/**
 * WebVM Status Component
 * 
 * Displays WebVM runtime status and provides control buttons
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Play, 
  Square, 
  RotateCcw, 
  Activity, 
  HardDrive, 
  Cpu, 
  Wifi,
  WifiOff,
  Clock
} from 'lucide-react'
import { WebVMManager } from '../../lib/webvm/WebVMManager'
import { WebVMStatus as WebVMStatusType } from '../../lib/webvm/types'

export function WebVMStatus() {
  const [status, setStatus] = useState<WebVMStatusType | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const webvmManager = WebVMManager.getInstance()

  // Update status from manager
  const updateStatus = useCallback(() => {
    const currentStatus = webvmManager.getStatus()
    setStatus(currentStatus)
  }, [webvmManager])

  // Format uptime for display
  const formatUptime = (uptime: number): string => {
    const seconds = Math.floor(uptime / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  // Format CPU usage as percentage
  const formatCpuUsage = (usage: number): string => {
    return `${Math.round(usage * 100)}%`
  }

  // Get status badge configuration
  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'running':
        return { text: 'Running', className: 'bg-green-500 hover:bg-green-600' }
      case 'starting':
        return { text: 'Starting', className: 'bg-yellow-500 hover:bg-yellow-600' }
      case 'stopping':
        return { text: 'Stopping', className: 'bg-yellow-500 hover:bg-yellow-600' }
      case 'error':
        return { text: 'Error', className: 'bg-red-500 hover:bg-red-600' }
      default:
        return { text: 'Stopped', className: 'bg-gray-500 hover:bg-gray-600' }
    }
  }

  // Control actions
  const handleStart = async () => {
    setIsLoading(true)
    try {
      await webvmManager.start()
    } catch (error) {
      console.error('Failed to start WebVM:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = async () => {
    setIsLoading(true)
    try {
      await webvmManager.stop()
    } catch (error) {
      console.error('Failed to stop WebVM:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestart = async () => {
    setIsLoading(true)
    try {
      await webvmManager.restart()
    } catch (error) {
      console.error('Failed to restart WebVM:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Event handlers for real-time updates
  const handleStarted = useCallback(() => {
    updateStatus()
  }, [updateStatus])

  const handleStopped = useCallback(() => {
    updateStatus()
  }, [updateStatus])

  const handleError = useCallback(() => {
    updateStatus()
  }, [updateStatus])

  // Setup event listeners and initial status
  useEffect(() => {
    updateStatus()

    // Register event listeners
    webvmManager.on('started', handleStarted)
    webvmManager.on('stopped', handleStopped)
    webvmManager.on('error', handleError)

    // Cleanup
    return () => {
      webvmManager.off('started', handleStarted)
      webvmManager.off('stopped', handleStopped)
      webvmManager.off('error', handleError)
    }
  }, [webvmManager, handleStarted, handleStopped, handleError, updateStatus])

  if (!status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>WebVM Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div>Loading...</div>
        </CardContent>
      </Card>
    )
  }

  const statusBadge = getStatusBadge(status.state)
  const config = webvmManager.getConfig()
  const isTransitioning = status.state === 'starting' || status.state === 'stopping'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>WebVM Status</span>
          <Badge className={statusBadge.className}>
            {statusBadge.text}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Error Display */}
        {status.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {status.error}
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex gap-2">
          {status.state === 'stopped' || status.state === 'error' ? (
            <Button
              onClick={handleStart}
              disabled={isLoading || isTransitioning}
              size="sm"
              className="flex items-center gap-2"
            >
              <Play size={16} />
              Start WebVM
            </Button>
          ) : status.state === 'starting' ? (
            <Button
              disabled={true}
              size="sm"
              className="flex items-center gap-2"
            >
              <Play size={16} />
              Starting...
            </Button>
          ) : status.state === 'stopping' ? (
            <Button
              disabled={true}
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
            >
              <Square size={16} />
              Stopping...
            </Button>
          ) : (
            <>
              <Button
                onClick={handleStop}
                disabled={isLoading || isTransitioning}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <Square size={16} />
                Stop WebVM
              </Button>
              
              <Button
                onClick={handleRestart}
                disabled={isLoading || isTransitioning}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <RotateCcw size={16} />
                Restart WebVM
              </Button>
            </>
          )}
        </div>

        {/* Runtime Information */}
        {status.state === 'running' && (
          <>
            <Separator />
            
            <div className="space-y-3">
              {/* Deno Runtime */}
              {status.deno.available && (
                <div className="flex items-center gap-2 text-sm">
                  <Activity size={16} className="text-green-600" />
                  <span>Deno {status.deno.version}</span>
                </div>
              )}

              {/* PostgREST Runtime */}
              {status.postgrest.installed && (
                <div className="flex items-center gap-2 text-sm">
                  <HardDrive size={16} className={status.postgrest.running ? "text-green-600" : "text-yellow-600"} />
                  <span>PostgREST {status.postgrest.version}</span>
                  {status.postgrest.running && (
                    <Badge variant="outline" className="text-xs">
                      :{status.postgrest.port}
                    </Badge>
                  )}
                  {status.postgrest.bridgeConnected && (
                    <Badge variant="outline" className="text-xs text-green-700">
                      Bridge Connected
                    </Badge>
                  )}
                </div>
              )}

              {/* Edge Functions Runtime */}
              {status.edgeRuntime.installed && (
                <div className="flex items-center gap-2 text-sm">
                  <HardDrive size={16} className={status.edgeRuntime.running ? "text-green-600" : "text-yellow-600"} />
                  <span>Edge Runtime {status.edgeRuntime.runtimeVersion}</span>
                  {status.edgeRuntime.running && (
                    <Badge variant="outline" className="text-xs">
                      :{status.edgeRuntime.port}
                    </Badge>
                  )}
                  {status.edgeRuntime.denoVersion && (
                    <Badge variant="outline" className="text-xs text-blue-700">
                      Deno {status.edgeRuntime.denoVersion}
                    </Badge>
                  )}
                </div>
              )}

              {/* Envoy Proxy */}
              {status.envoy.installed && (
                <div className="flex items-center gap-2 text-sm">
                  <HardDrive size={16} className={status.envoy.running ? "text-green-600" : "text-yellow-600"} />
                  <span>Envoy Proxy {status.envoy.version}</span>
                  {status.envoy.running && (
                    <Badge variant="outline" className="text-xs">
                      :{status.envoy.port}
                    </Badge>
                  )}
                  {status.envoy.adminPort && (
                    <Badge variant="outline" className="text-xs text-purple-700">
                      Admin :{status.envoy.adminPort}
                    </Badge>
                  )}
                  {status.envoy.routingActive && (
                    <Badge variant="outline" className="text-xs text-green-700">
                      Routing Active
                    </Badge>
                  )}
                </div>
              )}

              {/* Functions */}
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{status.functions.total} functions deployed</span>
                {status.functions.active > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {status.functions.active} active
                  </Badge>
                )}
              </div>

              {/* Uptime */}
              {status.uptime > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={16} className="text-blue-600" />
                  <span>Uptime: {formatUptime(status.uptime)}</span>
                </div>
              )}

              {/* Network Status */}
              <div className="flex items-center gap-2 text-sm">
                {status.network.connected ? (
                  <Wifi size={16} className="text-green-600" />
                ) : (
                  <WifiOff size={16} className="text-red-600" />
                )}
                <span>Network: {status.network.connected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          </>
        )}

        {/* Resource Usage */}
        {status.state === 'running' && (
          <>
            <Separator />
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Resource Usage</h4>
              
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-blue-600" />
                  <span>Memory: {status.resources.memory.used} / {status.resources.memory.total}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-orange-600" />
                  <span>CPU: {formatCpuUsage(status.resources.cpu.usage)}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <HardDrive size={16} className="text-purple-600" />
                  <span>Storage: {status.resources.storage.used} / {status.resources.storage.total}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Configuration */}
        <Separator />
        
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Configuration</h4>
          
          <div className="grid grid-cols-1 gap-1 text-sm text-gray-600">
            <div>Memory Limit: {config.memory}</div>
            <div>CPU Cores: {config.cpu}</div>
            <div>Storage Size: {config.storage.size}</div>
            <div>
              {config.networking.enabled ? 'Networking: Enabled' : 'Networking: Disabled'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}