// Import all modular handler groups
import { restHandlers } from './handlers/rest'
import { authHandlers } from './handlers/auth'
import { storageHandlers } from './handlers/storage'
import { functionsHandlers } from './handlers/functions'
import { appHostingHandlers } from './handlers/app-hosting'

// Import shared utilities
import { debugHandlers } from './handlers/shared/debug'
import { catchAllHandler } from './handlers/shared/catch-all'

/**
 * All API handlers organized by service
 * This replaces the monolithic handlers.ts file with modular, maintainable structure
 */
export const handlers = [
  // REST API - PostgREST compatible endpoints
  ...restHandlers,
  
  // Authentication API - Supabase Auth compatible
  ...authHandlers,
  
  // Storage API - Supabase Storage compatible
  ...storageHandlers,
  
  // Edge Functions API - Serverless function execution
  ...functionsHandlers,
  
  // App Hosting API - Static app deployment and serving
  ...appHostingHandlers,
  
  // Debug endpoints for development
  ...debugHandlers,
  
  // Catch-all handler for unmatched routes (must be last)
  catchAllHandler
]

// Export individual handler groups for backward compatibility
export {
  restHandlers,
  authHandlers,
  storageHandlers,
  functionsHandlers,
  appHostingHandlers,
  debugHandlers
}