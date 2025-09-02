import { createClient } from '@supabase/supabase-js'

// Environment detection as specified in PRD
const isLocalDevelopment = 
  window.location.protocol === 'http:' || 
  window.location.hostname === 'localhost';

const supabaseUrl = isLocalDevelopment
  ? 'http://localhost:5173'  // Local Supabase Lite instance
  : window.location.origin;  // Production deployment

// For local development, we'll use a placeholder key since Supabase Lite doesn't require real keys
// For production, this would be the actual anon key
const supabaseAnonKey = isLocalDevelopment
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsaG9zdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNTUyMDB9'
  : (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configure auth for both environments
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
})

export default supabase