/**
 * Supabase Storage SDK
 * 
 * Drop-in compatible replacement for @supabase/storage-js
 */

export { StorageClient } from './StorageClient'
export { StorageBucket } from './StorageBucket'
export { StorageError } from './StorageError'
export type * from './types'

// Default export for compatibility
export { StorageClient as default } from './StorageClient'