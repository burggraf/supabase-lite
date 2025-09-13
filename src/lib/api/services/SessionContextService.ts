import { logger } from '../../infrastructure/Logger'
import { apiKeyGenerator } from '../../auth/api-keys'
import type { SessionContext } from '../../database/connection'

export interface AuthHeaders {
  apikey?: string
  'x-api-key'?: string
  authorization?: string
  Authorization?: string
}

export class SessionContextService {
  /**
   * Extract user ID from JWT token
   */
  private extractUserIdFromJWT(token: string): string | null {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      
      const payload = JSON.parse(atob(parts[1]))
      return payload.sub || null
    } catch (error) {
      logger.warn('Failed to parse JWT token', { error })
      return null
    }
  }

  /**
   * Create session context for RLS enforcement based on request headers
   * Handles both API keys and user JWTs
   */
  async createSessionContext(headers: AuthHeaders): Promise<SessionContext> {
    console.log('🔍 SessionContextService.createSessionContext called with headers:', {
      hasApiKey: !!(headers.apikey || headers['x-api-key']),
      hasAuthHeader: !!(headers.authorization || headers.Authorization),
      apiKeyPreview: headers.apikey ? `${headers.apikey.substring(0, 10)}...` : 'none',
      authHeaderPreview: headers.authorization ? `${headers.authorization.substring(0, 20)}...` : 'none'
    })

    const apiKey = headers.apikey || headers['x-api-key']
    const authHeader = headers.authorization || headers.Authorization

    // Extract role from API key
    let apiKeyRole: 'anon' | 'service_role' = 'anon'
    if (apiKey) {
      // Handle hardcoded test keys for compatibility
      if (apiKey === 'test-service-role-key') {
        apiKeyRole = 'service_role'
      } else if (apiKey === 'test-anon-key') {
        apiKeyRole = 'anon'
      } else {
        // Try to extract from JWT
        const extractedRole = apiKeyGenerator.extractRole(apiKey)
        if (extractedRole) {
          apiKeyRole = extractedRole
        }
      }
    }

    console.log('🔍 SessionContextService: API key analysis:', {
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'none',
      extractedRole: apiKeyRole
    })

    // If service_role API key, create service context (bypasses RLS)
    if (apiKeyRole === 'service_role') {
      console.log('🔍 SessionContextService: Creating SERVICE ROLE context')
      return {
        role: 'service_role',
        claims: {
          role: 'service_role',
          iss: 'supabase-lite'
        }
      }
    }

    // Extract user context from Bearer token if present
    let userClaims = null
    let userId = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      console.log('🔍 SessionContextService: Processing Bearer token:', {
        tokenPreview: `${token.substring(0, 20)}...`
      })
      try {
        // Try to extract user ID from JWT
        userId = this.extractUserIdFromJWT(token)
        console.log('🔍 SessionContextService: Extracted user ID:', userId)

        // Create basic user claims
        if (userId) {
          userClaims = {
            sub: userId,
            role: 'authenticated',
            iss: 'supabase-lite'
          }
        }
      } catch (error) {
        console.log('🔍 SessionContextService: Failed to parse JWT:', error)
        logger.debug('Failed to parse user JWT', { error })
      }
    } else {
      console.log('🔍 SessionContextService: No Bearer token found in auth header')
    }

    // Return appropriate context
    if (userClaims && userId) {
      // Authenticated user
      console.log('🔍 SessionContextService: Creating AUTHENTICATED context for user:', userId)
      return {
        role: 'authenticated',
        userId: userId,
        claims: userClaims
      }
    } else {
      // Anonymous user (with anon API key)
      console.log('🔍 SessionContextService: Creating ANONYMOUS context (NO USER ID)')
      const anonContext = {
        role: 'anon',
        claims: {
          role: 'anon',
          iss: 'supabase-lite'
        }
      }
      console.log('🔍 SessionContextService: Final anonymous context:', anonContext)
      return anonContext
    }
  }
}