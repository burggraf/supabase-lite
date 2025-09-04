/**
 * WebVM Page
 * 
 * Main page for WebVM Runtime management and monitoring
 */

import { useState, useRef, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WebVMStatus } from '@/components/webvm/WebVMStatus'
import { WebVMEmbed, WebVMEmbedRef } from '@/components/webvm/WebVMEmbed'
import TailscaleConfig from '@/components/edge-functions/TailscaleConfig'
import { WebVMManager } from '@/lib/webvm/WebVMManager'

export function WebVM() {
  const [isWebVMLoaded, setIsWebVMLoaded] = useState(false)
  const [webvmError, setWebvmError] = useState<string | null>(null)
  const webvmRef = useRef<WebVMEmbedRef>(null)
  const webvmManager = WebVMManager.getInstance()

  // Handle WebVM embed load
  const handleWebVMLoad = useCallback(() => {
    setIsWebVMLoaded(true)
    setWebvmError(null)
    
    // Register the WebVM embed with the manager
    if (webvmRef.current) {
      webvmManager.registerWebVMEmbed(webvmRef.current)
      console.log('WebVM embed registered with manager')
    }
  }, [webvmManager])

  // Handle WebVM embed error
  const handleWebVMError = useCallback((error: Error) => {
    setWebvmError(error.message)
    console.error('WebVM embed error:', error)
  }, [])

  // Handle messages from WebVM
  const handleWebVMMessage = useCallback((data: any) => {
    // Forward messages to the WebVM manager
    webvmManager.handleWebVMMessage(data)
  }, [webvmManager])
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">WebVM Runtime</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage WebVM instance for browser-native Edge Functions execution
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="min-h-full max-w-7xl mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 min-h-full">
            {/* WebVM Container - Main Column */}
            <div className="xl:col-span-3 flex flex-col min-h-[600px]">
              <Tabs defaultValue="status" className="flex flex-col h-full">
                <div className="flex-shrink-0 mb-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="status">WebVM Status</TabsTrigger>
                    <TabsTrigger value="networking">Networking</TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="status" className="flex-1 flex flex-col space-y-4 min-h-0">
                  {/* Status Controls */}
                  <div className="flex-shrink-0">
                    <WebVMStatus />
                  </div>
                  
                  {/* WebVM Embed */}
                  <div className="flex-1 min-h-[400px]">
                    {webvmError ? (
                      <div className="h-full flex items-center justify-center bg-red-50 border border-red-200 rounded-lg">
                        <div className="text-center text-red-600">
                          <div className="text-lg font-semibold mb-2">WebVM Load Error</div>
                          <div className="text-sm">{webvmError}</div>
                          <button 
                            onClick={() => window.location.reload()} 
                            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Reload Page
                          </button>
                        </div>
                      </div>
                    ) : (
                      <WebVMEmbed 
                        ref={webvmRef}
                        width="100%" 
                        height="100%" 
                        variant="debian"
                        className="h-full"
                        onLoad={handleWebVMLoad}
                        onError={handleWebVMError}
                        onMessage={handleWebVMMessage}
                      />
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="networking" className="overflow-auto">
                  <TailscaleConfig />
                </TabsContent>
              </Tabs>
            </div>

            {/* Info Panel */}
            <div className="xl:col-span-1 space-y-4">
              {/* About WebVM */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  About WebVM Runtime
                </h3>
                <p className="text-sm text-blue-700">
                  WebVM provides a complete Linux environment in the browser, enabling 
                  real Deno Edge Functions execution with external API access and 
                  database connectivity.
                </p>
              </div>

              {/* Features */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Key Features
                </h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    Real Linux desktop environment
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    WebAssembly x86 virtualization
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    Persistent file system
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    Network connectivity (see Networking tab)
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    Full desktop applications
                  </li>
                </ul>
              </div>

              {/* Getting Started */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Getting Started
                </h3>
                <ol className="text-sm text-gray-600 space-y-2">
                  <li className="flex gap-2">
                    <span className="text-gray-400">1.</span>
                    <span>WebVM will load automatically in the main panel</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-gray-400">2.</span>
                    <span>Wait for Linux desktop to boot</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-gray-400">3.</span>
                    <span>Configure networking in Networking tab (optional)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-gray-400">4.</span>
                    <span>Install Deno and Supabase Edge Runtime</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-gray-400">5.</span>
                    <span>Deploy and test your Edge Functions</span>
                  </li>
                </ol>
              </div>

              {/* Performance Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-yellow-900 mb-2">
                  Performance Note
                </h3>
                <p className="text-sm text-yellow-700">
                  WebVM requires significant resources. Close other browser tabs 
                  and applications for optimal performance. Mobile devices may 
                  have limited memory allocation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}