import { HttpResponse } from 'msw'
import { AuthBridge } from '../../bridges/auth-bridge'
import { createGetRoutes, createPostRoutes, createDeleteRoutes } from '../shared/route-factory'
import { handleError, createAuthError } from '../shared/error-handling'
import { addCorsHeaders } from '../shared/cors'

const authBridge = AuthBridge.getInstance()

/**
 * Handler for GET /auth/v1/factors
 * Lists all MFA factors for the current user
 */
const createListFactorsHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling list factors request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'factors',
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
    console.error('❌ MSW: List factors error:', error)
    return createAuthError('factors_error', error.message || 'Failed to list factors', 400)
  }
}

/**
 * Handler for POST /auth/v1/factors
 * Creates/enrolls a new MFA factor
 */
const createEnrollFactorHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling enroll factor request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'factors',
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
    console.error('❌ MSW: Enroll factor error:', error)
    return createAuthError('enroll_failed', error.message || 'Factor enrollment failed', 400)
  }
}

/**
 * Handler for POST /auth/v1/factors/:factorId/challenge
 * Creates a challenge for MFA verification
 */
const createFactorChallengeHandler = async ({ request, params }: any) => {
  try {
    console.log('🔐 MSW: Handling factor challenge request')
    const response = await authBridge.handleAuthRequest({
      endpoint: `factors/${params.factorId}/challenge`,
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
    console.error('❌ MSW: Factor challenge error:', error)
    return createAuthError('challenge_failed', error.message || 'Challenge creation failed', 400)
  }
}

/**
 * Handler for POST /auth/v1/factors/:factorId/verify
 * Verifies an MFA challenge
 */
const createFactorVerifyHandler = async ({ request, params }: any) => {
  try {
    console.log('🔐 MSW: Handling factor verify request')
    const response = await authBridge.handleAuthRequest({
      endpoint: `factors/${params.factorId}/verify`,
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
    console.error('❌ MSW: Factor verify error:', error)
    return createAuthError('verify_failed', error.message || 'Factor verification failed', 400)
  }
}

/**
 * Handler for DELETE /auth/v1/factors/:factorId
 * Removes/unenrolls an MFA factor
 */
const createUnenrollFactorHandler = async ({ request, params }: any) => {
  try {
    console.log('🔐 MSW: Handling unenroll factor request')
    const response = await authBridge.handleAuthRequest({
      endpoint: `factors/${params.factorId}`,
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
    console.error('❌ MSW: Unenroll factor error:', error)
    return createAuthError('unenroll_failed', error.message || 'Factor unenrollment failed', 400)
  }
}

/**
 * Export MFA handlers
 */
export const mfaHandlers = [
  ...createGetRoutes('/auth/v1/factors', createListFactorsHandler),
  ...createPostRoutes('/auth/v1/factors', createEnrollFactorHandler),
  ...createPostRoutes('/auth/v1/factors/:factorId/challenge', createFactorChallengeHandler),
  ...createPostRoutes('/auth/v1/factors/:factorId/verify', createFactorVerifyHandler),
  ...createDeleteRoutes('/auth/v1/factors/:factorId', createUnenrollFactorHandler)
]