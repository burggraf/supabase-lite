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
    const apiKey = headers.apikey || headers['x-api-key']
    const authHeader = headers.authorization || headers.Authorization

    // Extract role from API key
    let apiKeyRole: 'anon' | 'service_role' = 'anon'
    if (apiKey) {
      const extractedRole = apiKeyGenerator.extractRole(apiKey)
      if (extractedRole) {
        apiKeyRole = extractedRole
      }
    }

    // If service_role API key, create service context (bypasses RLS)
    if (apiKeyRole === 'service_role') {
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
      try {
        // Try to extract user ID from JWT
        userId = this.extractUserIdFromJWT(token)
        
        // Create basic user claims
        if (userId) {
          userClaims = {
            sub: userId,
            role: 'authenticated',
            iss: 'supabase-lite'
          }
        }
      } catch (error) {
        logger.debug('Failed to parse user JWT', { error })
      }
    }

    // Return appropriate context
    if (userClaims && userId) {
      // Authenticated user
      return {
        role: 'authenticated',
        userId: userId,
        claims: userClaims
      }
    } else {
      // Anonymous user (with anon API key)
      return {
        role: 'anon',
        claims: {
          role: 'anon',
          iss: 'supabase-lite'
        }
      }
    }
  }
}