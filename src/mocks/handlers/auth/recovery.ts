import { HttpResponse } from 'msw'
import { AuthBridge } from '../../bridges/auth-bridge'
import { createPostRoutes } from '../shared/route-factory'
import { handleError, createAuthError } from '../shared/error-handling'
import { addCorsHeaders } from '../shared/cors'

const authBridge = AuthBridge.getInstance()

/**
 * Handler for POST /auth/v1/recover
 * Initiates password recovery process
 */
const createRecoverHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling password recovery request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'recover',
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
    console.error('❌ MSW: Password recovery error:', error)
    return createAuthError('recovery_failed', error.message || 'Password recovery failed', 400)
  }
}

/**
 * Handler for POST /auth/v1/verify
 * Verifies email confirmation, password reset, etc.
 */
const createVerifyHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling verification request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'verify',
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
    console.error('❌ MSW: Verification error:', error)
    return createAuthError('verification_failed', error.message || 'Verification failed', 400)
  }
}

/**
 * Handler for POST /auth/v1/otp
 * Sends or verifies one-time passwords
 */
const createOtpHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling OTP request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'otp',
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
    console.error('❌ MSW: OTP error:', error)
    return createAuthError('otp_failed', error.message || 'OTP operation failed', 400)
  }
}

/**
 * Handler for POST /auth/v1/resend
 * Resends verification emails or other notifications
 */
const createResendHandler = async ({ request }: any) => {
  try {
    console.log('🔐 MSW: Handling resend request')
    const response = await authBridge.handleAuthRequest({
      endpoint: 'resend',
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
    console.error('❌ MSW: Resend error:', error)
    return createAuthError('resend_failed', error.message || 'Resend operation failed', 400)
  }
}

/**
 * Export recovery and verification handlers
 */
export const recoveryHandlers = [
  ...createPostRoutes('/auth/v1/recover', createRecoverHandler),
  ...createPostRoutes('/auth/v1/verify', createVerifyHandler),
  ...createPostRoutes('/auth/v1/otp', createOtpHandler),
  ...createPostRoutes('/auth/v1/resend', createResendHandler)
]