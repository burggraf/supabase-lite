import { http, HttpResponse } from 'msw'
import { COMMON_CORS_HEADERS, BASIC_CORS_HEADERS } from './common-handlers'

/**
 * CORS preflight requests AND catch-all for Edge Functions
 * This must be the last handler in the array to catch all unhandled requests
 */
export const corsAndCatchAllHandler = http.all('*', ({ request }: any) => {
  const url = new URL(request.url)
  
  // Handle Edge Functions requests that weren't caught by earlier handlers
  if (url.pathname.includes('/functions/v1/')) {
    const pathParts = url.pathname.split('/')
    const functionNameIndex = pathParts.findIndex(part => part === 'v1') + 1
    const functionName = pathParts[functionNameIndex]
    
    console.log('✅ CATCH-ALL EDGE FUNCTION HANDLER:', functionName, request.method)
    
    if (request.method === 'OPTIONS') {
      return new HttpResponse(null, {
        status: 200,
        headers: COMMON_CORS_HEADERS
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
      headers: BASIC_CORS_HEADERS
    })
  }
  
  // Default CORS preflight for all other requests
  if (request.method === 'OPTIONS') {
    return new HttpResponse(null, {
      status: 200,
      headers: COMMON_CORS_HEADERS
    })
  }
  
  // Let other non-OPTIONS requests pass through (not handled by this catch-all)
  return
})