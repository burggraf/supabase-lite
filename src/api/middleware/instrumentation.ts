/**
 * Enhanced instrumentation middleware for request tracking and performance monitoring
 * Provides comprehensive debugging capabilities including pipeline stage tracing
 */

import type { MiddlewareFunction, ApiRequest, ApiContext, ApiResponse } from '../types'
import { getApiConfig } from '../config'
import { logger } from '../../lib/infrastructure/Logger'

// Global request tracking for debugging tools
interface RequestTrace {
  requestId: string
  method: string
  url: string
  startTime: number
  stages: Array<{
    stage: string
    timestamp: number
    duration?: number
    data?: any
  }>
  completed: boolean
  error?: any
}

// In-memory request trace storage (for debugging tools like window.mswDebug)
const activeTraces = new Map<string, RequestTrace>()
const completedTraces: RequestTrace[] = []
const MAX_COMPLETED_TRACES = 100

/**
 * Generate a unique request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Add a stage to the request trace
 */
function addTraceStage(requestId: string, stage: string, data?: any) {
  const trace = activeTraces.get(requestId)
  if (trace && getApiConfig().debugging.enableRequestTracing) {
    const now = performance.now()
    const previousStage = trace.stages[trace.stages.length - 1]
    const duration = previousStage ? now - previousStage.timestamp : undefined

    // Update previous stage duration
    if (previousStage && duration !== undefined) {
      previousStage.duration = duration
    }

    trace.stages.push({
      stage,
      timestamp: now,
      data: getApiConfig().debugging.enableVerboseLogging ? data : undefined
    })
  }
}

/**
 * Complete a request trace
 */
function completeTrace(requestId: string, success: boolean, error?: any) {
  const trace = activeTraces.get(requestId)
  if (trace) {
    trace.completed = true
    trace.error = error

    // Calculate final duration for last stage
    const lastStage = trace.stages[trace.stages.length - 1]
    if (lastStage) {
      lastStage.duration = performance.now() - lastStage.timestamp
    }

    // Move to completed traces
    activeTraces.delete(requestId)
    completedTraces.push(trace)

    // Keep only the last MAX_COMPLETED_TRACES
    if (completedTraces.length > MAX_COMPLETED_TRACES) {
      completedTraces.shift()
    }
  }
}

export const instrumentationMiddleware: MiddlewareFunction = async (
  request: ApiRequest,
  context: ApiContext,
  next: () => Promise<ApiResponse>
): Promise<ApiResponse> => {
  const config = getApiConfig()

  // Assign unique request ID for tracing
  if (!context.requestId) {
    context.requestId = generateRequestId()
  }

  // Set start time for performance tracking
  const startTime = performance.now()
  context.startTime = startTime

  // Initialize request trace
  if (config.debugging.enableRequestTracing) {
    const trace: RequestTrace = {
      requestId: context.requestId,
      method: request.method,
      url: request.url.pathname + request.url.search,
      startTime,
      stages: [],
      completed: false
    }
    activeTraces.set(context.requestId, trace)

    addTraceStage(context.requestId, 'instrumentation', {
      headers: config.debugging.enableVerboseLogging ? request.headers : undefined,
      body: config.debugging.enableVerboseLogging && request.body ? request.body : undefined
    })
  }

  // Log request start
  if (config.debugging.enableInstrumentation) {
    const logMessage = `${request.method} ${request.url.pathname}`
    const logData = {
      requestId: context.requestId,
      method: request.method,
      url: request.url.pathname,
      search: request.url.search || undefined,
      userAgent: request.headers['user-agent'],
      origin: request.headers['origin']
    }

    if (config.debugging.enableVerboseLogging) {
      logger.debug(`🔍 Starting request: ${logMessage}`, logData)
    } else {
      logger.info(`🔍 ${logMessage}`, { requestId: context.requestId })
    }
  }

  try {
    // Add context methods for middleware to report their stages
    context.reportStage = (stage: string, data?: any) => {
      addTraceStage(context.requestId!, stage, data)
    }

    const response = await next()

    const duration = performance.now() - startTime

    // Log successful completion
    if (config.debugging.enablePerformanceTracking) {
      logger.info(`⏱️ Request completed`, {
        requestId: context.requestId,
        duration: Math.round(duration * 100) / 100,
        status: response.status,
        dataSize: typeof response.data === 'string' ? response.data.length :
                  response.data ? JSON.stringify(response.data).length : 0
      })
    }

    // Complete trace
    completeTrace(context.requestId, true)

    // Add X-Request-ID header for debugging
    if (config.debugging.enableRequestTracing) {
      response.headers = {
        ...response.headers,
        'X-Request-ID': context.requestId
      }
    }

    return response

  } catch (error: any) {
    const duration = performance.now() - startTime

    // Log error
    logger.error(`❌ Request failed`, {
      requestId: context.requestId,
      duration: Math.round(duration * 100) / 100,
      error: error instanceof Error ? error.message : String(error),
      stack: config.debugging.enableVerboseLogging && error instanceof Error ? error.stack : undefined
    })

    // Complete trace with error
    completeTrace(context.requestId, false, error)

    throw error
  }
}

/**
 * Debugging utilities for browser console access
 */
export function getDebugInfo() {
  return {
    activeRequests: Array.from(activeTraces.values()),
    recentRequests: completedTraces.slice(-20),
    totalRequests: completedTraces.length,

    // Helper methods for debugging
    getRequestById: (requestId: string) => {
      return activeTraces.get(requestId) ||
             completedTraces.find(t => t.requestId === requestId)
    },

    getRequestsByUrl: (urlPattern: string) => {
      const regex = new RegExp(urlPattern)
      return completedTraces.filter(t => regex.test(t.url))
    },

    clearHistory: () => {
      completedTraces.length = 0
    },

    enableVerboseLogging: () => {
      const config = getApiConfig()
      config.debugging.enableVerboseLogging = true
      logger.info('🔧 Verbose logging enabled')
    },

    disableVerboseLogging: () => {
      const config = getApiConfig()
      config.debugging.enableVerboseLogging = false
      logger.info('🔧 Verbose logging disabled')
    },

    getConfig: () => getApiConfig()
  }
}

// Expose debugging tools to global scope in development
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as any).apiDebug = getDebugInfo()
}