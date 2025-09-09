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
      body,
      extractHeaders(request),
      new URL(request.url)
    )
    
    console.log('🔍 RPC Handler - Response:', response)
    console.log('🔍 RPC Handler - Response data:', response.data)
    console.log('🔍 RPC Handler - Response status:', response.status)
    
    // For scalar RPC responses, return the value directly as JSON
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        ...response.headers,
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
        'Access-Control-Allow-Methods': 'POST'
      }
    })
  } catch (error: any) {
    console.error('❌ RPC Handler Error:', error)
    return createPostgreSQLErrorResponse(error)
  }
}

const createRpcGetHandler = () => async ({ params, request }: any) => {
  try {
    // For GET requests, extract parameters from query string
    const url = new URL(request.url)
    const queryParams: Record<string, any> = {}
    
    // Convert URLSearchParams to plain object
    for (const [key, value] of url.searchParams.entries()) {
      // Handle JSON parameters
      try {
        queryParams[key] = JSON.parse(value)
      } catch {
        // If not JSON, use as string
        queryParams[key] = value
      }
    }
    
    console.log('🔍 RPC GET Handler - Function:', params.functionName)
    console.log('🔍 RPC GET Handler - Query Params:', queryParams)
    
    const response = await enhancedBridge.handleRpc(
      params.functionName as string,
      queryParams,
      extractHeaders(request),
      url
    )
    
    console.log('🔍 RPC GET Handler - Response:', response)
    console.log('🔍 RPC GET Handler - Response data:', response.data)
    console.log('🔍 RPC GET Handler - Response status:', response.status)
    
    // For scalar RPC responses, return the value directly as JSON
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        ...response.headers,
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
        'Access-Control-Allow-Methods': 'GET'
      }
    })
  } catch (error: any) {
    console.error('❌ RPC GET Handler Error:', error)
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
  
  // RPC GET handlers (for read-only functions with { get: true })
  http.get('/rest/v1/rpc/:functionName', withProjectResolution(createRpcGetHandler())),
  http.get('/:projectId/rest/v1/rpc/:functionName', withProjectResolution(createRpcGetHandler())),
]