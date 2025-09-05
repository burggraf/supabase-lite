import { HttpResponse } from 'msw'
import { DatabaseManager } from '../../../lib/database/connection'
import { createPostRoutes } from './route-factory'
import { handleError, createGenericError } from './error-handling'
import { addCorsHeaders } from './cors'

const dbManager = DatabaseManager.getInstance()

/**
 * Handler for POST /debug/sql
 * Executes SQL queries directly against the database for development/debugging
 */
const createDebugSQLHandler = async ({ request }: any) => {
  try {
    const { sql } = await request.json()
    
    if (!sql || typeof sql !== 'string') {
      return HttpResponse.json({
        error: 'SQL query is required',
        message: 'Please provide a valid SQL query in the request body'
      }, {
        status: 400,
        headers: addCorsHeaders({
          'Content-Type': 'application/json'
        })
      })
    }

    console.log('🐛 MSW: Executing debug SQL:', sql)
    
    if (!dbManager.isConnected()) {
      throw new Error('Database is not connected')
    }
    
    // Execute the SQL query
    const result = await dbManager.query(sql)
    
    console.log('✅ MSW: Debug SQL executed successfully')
    
    return HttpResponse.json({
      success: true,
      data: result.rows,
      rowCount: result.rows?.length || 0,
      query: sql,
      executedAt: new Date().toISOString()
    }, {
      status: 200,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      })
    })
  } catch (error: any) {
    console.error('❌ MSW: Debug SQL error:', error)
    return createGenericError(
      error.message || 'Failed to execute SQL query',
      500,
      { 'X-Debug-Error': 'SQL execution failed' }
    )
  }
}

/**
 * Export debug handlers for development tools
 */
export const debugHandlers = [
  // SQL execution endpoint for both regular and project-specific routes
  ...createPostRoutes('/debug/sql', createDebugSQLHandler)
]