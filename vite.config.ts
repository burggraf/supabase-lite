import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Plugin } from 'vite'
import { createMiddleware } from '@mswjs/http-middleware'
import { handlers } from './src/mocks/handlers'

// Plugin to expose MSW handlers as real HTTP endpoints for cross-origin access
function mswHttpMiddleware(): Plugin {
  return {
    name: 'msw-http-middleware',
    configureServer(server) {
      // Create middleware from MSW handlers
      const middleware = createMiddleware(...handlers)
      
      // Add MSW middleware for API routes with Express-like compatibility
      server.middlewares.use((req, res, next) => {
        // Only apply MSW middleware to API routes
        if (req.url?.startsWith('/rest/') || 
            req.url?.startsWith('/auth/') || 
            req.url?.startsWith('/health')) {
          
          // Add Express-like methods to the request object for MSW compatibility
          if (!(req as any).get) {
            (req as any).get = (header: string) => req.headers?.[header.toLowerCase()]
          }
          if (!(req as any).protocol) {
            (req as any).protocol = 'http'
          }
          
          return middleware(req, res, next)
        }
        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mswHttpMiddleware()],
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
    }
  }
})
