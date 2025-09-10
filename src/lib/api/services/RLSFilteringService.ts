import { logger } from '../../infrastructure/Logger'
import { SessionContextService, type AuthHeaders } from './SessionContextService'
import type { ParsedQuery } from '../../postgrest'
import type { SessionContext } from '../../database/connection'

export class RLSFilteringService {
  private sessionContextService: SessionContextService

  constructor() {
    this.sessionContextService = new SessionContextService()
  }

  /**
   * Apply RLS by setting session context instead of query filtering
   * RLS is now enforced at the database level via PostgreSQL policies
   */
  async applyRLSFiltering(
    table: string, 
    query: ParsedQuery, 
    headers: AuthHeaders
  ): Promise<{ query: ParsedQuery; context: SessionContext }> {
    // Create session context based on headers
    const context = await this.sessionContextService.createSessionContext(headers)
    
    logger.debug('Created session context for RLS', { 
      table, 
      role: context.role, 
      userId: context.userId 
    })

    // Return query unchanged - RLS enforcement happens at database level
    return { query, context }
  }
}