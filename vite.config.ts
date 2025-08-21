import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Plugin } from 'vite'
import { WebSocketServer } from 'ws'
import type { IncomingMessage } from 'http'

interface PendingRequest {
  resolve: (response: any) => void
  reject: (error: any) => void
  timeout: NodeJS.Timeout
}

// WebSocket bridge that forwards HTTP requests to browser for processing
function websocketBridge(): Plugin {
  let wss: WebSocketServer | null = null
  let browserSocket: any = null
  const pendingRequests = new Map<string, PendingRequest>()
  
  // Helper to get request body
  async function getRequestBody(req: IncomingMessage): Promise<string | null> {
    return new Promise((resolve) => {
      if (req.method === 'GET' || req.method === 'DELETE') {
        resolve(null)
        return
      }
      
      let body = ''
      req.on('data', (chunk) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        resolve(body || null)
      })
      req.on('error', () => {
        resolve(null)
      })
    })
  }

  return {
    name: 'websocket-bridge',
    configureServer(server) {
      // Prevent multiple WebSocket server creation
      if (wss) {
        console.log('⚠️  WebSocket server already exists, skipping creation')
        return
      }
      
      // Wait for HTTP server to be ready, then create WebSocket server
      const initWebSocket = () => {
        try {
          wss = new WebSocketServer({ 
            port: 5176,
            // Use different port to avoid conflicts with MSW
          })
          console.log('🔌 WebSocket bridge server created on port 5176')
        
          wss.on('connection', (ws) => {
            console.log('🔗 Browser connected to WebSocket bridge')
            browserSocket = ws
            
            ws.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString())
                
                if (message.type === 'response' && message.requestId) {
                  const pending = pendingRequests.get(message.requestId)
                  if (pending) {
                    clearTimeout(pending.timeout)
                    pending.resolve(message.response)
                    pendingRequests.delete(message.requestId)
                  }
                }
              } catch (error) {
                console.error('Error processing WebSocket message:', error)
              }
            })
            
            ws.on('close', () => {
              console.log('🔌 Browser disconnected from WebSocket bridge')
              browserSocket = null
              // Reject all pending requests
              for (const [requestId, pending] of pendingRequests) {
                clearTimeout(pending.timeout)
                pending.reject(new Error('Browser disconnected'))
                pendingRequests.delete(requestId)
              }
            })
            
            ws.on('error', (error) => {
              console.error('❌ Client WebSocket error:', error)
              browserSocket = null
            })
          })
          
          wss.on('error', (error) => {
            console.error('❌ WebSocket server error:', error)
          })
          
        } catch (error) {
          console.error('❌ Failed to start WebSocket server:', error)
        }
      }
      
      // Initialize WebSocket server immediately (separate port)
      try {
        initWebSocket()
      } catch (error) {
        console.error('❌ Failed to initialize WebSocket server:', error)
      }

      // HTTP middleware
      server.middlewares.use(async (req, res, next) => {
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
          
          // Check if browser is connected
          if (!browserSocket || browserSocket.readyState !== 1) {
            res.writeHead(503, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            })
            res.end(JSON.stringify({
              error: 'Browser database not connected',
              message: 'Please open http://localhost:5173 in your browser to initialize the database connection.',
              details: 'The WebSocket bridge requires the browser to be connected for database operations',
              path: req.url,
              method: req.method
            }))
            return
          }
          
          try {
            // Get request body
            const body = await getRequestBody(req)
            
            // Generate unique request ID
            const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            
            // Create promise for the response
            const responsePromise = new Promise<any>((resolve, reject) => {
              const timeout = setTimeout(() => {
                pendingRequests.delete(requestId)
                reject(new Error('Request timeout'))
              }, 30000) // 30 second timeout
              
              pendingRequests.set(requestId, { resolve, reject, timeout })
            })
            
            // Forward request to browser via WebSocket
            const message = {
              type: 'request',
              requestId,
              method: req.method,
              url: req.url,
              headers: req.headers,
              body: body
            }
            
            browserSocket.send(JSON.stringify(message))
            console.log(`📤 Forwarded ${req.method} ${req.url} to browser (ID: ${requestId})`)
            
            // Wait for response from browser
            const response = await responsePromise
            
            console.log(`📥 Received response for ${requestId} (status: ${response.status})`)
            
            // Send response back to client
            res.writeHead(response.status || 200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              ...response.headers
            })
            res.end(typeof response.body === 'string' ? response.body : JSON.stringify(response.body))
            
          } catch (error: any) {
            console.error(`❌ Error processing request ${req.method} ${req.url}:`, error)
            res.writeHead(500, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            })
            res.end(JSON.stringify({
              error: 'Internal server error',
              message: error.message,
              path: req.url,
              method: req.method
            }))
          }
          
          return
        }
        
        next()
      })
    },
    
    buildStart() {
      // Don't clean up on build start in dev mode - only on actual rebuilds
      console.log('🔄 Build starting, WebSocket server state:', !!wss)
    },
    
    closeBundle() {
      // Clean up on close
      if (wss) {
        console.log('🧹 Cleaning up WebSocket server on close')
        try {
          wss.close(() => {
            console.log('✅ WebSocket server closed on bundle close')
          })
        } catch (error) {
          console.log('⚠️ Error closing WebSocket server on close:', error.message)
        }
        wss = null
        browserSocket = null
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), websocketBridge()],
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
