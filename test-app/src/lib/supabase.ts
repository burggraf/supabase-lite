import { createClient } from '@supabase/supabase-js'

// Storage keys for configuration
const SUPABASE_URL_KEY = 'supabase-lite-url';
const SUPABASE_API_KEY_KEY = 'supabase-lite-api-key';

// Default configuration
const DEFAULT_CONFIG = {
  url: 'http://localhost:5173',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQyMDk2MDAsImV4cCI6MTg5MVECWMDh0.o6LGZvMJoV5U7CDIsKKHhjqTLLHgJ9jlNUmNgcjnv6c'
};

// Get the Supabase URL and anonymous key
const getSupabaseConfig = () => {
  const savedUrl = localStorage.getItem(SUPABASE_URL_KEY);
  const savedApiKey = localStorage.getItem(SUPABASE_API_KEY_KEY);
  
  return {
    url: savedUrl || DEFAULT_CONFIG.url,
    anonKey: savedApiKey || DEFAULT_CONFIG.anonKey
  };
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

// Helper function to update the client configuration
export function updateSupabaseClient(url?: string, apiKey?: string) {
  if (url) {
    localStorage.setItem(SUPABASE_URL_KEY, url);
  }
  if (apiKey) {
    localStorage.setItem(SUPABASE_API_KEY_KEY, apiKey);
  }
  
  const config = getSupabaseConfig();
  
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
  });
  
  return supabaseClient;
}

// Legacy function for backward compatibility
export function updateSupabaseClientPort(port: number) {
  return updateSupabaseClient(`http://localhost:${port}`);
}