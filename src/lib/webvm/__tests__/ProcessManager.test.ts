import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ProcessManager, type ProcessDetails, type SystemResources } from '../ProcessManager'
import { WebVMManager } from '../WebVMManager'
import { type RuntimeInstance } from '../types'

// Mock Logger
vi.mock('../infrastructure/Logger', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('ProcessManager', () => {
  let processManager: ProcessManager
  let mockWebVMManager: any
  let mockLogger: any

  beforeEach(() => {
    // Mock WebVMManager
    mockWebVMManager = {
      executeCommand: vi.fn(),
      getRuntimeStatus: vi.fn(),
      listRuntimes: vi.fn().mockResolvedValue([])
    }

    processManager = new ProcessManager(mockWebVMManager)
  })

  afterEach(() => {
    processManager.stopMonitoring()
    vi.clearAllMocks()
  })

  describe('Monitoring Control', () => {
    it('should start monitoring', () => {
      processManager.startMonitoring(1000)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting process monitoring',
        { intervalMs: 1000 }
      )
    })

    it('should not start monitoring twice', () => {
      processManager.startMonitoring(1000)
      processManager.startMonitoring(1000)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Process monitoring already started'
      )
    })

    it('should stop monitoring', () => {
      processManager.startMonitoring(1000)
      processManager.stopMonitoring()

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Process monitoring stopped'
      )
    })

    it('should handle stop monitoring when not started', () => {
      processManager.stopMonitoring()
      
      // Should not throw error
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'Process monitoring stopped'
      )
    })
  })

  describe('Process Information Retrieval', () => {
    beforeEach(() => {
      const mockPsOutput = `
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.1   1234   567 ?        Ss   12:00   0:01 /sbin/init
node      1001  2.5  5.2  98765  4321 ?        Sl   12:01   0:30 node server.js
python    1002  1.8  3.1  87654  3210 ?        S    12:02   0:15 python app.py
nginx     1003  0.5  1.0  45678  1234 ?        S    12:03   0:02 nginx: worker
      `.trim()

      mockWebVMManager.executeCommand.mockResolvedValue({
        stdout: mockPsOutput,
        stderr: '',
        exitCode: 0,
        duration: 100
      })
    })

    it('should get processes for instance', async () => {
      const processes = await processManager.getProcesses('runtime-1')

      expect(processes).toHaveLength(3) // Excluding init process (PID < 100)
      
      const nodeProcess = processes.find(p => p.command.includes('node server.js'))
      expect(nodeProcess).toMatchObject({
        pid: 1001,
        command: 'node server.js',
        status: 'running',
        cpu: 2.5,
        memory: 5.2
      })

      const pythonProcess = processes.find(p => p.command.includes('python app.py'))
      expect(pythonProcess).toMatchObject({
        pid: 1002,
        command: 'python app.py',
        status: 'running',
        cpu: 1.8,
        memory: 3.1
      })
    })

    it('should handle empty process list', async () => {
      mockWebVMManager.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        duration: 100
      })

      const processes = await processManager.getProcesses('runtime-1')

      expect(processes).toEqual([])
    })

    it('should handle ps command failure', async () => {
      mockWebVMManager.executeCommand.mockRejectedValue(new Error('Command failed'))

      const processes = await processManager.getProcesses('runtime-1')

      expect(processes).toEqual([])
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get processes',
        expect.objectContaining({ instanceId: 'runtime-1' })
      )
    })

    it('should return cached processes when monitoring is active', async () => {
      processManager.startMonitoring(5000)
      
      // First call should fetch from provider
      const processes1 = await processManager.getProcesses('runtime-1')
      
      // Second call should use cache
      const processes2 = await processManager.getProcesses('runtime-1')

      expect(mockWebVMManager.executeCommand).toHaveBeenCalledTimes(1)
      expect(processes1).toEqual(processes2)
    })
  })

  describe('System Resource Monitoring', () => {
    beforeEach(() => {
      const runtimeInstance: RuntimeInstance = {
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'running',
        startedAt: new Date(),
        metadata: {
          appId: 'test-app',
          entryPoint: 'index.js',
          environmentVariables: {},
          workingDirectory: '/app'
        }
      }

      mockWebVMManager.getRuntimeStatus.mockResolvedValue(runtimeInstance)
    })

    it('should get system resources', async () => {
      // Mock memory info
      mockWebVMManager.executeCommand
        .mockResolvedValueOnce({
          stdout: 'Mem:        2048        512        1536',
          stderr: '',
          exitCode: 0,
          duration: 50
        })
        // Mock CPU info
        .mockResolvedValueOnce({
          stdout: '25.5',
          stderr: '',
          exitCode: 0,
          duration: 50
        })
        // Mock process count
        .mockResolvedValueOnce({
          stdout: '45',
          stderr: '',
          exitCode: 0,
          duration: 50
        })
        // Mock uptime
        .mockResolvedValueOnce({
          stdout: '1234.56',
          stderr: '',
          exitCode: 0,
          duration: 50
        })

      const resources = await processManager.getSystemResources('runtime-1')

      expect(resources).toMatchObject({
        totalMemory: 2048,
        usedMemory: 512,
        totalCpu: 100,
        usedCpu: 25.5,
        processCount: 45,
        uptime: 1234560 // Converted to milliseconds
      })
    })

    it('should return null for non-running runtime', async () => {
      const stoppedInstance: RuntimeInstance = {
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'stopped',
        startedAt: new Date(),
        metadata: {
          appId: 'test-app',
          entryPoint: 'index.js',
          environmentVariables: {},
          workingDirectory: '/app'
        }
      }

      mockWebVMManager.getRuntimeStatus.mockResolvedValue(stoppedInstance)

      const resources = await processManager.getSystemResources('runtime-1')

      expect(resources).toBeNull()
    })

    it('should return null for non-existent runtime', async () => {
      mockWebVMManager.getRuntimeStatus.mockResolvedValue(null)

      const resources = await processManager.getSystemResources('runtime-1')

      expect(resources).toBeNull()
    })

    it('should handle system command failures gracefully', async () => {
      mockWebVMManager.executeCommand.mockRejectedValue(new Error('Command failed'))

      const resources = await processManager.getSystemResources('runtime-1')

      expect(resources).toBeNull()
    })
  })

  describe('Process Control', () => {
    it('should kill process successfully', async () => {
      mockWebVMManager.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        duration: 100
      })

      const result = await processManager.killProcess('runtime-1', 1234)

      expect(result).toBe(true)
      expect(mockWebVMManager.executeCommand).toHaveBeenCalledWith(
        'runtime-1',
        'kill 1234'
      )
    })

    it('should handle kill process failure', async () => {
      mockWebVMManager.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: 'No such process',
        exitCode: 1,
        duration: 100
      })

      const result = await processManager.killProcess('runtime-1', 1234)

      expect(result).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to kill process',
        expect.objectContaining({ 
          instanceId: 'runtime-1',
          pid: 1234
        })
      )
    })

    it('should force kill process successfully', async () => {
      mockWebVMManager.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        duration: 100
      })

      const result = await processManager.forceKillProcess('runtime-1', 1234)

      expect(result).toBe(true)
      expect(mockWebVMManager.executeCommand).toHaveBeenCalledWith(
        'runtime-1',
        'kill -9 1234'
      )
    })

    it('should handle command execution errors', async () => {
      mockWebVMManager.executeCommand.mockRejectedValue(new Error('Command failed'))

      const result = await processManager.killProcess('runtime-1', 1234)

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error killing process',
        expect.objectContaining({ instanceId: 'runtime-1', pid: 1234 })
      )
    })
  })

  describe('Process Logs', () => {
    it('should get process logs', async () => {
      const logOutput = `
Jan 01 12:00:01 app[1234]: Starting application
Jan 01 12:00:02 app[1234]: Server listening on port 3000
Jan 01 12:00:03 app[1234]: Database connected
      `.trim()

      mockWebVMManager.executeCommand.mockResolvedValue({
        stdout: logOutput,
        stderr: '',
        exitCode: 0,
        duration: 100
      })

      const logs = await processManager.getProcessLogs('runtime-1', 1234, 50)

      expect(logs).toHaveLength(3)
      expect(logs[0]).toContain('Starting application')
      expect(logs[1]).toContain('Server listening on port 3000')
      expect(logs[2]).toContain('Database connected')
    })

    it('should handle no logs available', async () => {
      mockWebVMManager.executeCommand.mockResolvedValue({
        stdout: 'No logs found',
        stderr: '',
        exitCode: 0,
        duration: 100
      })

      const logs = await processManager.getProcessLogs('runtime-1', 1234)

      expect(logs).toEqual(['No logs found'])
    })

    it('should handle log retrieval failure', async () => {
      mockWebVMManager.executeCommand.mockRejectedValue(new Error('Log command failed'))

      const logs = await processManager.getProcessLogs('runtime-1', 1234)

      expect(logs).toEqual([])
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get process logs',
        expect.objectContaining({ instanceId: 'runtime-1', pid: 1234 })
      )
    })
  })

  describe('Process Statistics', () => {
    it('should get detailed process stats', async () => {
      const psOutput = '1234 node server.js 15.5 8.2 01:23:45'

      mockWebVMManager.executeCommand
        .mockResolvedValueOnce({
          stdout: psOutput,
          stderr: '',
          exitCode: 0,
          duration: 100
        })
        .mockResolvedValueOnce({
          stdout: 'Starting application\nServer ready',
          stderr: '',
          exitCode: 0,
          duration: 50
        })

      const stats = await processManager.getProcessStats('runtime-1', 1234)

      expect(stats).toMatchObject({
        pid: 1234,
        command: 'node server.js',
        status: 'running',
        cpu: 15.5,
        memory: 8.2,
        startTime: expect.any(Date),
        logs: expect.arrayContaining(['Starting application', 'Server ready'])
      })
    })

    it('should return null for non-existent process', async () => {
      mockWebVMManager.executeCommand.mockResolvedValue({
        stdout: 'Process not found',
        stderr: '',
        exitCode: 0,
        duration: 100
      })

      const stats = await processManager.getProcessStats('runtime-1', 1234)

      expect(stats).toBeNull()
    })

    it('should handle malformed ps output', async () => {
      mockWebVMManager.executeCommand.mockResolvedValue({
        stdout: 'malformed output',
        stderr: '',
        exitCode: 0,
        duration: 100
      })

      const stats = await processManager.getProcessStats('runtime-1', 1234)

      expect(stats).toBeNull()
    })
  })

  describe('Health Monitoring', () => {
    it('should check if process is responding', async () => {
      mockWebVMManager.executeCommand.mockResolvedValue({
        stdout: '{"status": "ok"}',
        stderr: '',
        exitCode: 0,
        duration: 100
      })

      const isResponding = await processManager.isProcessResponding('runtime-1', 3000)

      expect(isResponding).toBe(true)
      expect(mockWebVMManager.executeCommand).toHaveBeenCalledWith(
        'runtime-1',
        expect.stringContaining('curl -f -s http://localhost:3000')
      )
    })

    it('should detect non-responding process', async () => {
      mockWebVMManager.executeCommand.mockResolvedValue({
        stdout: 'FAILED',
        stderr: '',
        exitCode: 1,
        duration: 100
      })

      const isResponding = await processManager.isProcessResponding('runtime-1', 3000)

      expect(isResponding).toBe(false)
    })

    it('should handle health check errors', async () => {
      mockWebVMManager.executeCommand.mockRejectedValue(new Error('Network error'))

      const isResponding = await processManager.isProcessResponding('runtime-1', 3000)

      expect(isResponding).toBe(false)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Process health check failed',
        expect.objectContaining({ instanceId: 'runtime-1', port: 3000 })
      )
    })
  })

  describe('Background Monitoring', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should update process cache periodically', async () => {
      const runtimeInstance: RuntimeInstance = {
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'running',
        startedAt: new Date(),
        metadata: {
          appId: 'test-app',
          entryPoint: 'index.js',
          environmentVariables: {},
          workingDirectory: '/app'
        }
      }

      mockWebVMManager.listRuntimes.mockResolvedValue([runtimeInstance])
      mockWebVMManager.executeCommand.mockResolvedValue({
        stdout: 'USER PID %CPU %MEM COMMAND\nnode 1001 2.5 5.2 node server.js',
        stderr: '',
        exitCode: 0,
        duration: 100
      })

      processManager.startMonitoring(1000)

      // Fast-forward time to trigger monitoring
      await vi.advanceTimersByTimeAsync(1500)

      expect(mockWebVMManager.listRuntimes).toHaveBeenCalled()
      expect(mockWebVMManager.executeCommand).toHaveBeenCalledWith(
        'runtime-1',
        expect.stringContaining('ps aux')
      )
    })

    it('should handle monitoring errors gracefully', async () => {
      mockWebVMManager.listRuntimes.mockRejectedValue(new Error('Monitoring error'))

      processManager.startMonitoring(1000)

      // Fast-forward time to trigger monitoring
      await vi.advanceTimersByTimeAsync(1500)

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Process monitoring update failed',
        expect.objectContaining({ error: expect.any(Error) })
      )
    })
  })

  describe('Memory Management', () => {
    it('should remove process from cache when killed', async () => {
      // First, add a process to cache
      const processDetails: ProcessDetails = {
        pid: 1234,
        command: 'node server.js',
        status: 'running',
        cpu: 2.5,
        memory: 5.2,
        startTime: new Date(),
        logs: []
      }

      ;(processManager as any).processCache.set('runtime-1', [processDetails])

      mockWebVMManager.executeCommand.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        duration: 100
      })

      await processManager.killProcess('runtime-1', 1234)

      // Check that process was removed from cache
      const cachedProcesses = (processManager as any).processCache.get('runtime-1')
      expect(cachedProcesses).toEqual([])
    })

    it('should clear cache on stop monitoring', () => {
      // Add some data to cache
      (processManager as any).processCache.set('runtime-1', [])
      ;(processManager as any).processCache.set('runtime-2', [])

      processManager.startMonitoring(1000)
      processManager.stopMonitoring()

      expect((processManager as any).processCache.size).toBe(0)
    })
  })
})