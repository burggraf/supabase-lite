/**
 * Supabase Lite Storage Integration
 * 
 * This module provides seamless integration with the existing Supabase ecosystem
 * by extending the official @supabase/supabase-js client with our storage implementation.
 */

import { StorageClient } from './StorageClient'
import type { StorageClientOptions } from './types'

/**
 * Create a storage client that works with Supabase Lite
 * 
 * This creates a StorageClient instance configured to work with the local
 * Supabase Lite instance via MSW request interception.
 */
export function createStorageClient(options: {
  supabaseUrl: string
  supabaseKey: string
  headers?: Record<string, string>
}): StorageClient {
  const storageOptions: StorageClientOptions = {
    apiUrl: options.supabaseUrl,
    apiKey: options.supabaseKey,
    headers: options.headers
  }

  return new StorageClient(storageOptions)
}

/**
 * Extend an existing Supabase client with storage functionality
 * 
 * This adds a `storage` property to any object (like a Supabase client instance)
 * that provides our storage implementation.
 */
export function addStorageToClient<T extends Record<string, any>>(
  client: T,
  options: {
    supabaseUrl: string
    supabaseKey: string
    headers?: Record<string, string>
  }
): T & { storage: StorageClient } {
  const storage = createStorageClient(options)
  
  return {
    ...client,
    storage
  }
}

/**
 * Get storage client options from a Supabase client URL and key
 */
export function getStorageClientOptions(supabaseUrl: string, supabaseKey: string) {
  return {
    supabaseUrl,
    supabaseKey,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  }
}

// Re-export everything from the main storage module
export * from './index'