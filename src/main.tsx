import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CrossOriginAPIHandler } from './lib/api/CrossOriginAPIHandler'
import { vfsDirectHandler } from './lib/vfs/VFSDirectHandler'

// WebSocket bridge client for external API access
function initializeWebSocketBridge() {
  // WebSocket bridge enables external API access via proxy
  // Only enable in development mode (production uses PostMessage only)
  const isDevelopment = import.meta.env.DEV;
  
  if (isDevelopment) {
    // WebSocket bridge setup (development only)
    setupWebSocketBridge();
  } else {
  }
  
  function setupWebSocketBridge() {
  
  // Store reference to native WebSocket before MSW can override it
  const NativeWebSocket = window.WebSocket
  let ws: WebSocket
  let reconnectTimeout: number
  
  function connect() {
    try {
      // In development, always connect to localhost:5176
      const wsUrl = 'ws://localhost:5176';
      
      ws = new NativeWebSocket(wsUrl)
      
      // Expose globally for debugging
      ;(window as any).ws = ws
      
      ws.onopen = () => {
        
        // Send identification message to distinguish from proxy connections
        ws.send(JSON.stringify({
          type: 'identify',
          client: 'browser'
        }))
        
        // Clear any reconnection timeout
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout)
        }
      }
      
      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data)
          
          console.log('🔄 Browser WebSocket received message:', { 
            type: message.type, 
            url: message.url, 
            method: message.method,
            requestId: message.requestId 
          })
          
          if (message.type === 'request') {
            
            // Handle VFS-direct requests directly (bypass MSW)
            if (message.url && message.url.includes('/vfs-direct/')) {
              console.log('🚀 Handling VFS-direct request in browser:', message.url)
              
              try {
                const result = await vfsDirectHandler.handleRequest(
                  message.url,
                  message.method,
                  message.headers || {}
                )
                
                // Convert ArrayBuffer to base64 for JSON serialization
                let responseBody = result.body
                if (result.body instanceof ArrayBuffer) {
                  const bytes = new Uint8Array(result.body)
                  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
                  responseBody = btoa(binary)
                  result.headers['X-Content-Encoding'] = 'base64'
                }
                
                // Send response back via WebSocket
                const responseMessage = {
                  type: 'response',
                  requestId: message.requestId,
                  response: {
                    status: result.status,
                    statusText: result.status === 200 ? 'OK' : 'Error',
                    headers: result.headers,
                    body: responseBody
                  }
                }
                
                console.log('✅ Sending VFS-direct response via WebSocket')
                ws.send(JSON.stringify(responseMessage))
                return // Skip normal fetch processing
                
              } catch (vfsError: any) {
                console.error('❌ VFS-direct error:', vfsError)
                
                // Send error response
                const errorResponse = {
                  type: 'response',
                  requestId: message.requestId,
                  response: {
                    status: 500,
                    statusText: 'VFS Direct Error',
                    headers: { 'content-type': 'application/json' },
                    body: {
                      error: 'VFS direct handler failed',
                      message: vfsError.message
                    }
                  }
                }
                
                ws.send(JSON.stringify(errorResponse))
                return // Skip normal fetch processing
              }
            }
            
            // Process the request using fetch (which will be intercepted by MSW)
            const fetchOptions: RequestInit = {
              method: message.method,
              headers: {
                ...message.headers
                // Don't force content-type - let MSW handle it based on the request
              }
            }
            
            // Only set content-type to JSON for requests that actually need it
            if (message.body && (message.method === 'POST' || message.method === 'PATCH' || message.method === 'PUT')) {
              fetchOptions.body = message.body
              // Only set JSON content-type if not already specified
              if (!fetchOptions.headers?.['content-type'] && !fetchOptions.headers?.['Content-Type']) {
                (fetchOptions.headers as any)['Content-Type'] = 'application/json'
              }
            }
            
            try {
              // Make the fetch request - this WILL be intercepted by MSW!
              const response = await fetch(message.url, fetchOptions)
              
              // Get response data - handle different content types properly
              const contentType = response.headers.get('content-type') || ''
              let responseData
              
              if (contentType.includes('application/json')) {
                // JSON response
                const responseText = await response.text()
                try {
                  responseData = JSON.parse(responseText)
                } catch {
                  responseData = responseText
                }
              } else {
                // Non-JSON response (JavaScript, CSS, HTML, etc.) - keep as text
                responseData = await response.text()
              }
              
              // Send response back via WebSocket
              const responseMessage = {
                type: 'response',
                requestId: message.requestId,
                response: {
                  status: response.status,
                  statusText: response.statusText,
                  headers: Object.fromEntries(response.headers.entries()),
                  body: responseData
                }
              }
              
              ws.send(JSON.stringify(responseMessage))
              
            } catch (fetchError: any) {
              console.error(`❌ Fetch error for ${message.requestId}:`, fetchError)
              
              // Send error response
              const errorResponse = {
                type: 'response',
                requestId: message.requestId,
                response: {
                  status: 500,
                  statusText: 'Internal Server Error',
                  headers: { 'content-type': 'application/json' },
                  body: {
                    error: 'Database operation failed',
                    message: fetchError.message,
                    path: message.url,
                    method: message.method
                  }
                }
              }
              
              ws.send(JSON.stringify(errorResponse))
            }
          }
        } catch (error) {
          console.error('❌ Error processing WebSocket message:', error)
        }
      }
      
      ws.onclose = () => {
        // Attempt to reconnect after 3 seconds
        reconnectTimeout = window.setTimeout(connect, 3000)
      }
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket bridge error - ensure "npm run dev" is running:', error)
      }
      
    } catch (error) {
      console.error('❌ Failed to connect to WebSocket bridge - ensure "npm run dev" is running:', error)
      // Attempt to reconnect after 5 seconds
      reconnectTimeout = window.setTimeout(connect, 5000)
    }
  }
  
  // Initial connection
  connect()
  } // End of setupWebSocketBridge function
}

// Start MSW for browser-based API simulation and cross-origin API handler
async function initializeApp() {
  try {
    // Initialize WebSocket bridge BEFORE MSW to avoid WebSocket override conflicts
    initializeWebSocketBridge()
    
    const { worker } = await import('./mocks/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
    })
    
    // Initialize cross-origin API handler for test app communication
    new CrossOriginAPIHandler()
    
  } catch (error) {
    console.error('Failed to start MSW worker or cross-origin handler:', error)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

initializeApp()
