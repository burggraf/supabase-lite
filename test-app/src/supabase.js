import { createClient } from '@supabase/supabase-js'
import { getEnvironmentConfig } from './config.js'
import CrossOriginAPIClient from './CrossOriginAPIClient.js'

let supabaseClient = null

export function createSupabaseClient(environment = 'local') {
  const config = getEnvironmentConfig(environment)
  
  if (!config) {
    throw new Error(`Unknown environment: ${environment}`)
  }

  // Check if this is a cross-origin environment
  if (config.url.startsWith('cross-origin://')) {
    // Extract the main app origin from the URL
    const mainAppOrigin = 'http://' + config.url.replace('cross-origin://', '')
    console.log('Creating cross-origin Supabase client for:', mainAppOrigin)
    
    // Create a custom client that uses cross-origin messaging
    return createCrossOriginSupabaseClient(mainAppOrigin, config)
  }

  // Create client with standard configuration for remote environments
  const clientConfig = {
    auth: {
      persistSession: true,
      detectSessionInUrl: false
    }
  }

  return createClient(config.url, config.anonKey, clientConfig)
}

function createCrossOriginSupabaseClient(mainAppOrigin, config) {
  const apiClient = new CrossOriginAPIClient(mainAppOrigin)
  
  // Create a mock Supabase client that intercepts calls and routes them through postMessage
  return {
    from: (table) => {
      const query = {
        _table: table,
        _columns: '*',
        _filters: [],
        _order: null,
        _single: false,
        
        select: function(columns = '*') {
          this._columns = columns
          return this
        },
        
        eq: function(column, value) {
          this._filters.push(`${column}=eq.${value}`)
          return this
        },
        
        order: function(column, options = {}) {
          const ascending = options.ascending !== false
          this._order = `${column}.${ascending ? 'asc' : 'desc'}`
          return this
        },
        
        single: function() {
          this._single = true
          return this
        },
        
        async execute() {
          // Build query parameters
          const params = []
          if (this._columns !== '*') {
            params.push(`select=${this._columns}`)
          }
          if (this._filters.length > 0) {
            params.push(...this._filters)
          }
          if (this._order) {
            params.push(`order=${this._order}`)
          }
          
          const path = `/rest/v1/${this._table}${params.length > 0 ? '?' + params.join('&') : ''}`
          const headers = {
            'apikey': config.anonKey,
            'Authorization': `Bearer ${config.anonKey}`
          }
          
          if (this._single) {
            headers['Accept'] = 'application/vnd.pgrst.object+json'
          }
          
          const response = await apiClient.get(path, headers)
          
          return {
            data: this._single ? (response.data?.[0] || null) : response.data,
            error: response.error ? { message: response.error } : null,
            status: response.status,
            statusText: response.status === 200 ? 'OK' : 'Error'
          }
        }
      }
      
      // Make it directly callable and return the query object
      return query
    },
      
      insert: (values) => ({
        select: (columns = '*') => ({
          async execute() {
            const path = `/rest/v1/${table}`
            const response = await apiClient.post(path, values, {
              'apikey': config.anonKey,
              'Authorization': `Bearer ${config.anonKey}`,
              'Content-Type': 'application/json',
              'Prefer': `return=${columns === '*' ? 'representation' : 'representation'}`
            })
            
            return {
              data: response.data,
              error: response.error ? { message: response.error } : null,
              status: response.status,
              statusText: response.status === 201 ? 'Created' : 'Error'
            }
          }
        }),
        
        async execute() {
          return this.select().execute()
        }
      }),
      
      update: (values) => ({
        eq: (column, value) => ({
          select: (columns = '*') => ({
            async execute() {
              const path = `/rest/v1/${table}?${column}=eq.${value}`
              const response = await apiClient.patch(path, values, {
                'apikey': config.anonKey,
                'Authorization': `Bearer ${config.anonKey}`,
                'Content-Type': 'application/json',
                'Prefer': `return=${columns === '*' ? 'representation' : 'representation'}`
              })
              
              return {
                data: response.data,
                error: response.error ? { message: response.error } : null,
                status: response.status,
                statusText: response.status === 200 ? 'OK' : 'Error'
              }
            }
          }),
          
          async execute() {
            return this.select().execute()
          }
        })
      }),
      
      delete: () => ({
        eq: (column, value) => ({
          async execute() {
            const path = `/rest/v1/${table}?${column}=eq.${value}`
            const response = await apiClient.delete(path, {
              'apikey': config.anonKey,
              'Authorization': `Bearer ${config.anonKey}`
            })
            
            return {
              data: response.data,
              error: response.error ? { message: response.error } : null,
              status: response.status,
              statusText: response.status === 200 ? 'OK' : 'Error'
            }
          }
        })
      })
    }),
    
    auth: {
      async getSession() {
        // For now, return a mock session
        return {
          data: {
            session: null
          },
          error: null
        }
      },
      
      async signInWithPassword(credentials) {
        return {
          data: { user: null, session: null },
          error: { message: 'Auth not yet implemented in cross-origin mode' }
        }
      },
      
      async signUp(credentials) {
        return {
          data: { user: null, session: null },
          error: { message: 'Auth not yet implemented in cross-origin mode' }
        }
      },
      
      async signOut() {
        return { error: null }
      },
      
      async resetPasswordForEmail(email) {
        return { error: { message: 'Auth not yet implemented in cross-origin mode' } }
      }
    }
  }
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