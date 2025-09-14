/**
 * Unified API Kernel - Composable request processing pipeline
 *
 * This replaces the dual-bridge system with a single, unified pipeline
 * that can be extended with middleware functions for different concerns.
 */

import type {
  ApiRequest,
  ApiContext,
  ApiResponse,
  MiddlewareFunction,
  ExecutorFunction
} from './types'
import { HttpResponse } from 'msw'
import { logger } from '../lib/infrastructure/Logger'

// Import all middleware
import { instrumentationMiddleware } from './middleware/instrumentation'
import { corsMiddleware } from './middleware/cors'
import { projectResolutionMiddleware } from './middleware/project-resolution'
import { authenticationMiddleware } from './middleware/authentication'
import { requestParsingMiddleware } from './middleware/request-parsing'
import { responseFormattingMiddleware } from './middleware/response-formatting'
import { errorHandlingMiddleware } from './middleware/error-handling'

/**
 * Creates a unified API handler with the standard middleware pipeline
 */
export function createApiHandler(executor: ExecutorFunction) {
  return async (info: any) => {
    const { request, params } = info
    // Convert MSW Request to our internal ApiRequest format
    const apiRequest: ApiRequest = {
      url: new URL(request.url),
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await getRequestBody(request),
      params: params || {}
    }

    // Initialize context
    const context: ApiContext = {
      requestId: '',
      startTime: performance.now()
    }

    try {
      // Execute the middleware pipeline
      const response = await executeMiddlewarePipeline(
        apiRequest,
        context,
        executor
      )

      // Convert our internal ApiResponse back to MSW HttpResponse
      // Handle different content types properly
      const contentType = response.headers['Content-Type'] || response.headers['content-type'] || 'application/json'

      if (contentType.startsWith('text/csv')) {
        // For CSV responses, return raw text content
        return new HttpResponse(response.data, {
          status: response.status,
          headers: response.headers
        })
      } else {
        // For JSON responses, use HttpResponse.json
        return HttpResponse.json(response.data, {
          status: response.status,
          headers: response.headers
        })
      }
    } catch (error) {
      // Final error fallback - this should rarely execute due to error handling middleware
      logger.error('Kernel error fallback triggered', {
        error: error instanceof Error ? error.message : String(error),
        requestId: context.requestId,
        url: apiRequest.url.toString()
      })

      return HttpResponse.json(
        {
          error: 'KERNEL_ERROR',
          message: 'An unexpected error occurred in the API kernel'
        },
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }
  }
}

/**
 * Execute the complete middleware pipeline
 */
async function executeMiddlewarePipeline(
  request: ApiRequest,
  context: ApiContext,
  executor: ExecutorFunction
): Promise<ApiResponse> {

  // Define the complete middleware pipeline in order
  const middlewareStack: MiddlewareFunction[] = [
    errorHandlingMiddleware,        // Wrap everything in error handling
    instrumentationMiddleware,      // Request tracking and performance
    corsMiddleware,                // CORS header management
    projectResolutionMiddleware,    // Extract project and switch database
    authenticationMiddleware,       // JWT decoding and RLS context
    requestParsingMiddleware,       // Parse request into standardized format
    responseFormattingMiddleware    // Format response according to API standards
  ]

  // Create the execution chain
  let index = 0

  const next = async (): Promise<ApiResponse> => {
    if (index < middlewareStack.length) {
      const middleware = middlewareStack[index++]
      return middleware(request, context, next)
    } else {
      // All middleware has run, execute the actual handler
      return executor(request, context)
    }
  }

  return next()
}

/**
 * Helper to extract request body in a safe way
 */
async function getRequestBody(request: Request): Promise<any> {
  if (!request.body) {
    return null
  }

  try {
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      return await request.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      return Object.fromEntries(formData.entries())
    } else {
      return await request.text()
    }
  } catch (error) {
    logger.debug('Failed to parse request body', {
      error: error instanceof Error ? error.message : String(error),
      contentType: request.headers.get('content-type')
    })
    return null
  }
}

/**
 * Convenience function to create simple handlers that don't need the full pipeline
 * Useful for health checks, static content, etc.
 */
export function createSimpleHandler(
  handler: (request: ApiRequest, context: ApiContext) => Promise<ApiResponse> | ApiResponse
) {
  return createApiHandler(async (request: ApiRequest, context: ApiContext) => {
    const result = await handler(request, context)
    return result
  })
}

/**
 * Debug function to inspect pipeline state
 */
export function enableKernelDebugging() {
  if (typeof window !== 'undefined') {
    ;(window as any).mswDebug = {
      ...(window as any).mswDebug,
      kernelInfo: () => {
        return {
          middlewareCount: 7,
          middlewareStack: [
            'errorHandlingMiddleware',
            'instrumentationMiddleware',
            'corsMiddleware',
            'projectResolutionMiddleware',
            'authenticationMiddleware',
            'requestParsingMiddleware',
            'responseFormattingMiddleware'
          ],
          version: '1.0.0'
        }
      },
      enableKernelVerboseLogging: () => {
        // This could be used to enable more detailed pipeline logging
        console.log('🔧 Kernel verbose logging enabled')
      }
    }
  }
}

// Enable debugging in browser environment
if (typeof window !== 'undefined') {
  enableKernelDebugging()
}