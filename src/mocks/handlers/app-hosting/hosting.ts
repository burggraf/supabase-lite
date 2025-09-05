import { HttpResponse } from 'msw'
import { VFSBridge } from '../../../lib/vfs/VFSBridge'
import { createGetRoutes } from '../shared/route-factory'
import { handleError, createGenericError } from '../shared/error-handling'
import { addCorsHeaders } from '../shared/cors'

const vfsBridge = new VFSBridge()

/**
 * Handler for /app/* routes
 * Serves Single Page Applications (SPAs) from VFS storage
 */
const createSPAHandler = async ({ params: _params, request, projectInfo }: any) => {
  try {
    const path = new URL(request.url).pathname
    const method = request.method
    const userAgent = request.headers.get('user-agent')
    
    console.log('🌐 MSW: SPA request', { 
      path, 
      method, 
      projectId: projectInfo?.projectId,
      isAssetRequest: path.includes('.'),
      userAgent: userAgent ? userAgent.substring(0, 50) + '...' : 'none'
    })
    
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId)
    }
    
    const response = await vfsBridge.handleSPARequest({ path })
    
    console.log('✅ MSW: SPA served', { path, status: response.status })
    return response
  } catch (error: any) {
    console.error('❌ MSW: SPA error:', error)
    return new HttpResponse(
      '<html><body><h1>Application Error</h1><p>Failed to serve the requested application.</p></body></html>',
      {
        status: 500,
        headers: addCorsHeaders({
          'Content-Type': 'text/html'
        })
      }
    )
  }
}

/**
 * Export app hosting handlers for SPAs
 */
export const appHostingHandlers = [
  // SPA hosting routes - handle requests forwarded from Vite middleware via WebSocket
  ...createGetRoutes('/app/*', createSPAHandler)
]