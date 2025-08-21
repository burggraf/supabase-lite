import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Plugin } from 'vite'

// HTTP middleware that proxies API requests to the browser database
function browserDatabaseProxy(): Plugin {
  return {
    name: 'browser-database-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Only handle API routes
        if (req.url?.startsWith('/rest/') || 
            req.url?.startsWith('/auth/') || 
            req.url?.startsWith('/health')) {
          
          // Handle CORS preflight
          if (req.method === 'OPTIONS') {
            res.writeHead(204, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, prefer, range, x-supabase-api-version, x-client-info, accept-profile, content-profile'
            })
            res.end()
            return
          }
          
          // Return instructions to use the browser database
          res.writeHead(503, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          })
          res.end(JSON.stringify({
            error: 'Database operations must be performed in the browser context',
            message: 'This endpoint requires the browser database to be initialized. Please ensure you are accessing the API from within the browser application.',
            details: 'HTTP middleware no longer creates separate database instances to maintain browser-only operation',
            path: req.url,
            method: req.method
          }))
          return
        }
        
        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), browserDatabaseProxy()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],
    force: true,
  },
  worker: {
    format: 'es',
  },
  define: {
    global: 'globalThis',
  },
  esbuild: {
    target: 'esnext'
  },
  build: {
    target: 'esnext',
  },
  server: {
    fs: {
      strict: false
    },
    cors: {
      origin: true, // Allow all origins for development
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'prefer', 'range', 'x-supabase-api-version', 'x-client-info', 'accept-profile', 'content-profile']
    }
  }
})
