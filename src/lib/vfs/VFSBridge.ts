import { VFSManager } from './VFSManager';
import { UTILS } from './constants';
import { logger } from '../infrastructure/Logger';
import type { VFSFile, VFSCreateFileOptions, VFSListOptions } from '../../types/vfs';

/**
 * VFS Bridge for MSW Handler Integration
 * 
 * Provides a bridge between MSW request handlers and the VFS system,
 * following the same patterns as SupabaseAPIBridge and AuthBridge.
 * Handles file serving, upload, and management operations.
 */
export class VFSBridge {
  private vfsManager: VFSManager;

  constructor(vfsManager?: VFSManager) {
    this.vfsManager = vfsManager || VFSManager.getInstance();
  }

  /**
   * Initialize VFS for a specific project
   */
  async initializeForProject(projectId: string): Promise<void> {
    await this.vfsManager.initialize(projectId);
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
        // Convert string content to ArrayBuffer
        const encoder = new TextEncoder();
        content = encoder.encode(file.content).buffer;
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

      // Convert file to text content
      const content = await file.text();

      // Create file in VFS
      const createOptions: VFSCreateFileOptions = {
        content,
        mimeType: file.type || UTILS.getMimeType(file.name),
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