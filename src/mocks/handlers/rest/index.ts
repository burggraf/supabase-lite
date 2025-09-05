import { crudHandlers } from './crud'
import { rpcHandlers } from './rpc'
import { schemaHandlers } from './schema'

/**
 * All REST/PostgREST API handlers
 * Combines CRUD operations, RPC calls, and schema inspection
 */
export const restHandlers = [
  ...crudHandlers,
  ...rpcHandlers,
  ...schemaHandlers
]

// Re-export individual modules for direct access
export { crudHandlers } from './crud'
export { rpcHandlers } from './rpc'
export { schemaHandlers } from './schema'