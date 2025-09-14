/**
 * Authentication middleware for JWT decoding and RLS context establishment
 */

import type { MiddlewareFunction, ApiRequest, ApiContext, ApiResponse, SessionContext } from '../types'
import { JWTService } from '../../lib/auth/core/JWTService'
import { apiKeyGenerator } from '../../lib/auth/api-keys'
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
    // First check if this is an API key (service_role or anon)
    const apiKeyRole = apiKeyGenerator.extractRole(token)

    if (apiKeyRole) {
      // This is an API key - set up the session context accordingly
      context.sessionContext = {
        role: apiKeyRole,
        claims: {
          role: apiKeyRole,
          iss: 'supabase-lite'
        }
      }

      // Set direct context properties for backward compatibility
      context.userId = undefined
      context.role = apiKeyRole

      logger.debug(`API key authenticated: ${apiKeyRole}`, {
        requestId: context.requestId,
        role: apiKeyRole
      })
    } else {
      // This might be a user JWT token - try to verify it
      try {
        const jwtService = JWTService.getInstance()
        await jwtService.initialize()

        // Verify and decode the JWT token
        const payload = await jwtService.verifyToken(token)

        // Establish session context for RLS
        const userId = payload.sub || payload.user_id
        const role = payload.role || 'authenticated'

        context.sessionContext = {
          userId: userId,
          role: role,
          claims: payload,
          jwt: token
        }

        // Also set direct context properties for backward compatibility
        context.userId = userId
        context.role = role

        logger.debug(`User JWT authenticated: ${context.sessionContext.userId}`, {
          requestId: context.requestId,
          role: context.sessionContext.role
        })
      } catch (error) {
        // Token verification failed - continue with anonymous access
        context.sessionContext = {
          role: 'anon'
        }
        // Set direct context properties for backward compatibility
        context.userId = undefined
        context.role = 'anon'
        logger.debug('JWT verification failed, proceeding as anonymous', {
          requestId: context.requestId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  } else {
    // No token provided - anonymous access
    context.sessionContext = {
      role: 'anon'
    }
    // Set direct context properties for backward compatibility
    context.userId = undefined
    context.role = 'anon'
  }

  return next()
}