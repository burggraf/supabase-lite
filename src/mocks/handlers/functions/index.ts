import { functionExecutionHandlers } from './execution'

/**
 * All Functions API handlers
 * Combines edge function execution and management
 */
export const functionsHandlers = [
  ...functionExecutionHandlers
]

// Re-export individual modules for direct access
export { functionExecutionHandlers } from './execution'