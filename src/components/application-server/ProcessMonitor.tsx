import React, { useState, useEffect, useRef } from 'react'
import { ProcessManager, ProcessDetails } from '@/lib/webvm/ProcessManager'
import { WebVMManager } from '@/lib/webvm'
import { logger as Logger } from '@/lib/infrastructure/Logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Activity, 
  Terminal, 
  X, 
  RefreshCw, 
  Zap,
  CirclePlay,
  CircleStop,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react'

interface ProcessMonitorProps {
  runtimeInstanceId: string | null
  className?: string
}

interface ProcessWithLogs extends ProcessDetails {
  logsVisible: boolean
  recentLogs: string[]
}

/**
 * Process Monitor - WebVM process management and monitoring
 * Shows running processes, resource usage, and logs within WebVM instances
 */
export function ProcessMonitor({ 
  runtimeInstanceId, 
  className = '' 
}: ProcessMonitorProps) {
  const [processes, setProcesses] = useState<ProcessWithLogs[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processManager, setProcessManager] = useState<ProcessManager | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedProcess, setSelectedProcess] = useState<number | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Initialize process manager
  useEffect(() => {
    const initializeProcessManager = async () => {
      try {
        Logger.info('Initializing process monitor', { runtimeInstanceId })
        
        const webvmManager = WebVMManager.getInstance()
        const procManager = new ProcessManager(webvmManager)
        
        procManager.startMonitoring(2000) // Monitor every 2 seconds
        setProcessManager(procManager)
        
        Logger.info('Process monitor initialized', { runtimeInstanceId })
      } catch (error) {
        Logger.error('Failed to initialize process monitor', { error, runtimeInstanceId })
        setError('Failed to initialize process monitoring')
      }
    }

    initializeProcessManager()
    
    return () => {
      if (processManager) {
        processManager.stopMonitoring()
      }
    }
  }, [runtimeInstanceId])

  // Update process list
  useEffect(() => {
    if (!processManager || !runtimeInstanceId || !autoRefresh) return

    const updateProcesses = async () => {
      try {
        setIsLoading(true)
        const processDetails = await processManager.getProcesses(runtimeInstanceId)
        
        // Convert to ProcessWithLogs and preserve log visibility state
        const processesWithLogs: ProcessWithLogs[] = processDetails.map(process => {
          const existing = processes.find(p => p.pid === process.pid)
          return {
            ...process,
            logsVisible: existing?.logsVisible || false,
            recentLogs: existing?.recentLogs || []
          }
        })
        
        setProcesses(processesWithLogs)
        setError(null)
      } catch (error) {
        Logger.error('Failed to update process list', { error, runtimeInstanceId })
        setError('Failed to fetch process information')
      } finally {
        setIsLoading(false)
      }
    }

    updateProcesses()
    const interval = setInterval(updateProcesses, 3000)
    
    return () => clearInterval(interval)
  }, [processManager, runtimeInstanceId, autoRefresh])

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [processes])

  const refreshProcesses = async () => {
    if (!processManager || !runtimeInstanceId) return
    
    setIsLoading(true)
    try {
      const processDetails = await processManager.getProcesses(runtimeInstanceId)
      const processesWithLogs: ProcessWithLogs[] = processDetails.map(process => {
        const existing = processes.find(p => p.pid === process.pid)
        return {
          ...process,
          logsVisible: existing?.logsVisible || false,
          recentLogs: existing?.recentLogs || []
        }
      })
      setProcesses(processesWithLogs)
      setError(null)
    } catch (error) {
      Logger.error('Failed to refresh processes', { error, runtimeInstanceId })
      setError('Failed to refresh process list')
    } finally {
      setIsLoading(false)
    }
  }

  const killProcess = async (pid: number) => {
    if (!processManager || !runtimeInstanceId) return
    
    try {
      Logger.info('Killing process', { pid, runtimeInstanceId })
      const success = await processManager.killProcess(runtimeInstanceId, pid)
      
      if (success) {
        // Remove process from list immediately
        setProcesses(prev => prev.filter(p => p.pid !== pid))
        Logger.info('Process killed successfully', { pid })
      } else {
        setError(`Failed to kill process ${pid}`)
      }
    } catch (error) {
      Logger.error('Error killing process', { error, pid, runtimeInstanceId })
      setError(`Error killing process ${pid}`)
    }
  }

  const forceKillProcess = async (pid: number) => {
    if (!processManager || !runtimeInstanceId) return
    
    try {
      Logger.info('Force killing process', { pid, runtimeInstanceId })
      const success = await processManager.forceKillProcess(runtimeInstanceId, pid)
      
      if (success) {
        setProcesses(prev => prev.filter(p => p.pid !== pid))
        Logger.info('Process force killed successfully', { pid })
      } else {
        setError(`Failed to force kill process ${pid}`)
      }
    } catch (error) {
      Logger.error('Error force killing process', { error, pid, runtimeInstanceId })
      setError(`Error force killing process ${pid}`)
    }
  }

  const toggleProcessLogs = async (pid: number) => {
    if (!processManager || !runtimeInstanceId) return
    
    setProcesses(prev => prev.map(process => {
      if (process.pid === pid) {
        return { ...process, logsVisible: !process.logsVisible }
      }
      return process
    }))

    // Fetch logs if toggling on
    const process = processes.find(p => p.pid === pid)
    if (process && !process.logsVisible) {
      try {
        const logs = await processManager.getProcessLogs(runtimeInstanceId, pid, 50)
        setProcesses(prev => prev.map(p => {
          if (p.pid === pid) {
            return { ...p, recentLogs: logs }
          }
          return p
        }))
      } catch (error) {
        Logger.error('Failed to fetch process logs', { error, pid })
      }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="default" className="bg-green-600">Running</Badge>
      case 'stopped':
        return <Badge variant="secondary">Stopped</Badge>
      case 'crashed':
        return <Badge variant="destructive">Crashed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCpu = (cpu: number) => `${cpu.toFixed(1)}%`
  const formatMemory = (memory: number) => `${memory.toFixed(1)}MB`
  
  const formatElapsedTime = (startTime: Date) => {
    const elapsed = Date.now() - startTime.getTime()
    const seconds = Math.floor(elapsed / 1000)
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

  if (!runtimeInstanceId) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Process Monitor
          </CardTitle>
          <CardDescription>
            No runtime instance available for monitoring
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Process Monitor
            </CardTitle>
            <CardDescription>
              Runtime processes in {runtimeInstanceId}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="flex items-center gap-2"
            >
              {autoRefresh ? <CircleStop className="w-4 h-4" /> : <CirclePlay className="w-4 h-4" />}
              {autoRefresh ? 'Pause' : 'Resume'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshProcesses}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Error</span>
            </div>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        )}

        {processes.length === 0 && !isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No processes running</p>
          </div>
        ) : (
          <div className="space-y-3">
            {processes.map((process) => (
              <div key={process.pid} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                          PID {process.pid}
                        </span>
                        {getStatusBadge(process.status)}
                      </div>
                      <p className="font-medium mt-1 truncate max-w-md">
                        {process.command}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleProcessLogs(process.pid)}
                      className="flex items-center gap-1"
                    >
                      {process.logsVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      Logs
                    </Button>
                    
                    {process.status === 'running' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => killProcess(process.pid)}
                          className="flex items-center gap-1 text-orange-600 hover:text-orange-700"
                        >
                          <X className="w-3 h-3" />
                          Kill
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => forceKillProcess(process.pid)}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700"
                        >
                          <Zap className="w-3 h-3" />
                          Force
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Process Stats */}
                <div className="grid grid-cols-4 gap-4 text-xs text-muted-foreground mb-2">
                  <div>
                    <span>CPU:</span>
                    <span className="ml-1 font-medium">{formatCpu(process.cpu)}</span>
                  </div>
                  <div>
                    <span>Memory:</span>
                    <span className="ml-1 font-medium">{formatMemory(process.memory)}</span>
                  </div>
                  <div>
                    <span>Started:</span>
                    <span className="ml-1 font-medium">{formatElapsedTime(process.startTime)} ago</span>
                  </div>
                  <div>
                    <span>Status:</span>
                    <span className="ml-1 font-medium">{process.status}</span>
                  </div>
                </div>

                {/* Process Logs */}
                {process.logsVisible && (
                  <div className="mt-3 border-t pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Terminal className="w-4 h-4" />
                      <span className="text-sm font-medium">Process Logs</span>
                    </div>
                    
                    <ScrollArea className="h-32 w-full border rounded-md">
                      <div className="p-3 font-mono text-xs space-y-1 bg-muted/20">
                        {process.recentLogs.length > 0 ? (
                          process.recentLogs.map((log, index) => (
                            <div key={index} className="whitespace-pre-wrap">
                              {log}
                            </div>
                          ))
                        ) : (
                          <div className="text-muted-foreground italic">
                            No logs available
                          </div>
                        )}
                        <div ref={logsEndRef} />
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {isLoading && processes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
            <p>Loading processes...</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}