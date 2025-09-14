import { http, HttpResponse } from 'msw'
import { AuthBridge } from '../../lib/auth/AuthBridge'
import { withProjectResolution } from './shared/project-resolution'
import { 
  createErrorResponse, 
  extractHeaders,
  safeJsonParse
} from './shared/common-handlers'

// Initialize the auth bridge
const authBridge = AuthBridge.getInstance()

/**
 * Auth headers with credentials support
 */
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true'
} as const

/**
 * Generic auth handler that delegates to AuthBridge
 */
const createAuthHandler = (endpoint: string) => async ({ request, params }: any) => {
  try {
    const body = await safeJsonParse(request)
    const url = new URL(request.url)


    const response = await authBridge.handleAuthRequest({
      endpoint,
      method: request.method,
      url: url,
      headers: extractHeaders(request),
      body
    })
    
    console.log(`✅ MSW: Auth ${endpoint} response:`, { 
      status: response.status, 
      hasData: !!response.data, 
      hasError: !!response.error 
    })
    
    if (response.error) {
      return HttpResponse.json(response.error, {
        status: response.status || 400,
        headers: AUTH_HEADERS
      })
    }
    
    return HttpResponse.json(response.data, {
      status: response.status || 200,
      headers: AUTH_HEADERS
    })
  } catch (error) {
    console.error(`❌ MSW: Auth ${endpoint} error:`, error)
    return createErrorResponse(
      'internal_server_error', 
      'Authentication service failed',
      500,
      AUTH_HEADERS
    )
  }
}

