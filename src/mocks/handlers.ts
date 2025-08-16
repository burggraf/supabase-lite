import { http, HttpResponse } from 'msw'

export const handlers = [
  // Hello endpoint
  http.get('/hello', () => {
    return HttpResponse.json({
      message: 'Hello, world.',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    })
  }),

  // Health check endpoint
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    })
  }),

  // Future Supabase-like endpoints (placeholder structure)
  http.get('/rest/v1/:table', ({ params }) => {
    return HttpResponse.json({
      message: `REST API for table: ${params.table}`,
      status: 'mock_response'
    })
  }),

  http.post('/auth/v1/token', () => {
    return HttpResponse.json({
      access_token: 'mock_token_' + Math.random().toString(36).substr(2, 9),
      token_type: 'bearer',
      expires_in: 3600
    })
  })
]