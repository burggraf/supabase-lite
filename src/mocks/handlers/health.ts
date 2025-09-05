import { http, HttpResponse } from 'msw'

// Health check handlers - simplified without project resolution for debugging
export const healthHandlers = [
  http.get('/health', () => {
    console.log('🔧 Health handler called')
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Supabase Lite API is running'
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }),
]