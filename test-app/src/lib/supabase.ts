import { createClient } from '@supabase/supabase-js'

// Get the Supabase URL and anonymous key
// These will point to our local Supabase Lite instance
const getSupabaseConfig = () => {
  const savedPort = localStorage.getItem('supabase-lite-test-port')
  const port = savedPort ? parseInt(savedPort) : 5173 // Default to main app port
  
  return {
    url: `http://localhost:${port}`,
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQyMDk2MDAsImV4cCI6MTg5MTk3NjAwMH0.o6LGZvMJoV5U7CDIsKKHhjqTLLHgJ9jlNUmNgcjnv6c' // Mock anon key for local development
  }
}

let supabaseClient: ReturnType<typeof createClient> | null = null

export function createSupabaseClient() {
  if (typeof window === 'undefined') {
    // Server-side: always create a new client
    const config = getSupabaseConfig()
    return createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        storageKey: 'supabase-auth-token',
        storage: {
          getItem: (key: string) => localStorage.getItem(key),
          setItem: (key: string, value: string) => localStorage.setItem(key, value),
          removeItem: (key: string) => localStorage.removeItem(key)
        }
      }
    })
  }

  // Client-side: reuse existing client or create new one
  if (!supabaseClient) {
    const config = getSupabaseConfig()
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        storageKey: 'supabase-auth-token',
        storage: {
          getItem: (key: string) => localStorage.getItem(key),
          setItem: (key: string, value: string) => localStorage.setItem(key, value),
          removeItem: (key: string) => localStorage.removeItem(key)
        }
      }
    })
  }

  return supabaseClient
}

// Export a default client instance
export const supabase = createSupabaseClient()

// Helper function to update the client URL when port changes
export function updateSupabaseClient(port?: number) {
  const config = getSupabaseConfig()
  if (port) {
    config.url = `http://localhost:${port}`
  }
  
  supabaseClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      storageKey: 'supabase-auth-token',
      storage: {
        getItem: (key: string) => localStorage.getItem(key),
        setItem: (key: string, value: string) => localStorage.setItem(key, value),
        removeItem: (key: string) => localStorage.removeItem(key)
      }
    }
  })
  
  return supabaseClient
}