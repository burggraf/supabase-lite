import { VFSManager } from './VFSManager';
import { SignedUrlManager } from './SignedUrlManager';
import { UTILS } from './constants';
import { logger } from '../infrastructure/Logger';
import type { VFSFile, VFSCreateFileOptions, VFSListOptions } from '../../types/vfs';
import type {
  SignedUrlOptions,
  SignedUploadUrlOptions,
  PublicUrlOptions,
} from '../../types/signed-url';

/**
 * VFS Bridge for MSW Handler Integration
 * 
 * Provides a bridge between MSW request handlers and the VFS system,
 * following the same patterns as SupabaseAPIBridge and AuthBridge.
 * Handles file serving, upload, and management operations.
 */
export class VFSBridge {
  private vfsManager: VFSManager;
  private signedUrlManager: SignedUrlManager;

  constructor(vfsManager?: VFSManager) {
    this.vfsManager = vfsManager || VFSManager.getInstance();
    this.signedUrlManager = SignedUrlManager.getInstance();
  }

  /**
   * Initialize VFS for a specific project
   */
  async initializeForProject(projectId: string): Promise<void> {
    await this.vfsManager.initialize(projectId);
    await this.signedUrlManager.initialize();
  }

  /**
   * Handle file serving requests
   */
  async handleFileRequest(options: {
    bucket: string;
    path: string;
    range?: string;
    userContext?: any;
  }): Promise<Response> {
    try {
      const { bucket, path, range } = options;
      const fullPath = `${bucket}/${path}`;

      // Get the file from VFS
      const file = await this.vfsManager.readFile(fullPath);
      
      if (!file) {
        return new Response(null, { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // Debug: Log file metadata
      console.log('🔍 File download debug:', {
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        encoding: file.encoding,
        contentLength: file.content?.length,
        isChunked: file.chunked
      });

      // Handle range requests for partial content (e.g., video streaming)
      if (range && file.content) {
        return this.handleRangeRequest(file, range);
      }

      // Get file content
      let content: ArrayBuffer;
      if (file.chunked && file.chunkIds) {
        // Assemble chunked content
        content = await this.assembleChunkedContent(file);
      } else if (file.content) {
        // Handle content based on encoding
        if (file.encoding === 'base64') {
          // Decode base64 content for binary files
          const binaryString = atob(file.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          content = bytes.buffer;
        } else {
          // Convert text content to ArrayBuffer for utf-8 files
          const encoder = new TextEncoder();
          content = encoder.encode(file.content).buffer;
        }
      } else {
        throw new Error('File content not available');
      }

      // Determine cache headers
      const cacheHeaders = this.getCacheHeaders(file);

      return new Response(content, {
        status: 200,
        headers: {
          'Content-Type': file.mimeType,
          'Content-Length': String(file.size),
          'Access-Control-Allow-Origin': '*',
          ...cacheHeaders,
        }
      });

    } catch (error) {
      logger.error('VFS file request failed', error as Error, { path: options.path });
      return new Response(
        JSON.stringify({
          error: 'file_request_failed',
          message: 'Failed to serve file'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }

  /**
   * Handle file upload requests
   */
  async handleUploadRequest(options: {
    bucket: string;
    path: string;
    formData: FormData;
    userContext?: any;
  }): Promise<Response> {
    try {
      const { bucket, path, formData } = options;
      const fullPath = `${bucket}/${path}`;

      // Get the uploaded file
      const file = formData.get('file') as File;
      if (!file) {
        return new Response(
          JSON.stringify({
            error: 'missing_file',
            message: 'No file provided in request'
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Convert file content based on MIME type
      let content: string;
      let encoding: 'utf-8' | 'base64' = 'utf-8';
      
      const mimeType = file.type || UTILS.getMimeType(file.name);
      const isTextFile = mimeType.startsWith('text/') || 
                        mimeType === 'application/json' || 
                        mimeType === 'application/xml' ||
                        mimeType === 'application/javascript' ||
                        mimeType === 'application/x-javascript';

      if (isTextFile) {
        // Text files can be stored as UTF-8
        content = await file.text();
        encoding = 'utf-8';
        console.log('🔍 Upload debug (text file):', { 
          fileName: file.name, 
          originalSize: file.size, 
          contentLength: content.length,
          encoding 
        });
      } else {
        // Binary files should be stored as base64
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const binaryString = Array.from(uint8Array)
          .map(byte => String.fromCharCode(byte))
          .join('');
        content = btoa(binaryString);
        encoding = 'base64';
        console.log('🔍 Upload debug (binary file):', { 
          fileName: file.name, 
          originalSize: file.size, 
          arrayBufferSize: arrayBuffer.byteLength,
          base64Length: content.length,
          encoding 
        });
      }

      // Create file in VFS
      const createOptions: VFSCreateFileOptions = {
        content,
        mimeType,
        encoding,
      };

      const vfsFile = await this.vfsManager.createFile(fullPath, createOptions);

      return new Response(
        JSON.stringify({
          id: vfsFile.id,
          path: vfsFile.path,
          name: vfsFile.name,
          size: vfsFile.size,
          mimeType: vfsFile.mimeType,
          createdAt: vfsFile.createdAt.toISOString(),
          updatedAt: vfsFile.updatedAt.toISOString(),
        }),
        {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      logger.error('VFS upload request failed', error as Error, { path: options.path });
      
      // Handle specific errors
      if ((error as Error).message.includes('already exists')) {
        return new Response(
          JSON.stringify({
            error: 'duplicate_file',
            message: 'File already exists'
          }),
          {
            status: 409,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: 'upload_failed',
          message: 'Failed to upload file'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }

  /**
   * Handle file deletion requests
   */
  async handleDeleteRequest(options: {
    bucket: string;
    path: string;
    userContext?: any;
  }): Promise<Response> {
    try {
      const { bucket, path } = options;
      const fullPath = `${bucket}/${path}`;

      const success = await this.vfsManager.deleteFile(fullPath);
      
      if (!success) {
        return new Response(null, {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error) {
      logger.error('VFS delete request failed', error as Error, { path: options.path });
      return new Response(
        JSON.stringify({
          error: 'delete_failed',
          message: 'Failed to delete file'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }

  /**
   * Handle directory listing requests
   */
  async handleListRequest(options: {
    bucket: string;
    prefix?: string;
    limit?: number;
    offset?: number;
    userContext?: any;
  }): Promise<Response> {
    try {
      const { bucket, prefix = '', limit = 100, offset = 0 } = options;
      const directory = prefix ? `${bucket}/${prefix}` : bucket;

      const listOptions: VFSListOptions = {
        directory,
        limit,
        offset,
      };

      const files = await this.vfsManager.listFiles(listOptions);

      // Transform to storage API format
      const objects = files.map(file => ({
        id: file.id,
        name: file.name,
        path: file.path.replace(`${bucket}/`, ''), // Remove bucket prefix
        size: file.size,
        mime_type: file.mimeType,
        created_at: file.createdAt.toISOString(),
        updated_at: file.updatedAt.toISOString(),
      }));

      return new Response(
        JSON.stringify(objects),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      logger.error('VFS list request failed', error as Error, { bucket: options.bucket });
      return new Response(
        JSON.stringify({
          error: 'list_failed',
          message: 'Failed to list files'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }

  /**
   * Handle SPA (Single Page Application) routing
   * Serves index.html for unmatched routes
   */
  async handleSPARequest(options: {
    path: string;
    userContext?: any;
  }): Promise<Response> {
    try {
      const { path } = options;

      // Try to serve the exact file first
      const file = await this.vfsManager.readFile(path);
      if (file) {
        return this.handleFileRequest({
          bucket: 'app',
          path: path.replace('app/', ''),
          userContext: options.userContext,
        });
      }

      // Fallback to index.html for SPA routing
      const indexFile = await this.vfsManager.readFile('app/index.html');
      if (!indexFile) {
        return new Response(
          '<html><body><h1>No application deployed</h1></body></html>',
          {
            status: 404,
            headers: {
              'Content-Type': 'text/html',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      return new Response(indexFile.content, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache', // Don't cache SPA routes
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error) {
      logger.error('VFS SPA request failed', error as Error, { path: options.path });
      return new Response(
        '<html><body><h1>Application Error</h1></body></html>',
        {
          status: 500,
          headers: {
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }

  /**
   * Handle range requests for partial content delivery
   */
  private async handleRangeRequest(file: VFSFile, rangeHeader: string): Promise<Response> {
    const range = this.parseRangeHeader(rangeHeader, file.size);
    
    if (!range) {
      return new Response('Invalid range', {
        status: 416,
        headers: {
          'Content-Range': `bytes */${file.size}`,
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const { start, end } = range;
    const contentLength = end - start + 1;

    // Get partial content
    let fullContent: string;
    if (file.chunked && file.chunkIds) {
      const buffer = await this.assembleChunkedContent(file);
      fullContent = new TextDecoder().decode(buffer);
    } else {
      fullContent = file.content || '';
    }

    const partialContent = fullContent.slice(start, end + 1);
    const contentBuffer = new TextEncoder().encode(partialContent).buffer;

    return new Response(contentBuffer, {
      status: 206,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Range': `bytes ${start}-${end}/${file.size}`,
        'Content-Length': String(contentLength),
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  /**
   * Parse HTTP Range header
   */
  private parseRangeHeader(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) return null;

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      return null;
    }

    return { start, end };
  }

  /**
   * Assemble chunked content into ArrayBuffer
   */
  private async assembleChunkedContent(file: VFSFile): Promise<ArrayBuffer> {
    if (!file.chunkIds || file.chunkIds.length === 0) {
      throw new Error('No chunks available for chunked file');
    }

    // This would need to be implemented to read chunks from FileStorage
    // For now, return the content as is
    if (file.content) {
      return new TextEncoder().encode(file.content).buffer;
    }

    throw new Error('Chunked content assembly not implemented');
  }

  /**
   * Handle signed URL creation requests
   */
  async handleCreateSignedUrlRequest(options: {
    bucket: string;
    path: string;
    signedUrlOptions: SignedUrlOptions;
    projectId: string;
    userContext?: any;
  }): Promise<Response> {
    try {
      const { bucket, path, signedUrlOptions, projectId } = options;
      const fullPath = `${bucket}/${path}`;

      // Check if file exists
      const file = await this.vfsManager.readFile(fullPath);
      if (!file) {
        return new Response(
          JSON.stringify({
            error: 'file_not_found',
            message: 'File not found'
          }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Check bucket permissions
      const bucketInfo = await this.vfsManager.getBucket(bucket);
      if (!bucketInfo) {
        return new Response(
          JSON.stringify({
            error: 'bucket_not_found',
            message: 'Bucket not found'
          }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Create signed URL
      const signedUrlResponse = await this.signedUrlManager.createSignedUrl(
        projectId,
        bucket,
        path,
        signedUrlOptions
      );

      return new Response(
        JSON.stringify(signedUrlResponse),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      logger.error('Failed to create signed URL', error as Error, { 
        bucket: options.bucket, 
        path: options.path 
      });
      return new Response(
        JSON.stringify({
          error: 'signed_url_creation_failed',
          message: 'Failed to create signed URL'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }

  /**
   * Handle signed upload URL creation requests
   */
  async handleCreateSignedUploadUrlRequest(options: {
    bucket: string;
    path: string;
    signedUploadUrlOptions: SignedUploadUrlOptions;
    projectId: string;
    userContext?: any;
  }): Promise<Response> {
    try {
      const { bucket, path, signedUploadUrlOptions, projectId } = options;

      // Check bucket permissions
      const bucketInfo = await this.vfsManager.getBucket(bucket);
      if (!bucketInfo) {
        return new Response(
          JSON.stringify({
            error: 'bucket_not_found',
            message: 'Bucket not found'
          }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Create signed upload URL
      const signedUploadResponse = await this.signedUrlManager.createSignedUploadUrl(
        projectId,
        bucket,
        path,
        signedUploadUrlOptions
      );

      return new Response(
        JSON.stringify(signedUploadResponse),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      logger.error('Failed to create signed upload URL', error as Error, { 
        bucket: options.bucket, 
        path: options.path 
      });
      return new Response(
        JSON.stringify({
          error: 'signed_upload_url_creation_failed',
          message: 'Failed to create signed upload URL'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }

  /**
   * Handle public URL requests
   */
  async handlePublicUrlRequest(options: {
    bucket: string;
    path: string;
    publicUrlOptions?: PublicUrlOptions;
    userContext?: any;
  }): Promise<Response> {
    try {
      const { bucket, path } = options;
      // const publicUrlOptions = options.publicUrlOptions || {};

      // Check if bucket is public
      const bucketInfo = await this.vfsManager.getBucket(bucket);
      if (!bucketInfo || !bucketInfo.isPublic) {
        return new Response(
          JSON.stringify({
            error: 'access_denied',
            message: 'Bucket is not public or does not exist'
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Serve file directly for public access
      return await this.handleFileRequest({
        bucket,
        path,
        userContext: options.userContext
      });

    } catch (error) {
      logger.error('Failed to handle public URL request', error as Error, { 
        bucket: options.bucket, 
        path: options.path 
      });
      return new Response(
        JSON.stringify({
          error: 'public_url_request_failed',
          message: 'Failed to handle public URL request'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }

  /**
   * Handle authenticated file requests (with signed URLs)
   */
  async handleAuthenticatedFileRequest(options: {
    bucket: string;
    path: string;
    token?: string;
    userContext?: any;
  }): Promise<Response> {
    try {
      const { bucket, path, token } = options;

      // If no token, deny access
      if (!token) {
        return new Response(
          JSON.stringify({
            error: 'authentication_required',
            message: 'Token required for authenticated access'
          }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Validate the signed URL token
      const validation = await this.signedUrlManager.validateSignedUrl(token, 'download');
      if (!validation.isValid) {
        return new Response(
          JSON.stringify({
            error: 'invalid_token',
            message: validation.error || 'Invalid or expired token'
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Check if token is for this specific file
      const metadata = validation.metadata!;
      if (metadata.bucket !== bucket || metadata.path !== path) {
        return new Response(
          JSON.stringify({
            error: 'token_mismatch',
            message: 'Token not valid for this file'
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Serve the file with any transform options
      return await this.handleFileRequest({
        bucket,
        path,
        userContext: options.userContext
      });

    } catch (error) {
      logger.error('Failed to handle authenticated file request', error as Error, { 
        bucket: options.bucket, 
        path: options.path 
      });
      return new Response(
        JSON.stringify({
          error: 'authenticated_request_failed',
          message: 'Failed to handle authenticated request'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }

  /**
   * Handle bucket creation requests
   */
  async handleCreateBucketRequest(options: {
    id: string;
    name: string;
    public: boolean;
    file_size_limit?: number;
    allowed_mime_types?: string[];
    avif_autodetection?: boolean;
  }): Promise<Response> {
    try {
      const { id, name, public: isPublic, file_size_limit, allowed_mime_types } = options;
      
      logger.info('Creating bucket', { id, name, isPublic });
      
      const bucket = await this.vfsManager.createBucket(id, {
        isPublic,
        maxFileSize: file_size_limit,
        allowedMimeTypes: allowed_mime_types || []
      });

      const bucketData = {
        id: bucket.id,
        name: bucket.name || bucket.id,
        owner: null, // Not implemented in browser context
        public: bucket.isPublic,
        created_at: bucket.createdAt.toISOString(),
        updated_at: bucket.updatedAt.toISOString(),
        file_size_limit: bucket.maxFileSize,
        allowed_mime_types: bucket.allowedMimeTypes,
        avif_autodetection: false // Not implemented in VFS layer
      };

      return new Response(JSON.stringify(bucketData), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      logger.error('Bucket creation failed', error as Error, { bucketId: options.id });
      const errorMessage = (error as Error).message;
      
      // Handle duplicate bucket error
      if (errorMessage.includes('already exists')) {
        return new Response(JSON.stringify({
          error: 'already_exists',
          message: `Bucket ${options.id} already exists`
        }), {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      return new Response(JSON.stringify({
        error: 'bucket_creation_failed',
        message: errorMessage
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  /**
   * Handle bucket listing requests
   */
  async handleListBucketsRequest(): Promise<Response> {
    try {
      logger.info('Listing buckets');
      
      const buckets = await this.vfsManager.listBuckets();
      const bucketData = buckets.map(bucket => ({
        id: bucket.id,
        name: bucket.name || bucket.id,
        owner: null, // Not implemented in browser context
        public: bucket.isPublic,
        created_at: bucket.createdAt.toISOString(),
        updated_at: bucket.updatedAt.toISOString(),
        file_size_limit: bucket.maxFileSize,
        allowed_mime_types: bucket.allowedMimeTypes,
        avif_autodetection: false // Not implemented in VFS layer
      }));

      return new Response(JSON.stringify(bucketData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      logger.error('Bucket listing failed', error as Error);
      return new Response(JSON.stringify({
        error: 'bucket_listing_failed',
        message: (error as Error).message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  /**
   * Handle get bucket details requests
   */
  async handleGetBucketRequest(options: { bucketId: string }): Promise<Response> {
    try {
      const { bucketId } = options;
      
      logger.info('Getting bucket details', { bucketId });
      
      const bucket = await this.vfsManager.getBucket(bucketId);
      if (!bucket) {
        return new Response(JSON.stringify({
          error: 'bucket_not_found',
          message: `Bucket ${bucketId} not found`
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const bucketData = {
        id: bucket.id,
        name: bucket.name || bucket.id,
        owner: null, // Not implemented in browser context
        public: bucket.isPublic,
        created_at: bucket.createdAt.toISOString(),
        updated_at: bucket.updatedAt.toISOString(),
        file_size_limit: bucket.maxFileSize,
        allowed_mime_types: bucket.allowedMimeTypes,
        avif_autodetection: false // Not implemented in VFS layer
      };

      return new Response(JSON.stringify(bucketData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      logger.error('Bucket get failed', error as Error, { bucketId: options.bucketId });
      return new Response(JSON.stringify({
        error: 'bucket_get_failed',
        message: (error as Error).message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  /**
   * Handle bucket update requests
   */
  async handleUpdateBucketRequest(options: { 
    bucketId: string; 
    updates: {
      public?: boolean;
      file_size_limit?: number;
      allowed_mime_types?: string[];
      avif_autodetection?: boolean;
    };
  }): Promise<Response> {
    try {
      const { bucketId, updates } = options;
      
      logger.info('Updating bucket', { bucketId, updates });
      
      const updateOptions: any = {};
      if (updates.public !== undefined) updateOptions.isPublic = updates.public;
      if (updates.file_size_limit !== undefined) updateOptions.maxFileSize = updates.file_size_limit;
      if (updates.allowed_mime_types !== undefined) updateOptions.allowedMimeTypes = updates.allowed_mime_types;

      const bucket = await this.vfsManager.updateBucket(bucketId, updateOptions);

      const bucketData = {
        id: bucket.id,
        name: bucket.name || bucket.id,
        owner: null, // Not implemented in browser context
        public: bucket.isPublic,
        created_at: bucket.createdAt.toISOString(),
        updated_at: bucket.updatedAt.toISOString(),
        file_size_limit: bucket.maxFileSize,
        allowed_mime_types: bucket.allowedMimeTypes,
        avif_autodetection: false // Not implemented in VFS layer
      };

      return new Response(JSON.stringify(bucketData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      logger.error('Bucket update failed', error as Error, { bucketId: options.bucketId });
      const errorMessage = (error as Error).message;
      
      // Handle bucket not found error
      if (errorMessage.includes('not found')) {
        return new Response(JSON.stringify({
          error: 'bucket_not_found',
          message: `Bucket ${options.bucketId} not found`
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      return new Response(JSON.stringify({
        error: 'bucket_update_failed',
        message: errorMessage
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  /**
   * Handle bucket deletion requests
   */
  async handleDeleteBucketRequest(options: { bucketId: string }): Promise<Response> {
    try {
      const { bucketId } = options;
      
      logger.info('Deleting bucket', { bucketId });
      
      const success = await this.vfsManager.deleteBucket(bucketId, true); // force delete
      
      if (!success) {
        return new Response(JSON.stringify({
          error: 'bucket_not_found',
          message: `Bucket ${bucketId} not found`
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      return new Response(JSON.stringify({
        message: `Bucket ${bucketId} deleted successfully`
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      logger.error('Bucket deletion failed', error as Error, { bucketId: options.bucketId });
      const errorMessage = (error as Error).message;
      
      // Handle bucket not empty error
      if (errorMessage.includes('not empty')) {
        return new Response(JSON.stringify({
          error: 'bucket_not_empty',
          message: `Bucket ${options.bucketId} is not empty. Use force delete or empty the bucket first.`
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      return new Response(JSON.stringify({
        error: 'bucket_deletion_failed',
        message: errorMessage
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  /**
   * Handle bucket empty requests
   */
  async handleEmptyBucketRequest(options: { bucketId: string }): Promise<Response> {
    try {
      const { bucketId } = options;
      
      logger.info('Emptying bucket', { bucketId });
      
      // Check if bucket exists first
      const bucket = await this.vfsManager.getBucket(bucketId);
      if (!bucket) {
        return new Response(JSON.stringify({
          error: 'bucket_not_found',
          message: `Bucket ${bucketId} not found`
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // List all files in the bucket and delete them
      const files = await this.vfsManager.listFiles(bucketId);
      const deletePromises = files.map(file => 
        this.vfsManager.deleteFile(file.path)
      );
      
      await Promise.all(deletePromises);
      
      // Update bucket stats
      await this.vfsManager.updateBucketStats(bucketId);

      return new Response(JSON.stringify({
        message: `Bucket ${bucketId} emptied successfully`
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      logger.error('Bucket empty failed', error as Error, { bucketId: options.bucketId });
      return new Response(JSON.stringify({
        error: 'bucket_empty_failed',
        message: (error as Error).message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  /**
   * Handle file move requests
   */
  async handleMoveFileRequest(options: {
    bucket: string;
    sourceKey: string;
    destinationKey: string;
  }): Promise<Response> {
    try {
      const { bucket, sourceKey, destinationKey } = options;
      const sourcePath = `${bucket}/${sourceKey}`;
      const destinationPath = `${bucket}/${destinationKey}`;

      logger.info('Moving file', { sourcePath, destinationPath });

      // Check if source file exists
      const sourceFile = await this.vfsManager.readFile(sourcePath);
      if (!sourceFile) {
        return new Response(JSON.stringify({
          error: 'file_not_found',
          message: `Source file ${sourceKey} not found`
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // Create the file at destination
      await this.vfsManager.createFile(destinationPath, {
        content: sourceFile.content || '',
        mimeType: sourceFile.mimeType
      });

      // Delete the source file
      await this.vfsManager.deleteFile(sourcePath);

      // Update bucket stats
      await this.vfsManager.updateBucketStats(bucket);

      return new Response(JSON.stringify({
        message: `File moved from ${sourceKey} to ${destinationKey}`
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      logger.error('File move failed', error as Error, options);
      return new Response(JSON.stringify({
        error: 'file_move_failed',
        message: (error as Error).message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  /**
   * Handle file copy requests
   */
  async handleCopyFileRequest(options: {
    bucket: string;
    sourceKey: string;
    destinationKey: string;
  }): Promise<Response> {
    try {
      const { bucket, sourceKey, destinationKey } = options;
      const sourcePath = `${bucket}/${sourceKey}`;
      const destinationPath = `${bucket}/${destinationKey}`;

      logger.info('Copying file', { sourcePath, destinationPath });

      // Check if source file exists
      const sourceFile = await this.vfsManager.readFile(sourcePath);
      if (!sourceFile) {
        return new Response(JSON.stringify({
          error: 'file_not_found',
          message: `Source file ${sourceKey} not found`
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // Create the file at destination
      await this.vfsManager.createFile(destinationPath, {
        content: sourceFile.content || '',
        mimeType: sourceFile.mimeType
      });

      // Update bucket stats
      await this.vfsManager.updateBucketStats(bucket);

      const destinationFile = await this.vfsManager.readFile(destinationPath);

      return new Response(JSON.stringify({
        path: destinationKey,
        id: destinationFile?.id,
        fullPath: destinationPath
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      logger.error('File copy failed', error as Error, options);
      return new Response(JSON.stringify({
        error: 'file_copy_failed',
        message: (error as Error).message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  /**
   * Handle batch delete requests
   */
  async handleBatchDeleteRequest(options: {
    bucket: string;
    prefixes: string[];
  }): Promise<Response> {
    try {
      const { bucket, prefixes } = options;

      logger.info('Batch deleting files', { bucket, prefixCount: prefixes.length });

      const deletedFiles: any[] = [];
      const errors: any[] = [];

      for (const prefix of prefixes) {
        try {
          const filePath = `${bucket}/${prefix}`;
          const file = await this.vfsManager.readFile(filePath);
          
          if (file) {
            await this.vfsManager.deleteFile(filePath);
            deletedFiles.push({
              name: prefix,
              id: file.id,
              created_at: file.createdAt.toISOString(),
              updated_at: file.updatedAt.toISOString(),
              size: file.size,
              metadata: {}
            });
          } else {
            errors.push({
              path: prefix,
              error: 'file_not_found',
              message: `File ${prefix} not found`
            });
          }
        } catch (error) {
          errors.push({
            path: prefix,
            error: 'delete_failed',
            message: (error as Error).message
          });
        }
      }

      // Update bucket stats
      if (deletedFiles.length > 0) {
        await this.vfsManager.updateBucketStats(bucket);
      }

      // Return array of deleted files (compatible with Supabase format)
      return new Response(JSON.stringify(deletedFiles), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      logger.error('Batch delete failed', error as Error, options);
      return new Response(JSON.stringify({
        error: 'batch_delete_failed',
        message: (error as Error).message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  /**
   * Get cache headers for file responses
   */
  private getCacheHeaders(file: VFSFile): Record<string, string> {
    const headers: Record<string, string> = {};

    // ETag based on file hash
    if (file.hash) {
      headers['ETag'] = `"${file.hash}"`;
    }

    // Last-Modified
    headers['Last-Modified'] = file.updatedAt.toUTCString();

    // Cache-Control based on file type
    if (UTILS.shouldCompress(file.mimeType)) {
      // Text files: cache for 1 hour
      headers['Cache-Control'] = 'public, max-age=3600';
    } else {
      // Binary files: cache for 1 day
      headers['Cache-Control'] = 'public, max-age=86400';
    }

    return headers;
  }
}

// Export singleton instance
export const vfsBridge = new VFSBridge();