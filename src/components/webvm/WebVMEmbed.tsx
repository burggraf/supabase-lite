import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Loader2 } from 'lucide-react'

interface WebVMEmbedProps {
  width?: string
  height?: string
  variant?: 'debian' | 'alpine'
  className?: string
  onMessage?: (data: any) => void
  onLoad?: () => void
  onError?: (error: Error) => void
}

export interface WebVMEmbedRef {
  sendMessage: (message: any) => void
  getIframe: () => HTMLIFrameElement | null
}

export const WebVMEmbed = forwardRef<WebVMEmbedRef, WebVMEmbedProps>(({
  width = "100%",
  height = "600px",
  variant = "debian",
  className = "",
  onMessage,
  onLoad,
  onError
}, ref) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [showSabWarning, setShowSabWarning] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const webvmUrl = variant === 'alpine' 
    ? "/webvm-proxy/https://webvm.io/alpine.html" 
    : "/webvm-proxy/"

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    sendMessage: (message: any) => {
      if (iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.postMessage(message, window.location.origin)
        } catch (error) {
          console.error('Failed to send message to WebVM:', error)
          onError?.(error instanceof Error ? error : new Error('Failed to send message'))
        }
      }
    },
    getIframe: () => iframeRef.current
  }))

  // Handle iframe load event
  const handleLoad = () => {
    setIsLoaded(true)
    setHasError(false)
    onLoad?.()
  }

  // Handle iframe error
  const handleError = () => {
    setHasError(true)
    const error = new Error('Failed to load WebVM')
    onError?.(error)
  }

  // Check SharedArrayBuffer support
  useEffect(() => {
    // Debug cross-origin isolation status
    console.log('Cross-origin isolation status:', {
      crossOriginIsolated: self.crossOriginIsolated,
      SharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      isSecureContext: self.isSecureContext
    })
    
    if (typeof SharedArrayBuffer === 'undefined') {
      setShowSabWarning(true)
      console.warn('SharedArrayBuffer is not available. WebVM may not function properly.')
    } else {
      console.log('✅ SharedArrayBuffer is available! WebVM should work properly.')
    }
  }, [])

  // Set up message listener
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Accept messages from local proxy origin (our Vite dev server) or iframe
      if (event.origin === window.location.origin || event.origin === 'https://webvm.io') {
        
        // Handle database request messages from WebVM
        if (event.data.type === 'database-request') {
          await handleDatabaseRequest(event)
          return
        }

        // Pass other messages to parent handler
        onMessage?.(event.data)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onMessage])

  // Handle database requests from WebVM iframe
  const handleDatabaseRequest = async (event: MessageEvent) => {
    const { requestId, request } = event.data
    
    try {
      console.log(`🔄 Processing database request: ${request.method} ${request.path}`)
      
      // Make HTTP request to MSW handlers on behalf of WebVM
      const url = `http://localhost:5173${request.path}`
      
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: request.headers
      }

      if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        fetchOptions.body = request.body
      }

      const response = await fetch(url, fetchOptions)
      const responseData = await response.json()

      const databaseResponse = {
        status: response.status,
        data: responseData.data || responseData,
        message: responseData.message,
        error: response.ok ? undefined : (responseData.error || responseData.message || 'Request failed')
      }

      // Send response back to WebVM
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'database-response',
          requestId,
          response: databaseResponse
        }, window.location.origin)
      }

      console.log(`✅ Database request completed: ${response.status}`)

    } catch (error) {
      console.error('❌ Database request failed:', error)
      
      // Send error response back to WebVM
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'database-response',
          requestId,
          response: {
            status: 500,
            error: error instanceof Error ? error.message : 'Unknown error',
            message: 'Failed to process database request'
          }
        }, window.location.origin)
      }
    }
  }

  return (
    <div className={`webvm-container relative ${className}`} role="group">
      {showSabWarning && (
        <div className="absolute top-2 left-2 right-2 bg-yellow-50 border border-yellow-200 rounded p-3 text-yellow-800 text-sm z-20">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">!</div>
            <div className="flex-1">
              <div className="font-semibold mb-1">SharedArrayBuffer Not Available</div>
              <div className="text-xs space-y-1">
                <div>WebVM requires SharedArrayBuffer for optimal performance.</div>
                <div className="font-medium">If this is a static hosting deployment:</div>
                <div>• The site may need Cross-Origin headers configured</div>
                <div>• Contact your hosting provider or check deployment settings</div>
                <div>• Try accessing the site via HTTPS if using HTTP</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {(!isLoaded && !hasError) && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg z-10"
          data-testid="loading-indicator"
        >
          <div className="flex items-center space-x-2 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading WebVM Linux Environment...</span>
          </div>
        </div>
      )}
      
      {hasError && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-red-50 border border-red-200 rounded-lg z-10"
          data-testid="error-indicator"
        >
          <div className="text-center text-red-600 px-4">
            <div className="text-lg font-semibold mb-2">WebVM Failed to Load</div>
            <div className="text-sm mb-3">
              WebVM requires SharedArrayBuffer support and proper Cross-Origin headers.
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <div><strong>Browser Requirements:</strong></div>
              <div>• Chrome 92+, Firefox 95+, or Safari 15.2+</div>
              <div>• JavaScript and WebAssembly enabled</div>
              <div><strong>Hosting Requirements:</strong></div>
              <div>• Cross-Origin-Embedder-Policy: credentialless</div>
              <div>• Cross-Origin-Opener-Policy: same-origin</div>
              <div>• HTTPS protocol (required for SharedArrayBuffer)</div>
            </div>
          </div>
        </div>
      )}

      <iframe 
        ref={iframeRef}
        src={webvmUrl}
        width={width}
        height={height}
        title="WebVM Linux Environment"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; camera; microphone"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        onLoad={handleLoad}
        onError={handleError}
        style={{ 
          border: 'none', 
          borderRadius: '8px',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out'
        }}
      />
    </div>
  )
})

WebVMEmbed.displayName = 'WebVMEmbed'