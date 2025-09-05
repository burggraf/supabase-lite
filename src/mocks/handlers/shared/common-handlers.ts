import { HttpResponse } from 'msw'

/**
 * Common CORS headers used across all handlers
 */
export const COMMON_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range, content-range, x-function-name',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, DELETE, PUT, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Type, X-Function-Name, X-Execution-Time',
  'Access-Control-Max-Age': '86400'
} as const

/**
 * Basic CORS headers for simple requests
 */
export const BASIC_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
} as const

/**
 * REST-specific CORS headers
 */
export const REST_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, DELETE'
} as const

/**
 * Creates a standard PostgreSQL error response
 */
export function createPostgreSQLErrorResponse(error: Error, status: number = 500) {
  return HttpResponse.json(
    { 
      code: 'PGRST100',
      message: error.message || 'Request failed',
      details: null,
      hint: null
    },
    { 
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    }
  )
}

/**
 * Creates a standard error response
 */
export function createErrorResponse(
  error: string, 
  message: string, 
  status: number = 500,
  additionalHeaders: Record<string, string> = {}
) {
  return HttpResponse.json(
    { error, message },
    { 
      status,
      headers: {
        ...BASIC_CORS_HEADERS,
        ...additionalHeaders
      }
    }
  )
}

/**
 * Creates a standard success response with CORS headers
 */
export function createSuccessResponse(
  data: any, 
  status: number = 200,
  additionalHeaders: Record<string, string> = {}
) {
  return HttpResponse.json(data, {
    status,
    headers: {
      ...BASIC_CORS_HEADERS,
      ...additionalHeaders
    }
  })
}

/**
 * Creates a CORS preflight response
 */
export function createCorsPreflightResponse() {
  return new HttpResponse(null, {
    status: 200,
    headers: COMMON_CORS_HEADERS
  })
}

/**
 * Safe JSON parsing with error handling
 */
export async function safeJsonParse(request: Request): Promise<any> {
  try {
    const text = await request.text()
    if (!text) return {}
    return JSON.parse(text)
  } catch (error) {
    console.warn('Failed to parse JSON:', error)
    return {}
  }
}

/**
 * Extract headers as plain object
 */
export function extractHeaders(request: Request): Record<string, string> {
  return Object.fromEntries(request.headers.entries())
}

/**
 * VFS initialization helper
 */
export async function initializeVFS(vfsBridge: any, projectInfo: any) {
  if (projectInfo?.projectId) {
    await vfsBridge.initializeForProject(projectInfo.projectId)
  }
}