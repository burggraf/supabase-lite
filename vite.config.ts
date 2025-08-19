import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { Plugin } from 'vite'

// Plugin to serve test-app files from the same origin and handle module resolution
function serveTestApp(): Plugin {
  return {
    name: 'serve-test-app',
    configureServer(server) {
      // Configure Service-Worker-Allowed header for MSW
      server.middlewares.use('/mockServiceWorker.js', (req, res, next) => {
        // Allow the MSW service worker to control all pages of the app
        res.setHeader('Service-Worker-Allowed', '/')
        next()
      })

      // Handle test-app HTML routes
      server.middlewares.use('/test-app', (req, res, next) => {
        // Only handle HTML file requests here, let Vite handle JS modules
        if (req.url?.includes('.js') || req.url?.includes('.ts')) {
          return next()
        }
        
        // Parse the requested path after /test-app
        let filePath = req.url?.replace(/^\//,'') || 'index.html'
        
        // Default to index.html for directory requests
        if (filePath === '' || filePath.endsWith('/')) {
          filePath = 'index.html'
        }
        
        const fullPath = path.resolve(__dirname, 'test-app', filePath)
        
        // Check if file exists
        if (!fs.existsSync(fullPath)) {
          // For SPA, serve index.html for non-file requests
          if (!path.extname(filePath)) {
            const indexPath = path.resolve(__dirname, 'test-app', 'index.html')
            if (fs.existsSync(indexPath)) {
              res.setHeader('Content-Type', 'text/html')
              fs.createReadStream(indexPath).pipe(res)
              return
            }
          }
          res.statusCode = 404
          res.end('Not Found')
          return
        }
        
        // Serve the file
        const ext = path.extname(filePath)
        const contentTypes: Record<string, string> = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml'
        }
        
        const contentType = contentTypes[ext] || 'application/octet-stream'
        res.setHeader('Content-Type', contentType)
        fs.createReadStream(fullPath).pipe(res)
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveTestApp()],
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
