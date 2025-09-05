import { bucketHandlers } from './buckets'
import { objectHandlers } from './objects'
import { signedUrlHandlers } from './signed-urls'
import { policyHandlers } from './policies'

/**
 * All Storage API handlers
 * Combines bucket management, file operations, signed URLs, and policies
 */
export const storageHandlers = [
  ...bucketHandlers,
  ...objectHandlers,
  ...signedUrlHandlers,
  ...policyHandlers
]

// Re-export individual modules for direct access
export { bucketHandlers } from './buckets'
export { objectHandlers } from './objects'
export { signedUrlHandlers } from './signed-urls'
export { policyHandlers } from './policies'