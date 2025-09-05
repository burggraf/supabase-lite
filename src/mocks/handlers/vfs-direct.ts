import { http } from 'msw'
import { VFSBridge } from '../../lib/vfs/VFSBridge'
import { withProjectResolution } from './shared/project-resolution'
import { 
  createErrorResponse,
  initializeVFS
} from './shared/common-handlers'

// Initialize the VFS bridge
const vfsBridge = new VFSBridge()

/**
 * VFS File Get Handler for direct file access
 */
const createVFSFileGetHandler = () => async ({ params, request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string;
    const path = params[0] as string; // Catch-all path parameter
    const rangeHeader = request.headers.get('range');
    
    // Parse URL to check for token parameter (for signed URLs)
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    console.log('📁 MSW: VFS direct file GET request', { bucket, path, token: !!token, range: rangeHeader, projectId: projectInfo?.projectId });
    
    // Initialize VFS for the current project
    await initializeVFS(vfsBridge, projectInfo)
    
    let response;
    if (token) {
      // Handle as authenticated/signed URL request
      response = await vfsBridge.handleAuthenticatedFileRequest({
        bucket,
        path,
        token,
      });
    } else {
      // Handle as regular file request
      response = await vfsBridge.handleFileRequest({
        bucket,
        path,
        range: rangeHeader || undefined,
      });
    }
    
    console.log('✅ MSW: VFS direct file served', { bucket, path, token: !!token, status: response.status });
    return response;
  } catch (error) {
    console.error('❌ MSW: VFS direct file GET error:', error);
    return createErrorResponse(
      'file_request_failed', 
      'Failed to serve file',
      500
    );
  }
};

// VFS Direct file access handlers
export const vfsDirectHandlers = [
  // Direct file access (public files)
  http.get('/files/:bucket/*', withProjectResolution(createVFSFileGetHandler())),
  http.get('/:projectId/files/:bucket/*', withProjectResolution(createVFSFileGetHandler())),
]