import { HttpResponse, http } from 'msw'
import { addCorsHeaders } from './cors'

/**
 * Catch-all handler for unmatched routes
 * Handles CORS preflight requests and provides fallback for edge functions
 * MUST BE LAST in the handler array
 */
export const catchAllHandler = http.all('*', ({ request }: any) => {
  const url = new URL(request.url)
  
  // Handle Edge Functions requests that weren't caught by earlier handlers
  if (url.pathname.includes('/functions/v1/')) {
    const pathParts = url.pathname.split('/')
    const functionNameIndex = pathParts.findIndex(part => part === 'v1') + 1
    const functionName = pathParts[functionNameIndex]
    
    console.log('✅ CATCH-ALL EDGE FUNCTION HANDLER:', functionName, request.method)
    
    // Handle CORS preflight for edge functions
    if (request.method === 'OPTIONS') {
      return new HttpResponse(null, {
        status: 204,
        headers: addCorsHeaders({
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type'
        })
      })
    }
    
    // Handle actual Edge Functions invocation
    return HttpResponse.json({ 
      message: 'Edge function working via catch-all', 
      function: functionName,
      method: request.method,
      url: url.pathname
    }, { 
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  }
  
  // Handle general CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new HttpResponse(null, {
      status: 204,
      headers: addCorsHeaders({
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range',
        'Access-Control-Max-Age': '86400'
      })
    })
  }
  
  // Let other non-OPTIONS requests pass through (not handled by this catch-all)
  // This allows the requests to potentially be handled by other systems
  return
})