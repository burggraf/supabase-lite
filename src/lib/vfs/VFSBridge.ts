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
          console.log('🔍 Non-chunked base64 decoding:', {
            contentLength: file.content.length,
            contentPreview: file.content.substring(0, 50)
          });
          
          // Decode base64 content for binary files
          const binaryString = atob(file.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          content = bytes.buffer;
          
          // Debug: Check if the decoded data is valid
          console.log('🔍 Base64 decoding verification:');
          console.log('  Original base64 starts with:', file.content.substring(0, 50));
          console.log('  Binary string length:', binaryString.length);
          console.log('  Uint8Array length:', bytes.length);
          console.log('  ArrayBuffer byteLength:', bytes.buffer.byteLength);
          console.log('  First 20 decoded bytes:', Array.from(bytes.slice(0, 20)).join(', '));
          
          const actualBytes = Array.from(bytes.slice(0, 10));
          const expectedPngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
          const headerMatch = actualBytes.slice(0, 8).join(',') === expectedPngHeader.join(',');
          
          console.log('🔍 Base64 decode result:');
          console.log('  📏 Lengths:', {
            originalBase64Length: file.content.length,
            binaryLength: binaryString.length,
            bufferLength: bytes.buffer.byteLength
          });
          console.log('  🔢 First 10 bytes:', actualBytes.join(', '));
          console.log('  ✅ Expected PNG header:', expectedPngHeader.join(', '));
          console.log('  🎯 Header match:', headerMatch);
          console.log('  📝 Base64 sample:', file.content.substring(0, 30));
        } else {
          // Convert text content to ArrayBuffer for utf-8 files
          console.log('🔍 Converting text content to buffer');
          const encoder = new TextEncoder();
          content = encoder.encode(file.content).buffer;
        }
      } else {
        throw new Error('File content not available');
      }

      // Note: Cache headers would be applied here in a more complete implementation

      console.log('🔍 Final response debug:', {
        mimeType: file.mimeType,
        fileSize: file.size,
        contentSize: content.byteLength,
        sizeMismatch: file.size !== content.byteLength
      });

      // Last resort: Let's try the most basic approach possible
      console.log('🔍 Creating basic binary Response with minimal headers');
      
      try {
        // Handle chunked vs non-chunked files differently
        if (file.chunked && file.chunkIds) {
          console.log('✅ Chunked file - using pre-processed ArrayBuffer content');
          // For chunked files, content is already processed and ready to serve
          const response = new Response(content, {
            status: 200,
            headers: new Headers({
              'Content-Type': file.mimeType,
              'Content-Length': content.byteLength.toString(),
              'Accept-Ranges': 'bytes',
              'Access-Control-Allow-Origin': '*'
            })
          });
          
          return response;
        }
        
        // Try alternative approach for base64 non-chunked files
        else if (file.encoding === 'base64' && file.content) {
          console.log('🔍 Testing base64 data validity before serving');
          
          // Test if the base64 data is actually valid
          let isValidBase64 = false;
          try {
            // Quick base64 validation - try to decode a small sample for non-chunked files
            const sample = file.content.substring(0, 100);
            atob(sample);
            isValidBase64 = true;
            console.log('✅ Base64 sample validation passed');
          } catch (e) {
            console.error('❌ Base64 validation failed:', e);
            isValidBase64 = false;
          }
          
          if (!isValidBase64) {
            console.error('❌ Base64 data is invalid, cannot serve file');
            return new Response('Invalid base64 data', { status: 500 });
          }
          
          // Log some base64 statistics
          console.log('🔍 Base64 data analysis:', {
            totalLength: file.content.length,
            expectedDecodedSize: Math.floor(file.content.length * 3 / 4),
            actualFileSize: file.size,
            sizeMismatch: Math.abs(Math.floor(file.content.length * 3 / 4) - file.size) > 10,
            startsValid: file.content.match(/^[A-Za-z0-9+\/]/),
            hasValidPadding: file.content.endsWith('=') || file.content.endsWith('==') || file.content.length % 4 === 0
          });
          
          console.log('🔍 Trying alternative base64 Response approach');
          
          // Use data URL approach which browsers handle natively
          const dataUrl = `data:${file.mimeType};base64,${file.content}`;
          
          // Test the data URL first
          try {
            const testResponse = await fetch(dataUrl);
            const testBlob = await testResponse.blob();
            
            console.log('🔍 Data URL test result:', {
              fetchSuccess: true,
              blobSize: testBlob.size,
              blobType: testBlob.type,
              expectedSize: file.size,
              sizeMatch: testBlob.size === file.size
            });
            
            // Even though everything looks good, MSW might have issues with Blob responses
            // Let's use the direct ArrayBuffer approach instead
            console.log('🔍 Using direct ArrayBuffer approach for better MSW compatibility');
            const binaryString = atob(file.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Verify the decoded bytes still have correct PNG header
            const headerBytes = Array.from(bytes.slice(0, 8));
            console.log('🔍 Final verification - PNG header bytes:', headerBytes.join(', '));
            
            const response = new Response(bytes.buffer, {
              status: 200,
              headers: new Headers({
                'Content-Type': file.mimeType,
                'Content-Length': bytes.length.toString(),
                'Accept-Ranges': 'bytes',
              })
            });
            
            console.log('🔍 Created ArrayBuffer Response, size:', bytes.length);
            return response;
            
          } catch (dataUrlError) {
            console.error('❌ Data URL approach failed:', dataUrlError);
            
            // Fallback to manual decoding
            console.log('🔍 Falling back to manual base64 decoding');
            const binaryString = atob(file.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            const response = new Response(bytes, {
              status: 200,
              headers: new Headers({
                'Content-Type': file.mimeType,
                'Content-Length': bytes.length.toString(),
              })
            });
            
            return response;
          }
        }
        
        // Create the simplest possible Response with binary data
        const response = new Response(content, {
          status: 200,
          headers: new Headers({
            'Content-Type': file.mimeType,
            'Content-Length': content.byteLength.toString(),
          })
        });
        
        console.log('🔍 Response created successfully');
        return response;
        
      } catch (responseError) {
        console.error('🔍 Response creation failed:', responseError);
        
        // If that fails, return an error
        return new Response(
          JSON.stringify({
            error: 'binary_response_failed',
            message: 'Could not create binary response',
            details: responseError instanceof Error ? responseError.message : String(responseError)
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

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
        originalSize: file.size, // Preserve actual file size for proper display
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
   * Serves index.html for unmatched routes with multi-app support
   */
  async handleSPARequest(options: {
    path: string;
    userContext?: any;
  }): Promise<Response> {
    try {
      const { path } = options;
      
      // Parse the path to extract app name
      // Expected paths: /app/my-app/some/route or /app/my-app
      const pathParts = path.split('/').filter(part => part !== '');
      
      let appName = '';
      let appPath = '';
      
      if (pathParts.length >= 2 && pathParts[0] === 'app') {
        appName = pathParts[1];
        appPath = pathParts.slice(2).join('/'); // remaining path after /app/appname/
      } else if (pathParts.length === 1 && pathParts[0] === 'app') {
        // Just /app - show app listing or default
        return this.handleAppRootRequest();
      } else {
        // Invalid path format
        return new Response(
          '<html><body><h1>Invalid app path</h1><p>Use /app/[app-name] format</p></body></html>',
          {
            status: 400,
            headers: {
              'Content-Type': 'text/html',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Construct the full VFS path
      let vfsPath = `app/${appName}${appPath ? '/' + appPath : ''}`;
      
      // If no specific file is requested (just /app/appName), look for index.html
      if (!appPath || appPath === '') {
        vfsPath = `app/${appName}/index.html`;
      }
      
      console.log('🔍 VFS SPA Debug:', {
        originalPath: path,
        appName,
        appPath,
        vfsPath,
        isAssetFile: appPath && /\.[a-zA-Z0-9]+$/.test(appPath)
      });
      
      // Check if this is a request for a specific asset (has file extension)
      const hasFileExtension = appPath && /\.[a-zA-Z0-9]+$/.test(appPath);
      
      // Try to serve the exact file first
      const file = await this.vfsManager.readFile(vfsPath);
      console.log('🔍 File lookup result:', {
        vfsPath,
        fileFound: !!file,
        fileMimeType: file?.mimeType,
        hasFileExtension,
        isAssetRequest: hasFileExtension
      });
      
      // DEBUG: If file not found, check what files actually exist in the app bucket
      if (!file) {
        try {
          console.log('🐛 DEBUG: File not found, checking what exists in app bucket...');
          const appFiles = await this.vfsManager.listFiles('app', { recursive: true });
          console.log('🐛 DEBUG: Files in app bucket:', appFiles?.map(f => f.path) || 'NO FILES');
          
          // Also check if the bucket exists at all
          const buckets = await this.vfsManager.listBuckets();
          console.log('🐛 DEBUG: Available buckets:', buckets?.map(b => b.name) || 'NO BUCKETS');
        } catch (debugError) {
          console.log('🐛 DEBUG: Error checking VFS contents:', debugError);
        }
      }
      
      if (file) {
        console.log('🔍 Serving file via handleFileRequest:', {
          bucket: 'app',
          requestPath: `${appName}${appPath ? '/' + appPath : '/index.html'}`,
          actualFilePath: file.path
        });
        
        // If this is an HTML file, we need to rewrite asset paths
        console.log('🐛 VFS BRIDGE DEBUG - File check:', { 
          mimeType: file.mimeType, 
          hasContent: !!file.content, 
          isHtml: file.mimeType?.startsWith('text/html'),
          contentPreview: file.content ? file.content.substring(0, 200) : 'NO CONTENT'
        });
        
        if (file.mimeType?.startsWith('text/html') && file.content) {
          console.log('🐛 VFS BRIDGE - Entering HTML rewrite logic');
          let htmlContent = file.content;
          
          // Add base tag to ensure relative paths resolve correctly
          const baseTag = `<base href="/app/${appName}/">`;
          if (!htmlContent.includes('<base')) {
            htmlContent = htmlContent.replace('<head>', `<head>\n    ${baseTag}`);
            console.log('🐛 VFS BRIDGE - Added base tag');
          } else {
            console.log('🐛 VFS BRIDGE - Base tag already exists');
          }
          
          // Convert absolute paths to relative (they'll resolve against the base tag)
          const originalContent = htmlContent;
          htmlContent = htmlContent
            .replace(/href="\/assets\//g, `href="assets/`)
            .replace(/src="\/assets\//g, `src="assets/`)
            .replace(/href="\/([^"\/]*\.(css|js|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf))"/g, `href="$1"`)
            .replace(/src="\/([^"\/]*\.(js|svg|png|jpg|jpeg|gif|webp|ico))"/g, `src="$1"`);
          
          console.log('🐛 VFS BRIDGE - HTML rewrite result:', {
            changed: originalContent !== htmlContent,
            originalLength: originalContent.length,
            newLength: htmlContent.length,
            preview: htmlContent.substring(0, 300)
          });
          
          console.log('🔧 Added base tag and rewrote HTML asset paths for direct file serve:', { appName, baseTag, originalLength: file.content.length, newLength: htmlContent.length });
          
          console.log('🐛 FINAL HTML DEBUG - Content being served:', {
            title: htmlContent.match(/<title>(.*?)<\/title>/)?.[1] || 'NO TITLE',
            hasReactScript: htmlContent.includes('React'),
            hasViteScript: htmlContent.includes('Vite'),
            hasSupabaseScript: htmlContent.includes('Supabase'),
            fullContent: htmlContent
          });
          
          return new Response(htmlContent, {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        // For non-HTML files, use regular file serving
        return this.handleFileRequest({
          bucket: 'app',
          path: `${appName}${appPath ? '/' + appPath : '/index.html'}`,
          userContext: options.userContext,
        });
      }

      // If this is a request for a specific asset file and it doesn't exist, return 404
      if (hasFileExtension) {
        console.log('🔍 Asset not found, returning 404:', { appPath, vfsPath });
        return new Response(null, {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // For SPA routes (no file extension), try to serve index.html
      const indexPath = `app/${appName}/index.html`;
      const indexFile = await this.vfsManager.readFile(indexPath);
      
      if (!indexFile) {
        // App doesn't exist or no index.html
        return new Response(
          `<html><body><h1>App "${appName}" not found</h1><p>The requested application could not be found or is not deployed.</p></body></html>`,
          {
            status: 404,
            headers: {
              'Content-Type': 'text/html',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Rewrite asset paths in HTML to be relative to the app
      let htmlContent = indexFile.content;
      if (indexFile.mimeType === 'text/html') {
        // Add base tag to ensure relative paths resolve correctly
        const baseTag = `<base href="/app/${appName}/">`;
        if (!htmlContent.includes('<base')) {
          htmlContent = htmlContent.replace('<head>', `<head>\n    ${baseTag}`);
        }
        
        // Convert absolute paths to relative (they'll resolve against the base tag)
        htmlContent = htmlContent
          .replace(/href="\/assets\//g, `href="assets/`)
          .replace(/src="\/assets\//g, `src="assets/`)
          .replace(/href="\/([^"\/]*\.(css|js|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf))"/g, `href="$1"`)
          .replace(/src="\/([^"\/]*\.(js|svg|png|jpg|jpeg|gif|webp|ico))"/g, `src="$1"`);
        
        console.log('🔧 Added base tag and rewrote HTML asset paths for SPA route:', { appName, baseTag, originalLength: indexFile.content.length, newLength: htmlContent.length });
      }

      // Serve the app's index.html for SPA routing
      console.log('🔍 Serving index.html for SPA route:', { originalPath: path, appName, appPath });
      return new Response(htmlContent, {
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
   * Handle requests to /app root - show list of deployed apps
   */
  private async handleAppRootRequest(): Promise<Response> {
    try {
      // List all files in the app bucket to find deployed apps
      const files = await this.vfsManager.listFiles({ directory: 'app', recursive: false });
      
      // Find unique app names (directories in app/)
      const appNames = new Set<string>();
      files.forEach(file => {
        const pathParts = file.path.split('/');
        if (pathParts.length >= 2 && pathParts[0] === 'app') {
          appNames.add(pathParts[1]);
        }
      });

      const apps = Array.from(appNames);

      if (apps.length === 0) {
        return new Response(
          `<html>
            <head><title>Supabase Lite - App Hosting</title></head>
            <body style="font-family: system-ui; padding: 2rem; max-width: 600px; margin: 0 auto;">
              <h1>📱 App Hosting</h1>
              <p>No applications are currently deployed.</p>
              <p>Deploy your static web applications through the Supabase Lite dashboard.</p>
              <a href="/" style="color: #3b82f6;">← Back to Dashboard</a>
            </body>
          </html>`,
          {
            status: 200,
            headers: {
              'Content-Type': 'text/html',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      const appList = apps.map(name => 
        `<li><a href="/app/${name}" style="color: #3b82f6;">📱 ${name}</a></li>`
      ).join('\n');

      return new Response(
        `<html>
          <head><title>Supabase Lite - Deployed Apps</title></head>
          <body style="font-family: system-ui; padding: 2rem; max-width: 600px; margin: 0 auto;">
            <h1>📱 Deployed Applications</h1>
            <p>Select an application to launch:</p>
            <ul style="line-height: 2;">
              ${appList}
            </ul>
            <p><a href="/" style="color: #3b82f6;">← Back to Dashboard</a></p>
          </body>
        </html>`,
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    } catch (error) {
      logger.error('Failed to handle app root request', error as Error);
      return new Response(
        '<html><body><h1>Error loading applications</h1></body></html>',
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

    try {
      // Use VFSManager to assemble chunks - this handles the chunk reading and assembly
      const content = await this.vfsManager.readFileContent(file.path);
      
      if (!content) {
        throw new Error('Cannot load chunked file content');
      }
      
      console.log('🔍 Chunked content debug:', {
        path: file.path,
        encoding: file.encoding,
        contentLength: content.length,
        contentPreview: content.substring(0, 100)
      });
      
      // Handle content based on encoding
      if (file.encoding === 'base64') {
        // Decode base64 content for binary files
        console.log('🔍 Decoding base64 content...');
        const binaryString = atob(content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        console.log('🔍 Base64 decoded:', { originalLength: content.length, binaryLength: binaryString.length, arrayBufferLength: bytes.buffer.byteLength });
        return bytes.buffer;
      } else {
        // Convert text content to ArrayBuffer for utf-8 files
        console.log('🔍 Converting text content to ArrayBuffer');
        const encoder = new TextEncoder();
        const buffer = encoder.encode(content).buffer;
        console.log('🔍 Text conversion:', { contentLength: content.length, bufferLength: buffer.byteLength });
        return buffer;
      }
    } catch (error) {
      logger.error('Failed to assemble chunked content', error as Error, { path: file.path });
      throw new Error(`Failed to assemble chunked content: ${error instanceof Error ? error.message : String(error)}`);
    }
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
      const files = await this.vfsManager.listFiles({ directory: bucketId });
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

      // For move operations, duplicate the file record exactly and copy chunks
      console.log('🔍 Moving file - cloning file record exactly:', {
        originalSize: sourceFile.size,
        isChunked: sourceFile.chunked,
        encoding: sourceFile.encoding
      });

      // For move operations, get the raw content and recreate the file
      console.log('🔍 Moving file - preserving exact content without re-encoding:', {
        originalSize: sourceFile.size,
        encoding: sourceFile.encoding,
        chunked: sourceFile.chunked
      });

      let rawContent: string;
      
      if (sourceFile.chunked && sourceFile.chunkIds) {
        // For chunked files, load the full content using VFSManager
        console.log('🔍 Loading chunked file content using VFSManager');
        const content = await this.vfsManager.readFileContent(sourcePath);
        if (!content) {
          throw new Error('Cannot load chunked file content');
        }
        rawContent = content;
      } else {
        // For regular files, use the existing content
        rawContent = sourceFile.content || '';
      }

      // Delete source first
      await this.vfsManager.deleteFile(sourcePath);
      
      // Create destination file with exact same content and encoding
      await this.vfsManager.createFile(destinationPath, {
        content: rawContent,
        mimeType: sourceFile.mimeType,
        encoding: sourceFile.encoding, // Preserve original encoding to prevent double-encoding
        originalSize: sourceFile.size // Preserve actual file size for proper display
      });

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

      // For copy operations, use VFS methods to preserve exact content
      console.log('🔍 Copying file - preserving exact content:', {
        originalSize: sourceFile.size,
        isChunked: sourceFile.chunked,
        encoding: sourceFile.encoding
      });

      let rawContent: string;
      
      if (sourceFile.chunked && sourceFile.chunkIds) {
        // For chunked files, load the full content using VFSManager
        console.log('🔍 Loading chunked file content for copy using VFSManager');
        const content = await this.vfsManager.readFileContent(sourcePath);
        if (!content) {
          throw new Error('Cannot load chunked file content');
        }
        rawContent = content;
      } else {
        // For regular files, use the existing content
        rawContent = sourceFile.content || '';
      }

      // Create destination file with exact same content and encoding
      await this.vfsManager.createFile(destinationPath, {
        content: rawContent,
        mimeType: sourceFile.mimeType,
        encoding: sourceFile.encoding, // Preserve original encoding to prevent double-encoding
        originalSize: sourceFile.size // Preserve actual file size for proper display
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