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
    const handleMessage = (event: MessageEvent) => {
      // Accept messages from local proxy origin (our Vite dev server)
      if (event.origin === window.location.origin || event.origin === 'https://webvm.io') {
        onMessage?.(event.data)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onMessage])

  return (
    <div className={`webvm-container relative ${className}`} role="group">
      {showSabWarning && (
        <div className="absolute top-2 left-2 right-2 bg-yellow-50 border border-yellow-200 rounded p-3 text-yellow-800 text-sm z-20">
          <strong>Warning:</strong> SharedArrayBuffer is not available. WebVM may not work properly in this browser or configuration.
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
            <div className="text-lg font-semibold mb-2">Failed to load WebVM</div>
            <div className="text-sm mb-3">
              WebVM requires a modern browser with SharedArrayBuffer support.
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>• Check your internet connection</div>
              <div>• Try Chrome, Firefox, or Safari (latest versions)</div>
              <div>• Ensure JavaScript is enabled</div>
              <div>• Some corporate networks may block WebAssembly</div>
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