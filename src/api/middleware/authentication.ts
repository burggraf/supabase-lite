/**
 * Authentication middleware for JWT decoding and RLS context establishment
 */

import type { MiddlewareFunction, ApiRequest, ApiContext, ApiResponse, SessionContext } from '../types'
import { JWTService } from '../../lib/auth/core/JWTService'
import { logger } from '../../lib/infrastructure/Logger'

export const authenticationMiddleware: MiddlewareFunction = async (
  request: ApiRequest,
  context: ApiContext,
  next: () => Promise<ApiResponse>
): Promise<ApiResponse> => {

  // Extract JWT token from Authorization header or apikey header
  const authHeader = request.headers['authorization'] || request.headers['Authorization']
  const apikeyHeader = request.headers['apikey'] || request.headers['Apikey']

  let token: string | undefined

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  } else if (apikeyHeader) {
    // Handle apikey-based authentication
    token = apikeyHeader
  }

  if (token) {
    try {
      const jwtService = JWTService.getInstance()
      await jwtService.initialize()

      // Verify and decode the JWT token
      const payload = await jwtService.verifyToken(token)

      // Establish session context for RLS
      context.sessionContext = {
        userId: payload.sub || payload.user_id,
        role: payload.role || 'authenticated',
        claims: payload,
        jwt: token
      }

      logger.debug(`User authenticated: ${context.sessionContext.userId}`, {
        requestId: context.requestId,
        role: context.sessionContext.role
      })
    } catch (error) {
      // Token verification failed - continue with anonymous access
      context.sessionContext = {
        role: 'anon'
      }
      logger.debug('JWT verification failed, proceeding as anonymous', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  } else {
    // No token provided - anonymous access
    context.sessionContext = {
      role: 'anon'
    }
  }

  return next()
}