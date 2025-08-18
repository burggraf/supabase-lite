// Environment configuration for switching between local and remote Supabase
export const environments = {
  local: {
    name: 'Local (PGlite + MSW)',
    url: 'http://localhost:5173',
    anonKey: 'local-anon-key-placeholder',
    serviceRoleKey: 'local-service-role-key-placeholder'
  },
  remote: {
    name: 'Remote (Hosted Supabase)',
    url: 'https://njknhalxnjqqeqoegymr.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qa25oYWx4bmpxcWVxb2VneW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MTUwMTYsImV4cCI6MjA3MTA5MTAxNn0.6OXeF4r2xdpx0jbkzjZ5eTE8LvKlqJBBPs1Di58bC88',
    serviceRoleKey: null // We won't use service role key in tests
  }
}

export let currentEnvironment = 'local'

export function setEnvironment(env) {
  currentEnvironment = env
}

export function getCurrentEnvironment() {
  return currentEnvironment
}

export function getEnvironmentConfig(env = currentEnvironment) {
  return environments[env]
}