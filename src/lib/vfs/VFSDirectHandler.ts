/**
 * VFS Direct Handler - Handles direct file access bypassing MSW
 * This is used for signed URLs to avoid MSW binary response corruption
 */

import { vfsManager } from './VFSManager';
import { SignedUrlManager } from './SignedUrlManager';
import { logger } from '../infrastructure/Logger';
import { getBaseUrl } from '../utils';

export class VFSDirectHandler {
  private static instance: VFSDirectHandler;
  private signedUrlManager: SignedUrlManager;

  constructor() {
    this.signedUrlManager = SignedUrlManager.getInstance();
  }

  static getInstance(): VFSDirectHandler {
    if (!VFSDirectHandler.instance) {
      VFSDirectHandler.instance = new VFSDirectHandler();
    }
    return VFSDirectHandler.instance;
  }

  /**
   * Handle direct VFS file requests bypassing MSW
   */
  async handleRequest(url: string, method: string, headers: Record<string, string>): Promise<{
    status: number;
    headers: Record<string, string>;
    body: ArrayBuffer | string;
  }> {
    try {
      console.log('🔍 VFS Direct Handler:', { url, method });

      const urlObj = new URL(url, getBaseUrl());
      const pathParts = urlObj.pathname.split('/');
      
      // Parse URL: /vfs-direct/bucket/path/to/file?token=...
      if (pathParts.length < 4 || pathParts[1] !== 'vfs-direct') {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid VFS direct URL format' })
        };
      }

      const bucket = pathParts[2];
      const path = pathParts.slice(3).join('/');
      const token = urlObj.searchParams.get('token');

      console.log('🔍 Parsed VFS direct request:', { bucket, path, hasToken: !!token });

      if (!token) {
        return {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Token required' })
        };
      }

      // Validate the signed URL token
      const validation = await this.signedUrlManager.validateSignedUrl(token, 'download');
      if (!validation.isValid) {
        return {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: validation.error || 'Invalid token' })
        };
      }

      console.log('✅ Token validation successful');

      // Get the file from VFS
      const fullPath = `${bucket}/${path}`;
      const file = await vfsManager.readFile(fullPath);

      if (!file) {
        return {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'File not found' })
        };
      }

      console.log('📄 File found:', {
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        encoding: file.encoding,
        hasContent: !!file.content,
        contentLength: file.content?.length || 0
      });

      // Handle base64 encoded files
      if (file.encoding === 'base64' && file.content) {
        console.log('🔍 Decoding base64 file for direct serving');
        
        const binaryString = atob(file.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        console.log('✅ Base64 decoded, returning ArrayBuffer response');

        return {
          status: 200,
          headers: {
            'Content-Type': file.mimeType,
            'Content-Length': bytes.length.toString(),
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*'
          },
          body: bytes.buffer
        };
      }

      // Handle text files
      if (file.content) {
        console.log('📝 Handling text file');
        const encoder = new TextEncoder();
        const bytes = encoder.encode(file.content);

        return {
          status: 200,
          headers: {
            'Content-Type': file.mimeType || 'text/plain',
            'Content-Length': bytes.length.toString(),
            'Access-Control-Allow-Origin': '*'
          },
          body: bytes.buffer
        };
      }

      // Handle chunked files (large files split into chunks)
      if (file.chunked && file.chunkIds && file.chunkIds.length > 0) {
        console.log('🧩 Handling chunked file with', file.chunkIds.length, 'chunks');
        
        try {
          // Use VFS manager to load the complete content from chunks
          const content = await vfsManager.fileStorage.loadFileContent(fullPath);
          console.log('✅ Chunked content loaded:', { contentLength: content.length });
          
          // Handle content based on encoding
          if (file.encoding === 'base64') {
            console.log('🔍 Decoding base64 chunked content');
            const binaryString = atob(content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            console.log('✅ Chunked base64 decoded, returning ArrayBuffer response');
            
            return {
              status: 200,
              headers: {
                'Content-Type': file.mimeType,
                'Content-Length': bytes.length.toString(),
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*'
              },
              body: bytes.buffer
            };
          } else {
            // Handle text content
            console.log('📝 Handling chunked text content');
            const encoder = new TextEncoder();
            const bytes = encoder.encode(content);
            
            return {
              status: 200,
              headers: {
                'Content-Type': file.mimeType || 'text/plain',
                'Content-Length': bytes.length.toString(),
                'Access-Control-Allow-Origin': '*'
              },
              body: bytes.buffer
            };
          }
        } catch (chunkError) {
          console.error('❌ Failed to load chunked content:', chunkError);
          return {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              error: 'Failed to load chunked file content',
              message: chunkError instanceof Error ? chunkError.message : String(chunkError)
            })
          };
        }
      }

      // Handle files without content but with size (might be stored differently)
      if (file.size > 0) {
        console.log('⚠️  File has size but no content - might be stored as Blob or different format');
        console.log('File object keys:', Object.keys(file));
        
        // Check if it's stored as a blob URL or has data property
        if (file.data) {
          console.log('📦 Found file.data property');
          return {
            status: 200,
            headers: {
              'Content-Type': file.mimeType,
              'Content-Length': file.size.toString(),
              'Access-Control-Allow-Origin': '*'
            },
            body: file.data
          };
        }
      }

      console.error('❌ File content not available - no content, no data, or zero size');
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'File content not available',
          debug: {
            hasContent: !!file.content,
            hasData: !!file.data,
            size: file.size,
            encoding: file.encoding,
            keys: Object.keys(file)
          }
        })
      };

    } catch (error) {
      logger.error('VFS Direct Handler error', error as Error);
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' })
      };
    }
  }
}

// Export singleton instance
export const vfsDirectHandler = VFSDirectHandler.getInstance();