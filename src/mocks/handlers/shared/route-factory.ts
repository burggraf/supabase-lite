import { http, type RequestHandler } from 'msw'
import { resolveAndSwitchToProject, normalizeApiPath } from './project-resolution'
import { HttpResponse } from 'msw'

/**
 * Higher-order function that wraps handlers with project resolution
 * Extracts project ID from URL and switches to the correct database before handling the request
 */
function withProjectResolution<T extends Parameters<typeof http.get>[1]>(
  handler: T
): T {
  return (async ({ params, request, ...rest }) => {
    const url = new URL(request.url)
    
    // Resolve and switch to the appropriate project database
    const resolution = await resolveAndSwitchToProject(url)
    
    if (!resolution.success) {
      console.error(`❌ MSW: Project resolution failed for ${url.pathname}:`, resolution.error)
      return HttpResponse.json(
        { error: 'Project not found', message: resolution.error },
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    // Normalize the URL to remove project identifier for the handler
    const normalizedUrl = normalizeApiPath(url)
    const normalizedRequest = new Request(normalizedUrl, request)

    // Call the original handler with normalized parameters and project info
    const result = await handler({ 
      params, 
      request: normalizedRequest, 
      projectInfo: {
        projectId: resolution.projectId,
        projectName: resolution.projectName
      },
      ...rest 
    } as any)
    
    return result
  }) as T
}

/**
 * Type for handler functions that accept project info
 */
export interface HandlerWithProjectInfo {
  (context: {
    params: Record<string, string>
    request: Request
    projectInfo?: {
      projectId: string
      projectName: string
    }
    [key: string]: any
  }): Promise<Response> | Response
}

/**
 * Creates both regular and project-specific routes for a given path and handler
 * This eliminates the duplication between /api/v1/... and /:projectId/api/v1/... routes
 */
export function createDualRoutes(
  method: 'get' | 'post' | 'patch' | 'put' | 'delete' | 'head' | 'options' | 'all',
  path: string,
  handler: HandlerWithProjectInfo
): RequestHandler[] {
  const wrappedHandler = withProjectResolution(handler as any)
  
  return [
    http[method](path, wrappedHandler),
    http[method](`/:projectId${path}`, wrappedHandler)
  ]
}

/**
 * Convenience functions for each HTTP method
 */
export const createGetRoutes = (path: string, handler: HandlerWithProjectInfo) =>
  createDualRoutes('get', path, handler)

export const createPostRoutes = (path: string, handler: HandlerWithProjectInfo) =>
  createDualRoutes('post', path, handler)

export const createPatchRoutes = (path: string, handler: HandlerWithProjectInfo) =>
  createDualRoutes('patch', path, handler)

export const createPutRoutes = (path: string, handler: HandlerWithProjectInfo) =>
  createDualRoutes('put', path, handler)

export const createDeleteRoutes = (path: string, handler: HandlerWithProjectInfo) =>
  createDualRoutes('delete', path, handler)

export const createHeadRoutes = (path: string, handler: HandlerWithProjectInfo) =>
  createDualRoutes('head', path, handler)

export const createAllRoutes = (path: string, handler: HandlerWithProjectInfo) =>
  createDualRoutes('all', path, handler)

// Export the withProjectResolution function for backwards compatibility
export { withProjectResolution }