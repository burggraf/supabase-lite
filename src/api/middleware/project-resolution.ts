/**
 * Project resolution middleware - replaces withProjectResolution HOF
 */

import type { MiddlewareFunction, ApiRequest, ApiContext, ApiResponse } from '../types'
import { resolveAndSwitchToProject, normalizeApiPath } from '../../mocks/project-resolver'
import { logger } from '../../lib/infrastructure/Logger'

// Endpoints that should not go through project resolution
const GLOBAL_ENDPOINTS = [
  '/health',
  '/projects',
  '/admin/projects'
]

export const projectResolutionMiddleware: MiddlewareFunction = async (
  request: ApiRequest,
  context: ApiContext,
  next: () => Promise<ApiResponse>
): Promise<ApiResponse> => {
  const startTime = performance.now()

  // Skip project resolution for global endpoints
  const pathname = request.url.pathname
  if (GLOBAL_ENDPOINTS.some(endpoint => pathname === endpoint || pathname.startsWith(endpoint + '/'))) {
    logger.debug(`Skipping project resolution for global endpoint: ${pathname}`, {
      requestId: context.requestId
    })
    return next()
  }

  // Resolve and switch to the appropriate project database
  const resolution = await resolveAndSwitchToProject(request.url)

  if (!resolution.success) {
    logger.error(`Project resolution failed for ${request.url.pathname}:`, resolution.error)
    throw {
      statusCode: 404,
      errorCode: 'PROJECT_NOT_FOUND',
      message: resolution.error || 'Project not found'
    }
  }

  // Store project information in context
  context.projectId = resolution.projectId
  context.projectName = resolution.projectName

  // Normalize the URL to remove project identifier for downstream handlers
  const normalizedUrl = normalizeApiPath(request.url)

  // Update the request with normalized URL in place
  request.url = normalizedUrl

  const resolutionTime = performance.now() - startTime
  logger.debug(`Project resolved in ${resolutionTime.toFixed(2)}ms`, {
    requestId: context.requestId,
    projectId: context.projectId,
    originalPath: request.url.pathname,
    normalizedPath: normalizedUrl.pathname
  })

  return next()
}