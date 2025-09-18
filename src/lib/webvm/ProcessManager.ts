import { WebVMManager } from './WebVMManager'
import { logger as Logger } from '../infrastructure/Logger'
import { 
  RuntimeInstance, 
  ProcessInfo,
  CommandResult,
  RuntimeFailureError
} from './types'

export interface ProcessDetails {
  pid: number
  command: string
  status: 'running' | 'stopped' | 'crashed'
  cpu: number
  memory: number // MB
  startTime: Date
  logs: string[]
}

export interface SystemResources {
  totalMemory: number
  usedMemory: number
  totalCpu: number
  usedCpu: number
  processCount: number
  uptime: number
}

/**
 * Process management and monitoring for WebVM instances
 * Provides system-level process control and resource monitoring
 */
export class ProcessManager {
  private webvmManager: WebVMManager
  private monitoringInterval: NodeJS.Timeout | null = null
  private processCache = new Map<string, ProcessDetails[]>()

  constructor(webvmManager?: WebVMManager) {
    this.webvmManager = webvmManager || WebVMManager.getInstance()
  }

  /**
   * Start monitoring processes across all runtime instances
   */
  startMonitoring(intervalMs: number = 5000): void {
    if (this.monitoringInterval) {
      Logger.warn('Process monitoring already started')
      return
    }

    Logger.info('Starting process monitoring', { intervalMs })

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.updateProcessCache()
      } catch (error) {
        Logger.error('Process monitoring update failed', { error })
      }
    }, intervalMs)
  }

  /**
   * Stop process monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      this.processCache.clear()
      
      Logger.info('Process monitoring stopped')
    }
  }

  /**
   * Get processes running in a specific runtime instance
   */
  async getProcesses(instanceId: string): Promise<ProcessDetails[]> {
    try {
      // Try to get from cache first
      const cached = this.processCache.get(instanceId)
      if (cached && this.monitoringInterval) {
        return cached
      }

      // Fetch fresh process data
      const processes = await this.fetchProcessDetails(instanceId)
      this.processCache.set(instanceId, processes)
      
      return processes
    } catch (error) {
      Logger.error('Failed to get processes', { error, instanceId })
      return []
    }
  }

  /**
   * Get system resource usage for a runtime instance
   */
  async getSystemResources(instanceId: string): Promise<SystemResources | null> {
    try {
      const runtime = await this.webvmManager.getRuntimeStatus(instanceId)
      if (!runtime || runtime.status !== 'running') {
        return null
      }

      // Get system information
      const [memInfo, cpuInfo, processCount, uptime] = await Promise.all([
        this.getMemoryInfo(instanceId),
        this.getCpuInfo(instanceId),
        this.getProcessCount(instanceId),
        this.getUptime(instanceId)
      ])

      return {
        totalMemory: memInfo.total,
        usedMemory: memInfo.used,
        totalCpu: 100, // 100% = 1 core
        usedCpu: cpuInfo.usage,
        processCount,
        uptime
      }
    } catch (error) {
      Logger.error('Failed to get system resources', { error, instanceId })
      return null
    }
  }

  /**
   * Kill a specific process in a runtime instance
   */
  async killProcess(instanceId: string, pid: number): Promise<boolean> {
    try {
      Logger.info('Killing process', { instanceId, pid })

      const result = await this.webvmManager.executeCommand(
        instanceId,
        `kill ${pid}`
      )

      const success = result.exitCode === 0
      
      if (success) {
        Logger.info('Process killed successfully', { instanceId, pid })
        // Update cache by removing killed process
        this.removeProcessFromCache(instanceId, pid)
      } else {
        Logger.warn('Failed to kill process', { 
          instanceId, 
          pid, 
          stderr: result.stderr 
        })
      }

      return success
    } catch (error) {
      Logger.error('Error killing process', { error, instanceId, pid })
      return false
    }
  }

  /**
   * Force kill a process using SIGKILL
   */
  async forceKillProcess(instanceId: string, pid: number): Promise<boolean> {
    try {
      Logger.info('Force killing process', { instanceId, pid })

      const result = await this.webvmManager.executeCommand(
        instanceId,
        `kill -9 ${pid}`
      )

      const success = result.exitCode === 0
      
      if (success) {
        Logger.info('Process force killed successfully', { instanceId, pid })
        this.removeProcessFromCache(instanceId, pid)
      }

      return success
    } catch (error) {
      Logger.error('Error force killing process', { error, instanceId, pid })
      return false
    }
  }

  /**
   * Get detailed logs for a specific process
   */
  async getProcessLogs(
    instanceId: string, 
    pid: number, 
    lines: number = 100
  ): Promise<string[]> {
    try {
      // Try to find log file for the process
      const result = await this.webvmManager.executeCommand(
        instanceId,
        `journalctl _PID=${pid} --no-pager -n ${lines} 2>/dev/null || echo "No logs found"`
      )

      return result.stdout.split('\n').filter(line => line.trim())
    } catch (error) {
      Logger.error('Failed to get process logs', { error, instanceId, pid })
      return []
    }
  }

  /**
   * Get real-time process statistics
   */
  async getProcessStats(instanceId: string, pid: number): Promise<ProcessDetails | null> {
    try {
      // Get detailed process information
      const result = await this.webvmManager.executeCommand(
        instanceId,
        `ps -p ${pid} -o pid,cmd,pcpu,pmem,etime --no-headers 2>/dev/null || echo "Process not found"`
      )

      if (result.stdout.includes('Process not found')) {
        return null
      }

      const line = result.stdout.trim()
      const parts = line.split(/\s+/)
      
      if (parts.length < 5) {
        return null
      }

      const [pidStr, ...cmdParts] = parts
      const cpu = parseFloat(parts[parts.length - 3]) || 0
      const memory = parseFloat(parts[parts.length - 2]) || 0
      const elapsed = parts[parts.length - 1]

      // Calculate start time from elapsed time
      const startTime = this.parseElapsedTime(elapsed)
      
      return {
        pid: parseInt(pidStr),
        command: cmdParts.slice(0, -3).join(' '),
        status: 'running',
        cpu,
        memory,
        startTime,
        logs: await this.getProcessLogs(instanceId, pid, 10)
      }
    } catch (error) {
      Logger.error('Failed to get process stats', { error, instanceId, pid })
      return null
    }
  }

  /**
   * Check if a process is responding (for web servers)
   */
  async isProcessResponding(instanceId: string, port: number): Promise<boolean> {
    try {
      const result = await this.webvmManager.executeCommand(
        instanceId,
        `curl -f -s http://localhost:${port}/health || curl -f -s http://localhost:${port}/ || echo "FAILED"`
      )

      return !result.stdout.includes('FAILED') && result.exitCode === 0
    } catch (error) {
      Logger.debug('Process health check failed', { error, instanceId, port })
      return false
    }
  }

  // Private helper methods

  private async updateProcessCache(): Promise<void> {
    const runtimes = await this.webvmManager.listRuntimes()
    
    for (const runtime of runtimes) {
      if (runtime.status === 'running') {
        try {
          const processes = await this.fetchProcessDetails(runtime.id)
          this.processCache.set(runtime.id, processes)
        } catch (error) {
          Logger.error('Failed to update process cache for runtime', { 
            error, 
            instanceId: runtime.id 
          })
        }
      }
    }
  }

  private async fetchProcessDetails(instanceId: string): Promise<ProcessDetails[]> {
    try {
      // Get process list with detailed information
      const result = await this.webvmManager.executeCommand(
        instanceId,
        'ps aux --no-headers | grep -v "ps aux" | grep -v "grep"'
      )

      const processes: ProcessDetails[] = []
      const lines = result.stdout.split('\n').filter(line => line.trim())

      for (const line of lines) {
        const process = this.parseProcessLine(line)
        if (process) {
          processes.push(process)
        }
      }

      return processes
    } catch (error) {
      Logger.error('Failed to fetch process details', { error, instanceId })
      return []
    }
  }

  private parseProcessLine(line: string): ProcessDetails | null {
    try {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 11) {
        return null
      }

      const pid = parseInt(parts[1])
      const cpu = parseFloat(parts[2]) || 0
      const memory = parseFloat(parts[3]) || 0
      const command = parts.slice(10).join(' ')

      // Skip kernel processes and system processes
      if (command.startsWith('[') || pid < 100) {
        return null
      }

      return {
        pid,
        command,
        status: 'running',
        cpu,
        memory,
        startTime: new Date(Date.now() - Math.random() * 3600000), // Approximate
        logs: []
      }
    } catch (error) {
      Logger.debug('Failed to parse process line', { error, line })
      return null
    }
  }

  private async getMemoryInfo(instanceId: string): Promise<{ total: number; used: number }> {
    try {
      const result = await this.webvmManager.executeCommand(
        instanceId,
        'free -m | grep Mem:'
      )

      const parts = result.stdout.trim().split(/\s+/)
      const total = parseInt(parts[1]) || 1024
      const used = parseInt(parts[2]) || 0

      return { total, used }
    } catch (error) {
      Logger.debug('Failed to get memory info', { error, instanceId })
      return { total: 1024, used: 256 } // Default values
    }
  }

  private async getCpuInfo(instanceId: string): Promise<{ usage: number }> {
    try {
      const result = await this.webvmManager.executeCommand(
        instanceId,
        'top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk \'{print 100 - $1}\''
      )

      const usage = parseFloat(result.stdout.trim()) || 0
      return { usage }
    } catch (error) {
      Logger.debug('Failed to get CPU info', { error, instanceId })
      return { usage: 0 }
    }
  }

  private async getProcessCount(instanceId: string): Promise<number> {
    try {
      const result = await this.webvmManager.executeCommand(
        instanceId,
        'ps aux --no-headers | wc -l'
      )

      return parseInt(result.stdout.trim()) || 0
    } catch (error) {
      Logger.debug('Failed to get process count', { error, instanceId })
      return 0
    }
  }

  private async getUptime(instanceId: string): Promise<number> {
    try {
      const result = await this.webvmManager.executeCommand(
        instanceId,
        'cat /proc/uptime | cut -d" " -f1'
      )

      return parseFloat(result.stdout.trim()) * 1000 || 0 // Convert to ms
    } catch (error) {
      Logger.debug('Failed to get uptime', { error, instanceId })
      return 0
    }
  }

  private parseElapsedTime(elapsed: string): Date {
    // Parse elapsed time formats like "01:23:45" or "3-01:23:45"
    try {
      const now = new Date()
      let totalSeconds = 0

      if (elapsed.includes('-')) {
        const [days, time] = elapsed.split('-')
        totalSeconds += parseInt(days) * 24 * 3600
        elapsed = time
      }

      const parts = elapsed.split(':')
      if (parts.length >= 3) {
        totalSeconds += parseInt(parts[0]) * 3600 // hours
        totalSeconds += parseInt(parts[1]) * 60   // minutes
        totalSeconds += parseInt(parts[2])        // seconds
      }

      return new Date(now.getTime() - totalSeconds * 1000)
    } catch (error) {
      return new Date()
    }
  }

  private removeProcessFromCache(instanceId: string, pid: number): void {
    const processes = this.processCache.get(instanceId)
    if (processes) {
      const filtered = processes.filter(p => p.pid !== pid)
      this.processCache.set(instanceId, filtered)
    }
  }
}