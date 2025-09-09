import { http, HttpResponse } from 'msw'
import { EnhancedSupabaseAPIBridge } from '../enhanced-bridge'
import { withProjectResolution } from './shared/project-resolution'
import { 
  createPostgreSQLErrorResponse, 
  extractHeaders,
  safeJsonParse,
  REST_CORS_HEADERS
} from './shared/common-handlers'

// Initialize the enhanced bridge
const enhancedBridge = new EnhancedSupabaseAPIBridge()

// Helper functions for common REST operations
const createRestGetHandler = () => async ({ params, request }: any) => {
  try {
    const response = await enhancedBridge.handleRestRequest({
      table: params.table as string,
      method: 'GET',
      headers: extractHeaders(request),
      url: new URL(request.url)
    })
    
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error: any) {
    console.error(`❌ MSW: GET error for ${params.table}:`, error)
    return createPostgreSQLErrorResponse(error)
  }
}

const createRestHeadHandler = () => async ({ params, request }: any) => {
  try {
    const response = await enhancedBridge.handleRestRequest({
      table: params.table as string,
      method: 'HEAD',
      headers: extractHeaders(request),
      url: new URL(request.url)
    })
    
    // HEAD requests return no body, only headers
    return new HttpResponse(null, {
      status: response.status,
      headers: {
        ...response.headers,
        ...REST_CORS_HEADERS
      }
    })
  } catch (error: any) {
    console.error(`❌ MSW: HEAD error for ${params.table}:`, error)
    
    return new HttpResponse(null, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
  }
}

const createRestPostHandler = () => async ({ params, request }: any) => {
  try {
    const body = await safeJsonParse(request)
    const response = await enhancedBridge.handleRestRequest({
      table: params.table as string,
      method: 'POST',
      body,
      headers: extractHeaders(request),
      url: new URL(request.url)
    })
    
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        ...response.headers,
        ...REST_CORS_HEADERS
      }
    })
  } catch (error: any) {
    return createPostgreSQLErrorResponse(error)
  }
}

const createRestPatchHandler = () => async ({ params, request }: any) => {
  try {
    const body = await safeJsonParse(request)
    const response = await enhancedBridge.handleRestRequest({
      table: params.table as string,
      method: 'PATCH',
      body,
      headers: extractHeaders(request),
      url: new URL(request.url)
    })
    
    // For 204 No Content responses, return empty body (correct HTTP semantics)
    if (response.status === 204) {
      // Remove Content-Type header for 204 responses (no content)
      const { 'Content-Type': contentType, ...headersWithoutContentType } = response.headers
      return new HttpResponse(null, {
        status: response.status,
        headers: {
          ...headersWithoutContentType,
          ...REST_CORS_HEADERS
        }
      })
    }
    
    // For other responses, return data normally
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        ...response.headers,
        ...REST_CORS_HEADERS
      }
    })
  } catch (error: any) {
    return createPostgreSQLErrorResponse(error)
  }
}


const createRestDeleteHandler = () => async ({ params, request }: any) => {
  try {
    const response = await enhancedBridge.handleRestRequest({
      table: params.table as string,
      method: 'DELETE',
      headers: extractHeaders(request),
      url: new URL(request.url)
    })
    
    // For 204 No Content responses, check if there's status injection data for testing
    if (response.status === 204) {
      // Check if the response data contains status injection (for testing compatibility)
      if (response.data && typeof response.data === 'object' && 
          '__supabase_status' in response.data) {
        // Return the injected data as JSON for test script extraction
        return HttpResponse.json(response.data, {
          status: response.status,
          headers: {
            ...response.headers,
            ...REST_CORS_HEADERS
          }
        })
      }
      
      // Otherwise return empty body (correct HTTP semantics)
      const { 'Content-Type': contentType, ...headersWithoutContentType } = response.headers
      return new HttpResponse(null, {
        status: response.status,
        headers: {
          ...headersWithoutContentType,
          ...REST_CORS_HEADERS
        }
      })
    }
    
    // For other responses, return data normally
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        ...response.headers,
        ...REST_CORS_HEADERS
      }
    })
  } catch (error: any) {
    return createPostgreSQLErrorResponse(error)
  }
}

// Helper functions for RPC operations
const createRpcHandler = () => async ({ params, request }: any) => {
  try {
    const body = await safeJsonParse(request)
    const response = await enhancedBridge.handleRpc(
      params.functionName as string,
      body
    )
    
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        ...response.headers,
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
        'Access-Control-Allow-Methods': 'POST'
      }
    })
  } catch (error: any) {
    return createPostgreSQLErrorResponse(error)
  }
}

// REST API handlers
export const restHandlers = [
  // Non-project-scoped REST handlers
  http.get('/rest/v1/:table', withProjectResolution(createRestGetHandler())),
  http.head('/rest/v1/:table', withProjectResolution(createRestHeadHandler())),
  http.post('/rest/v1/:table', withProjectResolution(createRestPostHandler())),
  http.patch('/rest/v1/:table', withProjectResolution(createRestPatchHandler())),
  http.delete('/rest/v1/:table', withProjectResolution(createRestDeleteHandler())),
  
  // Project-scoped REST handlers  
  http.get('/:projectId/rest/v1/:table', withProjectResolution(createRestGetHandler())),
  http.head('/:projectId/rest/v1/:table', withProjectResolution(createRestHeadHandler())),
  http.post('/:projectId/rest/v1/:table', withProjectResolution(createRestPostHandler())),
  http.patch('/:projectId/rest/v1/:table', withProjectResolution(createRestPatchHandler())),
  http.delete('/:projectId/rest/v1/:table', withProjectResolution(createRestDeleteHandler())),
  
  // RPC handlers
  http.post('/rest/v1/rpc/:functionName', withProjectResolution(createRpcHandler())),
  http.post('/:projectId/rest/v1/rpc/:functionName', withProjectResolution(createRpcHandler())),
]