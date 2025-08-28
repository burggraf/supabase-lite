import { JWTService } from '../auth/core/JWTService';
import { logger } from '../infrastructure/Logger';
import type {
  SignedUrlOptions,
  SignedUrlMetadata,
  SignedUploadUrlOptions,
  SignedUploadUrlMetadata,
  SignedUrlResponse,
  SignedUploadUrlResponse,
  SignedUrlValidationResult,
  SignedUrlType,
  TransformOptions
} from '../../types/signed-url';

/**
 * SignedUrlManager manages signed URLs for secure file access
 * Provides JWT-based authentication for time-limited file operations
 */
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export class SignedUrlManager {
  private static instance: SignedUrlManager;
  private jwtService: JWTService;
  private signedUrls = new Map<string, SignedUrlMetadata>();
  private signedUploadUrls = new Map<string, SignedUploadUrlMetadata>();
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private cleanupInterval: number | null = null;
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute
  private readonly DEFAULT_EXPIRY = 3600; // 1 hour
  private readonly MAX_EXPIRY = 86400; // 24 hours
  // Rate limiting configuration
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute window
  private readonly RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window
  private readonly BLOCKED_PATTERNS = [
    /\.\./,           // Directory traversal
    /[<>:"\\|?*]/,    // Invalid filename characters
    /^\//,            // Absolute paths
    /\0/,             // Null bytes
  ];
  private readonly BLOCKED_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.scr',
    '.vbs', '.js', '.jar', '.pif', '.msi'
  ];

  private constructor() {
    this.jwtService = JWTService.getInstance();
    this.startCleanup();
  }

  static getInstance(): SignedUrlManager {
    if (!SignedUrlManager.instance) {
      SignedUrlManager.instance = new SignedUrlManager();
    }
    return SignedUrlManager.instance;
  }

  /**
   * Initialize the signed URL manager
   */
  async initialize(): Promise<void> {
    await this.jwtService.initialize();
    logger.info('SignedUrlManager initialized');
  }

  /**
   * Create a signed URL for downloading a file
   */
  async createSignedUrl(
    projectId: string,
    bucket: string,
    path: string,
    options: SignedUrlOptions
  ): Promise<SignedUrlResponse> {
    try {
      // Security validation
      await this.validateRequest(projectId, bucket, path);
      
      // Rate limiting
      await this.checkRateLimit(projectId);
      // Validate expiry time
      const expiresIn = Math.min(options.expiresIn, this.MAX_EXPIRY);
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Generate unique ID and token
      const id = this.generateId();
      const token = await this.generateJWT(projectId, bucket, path, 'download', expiresAt, {
        transform: options.transform,
        download: options.download
      });

      // Store signed URL metadata
      const metadata: SignedUrlMetadata = {
        id,
        bucket,
        path,
        token,
        expiresAt,
        transform: options.transform,
        download: options.download,
        createdAt: new Date(),
        projectId
      };

      this.signedUrls.set(token, metadata);

      // Build signed URL using a special endpoint that bypasses MSW
      const baseUrl = this.getBaseUrl();
      const signedUrl = `${baseUrl}/vfs-direct/${bucket}/${path}?token=${token}`;

      logger.info('Signed URL created', { bucket, path, expiresIn });

      return {
        signedUrl,
        token,
        expiresAt: expiresAt.toISOString(),
        expiresIn
      };

    } catch (error) {
      logger.error('Failed to create signed URL', error as Error, { bucket, path });
      throw new Error('Failed to create signed URL');
    }
  }

  /**
   * Create a signed URL for uploading a file
   */
  async createSignedUploadUrl(
    projectId: string,
    bucket: string,
    path: string,
    options: SignedUploadUrlOptions = {}
  ): Promise<SignedUploadUrlResponse> {
    try {
      // Security validation
      await this.validateRequest(projectId, bucket, path);
      
      // Rate limiting
      await this.checkRateLimit(projectId);
      // Validate expiry time
      const expiresIn = Math.min(options.expiresIn || this.DEFAULT_EXPIRY, this.MAX_EXPIRY);
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Generate unique ID and token
      const id = this.generateId();
      const token = await this.generateJWT(projectId, bucket, path, 'upload', expiresAt, {
        upsert: options.upsert
      });

      // Store signed upload URL metadata
      const metadata: SignedUploadUrlMetadata = {
        id,
        bucket,
        path,
        token,
        expiresAt,
        upsert: options.upsert || false,
        createdAt: new Date(),
        projectId
      };

      this.signedUploadUrls.set(token, metadata);

      // Build signed upload URL
      const baseUrl = this.getBaseUrl();
      const signedUrl = `${baseUrl}/storage/v1/object/${bucket}/${path}`;

      logger.info('Signed upload URL created', { bucket, path, expiresIn });

      return {
        signedUrl,
        token,
        path,
        expiresAt: expiresAt.toISOString(),
        expiresIn
      };

    } catch (error) {
      logger.error('Failed to create signed upload URL', error as Error, { bucket, path });
      throw new Error('Failed to create signed upload URL');
    }
  }

  /**
   * Validate a signed URL token
   */
  async validateSignedUrl(token: string, type: SignedUrlType = 'download'): Promise<SignedUrlValidationResult> {
    try {
      // Validate JWT signature and decode payload
      let payload;
      try {
        console.log('🔍 Validating JWT token:', token.substring(0, 50) + '...');
        payload = await this.jwtService.verifyToken(token);
        console.log('✅ JWT validation successful:', payload);
      } catch (error) {
        console.error('❌ JWT verification failed:', error);
        logger.error('JWT verification failed', error as Error);
        return { isValid: false, error: 'Invalid token signature' };
      }

      // Check expiration from JWT payload
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return { isValid: false, error: 'Token expired' };
      }

      // Check token type matches
      if (payload.type !== type) {
        return { isValid: false, error: 'Invalid token type' };
      }

      // Create metadata from JWT payload
      const metadata = {
        id: payload.jti || 'unknown',
        bucket: payload.bucket,
        path: payload.path,
        token,
        expiresAt: new Date(payload.exp * 1000),
        projectId: payload.sub?.split(':')[0] || 'default',
        createdAt: new Date(payload.iat * 1000)
      };

      return { isValid: true, metadata };
    } catch (error) {
      logger.error('Failed to validate signed URL', error as Error, { token: token.substring(0, 10) + '...' });
      return { isValid: false, error: 'Validation failed' };
    }
  }

  /**
   * Revoke a signed URL (remove from storage)
   */
  revokeSignedUrl(token: string, type: SignedUrlType = 'download'): boolean {
    if (type === 'download') {
      return this.signedUrls.delete(token);
    } else {
      return this.signedUploadUrls.delete(token);
    }
  }

  /**
   * Clean up expired signed URLs
   */
  private cleanupExpired(): void {
    const now = new Date();
    let cleanedCount = 0;

    // Clean up download URLs
    for (const [token, metadata] of this.signedUrls) {
      if (metadata.expiresAt < now) {
        this.signedUrls.delete(token);
        cleanedCount++;
      }
    }

    // Clean up upload URLs
    for (const [token, metadata] of this.signedUploadUrls) {
      if (metadata.expiresAt < now) {
        this.signedUploadUrls.delete(token);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired signed URLs`);
    }
  }

  /**
   * Start automatic cleanup of expired URLs
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, this.CLEANUP_INTERVAL) as unknown as number;
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Generate JWT token for signed URL
   */
  private async generateJWT(
    projectId: string,
    bucket: string,
    path: string,
    type: SignedUrlType,
    expiresAt: Date,
    metadata: any = {}
  ): Promise<string> {
    const payload = {
      sub: `${projectId}:storage`,
      aud: 'storage',
      iss: 'https://supabase-lite.local/auth/v1',
      bucket,
      path,
      type,
      exp: Math.floor(expiresAt.getTime() / 1000),
      iat: Math.floor(Date.now() / 1000),
      ...metadata
    };

    console.log('🔑 Generating JWT with payload:', payload);
    const token = await this.jwtService.generateCustomToken(payload);
    console.log('✅ JWT generated:', token.substring(0, 50) + '...');
    return token;
  }

  /**
   * Validate JWT token signature
   */
  private async validateJWT(token: string): Promise<boolean> {
    try {
      await this.jwtService.verifyToken(token);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate unique ID for signed URL
   */
  private generateId(): string {
    return `signed_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get base URL for signed URLs
   */
  private getBaseUrl(): string {
    // In browser environment, use current origin
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    // Fallback for testing - detect current port or use 5174
    return 'http://localhost:5174';
  }

  /**
   * Get statistics about signed URLs
   */
  getStatistics() {
    return {
      downloadUrls: this.signedUrls.size,
      uploadUrls: this.signedUploadUrls.size,
      total: this.signedUrls.size + this.signedUploadUrls.size
    };
  }

  /**
   * Build query parameters for transform options
   */
  buildTransformQuery(transform?: TransformOptions): string {
    if (!transform) return '';

    const params = new URLSearchParams();
    if (transform.width) params.set('width', transform.width.toString());
    if (transform.height) params.set('height', transform.height.toString());
    if (transform.resize) params.set('resize', transform.resize);
    if (transform.quality) params.set('quality', transform.quality.toString());
    if (transform.format) params.set('format', transform.format);
    if (transform.rotate) params.set('rotate', transform.rotate.toString());

    const queryString = params.toString();
    return queryString ? `&${queryString}` : '';
  }

  /**
   * Security validation for signed URL requests
   */
  private async validateRequest(projectId: string, bucket: string, path: string): Promise<void> {
    // Validate project ID
    if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
      throw new Error('Invalid project ID');
    }

    // Validate bucket name
    if (!bucket || typeof bucket !== 'string' || bucket.trim().length === 0) {
      throw new Error('Invalid bucket name');
    }

    if (bucket.length > 63 || bucket.startsWith('-') || bucket.endsWith('-')) {
      throw new Error('Invalid bucket name format');
    }

    // Validate path
    if (!path || typeof path !== 'string') {
      throw new Error('Invalid path');
    }

    // Check for blocked patterns
    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(path)) {
        logger.warn('Blocked path pattern detected', { path, pattern: pattern.source });
        throw new Error('Path contains invalid characters or patterns');
      }
    }

    // Check for blocked file extensions
    const extension = path.toLowerCase().substring(path.lastIndexOf('.'));
    if (this.BLOCKED_EXTENSIONS.includes(extension)) {
      logger.warn('Blocked file extension detected', { path, extension });
      throw new Error('File type not allowed');
    }

    // Path length validation
    if (path.length > 1024) {
      throw new Error('Path too long');
    }

    // Validate path segments
    const segments = path.split('/');
    for (const segment of segments) {
      if (segment.length === 0) continue; // Skip empty segments
      if (segment.length > 255) {
        throw new Error('Path segment too long');
      }
    }

    logger.debug('Security validation passed', { projectId, bucket, path });
  }

  /**
   * Rate limiting check
   */
  private async checkRateLimit(projectId: string): Promise<void> {
    const now = Date.now();
    const key = `rate_limit_${projectId}`;
    
    let entry = this.rateLimitMap.get(key);
    
    if (!entry || (now - entry.windowStart) > this.RATE_LIMIT_WINDOW) {
      // Create new window
      entry = {
        count: 1,
        windowStart: now
      };
    } else {
      // Check if within limits
      if (entry.count >= this.RATE_LIMIT_MAX_REQUESTS) {
        const remainingTime = this.RATE_LIMIT_WINDOW - (now - entry.windowStart);
        logger.warn('Rate limit exceeded', { 
          projectId, 
          count: entry.count, 
          limit: this.RATE_LIMIT_MAX_REQUESTS,
          remainingTime 
        });
        throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(remainingTime / 1000)} seconds`);
      }
      
      entry.count++;
    }
    
    this.rateLimitMap.set(key, entry);
    
    // Clean up old rate limit entries during check
    this.cleanupRateLimitEntries();
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupRateLimitEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.rateLimitMap) {
      if ((now - entry.windowStart) > this.RATE_LIMIT_WINDOW) {
        this.rateLimitMap.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} rate limit entries`);
    }
  }

  /**
   * Audit log for security events
   */
  // private auditLog(event: string, details: any): void {
  //   logger.info(`[SECURITY AUDIT] ${event}`, {
  //     timestamp: new Date().toISOString(),
  //     event,
  //     ...details
  //   });
  // }
}

// Export singleton instance
export const signedUrlManager = SignedUrlManager.getInstance();