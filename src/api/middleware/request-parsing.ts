/**
 * Request parsing middleware - unified query parsing for all requests
 */

import type { MiddlewareFunction, ApiRequest, ApiContext, ApiResponse, ParsedQuery } from '../types'
import { QueryParser } from '../../lib/postgrest'
import { logger } from '../../lib/infrastructure/Logger'

export const requestParsingMiddleware: MiddlewareFunction = async (
  request: ApiRequest,
  context: ApiContext,
  next: () => Promise<ApiResponse>
): Promise<ApiResponse> => {

  // Only parse requests that have table parameters (database operations)
  const pathSegments = request.url.pathname.split('/').filter(s => s)
  const isRestApiRequest = pathSegments.includes('rest') || pathSegments.includes('v1')

  if (isRestApiRequest && request.params?.table) {
    try {
      // Use the existing QueryParser for full PostgREST compatibility
      const parsedQuery = QueryParser.parseQuery(request.url, request.headers)

      // Add parsed query to the request for downstream handlers
      ;(request as any).parsedQuery = {
        ...parsedQuery,
        table: request.params.table,
        method: request.method as any
      }

      logger.debug('Request parsed successfully', {
        requestId: context.requestId,
        table: request.params.table,
        method: request.method,
        hasFilters: parsedQuery.filters && parsedQuery.filters.length > 0,
        hasEmbeds: parsedQuery.embed && Object.keys(parsedQuery.embed).length > 0
      })
    } catch (error) {
      logger.error('Failed to parse request', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
        url: request.url.toString()
      })

      // Continue with basic request info if parsing fails
      ;(request as any).parsedQuery = {
        table: request.params?.table,
        method: request.method as any
      }
    }
  }

  return next()
}