import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CrossOriginAPIHandler } from './lib/api/CrossOriginAPIHandler'
import { vfsDirectHandler } from './lib/vfs/VFSDirectHandler'
import { registerServiceWorker } from './sw-register'

// WebSocket bridge client for external API access
function initializeWebSocketBridge() {
  // WebSocket bridge enables external API access via proxy
  // Only enable in development mode (production uses PostMessage only)
  const isDevelopment = import.meta.env.DEV;
  
  if (isDevelopment) {
    // WebSocket bridge setup (development only)
    setupWebSocketBridge();
  } else {
    // PostMessage bridge setup (production/deployed instances)
    setupPostMessageBridge();
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
              const headers = fetchOptions.headers as Record<string, string>;
              if (!headers?.['content-type'] && !headers?.['Content-Type']) {
                headers['Content-Type'] = 'application/json'
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

  function setupPostMessageBridge() {
    console.log('🔗 Setting up PostMessage bridge for deployed instance')
    
    // Listen for API requests from proxy bridge
    window.addEventListener('message', async (event) => {
      // Only accept messages from localhost (proxy bridge)
      if (!event.origin.startsWith('http://localhost:')) {
        return;
      }
      
      if (event.data.type === 'API_REQUEST') {
        console.log('📥 PostMessage bridge received API request:', {
          method: event.data.data.method,
          path: event.data.data.path,
          requestId: event.data.data.requestId
        });
        
        const { method, path, headers, body, requestId } = event.data.data;
        
        try {
          // Check for VFS direct handler first (same as WebSocket bridge)
          if (path.startsWith('/vfs/')) {
            try {
              console.log('🔄 Processing VFS-direct request via PostMessage')
              const vfsResponse = await vfsDirectHandler.handleRequest(path, method, headers || {});
              
              // Send VFS response back via PostMessage
              const vfsResponseMessage = {
                type: 'API_RESPONSE',
                data: {
                  requestId,
                  status: vfsResponse.status,
                  headers: vfsResponse.headers,
                  data: vfsResponse.body
                }
              };
              
              if (event.source) {
                console.log('✅ Sending VFS-direct response via PostMessage')
                event.source.postMessage(vfsResponseMessage, { targetOrigin: event.origin });
              }
              return; // Skip normal fetch processing
              
            } catch (vfsError: any) {
              console.error('❌ VFS-direct error:', vfsError)
              
              // Send error response
              const errorResponse = {
                type: 'API_RESPONSE',
                data: {
                  requestId,
                  status: 500,
                  headers: { 'content-type': 'application/json' },
                  error: 'VFS direct handler failed',
                  data: { error: vfsError.message }
                }
              };
              
              if (event.source) {
                event.source.postMessage(errorResponse, { targetOrigin: event.origin });
              }
              return; // Skip normal fetch processing
            }
          }
          
          // Process the request using fetch (which will be intercepted by MSW)
          const fetchOptions: RequestInit = {
            method,
            headers: {
              ...headers
            }
          };
          
          // Only set content-type to JSON for requests that actually need it
          if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
            // Only set JSON content-type if not already specified
            const headers = fetchOptions.headers as Record<string, string>;
            if (!headers?.['content-type'] && !headers?.['Content-Type']) {
              headers['Content-Type'] = 'application/json'
            }
          }
          
          // Make the fetch request - this WILL be intercepted by MSW!
          const response = await fetch(path, fetchOptions);
          
          // Get response data - handle different content types properly
          const contentType = response.headers.get('content-type') || '';
          let responseData;
          
          if (contentType.includes('application/json')) {
            // JSON response
            const responseText = await response.text();
            try {
              responseData = JSON.parse(responseText);
            } catch {
              responseData = responseText;
            }
          } else {
            // Non-JSON response (JavaScript, CSS, HTML, etc.) - keep as text
            responseData = await response.text();
          }
          
          // Send response back via PostMessage
          const responseMessage = {
            type: 'API_RESPONSE',
            data: {
              requestId,
              status: response.status,
              headers: Object.fromEntries(response.headers.entries()),
              data: responseData
            }
          };
          
          if (event.source) {
            console.log('✅ Sending API response via PostMessage:', {
              requestId,
              status: response.status
            });
            event.source.postMessage(responseMessage, { targetOrigin: event.origin });
          }
          
        } catch (fetchError: any) {
          console.error(`❌ PostMessage fetch error for ${requestId}:`, fetchError);
          
          // Send error response
          const errorResponse = {
            type: 'API_RESPONSE',
            data: {
              requestId,
              status: 500,
              headers: { 'content-type': 'application/json' },
              error: 'Database operation failed',
              data: {
                error: 'Database operation failed',
                message: fetchError.message,
                path: path,
                method: method
              }
            }
          };
          
          if (event.source) {
            event.source.postMessage(errorResponse, { targetOrigin: event.origin });
          }
        }
      }
    });
    
    console.log('✅ PostMessage bridge ready for proxy connections');
  }
}

// Navigation interceptor for /app/* routes to work around MSW navigation bypass
function setupAppNavigationInterceptor() {
  console.log('🔧 Setting up app navigation interceptor')

  // Intercept link clicks to /app/* routes
  document.addEventListener('click', (event) => {
    const link = (event.target as Element)?.closest('a')
    if (link?.href) {
      const url = new URL(link.href)
      if (url.pathname.startsWith('/app/')) {
        console.log('🔗 Intercepting link click to app route:', url.pathname)
        event.preventDefault()
        handleAppNavigation(url.pathname)
        // Update browser history without navigation
        history.pushState(null, '', url.pathname)
      }
    }
  })
  
  // Handle browser back/forward navigation to app routes
  window.addEventListener('popstate', (_event) => {
    if (window.location.pathname.startsWith('/app/')) {
      console.log('🔄 Handling popstate to app route:', window.location.pathname)
      handleAppNavigation(window.location.pathname)
    }
  })
}

// Handle app navigation by fetching content via MSW handlers
async function handleAppNavigation(pathname: string) {
  try {
    console.log('🚀 Intercepting app navigation:', pathname)
    
    // Make a fetch request that MSW can intercept (not navigation mode)
    const response = await fetch(pathname, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })
    
    if (response.ok) {
      const html = await response.text()
      // Replace current page content
      document.open()
      document.write(html)
      document.close()
      console.log('✅ App navigation handled successfully')
    } else {
      console.error('❌ App navigation failed:', response.status, response.statusText)
    }
  } catch (error) {
    console.error('❌ App navigation error:', error)
  }
}

