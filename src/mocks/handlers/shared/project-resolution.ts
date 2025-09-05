import { http, HttpResponse } from 'msw'
import { resolveAndSwitchToProject, normalizeApiPath } from '../../project-resolver'

/**
 * Higher-order function that wraps handlers with project resolution
 * Extracts project ID from URL and switches to the correct database before handling the request
 */
export function withProjectResolution<T extends Parameters<typeof http.get>[1]>(
  handler: T
): T {
  return (async ({ params, request, ...rest }) => {
    // const startTime = performance.now();
    const url = new URL(request.url);
    
    // Resolve and switch to the appropriate project database
    const resolution = await resolveAndSwitchToProject(url);
    
    if (!resolution.success) {
      console.error(`❌ MSW: Project resolution failed for ${url.pathname}:`, resolution.error);
      return HttpResponse.json(
        { error: 'Project not found', message: resolution.error },
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // const resolutionTime = performance.now() - startTime;

    // Normalize the URL to remove project identifier for the handler
    const normalizedUrl = normalizeApiPath(url);
    const normalizedRequest = new Request(normalizedUrl, request);

    // Call the original handler with normalized parameters and project info
    // const handleStartTime = performance.now();
    const result = await handler({ 
      params, 
      request: normalizedRequest, 
      projectInfo: {
        projectId: resolution.projectId,
        projectName: resolution.projectName
      },
      ...rest 
    } as any);
    
    // const totalTime = performance.now() - startTime;
    // const handleTime = performance.now() - handleStartTime;
    
    return result;
  }) as T;
}