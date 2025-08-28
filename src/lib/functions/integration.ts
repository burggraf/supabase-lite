/**
 * Supabase Lite Edge Functions Integration
 * 
 * This module provides seamless integration with the existing Supabase ecosystem
 * by extending the official @supabase/supabase-js client with our Edge Functions implementation.
 */

import { FunctionsClient } from './FunctionsClient'

/**
 * Create a functions client that works with Supabase Lite
 * 
 * This creates a FunctionsClient instance configured to work with the local
 * Supabase Lite instance via MSW request interception.
 */
export function createFunctionsClient(options: {
  supabaseUrl: string
  supabaseKey: string
  headers?: Record<string, string>
}): FunctionsClient {
  return new FunctionsClient(options.supabaseUrl, options.supabaseKey, options.headers)
}

/**
 * Extend an existing Supabase client with functions functionality
 * 
 * This adds a `functions` property to any object (like a Supabase client instance)
 * that provides our Edge Functions implementation.
 */
export function addFunctionsToClient<T extends Record<string, any>>(
  client: T,
  options: {
    supabaseUrl: string
    supabaseKey: string
    headers?: Record<string, string>
  }
): T & { functions: FunctionsClient } {
  const functions = createFunctionsClient(options)
  
  return {
    ...client,
    functions
  }
}

/**
 * Get functions client options from a Supabase client URL and key
 */
export function getFunctionsClientOptions(supabaseUrl: string, supabaseKey: string) {
  return {
    supabaseUrl,
    supabaseKey,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  }
}

// Re-export everything from the main functions module
export * from './FunctionsClient'