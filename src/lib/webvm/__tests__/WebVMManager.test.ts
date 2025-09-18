import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebVMManager } from '../WebVMManager'
import { MockWebVMProvider } from '../MockWebVMProvider'
import { 
  WebVMError, 
  RuntimeNotFoundError, 
  WebVMInitializationError,
  type RuntimeInstance,
  type RuntimeMetadata 
} from '../types'

// Mock the providers
vi.mock('../MockWebVMProvider')
vi.mock('../CheerpXProvider')

// Mock Logger
vi.mock('../infrastructure/Logger', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('WebVMManager', () => {
  let manager: WebVMManager
  let mockProvider: any
  let mockLogger: any

  beforeEach(() => {
    // Reset singleton
    ;(WebVMManager as any).instance = null

    // Mock provider
    mockProvider = {
      initialize: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      startRuntime: vi.fn(),
      stopRuntime: vi.fn().mockResolvedValue(undefined),
      restartRuntime: vi.fn(),
      getRuntimeStatus: vi.fn(),
      listRuntimes: vi.fn().mockResolvedValue([]),
      proxyHTTPRequest: vi.fn(),
      executeCommand: vi.fn(),
      installPackages: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn(),
      listFiles: vi.fn(),
      getStats: vi.fn().mockResolvedValue({
        totalMemory: 1024,
        usedMemory: 256,
        totalDisk: 10240,
        usedDisk: 512,
        runtimeCount: 0,
        uptime: 1000
      })
    }

    // Mock provider constructor
    ;(MockWebVMProvider as any).mockImplementation(() => mockProvider)

    // Create manager instance
    manager = WebVMManager.getInstance({
      type: 'mock',
      mock: {
        simulateLatency: false,
        errorRate: 0
      }
    })
  })

  afterEach(async () => {
    try {
      await manager.shutdown()
    } catch (error) {
      // Ignore shutdown errors in tests
    }
    vi.clearAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = WebVMManager.getInstance({
        type: 'mock',
        mock: { simulateLatency: false }
      })
      const instance2 = WebVMManager.getInstance()

      expect(instance1).toBe(instance2)
    })

    it('should throw error if no initial configuration provided', () => {
      ;(WebVMManager as any).instance = null

      expect(() => WebVMManager.getInstance()).toThrow(
        'WebVMManager requires initial configuration'
      )
    })
  })

  describe('Initialization', () => {
    it('should initialize successfully with mock provider', async () => {
      await manager.initialize()

      expect(mockProvider.initialize).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WebVM system initialized successfully'
      )
    })

    it('should not initialize twice', async () => {
      await manager.initialize()
      await manager.initialize()

      expect(mockProvider.initialize).toHaveBeenCalledTimes(1)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'WebVMManager already initialized'
      )
    })

    it('should handle initialization failures with retry', async () => {
      mockProvider.initialize
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(undefined)

      await manager.initialize()

      expect(mockProvider.initialize).toHaveBeenCalledTimes(2)
    })

    it('should fallback to mock provider if real provider fails', async () => {
      ;(WebVMManager as any).instance = null
      
      // Create manager with CheerpX config
      manager = WebVMManager.getInstance({
        type: 'cheerpx',
        webvm: { diskSize: 1024 }
      })

      // Mock CheerpX provider to fail
      const { CheerpXProvider } = await import('../CheerpXProvider')
      ;(CheerpXProvider as any).mockImplementation(() => {
        throw new Error('CheerpX not available')
      })

      await manager.initialize()

      // Should have fallen back to MockWebVMProvider
      expect(MockWebVMProvider).toHaveBeenCalled()
    })
  })

  describe('Runtime Management', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    describe('startRuntime', () => {
      it('should start runtime successfully', async () => {
        const metadata: RuntimeMetadata = {
          appId: 'test-app',
          entryPoint: 'index.js',
          environmentVariables: { NODE_ENV: 'test' },
          workingDirectory: '/app'
        }

        const expectedInstance: RuntimeInstance = {
          id: 'runtime-1',
          type: 'node',
          version: '18.0.0',
          port: 3000,
          status: 'running',
          startedAt: new Date(),
          metadata
        }

        mockProvider.startRuntime.mockResolvedValue(expectedInstance)

        const result = await manager.startRuntime('node', '18.0.0', metadata)

        expect(result).toEqual(expectedInstance)
        expect(mockProvider.startRuntime).toHaveBeenCalledWith('node', '18.0.0', metadata)
      })

      it('should retry runtime startup on failure', async () => {
        const metadata: RuntimeMetadata = {
          appId: 'test-app',
          entryPoint: 'index.js',
          environmentVariables: {},
          workingDirectory: '/app'
        }

        const expectedInstance: RuntimeInstance = {
          id: 'runtime-1',
          type: 'node',
          version: '18.0.0',
          port: 3000,
          status: 'running',
          startedAt: new Date(),
          metadata
        }

        mockProvider.startRuntime
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValue(expectedInstance)

        const result = await manager.startRuntime('node', '18.0.0', metadata)

        expect(result).toEqual(expectedInstance)
        expect(mockProvider.startRuntime).toHaveBeenCalledTimes(2)
      })

      it('should throw error if not initialized', async () => {
        const uninitializedManager = WebVMManager.getInstance()
        ;(uninitializedManager as any).initialized = false

        await expect(uninitializedManager.startRuntime('node', '18.0.0', {
          appId: 'test',
          entryPoint: 'index.js',
          environmentVariables: {},
          workingDirectory: '/app'
        })).rejects.toThrow('WebVM system not initialized')
      })
    })

    describe('stopRuntime', () => {
      it('should stop runtime successfully', async () => {
        await manager.stopRuntime('runtime-1')

        expect(mockProvider.stopRuntime).toHaveBeenCalledWith('runtime-1')
      })
    })

    describe('restartRuntime', () => {
      it('should restart runtime successfully', async () => {
        const expectedInstance: RuntimeInstance = {
          id: 'runtime-1-restarted',
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

        mockProvider.restartRuntime.mockResolvedValue(expectedInstance)

        const result = await manager.restartRuntime('runtime-1')

        expect(result).toEqual(expectedInstance)
        expect(mockProvider.restartRuntime).toHaveBeenCalledWith('runtime-1')
      })
    })

    describe('getRuntimeStatus', () => {
      it('should return runtime status', async () => {
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

        mockProvider.getRuntimeStatus.mockResolvedValue(runtimeInstance)

        const result = await manager.getRuntimeStatus('runtime-1')

        expect(result).toEqual(runtimeInstance)
        expect(mockProvider.getRuntimeStatus).toHaveBeenCalledWith('runtime-1')
      })

      it('should return null for non-existent runtime', async () => {
        mockProvider.getRuntimeStatus.mockResolvedValue(null)

        const result = await manager.getRuntimeStatus('non-existent')

        expect(result).toBeNull()
      })

      it('should return cached instance on provider error', async () => {
        const cachedInstance: RuntimeInstance = {
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

        // Add to cache first
        ;(manager as any).runtimeInstances.set('runtime-1', cachedInstance)

        mockProvider.getRuntimeStatus.mockRejectedValue(new Error('Provider error'))

        const result = await manager.getRuntimeStatus('runtime-1')

        expect(result).toEqual(cachedInstance)
      })
    })

    describe('listRuntimes', () => {
      it('should list all runtimes', async () => {
        const runtimes: RuntimeInstance[] = [
          {
            id: 'runtime-1',
            type: 'node',
            version: '18.0.0',
            port: 3000,
            status: 'running',
            startedAt: new Date(),
            metadata: { appId: 'app1', entryPoint: 'index.js', environmentVariables: {}, workingDirectory: '/app' }
          },
          {
            id: 'runtime-2',
            type: 'python',
            version: '3.9.0',
            port: 3001,
            status: 'running',
            startedAt: new Date(),
            metadata: { appId: 'app2', entryPoint: 'main.py', environmentVariables: {}, workingDirectory: '/app' }
          }
        ]

        mockProvider.listRuntimes.mockResolvedValue(runtimes)

        const result = await manager.listRuntimes()

        expect(result).toEqual(runtimes)
        expect(mockProvider.listRuntimes).toHaveBeenCalled()
      })

      it('should return cached runtimes on provider error', async () => {
        const cachedRuntimes: RuntimeInstance[] = [
          {
            id: 'runtime-1',
            type: 'node',
            version: '18.0.0',
            port: 3000,
            status: 'running',
            startedAt: new Date(),
            metadata: { appId: 'app1', entryPoint: 'index.js', environmentVariables: {}, workingDirectory: '/app' }
          }
        ]

        // Add to cache
        ;(manager as any).runtimeInstances.set('runtime-1', cachedRuntimes[0])

        mockProvider.listRuntimes.mockRejectedValue(new Error('Provider error'))

        const result = await manager.listRuntimes()

        expect(result).toEqual(cachedRuntimes)
      })
    })

    describe('getRuntimeForApp', () => {
      it('should find runtime by app ID', async () => {
        const runtimes: RuntimeInstance[] = [
          {
            id: 'runtime-1',
            type: 'node',
            version: '18.0.0',
            port: 3000,
            status: 'running',
            startedAt: new Date(),
            metadata: { appId: 'target-app', entryPoint: 'index.js', environmentVariables: {}, workingDirectory: '/app' }
          },
          {
            id: 'runtime-2',
            type: 'python',
            version: '3.9.0',
            port: 3001,
            status: 'running',
            startedAt: new Date(),
            metadata: { appId: 'other-app', entryPoint: 'main.py', environmentVariables: {}, workingDirectory: '/app' }
          }
        ]

        mockProvider.listRuntimes.mockResolvedValue(runtimes)

        const result = await manager.getRuntimeForApp('target-app')

        expect(result).toEqual(runtimes[0])
      })

      it('should return null if app not found', async () => {
        mockProvider.listRuntimes.mockResolvedValue([])

        const result = await manager.getRuntimeForApp('non-existent-app')

        expect(result).toBeNull()
      })
    })
  })

  describe('HTTP Proxy', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should proxy HTTP request successfully', async () => {
      const runtimeInstance: RuntimeInstance = {
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'running',
        startedAt: new Date(),
        metadata: { appId: 'test-app', entryPoint: 'index.js', environmentVariables: {}, workingDirectory: '/app' }
      }

      const mockRequest = new Request('http://localhost:3000/api/test')
      const mockResponse = new Response('{"success": true}', { status: 200 })

      mockProvider.getRuntimeStatus.mockResolvedValue(runtimeInstance)
      mockProvider.proxyHTTPRequest.mockResolvedValue(mockResponse)

      const result = await manager.proxyHTTPRequest('runtime-1', mockRequest)

      expect(result).toBe(mockResponse)
      expect(mockProvider.proxyHTTPRequest).toHaveBeenCalledWith('runtime-1', mockRequest)
    })

    it('should throw RuntimeNotFoundError for non-existent runtime', async () => {
      mockProvider.getRuntimeStatus.mockResolvedValue(null)

      const mockRequest = new Request('http://localhost:3000/api/test')

      await expect(manager.proxyHTTPRequest('non-existent', mockRequest))
        .rejects.toThrow(RuntimeNotFoundError)
    })

    it('should throw error for non-running runtime', async () => {
      const stoppedInstance: RuntimeInstance = {
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'stopped',
        startedAt: new Date(),
        metadata: { appId: 'test-app', entryPoint: 'index.js', environmentVariables: {}, workingDirectory: '/app' }
      }

      mockProvider.getRuntimeStatus.mockResolvedValue(stoppedInstance)

      const mockRequest = new Request('http://localhost:3000/api/test')

      await expect(manager.proxyHTTPRequest('runtime-1', mockRequest))
        .rejects.toThrow('Runtime instance is not running: stopped')
    })

    it('should retry proxy requests on failure', async () => {
      const runtimeInstance: RuntimeInstance = {
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'running',
        startedAt: new Date(),
        metadata: { appId: 'test-app', entryPoint: 'index.js', environmentVariables: {}, workingDirectory: '/app' }
      }

      const mockRequest = new Request('http://localhost:3000/api/test')
      const mockResponse = new Response('{"success": true}', { status: 200 })

      mockProvider.getRuntimeStatus.mockResolvedValue(runtimeInstance)
      mockProvider.proxyHTTPRequest
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockResponse)

      const result = await manager.proxyHTTPRequest('runtime-1', mockRequest)

      expect(result).toBe(mockResponse)
      expect(mockProvider.proxyHTTPRequest).toHaveBeenCalledTimes(2)
    })
  })

  describe('Command Execution', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should execute command successfully', async () => {
      const runtimeInstance: RuntimeInstance = {
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'running',
        startedAt: new Date(),
        metadata: { appId: 'test-app', entryPoint: 'index.js', environmentVariables: {}, workingDirectory: '/app' }
      }

      const commandResult = {
        stdout: 'Hello World',
        stderr: '',
        exitCode: 0,
        duration: 100
      }

      mockProvider.getRuntimeStatus.mockResolvedValue(runtimeInstance)
      mockProvider.executeCommand.mockResolvedValue(commandResult)

      const result = await manager.executeCommand('runtime-1', 'echo "Hello World"')

      expect(result).toEqual(commandResult)
      expect(mockProvider.executeCommand).toHaveBeenCalledWith(
        'runtime-1', 
        'echo "Hello World"', 
        undefined
      )
    })

    it('should throw RuntimeNotFoundError for non-existent runtime', async () => {
      mockProvider.getRuntimeStatus.mockResolvedValue(null)

      await expect(manager.executeCommand('non-existent', 'echo test'))
        .rejects.toThrow(RuntimeNotFoundError)
    })
  })

  describe('File Operations', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should write file successfully', async () => {
      await manager.writeFile('runtime-1', '/app/test.txt', 'Hello World')

      expect(mockProvider.writeFile).toHaveBeenCalledWith(
        'runtime-1', 
        '/app/test.txt', 
        'Hello World'
      )
    })

    it('should read file successfully', async () => {
      const fileContent = 'File content'
      mockProvider.readFile.mockResolvedValue(fileContent)

      const result = await manager.readFile('runtime-1', '/app/test.txt')

      expect(result).toBe(fileContent)
      expect(mockProvider.readFile).toHaveBeenCalledWith('runtime-1', '/app/test.txt')
    })

    it('should list files successfully', async () => {
      const files = [
        { name: 'test.txt', size: 100, isDirectory: false },
        { name: 'subdir', size: 0, isDirectory: true }
      ]
      mockProvider.listFiles.mockResolvedValue(files)

      const result = await manager.listFiles('runtime-1', '/app')

      expect(result).toEqual(files)
      expect(mockProvider.listFiles).toHaveBeenCalledWith('runtime-1', '/app')
    })
  })

  describe('Provider Switching', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should switch provider successfully', async () => {
      const newConfig = {
        type: 'cheerpx' as const,
        webvm: { diskSize: 2048 }
      }

      await manager.switchProvider(newConfig)

      expect(mockProvider.shutdown).toHaveBeenCalled()
    })
  })

  describe('System Status and Metrics', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should return system status', async () => {
      const status = await manager.getSystemStatus()

      expect(status).toMatchObject({
        initialized: true,
        providerType: 'mock',
        runtimeCount: 0,
        stats: expect.objectContaining({
          totalMemory: 1024,
          usedMemory: 256
        })
      })
    })

    it('should return system metrics', () => {
      const metrics = manager.getSystemMetrics()

      expect(metrics).toMatchObject({
        webvm: {
          initialized: true,
          providerType: 'mock',
          runtimeCount: 0,
          providerFallbackAttempted: false
        },
        errorHandler: {
          activeOperations: 0,
          circuitBreakers: []
        }
      })
    })

    it('should reset circuit breaker', () => {
      expect(() => manager.resetCircuitBreaker('test-key')).not.toThrow()
    })
  })

  describe('Shutdown', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should shutdown gracefully', async () => {
      await manager.shutdown()

      expect(mockProvider.shutdown).toHaveBeenCalled()
    })

    it('should handle shutdown errors gracefully', async () => {
      mockProvider.shutdown.mockRejectedValue(new Error('Shutdown error'))

      await expect(manager.shutdown()).rejects.toThrow('Shutdown error')
    })

    it('should not shutdown if not initialized', async () => {
      ;(manager as any).initialized = false

      await manager.shutdown()

      expect(mockProvider.shutdown).not.toHaveBeenCalled()
    })
  })
})