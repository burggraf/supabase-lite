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
  proxySocket?: any  // Store which proxy sent the request
}

// WebSocket bridge that forwards HTTP requests to browser for processing
function websocketBridge(): Plugin {
  let wss: WebSocketServer | null = null
  let browserSocket: any = null
  const proxyConnections = new Set<any>()
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
            console.log('🔗 New WebSocket connection')
            
            // Initially treat as unknown connection
            let connectionType: 'browser' | 'proxy' | 'unknown' = 'unknown'
            
            ws.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString())
                
                // Handle identification messages
                if (message.type === 'identify') {
                  if (message.client === 'browser') {
                    connectionType = 'browser'
                    browserSocket = ws
                    console.log('🔗 Identified as browser connection')
                  }
                  return // Don't process identify messages further
                }
                
                // Detect connection type based on first message (fallback)
                if (connectionType === 'unknown') {
                  if (message.type === 'request') {
                    connectionType = 'proxy'
                    proxyConnections.add(ws)
                    console.log('🔗 Identified as proxy connection')
                  } else if (message.type === 'response') {
                    connectionType = 'browser'
                    browserSocket = ws
                    console.log('🔗 Identified as browser connection (via response)')
                  }
                }
                
                // Handle responses from browser
                if (message.type === 'response' && message.requestId) {
                  console.log(`📥 Received response from browser: ${message.requestId}`)
                  const pending = pendingRequests.get(message.requestId)
                  if (pending) {
                    console.log(`✅ Found pending request, resolving: ${message.requestId}`)
                    clearTimeout(pending.timeout)
                    pending.resolve(message.response)
                    pendingRequests.delete(message.requestId)
                  } else {
                    console.log(`❌ No pending request found for: ${message.requestId}`)
                  }
                }
                
                // Handle requests from proxy - forward to browser
                else if (message.type === 'request' && message.requestId) {
                  console.log(`🔄 Forwarding WebSocket request ${message.method} ${message.url} to browser`)
                  
                  // Forward the request message to the browser
                  console.log(`🔍 Browser socket status: exists=${!!browserSocket}, readyState=${browserSocket?.readyState}`)
                  if (browserSocket && browserSocket.readyState === 1) {
                    // Create pending request entry for WebSocket requests
                    const timeout = setTimeout(() => {
                      pendingRequests.delete(message.requestId)
                      console.log(`⏰ WebSocket request timeout: ${message.requestId}`)
                    }, 30000)
                    
                    pendingRequests.set(message.requestId, {
                      resolve: (response) => {
                        console.log(`🔄 Sending response back to proxy: ${message.requestId}`)
                        ws.send(JSON.stringify({
                          type: 'response',
                          requestId: message.requestId,
                          response
                        }))
                      },
                      reject: (error) => {
                        console.log(`❌ Sending error back to proxy: ${message.requestId}`)
                        ws.send(JSON.stringify({
                          type: 'response',
                          requestId: message.requestId,
                          response: {
                            status: 500,
                            headers: { 'Content-Type': 'application/json' },
                            body: { error: error.message }
                          }
                        }))
                      },
                      timeout,
                      proxySocket: ws
                    })
                    
                    console.log(`📤 Sending request to browser: ${JSON.stringify(message).substring(0, 100)}...`)
                    browserSocket.send(JSON.stringify(message))
                  } else {
                    // Send error response back to proxy
                    ws.send(JSON.stringify({
                      type: 'response',
                      requestId: message.requestId,
                      response: {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' },
                        body: { 
                          error: 'Browser not connected',
                          message: 'No browser connection available to process request'
                        }
                      }
                    }))
                  }
                }
              } catch (error) {
                console.error('Error processing WebSocket message:', error)
              }
            })
            
            ws.on('close', () => {
              if (connectionType === 'browser') {
                console.log('🔌 Browser disconnected from WebSocket bridge')
                browserSocket = null
              } else if (connectionType === 'proxy') {
                console.log('🔌 Proxy disconnected from WebSocket bridge')
                proxyConnections.delete(ws)
              } else {
                console.log('🔌 Unknown connection disconnected from WebSocket bridge')
              }
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
        // Check if this is an API route we should handle
        const isApiRoute = req.url && (
          // Standard API routes
          req.url.startsWith('/rest/') || 
          req.url.startsWith('/auth/') || 
          req.url.startsWith('/storage/') ||
          req.url.startsWith('/health') ||
          req.url.startsWith('/projects') ||
          req.url.startsWith('/debug/sql') ||
          req.url.startsWith('/vfs-direct/') || // Direct VFS access bypassing MSW
          // Project-prefixed API routes (pattern: /:projectId/rest|auth|debug|storage)
          /^\/[^\/]+\/(rest|auth|debug|storage|vfs-direct)\//.test(req.url)
        );
        
        if (isApiRoute) {
          
          // Handle VFS direct requests - forward to browser via WebSocket
          if (req.url && req.url.startsWith('/vfs-direct/')) {
            console.log('🚀 Forwarding VFS-direct request to browser:', req.url)
            // This will be handled by the normal WebSocket forwarding logic below
            // The browser will process the VFS-direct request using VFSDirectHandler
          }
          
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
            
            // Extract project context from URL for better logging
            const urlPath = req.url || '';
            const projectMatch = urlPath.match(/^\/([^\/]+)\/(rest|auth|debug|storage|vfs-direct)\//);
            const projectContext = projectMatch ? {
              projectId: projectMatch[1],
              apiType: projectMatch[2]
            } : null;
            
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
              body: body,
              projectContext // Include project context in the message
            }
            
            browserSocket.send(JSON.stringify(message))
            
            const contextStr = projectContext 
              ? ` [${projectContext.projectId}/${projectContext.apiType}]` 
              : '';
            console.log(`📤 Forwarded ${req.method} ${req.url}${contextStr} to browser (ID: ${requestId})`)
            
            // Wait for response from browser
            const response = await responsePromise
            
            console.log(`📥 Received response for ${requestId}${contextStr} (status: ${response.status})`)
            
            // Handle VFS-direct responses specially (binary data)
            if (req.url && req.url.startsWith('/vfs-direct/')) {
              // Check if this is a base64-encoded binary response
              if (response.headers && response.headers['X-Content-Encoding'] === 'base64') {
                console.log('🔄 Converting base64 response back to binary for HTTP')
                
                // Decode base64 back to binary
                const binaryString = atob(response.body as string)
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i)
                }
                
                // Send binary response
                const headers = { ...response.headers }
                delete headers['X-Content-Encoding'] // Remove our internal header
                
                res.writeHead(response.status || 200, {
                  'Access-Control-Allow-Origin': '*',
                  ...headers
                })
                res.end(Buffer.from(bytes))
                console.log('✅ Sent binary response via HTTP')
                return
              }
            }
            
            // Send response back to client (normal JSON)
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
