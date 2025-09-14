import { http } from 'msw'
import { createApiHandler } from '../kernel'
import { restExecutor, rpcExecutor, headExecutor } from './executor'

// Database/REST API handlers using the unified kernel
export const dbHandlers = [
  // Non-project-scoped REST handlers
  http.get('/rest/v1/:table', createApiHandler(restExecutor)),
  http.head('/rest/v1/:table', createApiHandler(headExecutor)),
  http.post('/rest/v1/:table', createApiHandler(restExecutor)),
  http.patch('/rest/v1/:table', createApiHandler(restExecutor)),
  http.delete('/rest/v1/:table', createApiHandler(restExecutor)),

  // Project-scoped REST handlers
  http.get('/:projectId/rest/v1/:table', createApiHandler(restExecutor)),
  http.head('/:projectId/rest/v1/:table', createApiHandler(headExecutor)),
  http.post('/:projectId/rest/v1/:table', createApiHandler(restExecutor)),
  http.patch('/:projectId/rest/v1/:table', createApiHandler(restExecutor)),
  http.delete('/:projectId/rest/v1/:table', createApiHandler(restExecutor)),

  // RPC handlers
  http.post('/rest/v1/rpc/:functionName', createApiHandler(rpcExecutor)),
  http.post('/:projectId/rest/v1/rpc/:functionName', createApiHandler(rpcExecutor)),

  // RPC GET handlers (for read-only functions with { get: true })
  http.get('/rest/v1/rpc/:functionName', createApiHandler(rpcExecutor)),
  http.get('/:projectId/rest/v1/rpc/:functionName', createApiHandler(rpcExecutor)),
]