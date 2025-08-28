/**
 * VFS Direct Handler - Handles direct file access bypassing MSW
 * This is used for signed URLs to avoid MSW binary response corruption
 */

import { vfsManager } from './VFSManager';
import { SignedUrlManager } from './SignedUrlManager';
import { logger } from '../infrastructure/Logger';

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

      const urlObj = new URL(url, 'http://localhost:5173');
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
        encoding: file.encoding
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

      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'File content not available' })
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