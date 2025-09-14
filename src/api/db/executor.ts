/**
 * Database operation executors - handles REST and RPC operations
 * Phase 3: Now using unified QueryEngine instead of dual-bridge architecture
 */

import type { ApiRequest, ApiContext, ApiResponse } from '../types'
import { QueryEngine } from './QueryEngine'
import { ApiError, ApiErrorCode } from '../errors'
import { logger } from '../../lib/infrastructure/Logger'

// Initialize the unified query engine (Phase 3 implementation)
const queryEngine = new QueryEngine()

/**
 * Main REST executor for database CRUD operations
 */
export async function restExecutor(
  request: ApiRequest,
  context: ApiContext
): Promise<ApiResponse> {

  const table = request.params?.table
  if (!table) {
    throw new ApiError(
      ApiErrorCode.MISSING_REQUIRED_PARAMETER,
      'Table parameter is required',
      { parameter: 'table' },
      'Check that the table name is included in the request URL',
      context.requestId
    )
  }

  logger.debug('Executing REST operation', {
    requestId: context.requestId,
    method: request.method,
    table: table,
    projectId: context.projectId,
    contextUserId: context.userId,
    contextRole: context.role,
    hasSessionContext: !!context.sessionContext,
    sessionContextUserId: context.sessionContext?.userId,
    sessionContextRole: context.sessionContext?.role
  })

  try {
    // Use the unified query engine for database operations
    const response = await queryEngine.processRequest(request, context)

    logger.debug('Executor: QueryEngine response', {
      requestId: context.requestId,
      responseData: response.data,
      responseStatus: response.status,
      responseHeaders: Object.keys(response.headers || {}),
      dataType: typeof response.data,
      dataLength: Array.isArray(response.data) ? response.data.length : 'not_array'
    })

    // ResponseFormatter handles CSV formatting and content-type correctly
    // Don't override its work - just pass through the response
    return {
      data: response.data,
      status: response.status,
      headers: response.headers // Use ResponseFormatter's headers as-is
    }
  } catch (error: any) {
    logger.error('REST operation failed', {
      requestId: context.requestId,
      table: table,
      method: request.method,
      error: error.message || String(error)
    })

    // Convert to standardized API error for the error handling middleware
    throw ApiError.fromError(error, ApiErrorCode.QUERY_ERROR, context.requestId)
  }
}

/**
 * RPC executor for stored procedures
 */
export async function rpcExecutor(
  request: ApiRequest,
  context: ApiContext
): Promise<ApiResponse> {
  const functionName = request.params?.functionName
  if (!functionName) {
    throw new ApiError(
      ApiErrorCode.MISSING_REQUIRED_PARAMETER,
      'Function name parameter is required',
      { parameter: 'functionName' },
      'Check that the function name is included in the request URL',
      context.requestId
    )
  }

  try {
    let body: any = request.body

    // For GET requests, extract parameters from query string
    if (request.method === 'GET') {
      const queryParams: Record<string, any> = {}

      // Convert URLSearchParams to plain object
      for (const [key, value] of request.url.searchParams.entries()) {
        try {
          queryParams[key] = JSON.parse(value)
        } catch {
          queryParams[key] = value
        }
      }

      body = queryParams
    }

    // RPC operations still use orchestrator for now - will be migrated in future phase
    // TODO: Integrate RPC functionality into QueryEngine
    const { APIRequestOrchestrator } = await import('../../lib/api/core/APIRequestOrchestrator')
    const apiOrchestrator = new APIRequestOrchestrator()

    const response = await apiOrchestrator.handleRpc(
      functionName,
      body,
      request.headers,
      request.url
    )

    return {
      data: response.data,
      status: response.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...response.headers
      }
    }
  } catch (error: any) {
    throw ApiError.fromError(error, ApiErrorCode.FUNCTION_ERROR, context.requestId)
  }
}

/**
 * HEAD executor for metadata requests
 */
export async function headExecutor(
  request: ApiRequest,
  context: ApiContext
): Promise<ApiResponse> {
  // HEAD requests should return the same headers as GET but no body
  const table = request.params?.table
  if (!table) {
    throw new ApiError(
      ApiErrorCode.MISSING_REQUIRED_PARAMETER,
      'Table parameter is required',
      { parameter: 'table' },
      'Check that the table name is included in the request URL',
      context.requestId
    )
  }

  try {
    // Use query engine for HEAD requests - process as GET but return no body
    const tempRequest = { ...request, method: 'GET' }
    const response = await queryEngine.processRequest(tempRequest, context)

    return {
      data: null, // HEAD requests have no body
      status: response.status,
      headers: response.headers
    }
  } catch (error: any) {
    throw ApiError.fromError(error, ApiErrorCode.QUERY_ERROR, context.requestId)
  }
}