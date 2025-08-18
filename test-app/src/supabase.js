import { createClient } from '@supabase/supabase-js'
import { getEnvironmentConfig } from './config.js'

let supabaseClient = null

export function createSupabaseClient(environment = 'local') {
  const config = getEnvironmentConfig(environment)
  
  if (!config) {
    throw new Error(`Unknown environment: ${environment}`)
  }

  // For local environment, we need special configuration
  const clientConfig = {}
  
  if (environment === 'local') {
    // Configure for local MSW-based API
    clientConfig.global = {
      fetch: (url, options = {}) => {
        // Ensure we're hitting the local dev server
        const localUrl = url.toString().replace(config.url, 'http://localhost:5173')
        return fetch(localUrl, options)
      }
    }
  }

  return createClient(config.url, config.anonKey, clientConfig)
}

export function getSupabaseClient(environment) {
  return createSupabaseClient(environment)
}

// Helper to run the same operation on both environments
export async function runOnBothEnvironments(operation) {
  const results = {}
  
  try {
    const localClient = getSupabaseClient('local')
    results.local = await operation(localClient, 'local')
  } catch (error) {
    results.local = { error: error.message, stack: error.stack }
  }
  
  try {
    const remoteClient = getSupabaseClient('remote')
    results.remote = await operation(remoteClient, 'remote')
  } catch (error) {
    results.remote = { error: error.message, stack: error.stack }
  }
  
  return results
}