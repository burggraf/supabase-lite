import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CrossOriginAPIHandler } from './lib/api/CrossOriginAPIHandler'

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
          
          if (message.type === 'request') {
            
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
