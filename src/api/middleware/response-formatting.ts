/**
 * Response formatting middleware - standardizes API responses
 */

import type { MiddlewareFunction, ApiRequest, ApiContext, ApiResponse } from '../types'
import { ResponseFormatter } from '../../lib/postgrest'
import { logger } from '../../lib/infrastructure/Logger'

export const responseFormattingMiddleware: MiddlewareFunction = async (
  request: ApiRequest,
  context: ApiContext,
  next: () => Promise<ApiResponse>
): Promise<ApiResponse> => {

  const response = await next()

  // The QueryEngine already handles response formatting for REST API requests
  // This middleware is primarily for non-REST endpoints that need standardization
  logger.debug('Response formatting middleware - passing through', {
    requestId: context.requestId,
    path: request.url.pathname,
    status: response.status,
    dataType: Array.isArray(response.data) ? 'array' : typeof response.data
  })

  // Return the response as-is since QueryEngine handles REST API formatting
  return response
}