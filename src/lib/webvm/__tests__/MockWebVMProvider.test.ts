import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MockWebVMProvider } from '../MockWebVMProvider'
import { 
  RuntimeFailureError, 
  ProxyError,
  type RuntimeMetadata,
  type RuntimeInstance 
} from '../types'

// Mock Logger
vi.mock('../infrastructure/Logger', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('MockWebVMProvider', () => {
  let provider: MockWebVMProvider
  let mockLogger: any

  beforeEach(() => {
    provider = new MockWebVMProvider({
      simulateLatency: false,
      errorRate: 0,
      minLatency: 1,
      maxLatency: 5
    })
  })

  afterEach(async () => {
    if (provider.isReady()) {
      await provider.shutdown()
    }
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await provider.initialize()

      expect(provider.isReady()).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MockWebVMProvider initialized successfully'
      )
    })

    it('should not initialize twice', async () => {
      await provider.initialize()
      await provider.initialize()

      expect(provider.isReady()).toBe(true)
    })

    it('should handle initialization with latency simulation', async () => {
      const latencyProvider = new MockWebVMProvider({
        simulateLatency: true,
        minLatency: 10,
        maxLatency: 20,
        errorRate: 0
      })

      const startTime = Date.now()
      await latencyProvider.initialize()
      const endTime = Date.now()

      expect(endTime - startTime).toBeGreaterThanOrEqual(10)
      expect(latencyProvider.isReady()).toBe(true)
      
      await latencyProvider.shutdown()
    })
  })

  describe('Runtime Management', () => {
    beforeEach(async () => {
      await provider.initialize()
    })

    describe('startRuntime', () => {
      it('should start Node.js runtime successfully', async () => {
        const metadata: RuntimeMetadata = {
          appId: 'test-app',
          entryPoint: 'index.js',
          environmentVariables: { NODE_ENV: 'development' },
          workingDirectory: '/app'
        }

        const runtime = await provider.startRuntime('node', '18.0.0', metadata)

        expect(runtime).toMatchObject({
          id: expect.stringMatching(/^mock-node-\d+$/),
          type: 'node',
          version: '18.0.0',
          port: expect.any(Number),
          status: 'running',
          startedAt: expect.any(Date),
          metadata
        })
      })

      it('should start Python runtime successfully', async () => {
        const metadata: RuntimeMetadata = {
          appId: 'python-app',
          entryPoint: 'main.py',
          environmentVariables: { PYTHON_ENV: 'development' },
          workingDirectory: '/app'
        }

        const runtime = await provider.startRuntime('python', '3.9.0', metadata)

        expect(runtime).toMatchObject({
          id: expect.stringMatching(/^mock-python-\d+$/),
          type: 'python',
          version: '3.9.0',
          port: expect.any(Number),
          status: 'running',
          startedAt: expect.any(Date),
          metadata
        })
      })

      it('should assign unique ports to different runtimes', async () => {
        const metadata1: RuntimeMetadata = {
          appId: 'app1',
          entryPoint: 'index.js',
          environmentVariables: {},
          workingDirectory: '/app'
        }

        const metadata2: RuntimeMetadata = {
          appId: 'app2',
          entryPoint: 'main.py',
          environmentVariables: {},
          workingDirectory: '/app'
        }

        const runtime1 = await provider.startRuntime('node', '18.0.0', metadata1)
        const runtime2 = await provider.startRuntime('python', '3.9.0', metadata2)

        expect(runtime1.port).not.toBe(runtime2.port)
      })

      it('should simulate random errors when error rate is set', async () => {
        const errorProvider = new MockWebVMProvider({
          simulateLatency: false,
          errorRate: 1.0, // 100% error rate
          minLatency: 1,
          maxLatency: 5
        })

        await errorProvider.initialize()

        const metadata: RuntimeMetadata = {
          appId: 'error-test',
          entryPoint: 'index.js',
          environmentVariables: {},
          workingDirectory: '/app'
        }

        await expect(errorProvider.startRuntime('node', '18.0.0', metadata))
          .rejects.toThrow(RuntimeFailureError)

        await errorProvider.shutdown()
      })
    })

    describe('stopRuntime', () => {
      it('should stop runtime successfully', async () => {
        const metadata: RuntimeMetadata = {
          appId: 'test-app',
          entryPoint: 'index.js',
          environmentVariables: {},
          workingDirectory: '/app'
        }

        const runtime = await provider.startRuntime('node', '18.0.0', metadata)
        
        await provider.stopRuntime(runtime.id)

        const status = await provider.getRuntimeStatus(runtime.id)
        expect(status?.status).toBe('stopped')
      })

      it('should handle stopping non-existent runtime', async () => {
        await expect(provider.stopRuntime('non-existent'))
          .rejects.toThrow(RuntimeFailureError)
      })
    })

    describe('restartRuntime', () => {
      it('should restart runtime successfully', async () => {
        const metadata: RuntimeMetadata = {
          appId: 'test-app',
          entryPoint: 'index.js',
          environmentVariables: {},
          workingDirectory: '/app'
        }

        const originalRuntime = await provider.startRuntime('node', '18.0.0', metadata)
        
        const restartedRuntime = await provider.restartRuntime(originalRuntime.id)

        expect(restartedRuntime.id).not.toBe(originalRuntime.id)
        expect(restartedRuntime.type).toBe(originalRuntime.type)
        expect(restartedRuntime.version).toBe(originalRuntime.version)
        expect(restartedRuntime.metadata).toEqual(originalRuntime.metadata)
        expect(restartedRuntime.status).toBe('running')
      })

      it('should handle restarting non-existent runtime', async () => {
        await expect(provider.restartRuntime('non-existent'))
          .rejects.toThrow(RuntimeFailureError)
      })
    })

    describe('getRuntimeStatus', () => {
      it('should return runtime status', async () => {
        const metadata: RuntimeMetadata = {
          appId: 'test-app',
          entryPoint: 'index.js',
          environmentVariables: {},
          workingDirectory: '/app'
        }

        const runtime = await provider.startRuntime('node', '18.0.0', metadata)
        const status = await provider.getRuntimeStatus(runtime.id)

        expect(status).toEqual(runtime)
      })

      it('should return null for non-existent runtime', async () => {
        const status = await provider.getRuntimeStatus('non-existent')
        expect(status).toBeNull()
      })
    })

    describe('listRuntimes', () => {
      it('should list all runtimes', async () => {
        const metadata1: RuntimeMetadata = {
          appId: 'app1',
          entryPoint: 'index.js',
          environmentVariables: {},
          workingDirectory: '/app'
        }

        const metadata2: RuntimeMetadata = {
          appId: 'app2',
          entryPoint: 'main.py',
          environmentVariables: {},
          workingDirectory: '/app'
        }

        const runtime1 = await provider.startRuntime('node', '18.0.0', metadata1)
        const runtime2 = await provider.startRuntime('python', '3.9.0', metadata2)

        const runtimes = await provider.listRuntimes()

        expect(runtimes).toHaveLength(2)
        expect(runtimes).toContainEqual(runtime1)
        expect(runtimes).toContainEqual(runtime2)
      })

      it('should return empty array when no runtimes', async () => {
        const runtimes = await provider.listRuntimes()
        expect(runtimes).toEqual([])
      })
    })
  })

  describe('HTTP Proxy', () => {
    let runtime: RuntimeInstance

    beforeEach(async () => {
      await provider.initialize()
      
      const metadata: RuntimeMetadata = {
        appId: 'proxy-test',
        entryPoint: 'index.js',
        environmentVariables: {},
        workingDirectory: '/app'
      }

      runtime = await provider.startRuntime('node', '18.0.0', metadata)
    })

    it('should proxy GET request successfully', async () => {
      const request = new Request('http://localhost:3000/')

      const response = await provider.proxyHTTPRequest(runtime.id, request)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/json')
      
      const body = await response.json()
      expect(body).toMatchObject({
        status: 'ok',
        runtime: {
          id: runtime.id,
          type: 'node',
          version: '18.0.0'
        }
      })
    })

    it('should proxy POST request with body', async () => {
      const requestBody = { message: 'Hello World' }
      const request = new Request('http://localhost:3000/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const response = await provider.proxyHTTPRequest(runtime.id, request)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.method).toBe('POST')
      expect(body.body).toEqual(requestBody)
    })

    it('should handle different HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

      for (const method of methods) {
        const request = new Request('http://localhost:3000/api', { method })
        const response = await provider.proxyHTTPRequest(runtime.id, request)
        
        expect(response.status).toBe(200)
        
        const body = await response.json()
        expect(body.method).toBe(method)
      }
    })

    it('should simulate 404 for unknown paths', async () => {
      const request = new Request('http://localhost:3000/unknown/path')

      const response = await provider.proxyHTTPRequest(runtime.id, request)

      expect(response.status).toBe(404)
      
      const body = await response.json()
      expect(body.error).toBe('Not Found')
    })

    it('should handle runtime not found', async () => {
      const request = new Request('http://localhost:3000/')

      await expect(provider.proxyHTTPRequest('non-existent', request))
        .rejects.toThrow(ProxyError)
    })

    it('should handle stopped runtime', async () => {
      await provider.stopRuntime(runtime.id)
      
      const request = new Request('http://localhost:3000/')

      await expect(provider.proxyHTTPRequest(runtime.id, request))
        .rejects.toThrow(ProxyError)
    })
  })

  describe('Command Execution', () => {
    let runtime: RuntimeInstance

    beforeEach(async () => {
      await provider.initialize()
      
      const metadata: RuntimeMetadata = {
        appId: 'command-test',
        entryPoint: 'index.js',
        environmentVariables: {},
        workingDirectory: '/app'
      }

      runtime = await provider.startRuntime('node', '18.0.0', metadata)
    })

    it('should execute simple commands', async () => {
      const result = await provider.executeCommand(runtime.id, 'echo "Hello World"')

      expect(result).toMatchObject({
        stdout: expect.stringContaining('Hello World'),
        stderr: '',
        exitCode: 0,
        duration: expect.any(Number)
      })
    })

    it('should handle command failures', async () => {
      const result = await provider.executeCommand(runtime.id, 'invalidcommand')

      expect(result).toMatchObject({
        stdout: '',
        stderr: expect.stringContaining('command not found'),
        exitCode: 127,
        duration: expect.any(Number)
      })
    })

    it('should simulate different exit codes', async () => {
      const result = await provider.executeCommand(runtime.id, 'exit 42')

      expect(result.exitCode).toBe(42)
    })

    it('should handle runtime not found', async () => {
      await expect(provider.executeCommand('non-existent', 'echo test'))
        .rejects.toThrow(RuntimeFailureError)
    })

    it('should respect execution options', async () => {
      const options = {
        workingDirectory: '/tmp',
        timeout: 1000,
        environmentVariables: { TEST_VAR: 'test_value' }
      }

      const result = await provider.executeCommand(
        runtime.id, 
        'echo $TEST_VAR',
        options
      )

      expect(result.stdout).toContain('test_value')
    })
  })

  describe('Package Installation', () => {
    let runtime: RuntimeInstance

    beforeEach(async () => {
      await provider.initialize()
      
      const metadata: RuntimeMetadata = {
        appId: 'package-test',
        entryPoint: 'index.js',
        environmentVariables: {},
        workingDirectory: '/app'
      }

      runtime = await provider.startRuntime('node', '18.0.0', metadata)
    })

    it('should install Node.js packages', async () => {
      const packages = ['express', 'lodash']
      
      const result = await provider.installPackages(runtime.id, packages)

      expect(result).toMatchObject({
        stdout: expect.stringContaining('express'),
        stderr: '',
        exitCode: 0,
        duration: expect.any(Number)
      })
    })

    it('should install Python packages', async () => {
      const metadata: RuntimeMetadata = {
        appId: 'python-package-test',
        entryPoint: 'main.py',
        environmentVariables: {},
        workingDirectory: '/app'
      }

      const pythonRuntime = await provider.startRuntime('python', '3.9.0', metadata)
      const packages = ['requests', 'numpy']
      
      const result = await provider.installPackages(pythonRuntime.id, packages)

      expect(result).toMatchObject({
        stdout: expect.stringContaining('requests'),
        stderr: '',
        exitCode: 0,
        duration: expect.any(Number)
      })
    })

    it('should handle package installation failure', async () => {
      const packages = ['non-existent-package-12345']
      
      const result = await provider.installPackages(runtime.id, packages)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('not found')
    })
  })

  describe('File Operations', () => {
    let runtime: RuntimeInstance

    beforeEach(async () => {
      await provider.initialize()
      
      const metadata: RuntimeMetadata = {
        appId: 'file-test',
        entryPoint: 'index.js',
        environmentVariables: {},
        workingDirectory: '/app'
      }

      runtime = await provider.startRuntime('node', '18.0.0', metadata)
    })

    it('should write and read text files', async () => {
      const content = 'Hello, World!'
      const path = '/app/test.txt'

      await provider.writeFile(runtime.id, path, content)
      const readContent = await provider.readFile(runtime.id, path)

      expect(readContent).toBe(content)
    })

    it('should write and read binary files', async () => {
      const buffer = new ArrayBuffer(8)
      const view = new Uint8Array(buffer)
      view.set([1, 2, 3, 4, 5, 6, 7, 8])
      
      const path = '/app/binary.dat'

      await provider.writeFile(runtime.id, path, buffer)
      const readBuffer = await provider.readFile(runtime.id, path) as ArrayBuffer

      expect(new Uint8Array(readBuffer)).toEqual(view)
    })

    it('should list files in directory', async () => {
      // Create some files
      await provider.writeFile(runtime.id, '/app/file1.txt', 'content1')
      await provider.writeFile(runtime.id, '/app/file2.js', 'console.log("test")')
      await provider.writeFile(runtime.id, '/app/subdir/file3.py', 'print("hello")')

      const files = await provider.listFiles(runtime.id, '/app')

      expect(files).toContainEqual(
        expect.objectContaining({
          name: 'file1.txt',
          isDirectory: false
        })
      )
      expect(files).toContainEqual(
        expect.objectContaining({
          name: 'file2.js',
          isDirectory: false
        })
      )
      expect(files).toContainEqual(
        expect.objectContaining({
          name: 'subdir',
          isDirectory: true
        })
      )
    })

    it('should handle non-existent files', async () => {
      await expect(provider.readFile(runtime.id, '/non-existent.txt'))
        .rejects.toThrow('File not found')
    })

    it('should handle non-existent directories', async () => {
      const files = await provider.listFiles(runtime.id, '/non-existent')
      expect(files).toEqual([])
    })
  })

  describe('System Statistics', () => {
    beforeEach(async () => {
      await provider.initialize()
    })

    it('should return system stats', async () => {
      const stats = await provider.getStats()

      expect(stats).toMatchObject({
        totalMemory: expect.any(Number),
        usedMemory: expect.any(Number),
        totalDisk: expect.any(Number),
        usedDisk: expect.any(Number),
        runtimeCount: expect.any(Number),
        uptime: expect.any(Number)
      })

      expect(stats.totalMemory).toBeGreaterThan(0)
      expect(stats.usedMemory).toBeGreaterThanOrEqual(0)
      expect(stats.usedMemory).toBeLessThanOrEqual(stats.totalMemory)
    })

    it('should update stats when runtimes are added', async () => {
      const statsBeforeRuntime = await provider.getStats()

      const metadata: RuntimeMetadata = {
        appId: 'stats-test',
        entryPoint: 'index.js',
        environmentVariables: {},
        workingDirectory: '/app'
      }

      await provider.startRuntime('node', '18.0.0', metadata)

      const statsAfterRuntime = await provider.getStats()

      expect(statsAfterRuntime.runtimeCount).toBe(statsBeforeRuntime.runtimeCount + 1)
      expect(statsAfterRuntime.usedMemory).toBeGreaterThan(statsBeforeRuntime.usedMemory)
    })
  })

  describe('Shutdown', () => {
    beforeEach(async () => {
      await provider.initialize()
    })

    it('should shutdown gracefully', async () => {
      // Start a runtime to have something to clean up
      const metadata: RuntimeMetadata = {
        appId: 'shutdown-test',
        entryPoint: 'index.js',
        environmentVariables: {},
        workingDirectory: '/app'
      }

      await provider.startRuntime('node', '18.0.0', metadata)

      await provider.shutdown()

      expect(provider.isReady()).toBe(false)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MockWebVMProvider shutdown completed'
      )
    })

    it('should handle shutdown when not initialized', async () => {
      const uninitializedProvider = new MockWebVMProvider()
      
      await uninitializedProvider.shutdown()

      expect(uninitializedProvider.isReady()).toBe(false)
    })
  })

  describe('Error Simulation', () => {
    it('should simulate errors based on error rate', async () => {
      const errorProvider = new MockWebVMProvider({
        simulateLatency: false,
        errorRate: 0.5, // 50% error rate
        minLatency: 1,
        maxLatency: 5
      })

      await errorProvider.initialize()

      const metadata: RuntimeMetadata = {
        appId: 'error-test',
        entryPoint: 'index.js',
        environmentVariables: {},
        workingDirectory: '/app'
      }

      // Run multiple operations to test error rate
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () => 
          errorProvider.startRuntime('node', '18.0.0', metadata)
        )
      )

      const failures = results.filter(r => r.status === 'rejected')
      
      // With 50% error rate, we should have some failures (but not deterministic)
      expect(failures.length).toBeGreaterThan(0)
      expect(failures.length).toBeLessThan(20)

      await errorProvider.shutdown()
    })
  })
})