/**
 * REST API executor - handles database operations through the unified pipeline
 */

import type { ApiRequest, ApiContext, ApiResponse } from '../types'
import { APIRequestOrchestrator } from '../../lib/api/core/APIRequestOrchestrator'
import { logger } from '../../lib/infrastructure/Logger'

// Initialize the API orchestrator (existing business logic)
const apiOrchestrator = new APIRequestOrchestrator()

export async function restExecutor(
  request: ApiRequest,
  context: ApiContext
): Promise<ApiResponse> {

  const table = request.params?.table
  if (!table) {
    throw {
      statusCode: 400,
      errorCode: 'MISSING_TABLE',
      message: 'Table parameter is required'
    }
  }

  logger.debug('Executing REST operation', {
    requestId: context.requestId,
    method: request.method,
    table: table,
    projectId: context.projectId
  })

  try {
    // Use the existing orchestrator for the actual database operations
    const response = await apiOrchestrator.handleRestRequest({
      table: table,
      method: request.method as any,
      headers: request.headers,
      url: request.url,
      body: request.body
    })

    // Check if CSV format was requested via Accept header
    const acceptHeader = request.headers.accept || request.headers.Accept
    const isCSVRequest = acceptHeader === 'text/csv'

    if (isCSVRequest) {
      // For CSV requests, return raw CSV content
      return {
        data: response.data,
        status: response.status,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          ...response.headers
        }
      }
    } else {
      // For JSON requests, return normal Supabase response structure
      return {
        data: response.data,
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          ...response.headers
        }
      }
    }
  } catch (error: any) {
    logger.error('REST operation failed', {
      requestId: context.requestId,
      table: table,
      method: request.method,
      error: error.message || String(error)
    })

    // Re-throw as API error for the error handling middleware
    throw {
      statusCode: error.status || error.statusCode || 500,
      errorCode: error.code || 'REST_ERROR',
      message: error.message || 'Database operation failed',
      details: error.details || error
    }
  }
}