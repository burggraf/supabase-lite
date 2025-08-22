import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CrossOriginAPIHandler } from './lib/api/CrossOriginAPIHandler'

// WebSocket bridge client for external API access
function initializeWebSocketBridge() {
  // WebSocket bridge enables external API access via proxy
  // Works in both development and production modes
  const isDevelopment = import.meta.env.DEV;
  
  if (isDevelopment) {
    console.log('🛠️ Development mode: Enabling WebSocket bridge for external API access');
  } else {
    console.log('🌐 Production mode: Enabling WebSocket bridge for proxy connections');
  }
  
  // Always enable WebSocket bridge for proxy functionality
  
  // Store reference to native WebSocket before MSW can override it
  const NativeWebSocket = window.WebSocket
  let ws: WebSocket
  let reconnectTimeout: number
  
  function connect() {
    try {
      // In development, always connect to localhost:5176
      const wsUrl = 'ws://localhost:5176';
      
      console.log('🔌 Connecting WebSocket bridge to:', wsUrl);
      ws = new NativeWebSocket(wsUrl)
      
      // Expose globally for debugging
      ;(window as any).ws = ws
      
      ws.onopen = () => {
        console.log('🔗 Connected to WebSocket bridge')
        
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
          
          if (message.type === 'request') {
            console.log(`📥 Received ${message.method} ${message.url} from bridge (ID: ${message.requestId})`)
            
            // Process the request using fetch (which will be intercepted by MSW)
            const fetchOptions: RequestInit = {
              method: message.method,
              headers: {
                ...message.headers,
                // Ensure we have the right content type for JSON requests
                'Content-Type': message.headers?.['content-type'] || 'application/json'
              }
            }
            
            // Add body for non-GET requests
            if (message.body && (message.method === 'POST' || message.method === 'PATCH' || message.method === 'PUT')) {
              fetchOptions.body = message.body
            }
            
            try {
              // Make the fetch request - this WILL be intercepted by MSW!
              const response = await fetch(message.url, fetchOptions)
              
              // Get response data
              const responseText = await response.text()
              let responseData
              try {
                responseData = JSON.parse(responseText)
              } catch {
                responseData = responseText
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
              console.log(`📤 Sent response for ${message.requestId} (status: ${response.status})`)
              
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
        console.log('🔌 WebSocket bridge disconnected - attempting reconnection in 3s')
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
}

// Start MSW for browser-based API simulation and cross-origin API handler
async function initializeApp() {
  try {
    // Initialize WebSocket bridge BEFORE MSW to avoid WebSocket override conflicts
    initializeWebSocketBridge()
    console.log('WebSocket bridge client initialized')
    
    const { worker } = await import('./mocks/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
    })
    console.log('MSW worker started successfully')
    
    // Initialize cross-origin API handler for test app communication
    new CrossOriginAPIHandler()
    console.log('Cross-origin API handler initialized')
    
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
