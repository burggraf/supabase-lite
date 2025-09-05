import { HttpResponse } from 'msw'
import { AuthBridge } from '../../bridges/auth-bridge'
import { createGetRoutes, createPostRoutes, createPutRoutes, createDeleteRoutes } from '../shared/route-factory'
import { handleError, createAuthError } from '../shared/error-handling'
import { addCorsHeaders } from '../shared/cors'

const authBridge = AuthBridge.getInstance()

/**
 * Handler for GET /auth/v1/admin/users
 * Lists all users (admin only)
 */
const createListUsersHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling admin list users request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'admin/users',
      method: 'GET',
      url: new URL(request.url),
      headers: Object.fromEntries(request.headers.entries()),
      body: {}
    })

    if (response.error) {
      return HttpResponse.json(response.error, {
        status: response.status || 403,
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
    console.error('❌ MSW: Admin list users error:', error)
    return createAuthError('access_denied', error.message || 'Admin access required', 403)
  }
}

/**
 * Handler for POST /auth/v1/admin/users
 * Creates a new user (admin only)
 */
const createAdminCreateUserHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling admin create user request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'admin/users',
      method: 'POST',
      url: new URL(request.url),
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.json()
    })

    if (response.error) {
      return HttpResponse.json(response.error, {
        status: response.status || 403,
        headers: addCorsHeaders({
          'Content-Type': 'application/json'
        })
      })
    }

    return HttpResponse.json(response.data, {
      status: response.status || 201,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Admin create user error:', error)
    return createAuthError('create_failed', error.message || 'User creation failed', 400)
  }
}

/**
 * Handler for GET /auth/v1/admin/users/:userId
 * Gets a specific user by ID (admin only)
 */
const createGetUserHandler = async ({ request, params }: any) => {
  try {
    console.log('🔐 MSW: Handling admin get user request')
    const response = await authBridge.handleAuthRequest({
      endpoint: `admin/users/${params.userId}`,
      method: 'GET',
      url: new URL(request.url),
      headers: Object.fromEntries(request.headers.entries()),
      body: {}
    })

    if (response.error) {
      return HttpResponse.json(response.error, {
        status: response.status || 404,
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
    console.error('❌ MSW: Admin get user error:', error)
    return createAuthError('user_not_found', error.message || 'User not found', 404)
  }
}

/**
 * Handler for PUT /auth/v1/admin/users/:userId
 * Updates a specific user (admin only)
 */
const createUpdateUserHandler = async ({ request, params }: any) => {
  try {
    console.log('🔐 MSW: Handling admin update user request')
    const response = await authBridge.handleAuthRequest({
      endpoint: `admin/users/${params.userId}`,
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
    console.error('❌ MSW: Admin update user error:', error)
    return createAuthError('update_failed', error.message || 'User update failed', 400)
  }
}

/**
 * Handler for DELETE /auth/v1/admin/users/:userId
 * Deletes a specific user (admin only)
 */
const createDeleteUserHandler = async ({ request, params }: any) => {
  try {
    console.log('🔐 MSW: Handling admin delete user request')
    const response = await authBridge.handleAuthRequest({
      endpoint: `admin/users/${params.userId}`,
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
    console.error('❌ MSW: Admin delete user error:', error)
    return createAuthError('delete_failed', error.message || 'User deletion failed', 400)
  }
}

/**
 * Handler for POST /auth/v1/admin/generate_link
 * Generates various links (password reset, email verification, etc.) (admin only)
 */
const createGenerateLinkHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling admin generate link request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'admin/generate_link',
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
    console.error('❌ MSW: Admin generate link error:', error)
    return createAuthError('link_generation_failed', error.message || 'Link generation failed', 400)
  }
}

/**
 * Export admin handlers
 */
export const adminHandlers = [
  ...createGetRoutes('/auth/v1/admin/users', createListUsersHandler),
  ...createPostRoutes('/auth/v1/admin/users', createAdminCreateUserHandler),
  ...createGetRoutes('/auth/v1/admin/users/:userId', createGetUserHandler),
  ...createPutRoutes('/auth/v1/admin/users/:userId', createUpdateUserHandler),
  ...createDeleteRoutes('/auth/v1/admin/users/:userId', createDeleteUserHandler),
  ...createPostRoutes('/auth/v1/admin/generate_link', createGenerateLinkHandler)
]