// Authentication handlers
export const authHandlers = [
  // Core authentication endpoints
  http.post('/auth/v1/signup', createAuthHandler('signup')),
  http.post('/:projectId/auth/v1/signup', withProjectResolution(createAuthHandler('signup'))),
  
  http.post('/auth/v1/signin', createAuthHandler('signin')),
  http.post('/:projectId/auth/v1/signin', withProjectResolution(createAuthHandler('signin'))),
  
  http.post('/auth/v1/token', createAuthHandler('token')),
  http.post('/:projectId/auth/v1/token', withProjectResolution(createAuthHandler('token'))),
  
  http.post('/auth/v1/logout', withProjectResolution(createAuthHandler('logout'))),
  http.post('/:projectId/auth/v1/logout', withProjectResolution(createAuthHandler('logout'))),
  
  http.get('/auth/v1/session', withProjectResolution(createAuthHandler('session'))),
  http.get('/:projectId/auth/v1/session', withProjectResolution(createAuthHandler('session'))),
  
  http.get('/auth/v1/user', withProjectResolution(createAuthHandler('user'))),
  http.get('/:projectId/auth/v1/user', withProjectResolution(createAuthHandler('user'))),
  
  http.put('/auth/v1/user', withProjectResolution(createAuthHandler('user_update'))),
  http.put('/:projectId/auth/v1/user', withProjectResolution(createAuthHandler('user_update'))),
  
  // OTP endpoints
  http.post('/auth/v1/otp', createAuthHandler('otp')),
  http.post('/:projectId/auth/v1/otp', withProjectResolution(createAuthHandler('otp'))),
  
  http.post('/auth/v1/verify', createAuthHandler('verify')),
  http.post('/:projectId/auth/v1/verify', withProjectResolution(createAuthHandler('verify'))),
  
  // Password recovery
  http.post('/auth/v1/recover', withProjectResolution(createAuthHandler('recover'))),
  http.post('/:projectId/auth/v1/recover', withProjectResolution(createAuthHandler('recover'))),
  
  // Magic link
  http.post('/auth/v1/magiclink', withProjectResolution(createAuthHandler('magiclink'))),
  http.post('/:projectId/auth/v1/magiclink', withProjectResolution(createAuthHandler('magiclink'))),
  
  // Multi-factor authentication
  http.get('/auth/v1/factors', withProjectResolution(createAuthHandler('factors_list'))),
  http.get('/:projectId/auth/v1/factors', withProjectResolution(createAuthHandler('factors_list'))),
  
  http.post('/auth/v1/factors', withProjectResolution(createAuthHandler('factors_enroll'))),
  http.post('/:projectId/auth/v1/factors', withProjectResolution(createAuthHandler('factors_enroll'))),
  
  http.post('/auth/v1/factors/:factorId/challenge', withProjectResolution(createAuthHandler('factors_challenge'))),
  http.post('/:projectId/auth/v1/factors/:factorId/challenge', withProjectResolution(createAuthHandler('factors_challenge'))),
  
  http.post('/auth/v1/factors/:factorId/verify', withProjectResolution(createAuthHandler('factors_verify'))),
  http.post('/:projectId/auth/v1/factors/:factorId/verify', withProjectResolution(createAuthHandler('factors_verify'))),
  
  http.delete('/auth/v1/factors/:factorId', withProjectResolution(createAuthHandler('factors_unenroll'))),
  http.delete('/:projectId/auth/v1/factors/:factorId', withProjectResolution(createAuthHandler('factors_unenroll'))),
  
  // OAuth endpoints
  http.get('/auth/v1/authorize', withProjectResolution(createAuthHandler('authorize'))),
  http.get('/:projectId/auth/v1/authorize', withProjectResolution(createAuthHandler('authorize'))),
  
  http.post('/auth/v1/callback', withProjectResolution(createAuthHandler('callback'))),
  http.post('/:projectId/auth/v1/callback', withProjectResolution(createAuthHandler('callback'))),
  
  // User identities
  http.get('/auth/v1/user/identities', withProjectResolution(createAuthHandler('identities_list'))),
  http.get('/:projectId/auth/v1/user/identities', withProjectResolution(createAuthHandler('identities_list'))),
  
  http.post('/auth/v1/user/identities', withProjectResolution(createAuthHandler('identities_link'))),
  http.post('/:projectId/auth/v1/user/identities', withProjectResolution(createAuthHandler('identities_link'))),
  
  http.delete('/auth/v1/user/identities/:identityId', withProjectResolution(createAuthHandler('identities_unlink'))),
  http.delete('/:projectId/auth/v1/user/identities/:identityId', withProjectResolution(createAuthHandler('identities_unlink'))),
  
  // Admin endpoints
  http.get('/auth/v1/admin/users', withProjectResolution(createAuthHandler('admin_list_users'))),
  http.get('/:projectId/auth/v1/admin/users', withProjectResolution(createAuthHandler('admin_list_users'))),
  
  http.post('/auth/v1/admin/users', withProjectResolution(createAuthHandler('admin_create_user'))),
  http.post('/:projectId/auth/v1/admin/users', withProjectResolution(createAuthHandler('admin_create_user'))),
  
  http.get('/auth/v1/admin/users/:userId', withProjectResolution(createAuthHandler('admin_get_user'))),
  http.get('/:projectId/auth/v1/admin/users/:userId', withProjectResolution(createAuthHandler('admin_get_user'))),
  
  http.put('/auth/v1/admin/users/:userId', withProjectResolution(createAuthHandler('admin_update_user'))),
  http.put('/:projectId/auth/v1/admin/users/:userId', withProjectResolution(createAuthHandler('admin_update_user'))),
  
  http.delete('/auth/v1/admin/users/:userId', withProjectResolution(createAuthHandler('admin_delete_user'))),
  http.delete('/:projectId/auth/v1/admin/users/:userId', withProjectResolution(createAuthHandler('admin_delete_user'))),
  
  http.post('/auth/v1/admin/generate_link', withProjectResolution(createAuthHandler('admin_generate_link'))),
  http.post('/:projectId/auth/v1/admin/generate_link', withProjectResolution(createAuthHandler('admin_generate_link'))),
  
  // Session management
  http.get('/auth/v1/sessions', withProjectResolution(createAuthHandler('sessions_list'))),
  http.get('/:projectId/auth/v1/sessions', withProjectResolution(createAuthHandler('sessions_list'))),
  
  http.delete('/auth/v1/sessions/:sessionId', withProjectResolution(createAuthHandler('sessions_delete'))),
  http.delete('/:projectId/auth/v1/sessions/:sessionId', withProjectResolution(createAuthHandler('sessions_delete'))),
  
  // Resend verification
  http.post('/auth/v1/resend', withProjectResolution(createAuthHandler('resend'))),
  http.post('/:projectId/auth/v1/resend', withProjectResolution(createAuthHandler('resend'))),
]