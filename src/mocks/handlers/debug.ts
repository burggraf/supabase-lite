import { http } from 'msw'
import { DatabaseManager } from '../../lib/database/connection'
import { withProjectResolution } from './shared/project-resolution'
import { 
  createErrorResponse, 
  createSuccessResponse,
  safeJsonParse
} from './shared/common-handlers'

/**
 * Common debug SQL handler function
 */
const createDebugSqlHandler = () => async ({ request }: any) => {
  try {
    const body = await safeJsonParse(request);
    const { sql } = body;
    
    if (!sql || typeof sql !== 'string') {
      return createErrorResponse(
        'SQL query is required',
        'Request body must contain a "sql" field with a valid SQL string',
        400
      );
    }

    console.log('🐛 MSW: Executing debug SQL:', sql);
    
    const dbManager = DatabaseManager.getInstance();
    if (!dbManager.isConnected()) {
      throw new Error('Database is not connected');
    }

    const result = await dbManager.query(sql);
    
    console.log('✅ MSW: Debug SQL executed successfully:', { rowCount: result.rows?.length || 0 });
    
    return createSuccessResponse({
      data: result.rows || [],
      rowCount: result.rows?.length || 0,
      executedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ MSW: Debug SQL error:', error);
    return createErrorResponse(
      'SQL execution failed',
      (error as Error).message,
      400
    );
  }
}

// Debug handlers
export const debugHandlers = [
  // Debug SQL endpoint - uses active project by default
  http.post('/debug/sql', withProjectResolution(createDebugSqlHandler())),

  // Debug SQL endpoint for specific project
  http.post('/:projectId/debug/sql', withProjectResolution(createDebugSqlHandler())),
]