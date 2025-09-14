import { http } from 'msw'
import { createApiHandler } from '../kernel'
import { debugSqlExecutor } from './executor'

// Debug handlers using the unified kernel
export const debugHandlers = [
  // Debug SQL endpoint - uses active project by default
  http.post('/debug/sql', createApiHandler(debugSqlExecutor)),

  // Debug SQL endpoint for specific project
  http.post('/:projectId/debug/sql', createApiHandler(debugSqlExecutor)),
]