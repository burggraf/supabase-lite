import { HttpResponse } from 'msw'

/**
 * Standard CORS headers for Supabase API compatibility
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range, content-range, x-function-name, x-client-info',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Type, X-Function-Name, X-Execution-Time',
  'Access-Control-Max-Age': '86400'
} as const

/**
 * Creates a standard OPTIONS response for CORS preflight requests
 */
export function createOptionsResponse(): Response {
  return new HttpResponse(null, {
    status: 200,
    headers: CORS_HEADERS
  })
}

/**
 * Adds CORS headers to an existing response
 */
export function addCorsHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    ...CORS_HEADERS,
    ...headers
  }
}

/**
 * Creates a response with CORS headers
 */
export function createCorsResponse(
  data: any, 
  options: { 
    status?: number
    headers?: Record<string, string>
  } = {}
): Response {
  return HttpResponse.json(data, {
    status: options.status || 200,
    headers: addCorsHeaders(options.headers)
  })
}