import { http, HttpResponse } from 'msw'
import { SupabaseAPIBridge } from './supabase-bridge'

const bridge = new SupabaseAPIBridge()

export const handlers = [
  // PostgREST-compatible REST API endpoints
  http.get('/rest/v1/:table', async ({ params, request }) => {
    try {
      const result = await bridge.handleRestRequest({
        table: params.table as string,
        method: 'GET',
        headers: Object.fromEntries(request.headers.entries()),
        url: new URL(request.url)
      })
      
      return HttpResponse.json(result, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE'
        }
      })
    } catch (error: any) {
      return HttpResponse.json(
        { message: error.message },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }
  }),

  http.post('/rest/v1/:table', async ({ params, request }) => {
    try {
      const body = await request.json()
      const result = await bridge.handleRestRequest({
        table: params.table as string,
        method: 'POST',
        body,
        headers: Object.fromEntries(request.headers.entries()),
        url: new URL(request.url)
      })
      
      return HttpResponse.json(result, {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE'
        }
      })
    } catch (error: any) {
      return HttpResponse.json(
        { message: error.message },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }
  }),

  http.patch('/rest/v1/:table', async ({ params, request }) => {
    try {
      const body = await request.json()
      const result = await bridge.handleRestRequest({
        table: params.table as string,
        method: 'PATCH',
        body,
        headers: Object.fromEntries(request.headers.entries()),
        url: new URL(request.url)
      })
      
      return HttpResponse.json(result, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE'
        }
      })
    } catch (error: any) {
      return HttpResponse.json(
        { message: error.message },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }
  }),

  http.delete('/rest/v1/:table', async ({ params, request }) => {
    try {
      const result = await bridge.handleRestRequest({
        table: params.table as string,
        method: 'DELETE',
        headers: Object.fromEntries(request.headers.entries()),
        url: new URL(request.url)
      })
      
      return HttpResponse.json(result, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE'
        }
      })
    } catch (error: any) {
      return HttpResponse.json(
        { message: error.message },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }
  }),

  // Authentication endpoints
  http.post('/auth/v1/signup', async ({ request }) => {
    try {
      const body = await request.json()
      const result = await bridge.handleAuth('signup', 'POST', body)
      
      return HttpResponse.json(result, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
          'Access-Control-Allow-Methods': 'POST'
        }
      })
    } catch (error: any) {
      return HttpResponse.json(
        { message: error.message },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }
  }),

  http.post('/auth/v1/signin', async ({ request }) => {
    try {
      const body = await request.json()
      const result = await bridge.handleAuth('signin', 'POST', body)
      
      return HttpResponse.json(result, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
          'Access-Control-Allow-Methods': 'POST'
        }
      })
    } catch (error: any) {
      return HttpResponse.json(
        { message: error.message },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }
  }),

  http.post('/auth/v1/token', async ({ request }) => {
    try {
      const body = await request.json()
      const result = await bridge.handleAuth('refresh', 'POST', body)
      
      return HttpResponse.json(result, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
          'Access-Control-Allow-Methods': 'POST'
        }
      })
    } catch (error: any) {
      return HttpResponse.json(
        { message: error.message },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }
  }),

  http.post('/auth/v1/logout', async () => {
    try {
      const result = await bridge.handleAuth('signout', 'POST')
      
      return HttpResponse.json(result, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
          'Access-Control-Allow-Methods': 'POST'
        }
      })
    } catch (error: any) {
      return HttpResponse.json(
        { message: error.message },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }
  }),

  http.get('/auth/v1/user', async ({ request }) => {
    try {
      const result = await bridge.handleAuth('user', 'GET')
      
      return HttpResponse.json(result, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
          'Access-Control-Allow-Methods': 'GET'
        }
      })
    } catch (error: any) {
      return HttpResponse.json(
        { message: error.message },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }
  }),

  // Health check endpoint for testing
  http.get('/health', () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Supabase Lite API is running'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }),

  // CORS preflight requests
  http.options('*', () => {
    return new HttpResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
        'Access-Control-Max-Age': '86400'
      }
    })
  })
]