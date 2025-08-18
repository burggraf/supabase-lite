import { createClient } from '@supabase/supabase-js'
import { getEnvironmentConfig } from './config.js'

let supabaseClient = null

export function createSupabaseClient(environment = 'local') {
  const config = getEnvironmentConfig(environment)
  
  if (!config) {
    throw new Error(`Unknown environment: ${environment}`)
  }

  // Create client with standard configuration
  const clientConfig = {
    auth: {
      persistSession: false,
      detectSessionInUrl: false
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