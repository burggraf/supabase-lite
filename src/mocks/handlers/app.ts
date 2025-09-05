import { http, HttpResponse } from 'msw'
import { VFSBridge } from '../../lib/vfs/VFSBridge'
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

// App hosting handlers
export const appHandlers = [
  // SPA (Single Page Application) hosting
  http.get('/app/*', withProjectResolution(createSPAHandler())),
  http.get('/:projectId/app/*', withProjectResolution(createSPAHandler())),
]