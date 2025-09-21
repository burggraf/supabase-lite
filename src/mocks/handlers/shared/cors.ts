import { http, HttpResponse } from 'msw'
import { COMMON_CORS_HEADERS } from './common-handlers'

/**
 * CORS preflight catch-all handler
 * This must be the last handler in the array to catch any uncaught OPTIONS requests
 */
export const corsAndCatchAllHandler = http.all('*', ({ request }: any) => {
  if (request.method === 'OPTIONS') {
    return new HttpResponse(null, {
      status: 200,
      headers: COMMON_CORS_HEADERS,
    })
  }

  return
})
