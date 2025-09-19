/**
 * Modularized API handlers - Phase 2 implementation
 *
 * This file combines all feature-specific handlers into a single export
 * while maintaining clean separation of concerns by domain.
 */

import { dbHandlers } from './db/handlers'
import { debugHandlers } from './debug/handlers'
import { healthHandlers } from './health/handlers'

// Import remaining handlers from existing locations until migrated
import { authHandlers } from '../mocks/handlers/auth'
import { projectsHandlers } from '../mocks/handlers/projects'
import { storageHandlers } from '../mocks/handlers/storage'
import { vfsDirectHandlers } from '../mocks/handlers/vfs-direct'
import { applicationServerHandlers } from '../mocks/application-server/webvm-handlers'
import { functionsHandlers } from '../mocks/handlers/functions'
import { corsAndCatchAllHandler } from '../mocks/handlers/shared/cors'

/**
 * Combined handlers array maintaining the original order and functionality.
 *
 * Phase 2 Progress:
 * ✅ Database/REST handlers - moved to src/api/db/
 * ✅ Debug handlers - moved to src/api/debug/
 * ✅ Health handlers - moved to src/api/health/
 * 🚧 Auth handlers - still in mocks/handlers/auth
 * 🚧 Storage handlers - still in mocks/handlers/storage
 * 🚧 Functions handlers - still in mocks/handlers/functions
 * 🚧 Projects handlers - still in mocks/handlers/projects
 * 🚧 VFS/Files handlers - still in mocks/handlers/vfs-direct
 * 🚧 Application Server handlers - still in mocks/application-server/webvm-handlers
 */
export const handlers = [
  // ==== MIGRATED TO PHASE 2 STRUCTURE ====

  // Health check handlers (global endpoint)
  ...healthHandlers,

  // Database/REST API handlers
  ...dbHandlers,

  // Debug handlers
  ...debugHandlers,

  // ==== NOT YET MIGRATED (Phase 2 TODO) ====

  // Authentication handlers (must come first due to specific auth handlers before catch-all)
  ...authHandlers,

  // Project management handlers
  ...projectsHandlers,

  // Storage handlers (bucket management and object operations)
  ...storageHandlers,

  // VFS direct handlers (direct file access)
  ...vfsDirectHandlers,

  // Application Server handlers
  ...applicationServerHandlers,

  // Edge Functions handlers
  ...functionsHandlers,

  // CORS and catch-all handler (must be last)
  corsAndCatchAllHandler,
]