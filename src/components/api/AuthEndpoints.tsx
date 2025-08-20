// Component that sets up HTTP endpoints for auth operations
// This runs in the browser and exposes real auth functionality

import { useEffect } from 'react'
import { authAPIService } from '@/services/auth-api'

export function AuthEndpoints() {
  useEffect(() => {
    // Set up event listeners for auth requests
    const setupAuthEndpoints = () => {
      // Use postMessage API to handle cross-origin auth requests
      const handleMessage = async (event: MessageEvent) => {
        // Only accept messages from localhost:3003 (test-app)
        if (event.origin !== 'http://localhost:3003') {
          return
        }

        const { type, endpoint, method, body, headers, requestId } = event.data

        if (type !== 'SUPABASE_LITE_AUTH') {
          return
        }

        try {
          const result = await authAPIService.handleAuthRequest(endpoint, method, body, headers)
          
          // Send response back to test-app
          event.source?.postMessage({
            type: 'SUPABASE_LITE_AUTH_RESPONSE',
            requestId,
            success: !result.error,
            data: result.data || result.error,
            status: result.status
          }, { targetOrigin: event.origin })
        } catch (error: any) {
          // Send error response back to test-app
          event.source?.postMessage({
            type: 'SUPABASE_LITE_AUTH_RESPONSE',
            requestId,
            success: false,
            error: error.message,
            status: 500
          }, { targetOrigin: event.origin })
        }
      }

      window.addEventListener('message', handleMessage)

      // Cleanup
      return () => {
        window.removeEventListener('message', handleMessage)
      }
    }

    const cleanup = setupAuthEndpoints()

    // Let the world know we're ready
    console.log('Supabase Lite Auth endpoints ready for cross-origin requests')
    
    // Send a message to any listening test-app that we're ready
    try {
      const testAppWindow = window.open('http://localhost:3003', 'test-app-check')
      if (testAppWindow) {
        // Brief window reference to send ready message
        setTimeout(() => {
          testAppWindow.postMessage({
            type: 'SUPABASE_LITE_AUTH_READY'
          }, 'http://localhost:3003')
          testAppWindow.close()
        }, 100)
      }
    } catch (error) {
      // Ignore errors - test-app might not be open
    }

    return cleanup
  }, [])

  // This component doesn't render anything
  return null
}