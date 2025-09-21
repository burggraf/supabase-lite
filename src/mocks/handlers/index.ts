/**
 * Aggregated handlers for all API domains
 * 
 * This file combines all domain-specific handlers into a single export
 * while maintaining the same order as the original monolithic handlers file
 * to ensure compatibility and proper handler priority.
 */

import { restHandlers } from './rest'
import { authHandlers } from './auth'
import { projectsHandlers } from './projects'
import { debugHandlers } from './debug'
import { healthHandlers } from './health'
import { storageHandlers } from './storage'
import { vfsDirectHandlers } from './vfs-direct'
import { appHandlers } from './app'
import { corsAndCatchAllHandler } from './shared/cors'

/**
 * Combined handlers array maintaining the original order:
 * 1. Auth handlers (must come first due to specific auth handlers before catch-all)
 * 2. REST handlers 
 * 3. Projects handlers
 * 4. Debug handlers
 * 5. Health handlers
 * 6. Storage handlers (bucket management and object operations)
 * 7. VFS direct handlers (direct file access)
 * 8. App hosting handlers (SPA serving)
 * 9. CORS and catch-all handler (must be last)
 */
export const handlers = [
  // ==== AUTHENTICATION HANDLERS FIRST (must come before catch-all) ====
  ...authHandlers,
  
  // ==== REST API HANDLERS ====
  ...restHandlers,
  
  // ==== PROJECT MANAGEMENT HANDLERS ====
  ...projectsHandlers,
  
  // ==== DEBUG HANDLERS ====
  ...debugHandlers,
  
  // ==== HEALTH CHECK HANDLERS ====
  ...healthHandlers,
  
  // ==== STORAGE HANDLERS ====
  ...storageHandlers,
  
  // ==== VFS DIRECT FILE ACCESS HANDLERS ====
  ...vfsDirectHandlers,
  
  // ==== APP HOSTING HANDLERS ====
  ...appHandlers,
  
  // ==== CORS PREFLIGHT AND CATCH-ALL (must be last) ====
  corsAndCatchAllHandler,
]
