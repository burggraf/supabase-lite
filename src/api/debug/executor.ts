/**
 * Debug operation executors
 */

import type { ApiRequest, ApiContext, ApiResponse } from '../types'
import { DatabaseManager } from '../../lib/database/connection'

/**
 * Debug SQL executor
 */
export async function debugSqlExecutor(
  request: ApiRequest,
  context: ApiContext
): Promise<ApiResponse> {
  const { sql } = request.body || {}

  if (!sql || typeof sql !== 'string') {
    throw {
      statusCode: 400,
      errorCode: 'MISSING_SQL',
      message: 'SQL query is required',
      details: 'Request body must contain a "sql" field with a valid SQL string'
    }
  }

  console.log('🐛 MSW: Executing debug SQL:', sql)

  const dbManager = DatabaseManager.getInstance()
  if (!dbManager.isConnected()) {
    throw {
      statusCode: 500,
      errorCode: 'DATABASE_NOT_CONNECTED',
      message: 'Database is not connected'
    }
  }

  try {
    // Use queryWithContext to ensure proper RLS and session context
    const sessionContext = {
      projectId: context.projectId || 'default',
      userId: context.sessionContext?.userId || context.userId,
      role: context.sessionContext?.role || context.role || 'anon',
      claims: context.sessionContext?.claims,
      jwt: context.sessionContext?.jwt
    }

    console.log('🐛 Debug SQL: Session context', sessionContext)

    const result = await dbManager.queryWithContext(sql, sessionContext)

    console.log('✅ MSW: Debug SQL executed successfully:', {
      requestId: context.requestId,
      rowCount: result.rows?.length || 0
    })

    return {
      data: {
        data: result.rows || [],
        rowCount: result.rows?.length || 0,
        executedAt: new Date().toISOString(),
        requestId: context.requestId
      },
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  } catch (error) {
    console.error('❌ MSW: Debug SQL error:', error)
    throw {
      statusCode: 400,
      errorCode: 'SQL_EXECUTION_ERROR',
      message: 'SQL execution failed',
      details: error instanceof Error ? error.message : String(error)
    }
  }
}