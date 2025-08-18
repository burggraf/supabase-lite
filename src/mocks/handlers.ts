import { http, HttpResponse } from 'msw'
import { SupabaseAPIBridge } from './supabase-bridge'
import { EnhancedSupabaseAPIBridge } from './enhanced-bridge'
import { AuthBridge } from '../lib/auth/AuthBridge'

const bridge = new SupabaseAPIBridge()
const enhancedBridge = new EnhancedSupabaseAPIBridge()
const authBridge = AuthBridge.getInstance()

export const handlers = [
  // PostgREST-compatible REST API endpoints with enhanced features
  http.get('/rest/v1/:table', async ({ params, request }) => {
    try {
      const response = await enhancedBridge.handleRestRequest({
        table: params.table as string,
        method: 'GET',
        headers: Object.fromEntries(request.headers.entries()),
        url: new URL(request.url)
      })
      
      return HttpResponse.json(response.data, {
        status: response.status,
        headers: {
          ...response.headers,
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range',
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
      const response = await enhancedBridge.handleRestRequest({
        table: params.table as string,
        method: 'POST',
        body,
        headers: Object.fromEntries(request.headers.entries()),
        url: new URL(request.url)
      })
      
      return HttpResponse.json(response.data, {
        status: response.status,
        headers: {
          ...response.headers,
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range',
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
      const response = await enhancedBridge.handleRestRequest({
        table: params.table as string,
        method: 'PATCH',
        body,
        headers: Object.fromEntries(request.headers.entries()),
        url: new URL(request.url)
      })
      
      return HttpResponse.json(response.data, {
        status: response.status,
        headers: {
          ...response.headers,
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range',
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
      const response = await enhancedBridge.handleRestRequest({
        table: params.table as string,
        method: 'DELETE',
        headers: Object.fromEntries(request.headers.entries()),
        url: new URL(request.url)
      })
      
      return HttpResponse.json(response.data, {
        status: response.status,
        headers: {
          ...response.headers,
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range',
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

  // RPC (Remote Procedure Call) endpoints for stored functions
  http.post('/rest/v1/rpc/:functionName', async ({ params, request }) => {
    try {
      const body = await request.json().catch(() => ({}))
      const response = await enhancedBridge.handleRpc(
        params.functionName as string,
        body
      )
      
      return HttpResponse.json(response.data, {
        status: response.status,
        headers: {
          ...response.headers,
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
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

  // Authentication endpoints - Enhanced with AuthBridge
  http.post('/auth/v1/signup', async ({ request }) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'signup',
      method: 'POST',
      body: await request.json(),
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  }),

  http.post('/auth/v1/signin', async ({ request }) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'signin',
      method: 'POST',
      body: await request.json(),
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  }),

  http.post('/auth/v1/token', async ({ request }) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'token',
      method: 'POST',
      body: await request.json(),
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  }),

  http.post('/auth/v1/logout', async ({ request }) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'logout',
      method: 'POST',
      body: await request.json().catch(() => ({})),
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  }),

  http.get('/auth/v1/user', async ({ request }) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'user',
      method: 'GET',
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  }),

  http.put('/auth/v1/user', async ({ request }) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'user',
      method: 'PUT',
      body: await request.json(),
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  }),

  http.post('/auth/v1/recover', async ({ request }) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'recover',
      method: 'POST',
      body: await request.json(),
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  }),

  // MFA endpoints
  http.get('/auth/v1/factors', async ({ request }) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'factors',
      method: 'GET',
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  }),

  http.post('/auth/v1/factors', async ({ request }) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'factors',
      method: 'POST',
      body: await request.json(),
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  }),

  http.post('/auth/v1/factors/:factorId/challenge', async ({ params, request }) => {
    const requestBody = await request.json().catch(() => ({}))
    const response = await authBridge.handleAuthRequest({
      endpoint: 'factors/challenge',
      method: 'POST',
      body: { factor_id: params.factorId, ...requestBody as Record<string, any> },
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  }),

  http.post('/auth/v1/factors/:factorId/verify', async ({ params, request }) => {
    const body = await request.json().catch(() => ({})) as Record<string, any>
    const response = await authBridge.handleAuthRequest({
      endpoint: 'factors/verify',
      method: 'POST',
      body: { factor_id: params.factorId, ...body },
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  }),

  http.delete('/auth/v1/factors/:factorId', async ({ params, request }) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'factors',
      method: 'DELETE',
      body: { factor_id: params.factorId },
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  }),

  // JWT discovery endpoint
  http.get('/auth/v1/.well-known/jwks.json', async ({ request }) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: '.well-known/jwks.json',
      method: 'GET',
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
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
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range, content-range',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    })
  })
]