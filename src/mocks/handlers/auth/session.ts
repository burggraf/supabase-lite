import { HttpResponse } from 'msw'
import { AuthBridge } from '../../bridges/auth-bridge'
import { createPostRoutes, createGetRoutes, createDeleteRoutes } from '../shared/route-factory'
import { handleError, createAuthError } from '../shared/error-handling'
import { addCorsHeaders } from '../shared/cors'

const authBridge = AuthBridge.getInstance()

/**
 * Handler for POST /auth/v1/signin
 * Handles user authentication/login
 */
const createSigninHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling signin request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'signin',
      method: 'POST',
      url: new URL(request.url),
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.json()
    })
    console.log('✅ MSW: Auth response:', { status: response.status, hasData: !!response.data, hasError: !!response.error })
    
    if (response.error) {
      return HttpResponse.json(response.error, {
        status: response.status || 400,
        headers: addCorsHeaders({
          'Content-Type': 'application/json'
        })
      })
    }

    return HttpResponse.json(response.data, {
      status: response.status || 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Signin error:', error)
    return createAuthError('invalid_credentials', error.message || 'Authentication failed', 400)
  }
}

/**
 * Handler for POST /auth/v1/logout
 * Handles user logout/session termination
 */
const createLogoutHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling logout request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'logout',
      method: 'POST',
      url: new URL(request.url),
      headers: Object.fromEntries(request.headers.entries()),
      body: {}
    })

    if (response.error) {
      return HttpResponse.json(response.error, {
        status: response.status || 400,
        headers: addCorsHeaders({
          'Content-Type': 'application/json'
        })
      })
    }

    return HttpResponse.json(response.data, {
      status: response.status || 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Logout error:', error)
    return createAuthError('logout_failed', error.message || 'Logout failed', 400)
  }
}

/**
 * Handler for GET /auth/v1/session
 * Gets current user session information
 */
const createSessionHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling session request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'session',
      method: 'GET',
      url: new URL(request.url),
      headers: Object.fromEntries(request.headers.entries()),
      body: {}
    })

    if (response.error) {
      return HttpResponse.json(response.error, {
        status: response.status || 401,
        headers: addCorsHeaders({
          'Content-Type': 'application/json'
        })
      })
    }

    return HttpResponse.json(response.data, {
      status: response.status || 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Session error:', error)
    return createAuthError('session_not_found', error.message || 'Session not found', 401)
  }
}

/**
 * Handler for POST /auth/v1/token
 * Handles token refresh
 */
const createTokenHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling token refresh request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'token',
      method: 'POST',
      url: new URL(request.url),
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.json()
    })

    if (response.error) {
      return HttpResponse.json(response.error, {
        status: response.status || 400,
        headers: addCorsHeaders({
          'Content-Type': 'application/json'
        })
      })
    }

    return HttpResponse.json(response.data, {
      status: response.status || 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Token refresh error:', error)
    return createAuthError('invalid_token', error.message || 'Token refresh failed', 400)
  }
}

/**
 * Handler for GET /auth/v1/sessions
 * Lists all user sessions (admin functionality)
 */
const createSessionsHandler = async ({ request }: any) => {
  try {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'sessions',
      method: 'GET',
      url: new URL(request.url),
      headers: Object.fromEntries(request.headers.entries()),
      body: {}
    })

    if (response.error) {
      return HttpResponse.json(response.error, {
        status: response.status || 400,
        headers: addCorsHeaders({
          'Content-Type': 'application/json'
        })
      })
    }

    return HttpResponse.json(response.data, {
      status: response.status || 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Sessions list error:', error)
    return createAuthError('sessions_error', error.message || 'Failed to list sessions', 400)
  }
}

/**
 * Handler for DELETE /auth/v1/sessions/:sessionId
 * Deletes a specific session
 */
const createDeleteSessionHandler = async ({ request, params }: any) => {
  try {
    const response = await authBridge.handleAuthRequest({
      endpoint: `sessions/${params.sessionId}`,
      method: 'DELETE',
      url: new URL(request.url),
      headers: Object.fromEntries(request.headers.entries()),
      body: {}
    })

    if (response.error) {
      return HttpResponse.json(response.error, {
        status: response.status || 400,
        headers: addCorsHeaders({
          'Content-Type': 'application/json'
        })
      })
    }

    return HttpResponse.json(response.data, {
      status: response.status || 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Delete session error:', error)
    return createAuthError('delete_session_error', error.message || 'Failed to delete session', 400)
  }
}

/**
 * Export session management handlers
 */
export const sessionHandlers = [
  ...createPostRoutes('/auth/v1/signin', createSigninHandler),
  ...createPostRoutes('/auth/v1/logout', createLogoutHandler),
  ...createGetRoutes('/auth/v1/session', createSessionHandler),
  ...createPostRoutes('/auth/v1/token', createTokenHandler),
  ...createGetRoutes('/auth/v1/sessions', createSessionsHandler),
  ...createDeleteRoutes('/auth/v1/sessions/:sessionId', createDeleteSessionHandler)
]