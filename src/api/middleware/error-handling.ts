/**
 * Error handling middleware - standardizes error responses
 */

import type { MiddlewareFunction, ApiRequest, ApiContext, ApiResponse } from '../types'
import { ApiError, isApiError, getErrorInfo } from '../errors'
import { getApiConfig } from '../config'
import { logger } from '../../lib/infrastructure/Logger'

export const errorHandlingMiddleware: MiddlewareFunction = async (
  request: ApiRequest,
  context: ApiContext,
  next: () => Promise<ApiResponse>
): Promise<ApiResponse> => {

  try {
    return await next()
  } catch (error: any) {
    const config = getApiConfig()
    const duration = performance.now() - context.startTime

    // Convert any error to standardized format
    let apiError: ApiError
    if (isApiError(error)) {
      apiError = error
    } else {
      apiError = ApiError.fromError(error, undefined, context.requestId)
    }

    // Log the error with appropriate detail level
    const errorLevel = apiError.statusCode >= 500 ? 'error' : 'warn'
    logger[errorLevel](`Request failed after ${duration.toFixed(2)}ms`, {
      requestId: context.requestId,
      method: request.method,
      url: request.url.pathname,
      errorCode: apiError.errorCode,
      statusCode: apiError.statusCode,
      message: apiError.message,
      details: config.debugging.enableVerboseLogging ? apiError.details : undefined,
      stack: config.debugging.enableVerboseLogging && error instanceof Error ? error.stack : undefined
    })

    // Build response headers with CORS support
    const corsConfig = config.cors
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (corsConfig.allowedOrigins.includes('*') || corsConfig.allowedOrigins.includes(request.headers['origin'] || '')) {
      responseHeaders['Access-Control-Allow-Origin'] = request.headers['origin'] || '*'
    }
    if (corsConfig.credentials) {
      responseHeaders['Access-Control-Allow-Credentials'] = 'true'
    }

    // Include request ID in headers for debugging
    if (context.requestId) {
      responseHeaders['X-Request-ID'] = context.requestId
    }

    // Format error response based on configuration
    let errorData: any
    if (config.request.enableDetailedErrors) {
      // Development mode - include full error details
      errorData = apiError.toPostgRESTFormat()
      if (config.debugging.enableVerboseLogging && apiError.details) {
        errorData.details = apiError.details
      }
    } else {
      // Production mode - minimal error information for security
      errorData = {
        code: apiError.errorCode,
        message: apiError.statusCode >= 500 ? 'Internal server error' : apiError.message
      }
    }

    return {
      data: errorData,
      status: apiError.statusCode,
      headers: responseHeaders
    }
  }
}