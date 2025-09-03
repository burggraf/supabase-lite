import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignedUrlManager } from '../SignedUrlManager';
// import { JWTService } from '../../auth/core/JWTService';
import type { SignedUrlOptions, SignedUploadUrlOptions } from '../../../types/signed-url';

// Mock the JWTService
const mockJWTService = {
  initialize: vi.fn(),
  generateCustomToken: vi.fn(() => Promise.resolve('mocked-jwt-token')),
  verifyToken: vi.fn(() => Promise.resolve({ sub: 'test-user' })),
};

vi.mock('../../auth/core/JWTService', () => ({
  JWTService: {
    getInstance: vi.fn(() => mockJWTService),
  },
}));

// Mock the logger
vi.mock('../../infrastructure/Logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SignedUrlManager', () => {
  let signedUrlManager: SignedUrlManager;
  const mockProjectId = 'test-project-123';
  const mockBucket = 'test-bucket';
  const mockPath = 'folder/test-file.jpg';

  beforeEach(async () => {
    // Clear any existing data
    vi.clearAllMocks();
    
    // Reset the singleton instance to get fresh instance
    // @ts-expect-error - Accessing private static member for testing
    SignedUrlManager.instance = undefined;
    
    // Get fresh instance for each test
    signedUrlManager = SignedUrlManager.getInstance();
    await signedUrlManager.initialize();
  });

  afterEach(() => {
    signedUrlManager.stopCleanup();
  });

  describe('createSignedUrl', () => {
    it('should create a signed URL successfully', async () => {
      const options: SignedUrlOptions = {
        expiresIn: 3600,
        download: false,
      };

      const result = await signedUrlManager.createSignedUrl(
        mockProjectId,
        mockBucket,
        mockPath,
        options
      );

      expect(result).toHaveProperty('signedUrl');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('expiresIn');
      expect(result.expiresIn).toBe(3600);
      expect(result.signedUrl).toContain(`/storage/v1/object/${mockBucket}/${mockPath}`);
      expect(result.signedUrl).toContain('token=');
    });

    it('should limit expiry time to maximum allowed', async () => {
      const options: SignedUrlOptions = {
        expiresIn: 999999, // Very large value
      };

      const result = await signedUrlManager.createSignedUrl(
        mockProjectId,
        mockBucket,
        mockPath,
        options
      );

      expect(result.expiresIn).toBeLessThanOrEqual(86400); // 24 hours max
    });

    it('should include transform options in signed URL', async () => {
      const options: SignedUrlOptions = {
        expiresIn: 3600,
        transform: {
          width: 300,
          height: 200,
          format: 'webp',
        },
      };

      const result = await signedUrlManager.createSignedUrl(
        mockProjectId,
        mockBucket,
        mockPath,
        options
      );

      expect(result.signedUrl).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should reject invalid project ID', async () => {
      const options: SignedUrlOptions = { expiresIn: 3600 };

      await expect(
        signedUrlManager.createSignedUrl('', mockBucket, mockPath, options)
      ).rejects.toThrow('Invalid project ID');

      await expect(
        signedUrlManager.createSignedUrl('   ', mockBucket, mockPath, options)
      ).rejects.toThrow('Invalid project ID');
    });

    it('should reject invalid bucket names', async () => {
      const options: SignedUrlOptions = { expiresIn: 3600 };

      await expect(
        signedUrlManager.createSignedUrl(mockProjectId, '', mockPath, options)
      ).rejects.toThrow('Invalid bucket name');

      await expect(
        signedUrlManager.createSignedUrl(mockProjectId, '-invalid-bucket', mockPath, options)
      ).rejects.toThrow('Invalid bucket name format');

      await expect(
        signedUrlManager.createSignedUrl(mockProjectId, 'invalid-bucket-', mockPath, options)
      ).rejects.toThrow('Invalid bucket name format');
    });

    it('should reject paths with directory traversal', async () => {
      const options: SignedUrlOptions = { expiresIn: 3600 };

      await expect(
        signedUrlManager.createSignedUrl(mockProjectId, mockBucket, '../malicious.txt', options)
      ).rejects.toThrow('Path contains invalid characters or patterns');

      await expect(
        signedUrlManager.createSignedUrl(mockProjectId, mockBucket, 'folder/../../../etc/passwd', options)
      ).rejects.toThrow('Path contains invalid characters or patterns');
    });

    it('should reject blocked file extensions', async () => {
      const options: SignedUrlOptions = { expiresIn: 3600 };
      const maliciousFiles = ['malware.exe', 'script.bat', 'virus.scr', 'trojan.com'];

      for (const file of maliciousFiles) {
        await expect(
          signedUrlManager.createSignedUrl(mockProjectId, mockBucket, file, options)
        ).rejects.toThrow('File type not allowed');
      }
    });

    it('should reject paths that are too long', async () => {
      const options: SignedUrlOptions = { expiresIn: 3600 };
      const longPath = 'a'.repeat(1025); // Longer than 1024 characters

      await expect(
        signedUrlManager.createSignedUrl(mockProjectId, mockBucket, longPath, options)
      ).rejects.toThrow('Path too long');
    });
  });

  describe('createSignedUploadUrl', () => {
    it('should create a signed upload URL successfully', async () => {
      const options: SignedUploadUrlOptions = {
        expiresIn: 1800,
        upsert: true,
      };

      const result = await signedUrlManager.createSignedUploadUrl(
        mockProjectId,
        mockBucket,
        mockPath,
        options
      );

      expect(result).toHaveProperty('signedUrl');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('expiresIn');
      expect(result.expiresIn).toBe(1800);
      expect(result.path).toBe(mockPath);
      expect(result.signedUrl).toContain(`/storage/v1/object/${mockBucket}/${mockPath}`);
    });

    it('should use default expiry when not specified', async () => {
      const result = await signedUrlManager.createSignedUploadUrl(
        mockProjectId,
        mockBucket,
        mockPath
      );

      expect(result.expiresIn).toBe(3600); // Default 1 hour
    });

    it('should apply the same security validations as download URLs', async () => {
      await expect(
        signedUrlManager.createSignedUploadUrl(mockProjectId, mockBucket, '../malicious.txt')
      ).rejects.toThrow('Path contains invalid characters or patterns');
    });
  });

  describe('validateSignedUrl', () => {
    it('should validate a valid signed URL token', async () => {
      const options: SignedUrlOptions = { expiresIn: 3600 };
      
      const signedUrlResponse = await signedUrlManager.createSignedUrl(
        mockProjectId,
        mockBucket,
        mockPath,
        options
      );

      const validation = await signedUrlManager.validateSignedUrl(
        signedUrlResponse.token!,
        'download'
      );

      expect(validation.isValid).toBe(true);
      expect(validation.metadata).toBeDefined();
      expect(validation.metadata!.bucket).toBe(mockBucket);
      expect(validation.metadata!.path).toBe(mockPath);
    });

    it('should reject non-existent tokens', async () => {
      const validation = await signedUrlManager.validateSignedUrl(
        'non-existent-token',
        'download'
      );

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Token not found');
    });

    it('should reject expired tokens', async () => {
      const options: SignedUrlOptions = { expiresIn: -1 }; // Already expired
      
      const signedUrlResponse = await signedUrlManager.createSignedUrl(
        mockProjectId,
        mockBucket,
        mockPath,
        options
      );

      // Wait a tiny bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const validation = await signedUrlManager.validateSignedUrl(
        signedUrlResponse.token!,
        'download'
      );

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Token expired');
    });
  });

  describe('revokeSignedUrl', () => {
    it('should revoke a signed URL successfully', async () => {
      const options: SignedUrlOptions = { expiresIn: 3600 };
      
      const signedUrlResponse = await signedUrlManager.createSignedUrl(
        mockProjectId,
        mockBucket,
        mockPath,
        options
      );

      const revoked = signedUrlManager.revokeSignedUrl(signedUrlResponse.token!, 'download');
      expect(revoked).toBe(true);

      // Should no longer be valid
      const validation = await signedUrlManager.validateSignedUrl(
        signedUrlResponse.token!,
        'download'
      );
      expect(validation.isValid).toBe(false);
    });

    it('should return false for non-existent tokens', () => {
      const revoked = signedUrlManager.revokeSignedUrl('non-existent-token', 'download');
      expect(revoked).toBe(false);
    });
  });

  describe('rate limiting', () => {
    it('should allow requests within rate limits', async () => {
      const options: SignedUrlOptions = { expiresIn: 3600 };

      // Should allow multiple requests within limits
      for (let i = 0; i < 5; i++) {
        await expect(
          signedUrlManager.createSignedUrl(mockProjectId, mockBucket, `file${i}.jpg`, options)
        ).resolves.toBeDefined();
      }
    });

    // Note: This test would be slow in practice due to rate limiting
    it('should reject requests that exceed rate limits', async () => {
      const options: SignedUrlOptions = { expiresIn: 3600 };
      const requests = [];

      // Create many requests to exceed rate limit (100 per minute)
      for (let i = 0; i < 102; i++) {
        requests.push(
          signedUrlManager.createSignedUrl(mockProjectId, mockBucket, `file${i}.jpg`, options)
        );
      }

      const results = await Promise.allSettled(requests);
      const rejected = results.filter(result => result.status === 'rejected');
      
      expect(rejected.length).toBeGreaterThan(0);
      expect(rejected[0].reason.message).toContain('Rate limit exceeded');
    }, 10000); // Longer timeout for this test
  });

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      const downloadOptions: SignedUrlOptions = { expiresIn: 3600 };
      const uploadOptions: SignedUploadUrlOptions = { expiresIn: 1800 };

      await signedUrlManager.createSignedUrl(mockProjectId, mockBucket, 'file1.jpg', downloadOptions);
      await signedUrlManager.createSignedUrl(mockProjectId, mockBucket, 'file2.jpg', downloadOptions);
      await signedUrlManager.createSignedUploadUrl(mockProjectId, mockBucket, 'upload1.jpg', uploadOptions);

      const stats = signedUrlManager.getStatistics();
      
      expect(stats.downloadUrls).toBe(2);
      expect(stats.uploadUrls).toBe(1);
      expect(stats.total).toBe(3);
    });
  });

  describe('buildTransformQuery', () => {
    it('should build query string from transform options', () => {
      const transform = {
        width: 300,
        height: 200,
        resize: 'cover' as const,
        quality: 80,
        format: 'webp' as const,
        rotate: 90,
      };

      const query = signedUrlManager.buildTransformQuery(transform);
      
      expect(query).toContain('&width=300');
      expect(query).toContain('&height=200');
      expect(query).toContain('&resize=cover');
      expect(query).toContain('&quality=80');
      expect(query).toContain('&format=webp');
      expect(query).toContain('&rotate=90');
    });

    it('should return empty string for undefined transform', () => {
      const query = signedUrlManager.buildTransformQuery(undefined);
      expect(query).toBe('');
    });

    it('should handle partial transform options', () => {
      const transform = {
        width: 300,
        quality: 90,
      };

      const query = signedUrlManager.buildTransformQuery(transform);
      
      expect(query).toContain('&width=300');
      expect(query).toContain('&quality=90');
      expect(query).not.toContain('height');
      expect(query).not.toContain('resize');
    });
  });
});