// Start MSW for browser-based API simulation and cross-origin API handler
async function initializeApp() {
  try {
    // Register Service Worker for offline support BEFORE everything else
    await registerServiceWorker()
    
    // Initialize WebSocket bridge BEFORE MSW to avoid WebSocket override conflicts
    initializeWebSocketBridge()
    
    // Check if we're on an app route - if so, handle it separately
    if (window.location.pathname.startsWith('/app/')) {
      console.log('🎯 App route detected, setting up MSW and handling app navigation')
      
      const { worker } = await import('./mocks/browser')
      await worker.start({
        onUnhandledRequest: 'bypass',
      })
      
      // Wait for MSW to be ready, then handle the app navigation
      await waitForMSW()
      
      // Initialize cross-origin API handler
      new CrossOriginAPIHandler()
      
      // Handle the app navigation instead of rendering React app
      await handleAppNavigation(window.location.pathname)
      return // Don't render the main app
    }
    
    // Setup navigation interceptor for future navigation to app routes
    setupAppNavigationInterceptor()
    
    const { worker } = await import('./mocks/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
    })
    
    await waitForMSW()
    
    // Initialize cross-origin API handler for test app communication
    new CrossOriginAPIHandler()
    
  } catch (error) {
    console.error('Failed to start MSW worker or cross-origin handler:', error)
  }

  // Only render React app if we're not handling an app route
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Helper function to wait for MSW to be ready
async function waitForMSW() {
  if ('serviceWorker' in navigator) {
    let serviceWorkerReady = false
    let attempts = 0
    const maxAttempts = 50 // 5 second timeout
    
    while (!serviceWorkerReady && attempts < maxAttempts) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration && registration.active && registration.active.state === 'activated') {
        // Double-check that the service worker is controlling this client
        if (navigator.serviceWorker.controller) {
          serviceWorkerReady = true
          console.log('✅ MSW service worker is ready and controlling page')
        } else {
          // Force the service worker to take control
          registration.active?.postMessage({ type: 'CLIENT_READY' })
        }
      }
      
      if (!serviceWorkerReady) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }
    }
    
    if (!serviceWorkerReady) {
      console.warn('⚠️ MSW service worker not ready after timeout - proceeding anyway')
    }
  }
}

initializeApp()
