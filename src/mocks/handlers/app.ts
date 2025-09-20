import { http, HttpResponse } from 'msw'
import { VFSBridge } from '../../lib/vfs/VFSBridge'
import { webvmManager, WebVMStaticAssetError } from '@/lib/webvm'
import { withProjectResolution } from './shared/project-resolution'
import { initializeVFS } from './shared/common-handlers'

// Initialize the VFS bridge
const vfsBridge = new VFSBridge()

/**
 * SPA (Single Page Application) hosting handler
 * Handles requests forwarded from Vite middleware via WebSocket
 */
const createSPAHandler = () => async ({ params: _params, request, projectInfo }: any) => {
  try {
    const path = new URL(request.url).pathname;
    const method = request.method;
    const userAgent = request.headers.get('user-agent');
    
    console.log('🌐 MSW: SPA request', { 
      path, 
      method, 
      projectId: projectInfo?.projectId,
      isAssetRequest: path.includes('.'),
      userAgent: userAgent ? userAgent.substring(0, 50) + '...' : 'none'
    });
    
    // Initialize VFS for the current project
    await initializeVFS(vfsBridge, projectInfo)
    
    const response = await vfsBridge.handleSPARequest({ path });
    
    console.log('✅ MSW: SPA served', { path, status: response.status });
    return response;
  } catch (error) {
    console.error('❌ MSW: SPA error:', error);
    return new HttpResponse(
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
};

const createWebVMStaticHandler = () =>
  async ({ params, request }: any) => {
    const method = request.method.toUpperCase();

    if (method !== 'GET' && method !== 'HEAD') {
      return new HttpResponse('Method Not Allowed', { status: 405 });
    }

    const appName = params.appName || 'default';
    const url = new URL(request.url);
    const basePath = `/api/app/${appName}`;
    let relativePath = url.pathname.slice(basePath.length);
    if (!relativePath.startsWith('/')) {
      relativePath = `/${relativePath}`;
    }

    try {
      const asset = await webvmManager.fetchStaticAsset(appName, relativePath);
      const headers = new Headers({
        'Content-Type': asset.contentType,
        'Cache-Control': 'no-cache',
      });

      if (method === 'HEAD') {
        return new HttpResponse(null, { status: asset.status, headers });
      }

      return new HttpResponse(asset.body, { status: asset.status, headers });
    } catch (error) {
      if (error instanceof WebVMStaticAssetError) {
        return new HttpResponse(error.message, {
          status: error.status,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

      console.error('MSW: WebVM static proxy error', error);
      return new HttpResponse('WebVM proxy failure', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  };

// App hosting handlers
export const appHandlers = [
  // SPA (Single Page Application) hosting
  http.get('/app/*', withProjectResolution(createSPAHandler())),
  http.get('/:projectId/app/*', withProjectResolution(createSPAHandler())),
  http.all('/api/app/:appName', withProjectResolution(createWebVMStaticHandler())),
  http.all('/api/app/:appName/*', withProjectResolution(createWebVMStaticHandler())),
]
