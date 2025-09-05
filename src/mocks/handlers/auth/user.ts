import { HttpResponse } from 'msw'
import { AuthBridge } from '../../bridges/auth-bridge'
import { createPostRoutes, createGetRoutes, createPutRoutes } from '../shared/route-factory'
import { handleError, createAuthError } from '../shared/error-handling'
import { addCorsHeaders } from '../shared/cors'

const authBridge = AuthBridge.getInstance()

/**
 * Handler for POST /auth/v1/signup
 * Handles user registration
 */
const createSignupHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling signup request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'signup',
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
    console.error('❌ MSW: Signup error:', error)
    return createAuthError('signup_failed', error.message || 'User registration failed', 400)
  }
}

/**
 * Handler for GET /auth/v1/user
 * Gets current user profile information
 */
const createUserHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling user profile request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'user',
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
    console.error('❌ MSW: User profile error:', error)
    return createAuthError('user_not_found', error.message || 'User not found', 401)
  }
}

/**
 * Handler for PUT /auth/v1/user
 * Updates current user profile information
 */
const createUpdateUserHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling user update request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'user',
      method: 'PUT',
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
    console.error('❌ MSW: User update error:', error)
    return createAuthError('update_failed', error.message || 'User update failed', 400)
  }
}

/**
 * Export user management handlers
 */
export const userHandlers = [
  ...createPostRoutes('/auth/v1/signup', createSignupHandler),
  ...createGetRoutes('/auth/v1/user', createUserHandler),
  ...createPutRoutes('/auth/v1/user', createUpdateUserHandler)
]