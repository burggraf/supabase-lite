import React, { useState, useEffect } from 'react'
import { WebVMManager, RuntimeInstance, ProcessManager } from '@/lib/webvm'
import { logger as Logger } from '@/lib/infrastructure/Logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Play, 
  Square, 
  RotateCcw, 
  Activity, 
  HardDrive, 
  Cpu, 
  Memory, 
  Server,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'

interface ServerRuntimePanelProps {
  appId: string
  className?: string
  onStatusChange?: (status: 'running' | 'stopped' | 'error') => void
}

interface RuntimeStats {
  totalMemory: number
  usedMemory: number
  totalDisk: number
  usedDisk: number
  processCount: number
  uptime: number
}

/**
 * Server Runtime Panel - WebVM runtime management interface
 * Provides controls for starting, stopping, and monitoring application runtimes
 */
export function ServerRuntimePanel({ 
  appId, 
  className = '',
  onStatusChange 
}: ServerRuntimePanelProps) {
  const [runtime, setRuntime] = useState<RuntimeInstance | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<RuntimeStats | null>(null)
  const [webvmManager, setWebvmManager] = useState<WebVMManager | null>(null)
  const [processManager, setProcessManager] = useState<ProcessManager | null>(null)

  // Initialize WebVM and Process managers
  useEffect(() => {
    const initializeManagers = async () => {
      try {
        Logger.info('Initializing WebVM manager for runtime panel', { appId })
        
        const manager = WebVMManager.getInstance({
          type: 'mock',
          mock: {
            simulateLatency: true,
            minLatency: 50,
            maxLatency: 200,
            errorRate: 0.01
          }
        })
        
        await manager.initialize()
        setWebvmManager(manager)
        
        const procManager = new ProcessManager(manager)
        procManager.startMonitoring(3000)
        setProcessManager(procManager)
        
        Logger.info('Runtime panel managers initialized', { appId })
      } catch (error) {
        Logger.error('Failed to initialize runtime panel managers', { error, appId })
        setError('Failed to initialize WebVM system')
      }
    }

    initializeManagers()
    
    return () => {
      if (processManager) {
        processManager.stopMonitoring()
      }
    }
  }, [appId])

  // Update runtime status periodically
  useEffect(() => {
    if (!webvmManager) return

    const updateRuntimeStatus = async () => {
      try {
        const runtimeInstance = await webvmManager.getRuntimeForApp(appId)
        setRuntime(runtimeInstance)
        
        if (runtimeInstance && processManager) {
          const runtimeStats = await processManager.getSystemResources(runtimeInstance.id)
          if (runtimeStats) {
            setStats(runtimeStats)
          }
        }
        
        // Notify parent of status changes
        if (onStatusChange && runtimeInstance) {
          const status = runtimeInstance.status === 'running' ? 'running' : 
                        runtimeInstance.status === 'error' ? 'error' : 'stopped'
          onStatusChange(status)
        }
      } catch (error) {
        Logger.error('Failed to update runtime status', { error, appId })
      }
    }

    updateRuntimeStatus()
    const interval = setInterval(updateRuntimeStatus, 5000)
    
    return () => clearInterval(interval)
  }, [webvmManager, processManager, appId, onStatusChange])

  const startRuntime = async () => {
    if (!webvmManager) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      Logger.info('Starting runtime for application', { appId })
      
      // Create runtime metadata
      const metadata = {
        appId,
        entryPoint: 'index.js',
        environmentVariables: {
          NODE_ENV: 'development',
          PORT: '3000'
        },
        workingDirectory: '/app'
      }
      
      const runtimeInstance = await webvmManager.startRuntime('node', '20.0.0', metadata)
      setRuntime(runtimeInstance)
      
      Logger.info('Runtime started successfully', { appId, instanceId: runtimeInstance.id })
    } catch (error) {
      Logger.error('Failed to start runtime', { error, appId })
      setError(error instanceof Error ? error.message : 'Failed to start runtime')
    } finally {
      setIsLoading(false)
    }
  }

  const stopRuntime = async () => {
    if (!webvmManager || !runtime) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      Logger.info('Stopping runtime', { appId, instanceId: runtime.id })
      
      await webvmManager.stopRuntime(runtime.id)
      setRuntime(null)
      setStats(null)
      
      Logger.info('Runtime stopped successfully', { appId })
    } catch (error) {
      Logger.error('Failed to stop runtime', { error, appId })
      setError(error instanceof Error ? error.message : 'Failed to stop runtime')
    } finally {
      setIsLoading(false)
    }
  }

  const restartRuntime = async () => {
    if (!webvmManager || !runtime) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      Logger.info('Restarting runtime', { appId, instanceId: runtime.id })
      
      const newRuntime = await webvmManager.restartRuntime(runtime.id)
      setRuntime(newRuntime)
      
      Logger.info('Runtime restarted successfully', { appId, instanceId: newRuntime.id })
    } catch (error) {
      Logger.error('Failed to restart runtime', { error, appId })
      setError(error instanceof Error ? error.message : 'Failed to restart runtime')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = () => {
    if (!runtime) {
      return <Badge variant="secondary" className="flex items-center gap-1">
        <Square className="w-3 h-3" />
        Stopped
      </Badge>
    }

    switch (runtime.status) {
      case 'running':
        return <Badge variant="default" className="flex items-center gap-1 bg-green-600">
          <CheckCircle className="w-3 h-3" />
          Running
        </Badge>
      case 'starting':
        return <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-600">
          <Clock className="w-3 h-3" />
          Starting
        </Badge>
      case 'stopped':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Square className="w-3 h-3" />
          Stopped
        </Badge>
      case 'error':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Error
        </Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const formatUptime = (uptime: number) => {
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

  const formatMemory = (mb: number) => {
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(1)}GB`
    }
    return `${mb}MB`
  }

  return (
    <Card className={`${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Runtime Environment
            </CardTitle>
            <CardDescription>
              WebVM server runtime for {appId}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Error</span>
            </div>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        )}

        {/* Runtime Control Buttons */}
        <div className="flex items-center gap-2">
          {!runtime || runtime.status === 'stopped' ? (
            <Button 
              onClick={startRuntime} 
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {isLoading ? 'Starting...' : 'Start Runtime'}
            </Button>
          ) : (
            <>
              <Button 
                onClick={stopRuntime} 
                disabled={isLoading}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                {isLoading ? 'Stopping...' : 'Stop'}
              </Button>
              <Button 
                onClick={restartRuntime} 
                disabled={isLoading}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {isLoading ? 'Restarting...' : 'Restart'}
              </Button>
            </>
          )}
        </div>

        {/* Runtime Information */}
        {runtime && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Runtime Type:</span>
                <p className="font-medium">{runtime.type} {runtime.version}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Instance ID:</span>
                <p className="font-mono text-xs">{runtime.id}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Port:</span>
                <p className="font-medium">{runtime.port}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Started:</span>
                <p className="font-medium">
                  {runtime.startedAt ? new Date(runtime.startedAt).toLocaleTimeString() : 'N/A'}
                </p>
              </div>
            </div>

            {/* Resource Usage */}
            {stats && (
              <div className="space-y-3 border-t pt-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Resource Usage
                </h4>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Memory className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-muted-foreground">Memory</p>
                      <p className="font-medium">
                        {formatMemory(stats.usedMemory)} / {formatMemory(stats.totalMemory)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-muted-foreground">CPU</p>
                      <p className="font-medium">{stats.usedCpu.toFixed(1)}%</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-purple-500" />
                    <div>
                      <p className="text-muted-foreground">Disk</p>
                      <p className="font-medium">
                        {formatMemory(stats.usedMemory)} / {formatMemory(stats.totalMemory)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-orange-500" />
                    <div>
                      <p className="text-muted-foreground">Uptime</p>
                      <p className="font-medium">{formatUptime(stats.uptime)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="text-sm">
                  <span className="text-muted-foreground">Processes: </span>
                  <span className="font-medium">{stats.processCount}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No WebVM Warning */}
        {!webvmManager && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center gap-2 text-yellow-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">WebVM Initializing</span>
            </div>
            <p className="text-sm text-yellow-600 mt-1">
              Waiting for WebVM system to initialize...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}