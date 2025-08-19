import { http, HttpResponse } from 'msw'

// MSW handlers for the test-app
// These handlers should NOT intercept localhost:5173 requests
// Local requests should pass through to the main app's API endpoints

export const handlers = [
  // Example handler for testing MSW functionality with non-local domains
  http.get('https://example.com/api/test', async ({ request }) => {
    return HttpResponse.json({ 
      message: 'MSW test handler working',
      url: request.url 
    })
  }),

  // CORS preflight for any domain that might need it
  http.options('*', () => {
    return new HttpResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
      },
    })
  })
]

// Note: All localhost:5173 requests (auth, rest API, etc.) will bypass MSW
// and go directly to the main app's Vite server API endpoints