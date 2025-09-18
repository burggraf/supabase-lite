import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RuntimeEnvironment } from '../RuntimeEnvironment'
import { WebVMManager } from '../WebVMManager'
import { ProcessManager } from '../ProcessManager'
import { 
  type RuntimeInstance, 
  type RuntimeMetadata,
  RuntimeFailureError 
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

describe('RuntimeEnvironment', () => {
  let runtimeEnv: RuntimeEnvironment
  let mockWebVMManager: any
  let mockProcessManager: any
  let mockLogger: any

  beforeEach(() => {
    // Mock WebVMManager
    mockWebVMManager = {
      startRuntime: vi.fn(),
      stopRuntime: vi.fn(),
      restartRuntime: vi.fn(),
      getRuntimeStatus: vi.fn(),
      getRuntimeForApp: vi.fn(),
      proxyHTTPRequest: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      listFiles: vi.fn(),
      executeCommand: vi.fn(),
      installPackages: vi.fn()
    }

    // Mock ProcessManager
    mockProcessManager = {
      getProcesses: vi.fn(),
      isProcessResponding: vi.fn(),
      killProcess: vi.fn()
    }

    runtimeEnv = new RuntimeEnvironment(mockWebVMManager, mockProcessManager)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Runtime Lifecycle Management', () => {
    const mockMetadata: RuntimeMetadata = {
      appId: 'test-app',
      entryPoint: 'index.js',
      environmentVariables: { NODE_ENV: 'production' },
      workingDirectory: '/app'
    }

    const mockRuntimeInstance: RuntimeInstance = {
      id: 'runtime-1',
      type: 'node',
      version: '18.0.0',
      port: 3000,
      status: 'running',
      startedAt: new Date(),
      metadata: mockMetadata
    }

    it('should start runtime successfully', async () => {
      mockWebVMManager.startRuntime.mockResolvedValue(mockRuntimeInstance)

      const result = await runtimeEnv.startRuntime(mockMetadata)

      expect(result).toEqual(mockRuntimeInstance)
      expect(mockWebVMManager.startRuntime).toHaveBeenCalledWith(
        'node',
        expect.any(String),
        mockMetadata
      )
    })

    it('should infer runtime type from entry point', async () => {
      const pythonMetadata: RuntimeMetadata = {
        appId: 'python-app',
        entryPoint: 'main.py',
        environmentVariables: {},
        workingDirectory: '/app'
      }

      const pythonInstance: RuntimeInstance = {
        id: 'runtime-2',
        type: 'python',
        version: '3.9.0',
        port: 3001,
        status: 'running',
        startedAt: new Date(),
        metadata: pythonMetadata
      }

      mockWebVMManager.startRuntime.mockResolvedValue(pythonInstance)

      await runtimeEnv.startRuntime(pythonMetadata)

      expect(mockWebVMManager.startRuntime).toHaveBeenCalledWith(
        'python',
        expect.any(String),
        pythonMetadata
      )
    })

    it('should stop runtime successfully', async () => {
      await runtimeEnv.stopRuntime('runtime-1')

      expect(mockWebVMManager.stopRuntime).toHaveBeenCalledWith('runtime-1')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Runtime stopped',
        { instanceId: 'runtime-1' }
      )
    })

    it('should restart runtime successfully', async () => {
      mockWebVMManager.restartRuntime.mockResolvedValue(mockRuntimeInstance)

      const result = await runtimeEnv.restartRuntime('runtime-1')

      expect(result).toEqual(mockRuntimeInstance)
      expect(mockWebVMManager.restartRuntime).toHaveBeenCalledWith('runtime-1')
    })

    it('should get runtime status', async () => {
      mockWebVMManager.getRuntimeStatus.mockResolvedValue(mockRuntimeInstance)

      const result = await runtimeEnv.getRuntimeStatus('runtime-1')

      expect(result).toEqual(mockRuntimeInstance)
      expect(mockWebVMManager.getRuntimeStatus).toHaveBeenCalledWith('runtime-1')
    })
  })

  describe('Application Deployment', () => {
    const mockMetadata: RuntimeMetadata = {
      appId: 'deploy-test',
      entryPoint: 'index.js',
      environmentVariables: { NODE_ENV: 'production' },
      workingDirectory: '/app'
    }

    const mockRuntimeInstance: RuntimeInstance = {
      id: 'runtime-1',
      type: 'node',
      version: '18.0.0',
      port: 3000,
      status: 'running',
      startedAt: new Date(),
      metadata: mockMetadata
    }

    it('should deploy application successfully', async () => {
      const files = new Map<string, string | ArrayBuffer>([
        ['index.js', 'console.log("Hello World")'],
        ['package.json', '{"name": "test-app", "main": "index.js"}'],
        ['README.md', '# Test Application']
      ])

      mockWebVMManager.startRuntime.mockResolvedValue(mockRuntimeInstance)
      mockWebVMManager.writeFile.mockResolvedValue(undefined)
      mockWebVMManager.executeCommand
        .mockResolvedValueOnce({ // package.json check
          stdout: '{"name": "test-app"}',
          stderr: '',
          exitCode: 0,
          duration: 100
        })
        .mockResolvedValueOnce({ // npm install
          stdout: 'Dependencies installed',
          stderr: '',
          exitCode: 0,
          duration: 5000
        })
        .mockResolvedValueOnce({ // start application
          stdout: 'Server started',
          stderr: '',
          exitCode: 0,
          duration: 1000
        })

      const result = await runtimeEnv.deploy(files, mockMetadata)

      expect(result).toEqual(mockRuntimeInstance)
      expect(mockWebVMManager.startRuntime).toHaveBeenCalledWith(
        'node',
        expect.any(String),
        mockMetadata
      )
      expect(mockWebVMManager.writeFile).toHaveBeenCalledTimes(3)
      expect(mockWebVMManager.executeCommand).toHaveBeenCalledWith(
        'runtime-1',
        expect.stringContaining('npm install')
      )
    })

    it('should deploy Python application', async () => {
      const pythonMetadata: RuntimeMetadata = {
        appId: 'python-deploy',
        entryPoint: 'main.py',
        environmentVariables: {},
        workingDirectory: '/app'
      }

      const pythonInstance: RuntimeInstance = {
        id: 'runtime-2',
        type: 'python',
        version: '3.9.0',
        port: 3001,
        status: 'running',
        startedAt: new Date(),
        metadata: pythonMetadata
      }

      const files = new Map([
        ['main.py', 'print("Hello Python")'],
        ['requirements.txt', 'flask==2.0.1']
      ])

      mockWebVMManager.startRuntime.mockResolvedValue(pythonInstance)
      mockWebVMManager.writeFile.mockResolvedValue(undefined)
      mockWebVMManager.executeCommand
        .mockResolvedValueOnce({ // requirements.txt check
          stdout: 'flask==2.0.1',
          stderr: '',
          exitCode: 0,
          duration: 100
        })
        .mockResolvedValueOnce({ // pip install
          stdout: 'Requirements installed',
          stderr: '',
          exitCode: 0,
          duration: 3000
        })
        .mockResolvedValueOnce({ // start application
          stdout: 'Python app started',
          stderr: '',
          exitCode: 0,
          duration: 1000
        })

      const result = await runtimeEnv.deploy(files, pythonMetadata)

      expect(result).toEqual(pythonInstance)
      expect(mockWebVMManager.executeCommand).toHaveBeenCalledWith(
        'runtime-2',
        expect.stringContaining('pip install')
      )
    })

    it('should handle deployment failure', async () => {
      const files = new Map([['index.js', 'console.log("test")']])

      mockWebVMManager.startRuntime.mockRejectedValue(new Error('Runtime failed'))

      await expect(runtimeEnv.deploy(files, mockMetadata))
        .rejects.toThrow('Runtime failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Application deployment failed',
        expect.objectContaining({ error: expect.any(Error) })
      )
    })

    it('should handle file writing failure', async () => {
      const files = new Map([['index.js', 'console.log("test")']])

      mockWebVMManager.startRuntime.mockResolvedValue(mockRuntimeInstance)
      mockWebVMManager.writeFile.mockRejectedValue(new Error('Write failed'))

      await expect(runtimeEnv.deploy(files, mockMetadata))
        .rejects.toThrow('Write failed')
    })

    it('should handle dependency installation failure', async () => {
      const files = new Map([
        ['index.js', 'console.log("test")'],
        ['package.json', '{"name": "test"}']
      ])

      mockWebVMManager.startRuntime.mockResolvedValue(mockRuntimeInstance)
      mockWebVMManager.writeFile.mockResolvedValue(undefined)
      mockWebVMManager.executeCommand
        .mockResolvedValueOnce({ // package.json check
          stdout: '{"name": "test"}',
          stderr: '',
          exitCode: 0,
          duration: 100
        })
        .mockResolvedValueOnce({ // npm install failure
          stdout: '',
          stderr: 'Package not found',
          exitCode: 1,
          duration: 1000
        })

      await expect(runtimeEnv.deploy(files, mockMetadata))
        .rejects.toThrow('Dependency installation failed')
    })
  })

  describe('HTTP Request Proxying', () => {
    const mockMetadata: RuntimeMetadata = {
      appId: 'proxy-test',
      entryPoint: 'index.js',
      environmentVariables: {},
      workingDirectory: '/app'
    }

    it('should proxy request to running application', async () => {
      const mockRequest = new Request('http://localhost:3000/api/test')
      const mockResponse = new Response('{"success": true}', { status: 200 })

      mockWebVMManager.getRuntimeForApp.mockResolvedValue({
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'running',
        startedAt: new Date(),
        metadata: mockMetadata
      })

      mockProcessManager.isProcessResponding.mockResolvedValue(true)
      mockWebVMManager.proxyHTTPRequest.mockResolvedValue(mockResponse)

      const result = await runtimeEnv.proxyRequest(mockRequest, 'proxy-test')

      expect(result).toBe(mockResponse)
      expect(mockWebVMManager.proxyHTTPRequest).toHaveBeenCalledWith(
        'runtime-1',
        mockRequest
      )
    })

    it('should return 404 for non-existent application', async () => {
      const mockRequest = new Request('http://localhost:3000/api/test')

      mockWebVMManager.getRuntimeForApp.mockResolvedValue(null)

      const response = await runtimeEnv.proxyRequest(mockRequest, 'non-existent')

      expect(response.status).toBe(404)
      
      const body = await response.json()
      expect(body.error).toBe('Application not found')
    })

    it('should return 503 for stopped application', async () => {
      const mockRequest = new Request('http://localhost:3000/api/test')

      mockWebVMManager.getRuntimeForApp.mockResolvedValue({
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'stopped',
        startedAt: new Date(),
        metadata: mockMetadata
      })

      const response = await runtimeEnv.proxyRequest(mockRequest, 'proxy-test')

      expect(response.status).toBe(503)
      
      const body = await response.json()
      expect(body.error).toBe('Application is not running')
    })

    it('should return 503 for unresponsive application', async () => {
      const mockRequest = new Request('http://localhost:3000/api/test')

      mockWebVMManager.getRuntimeForApp.mockResolvedValue({
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'running',
        startedAt: new Date(),
        metadata: mockMetadata
      })

      mockProcessManager.isProcessResponding.mockResolvedValue(false)

      const response = await runtimeEnv.proxyRequest(mockRequest, 'proxy-test')

      expect(response.status).toBe(503)
      
      const body = await response.json()
      expect(body.error).toBe('Application is not responding')
    })

    it('should handle proxy errors gracefully', async () => {
      const mockRequest = new Request('http://localhost:3000/api/test')

      mockWebVMManager.getRuntimeForApp.mockResolvedValue({
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'running',
        startedAt: new Date(),
        metadata: mockMetadata
      })

      mockProcessManager.isProcessResponding.mockResolvedValue(true)
      mockWebVMManager.proxyHTTPRequest.mockRejectedValue(new Error('Proxy error'))

      const response = await runtimeEnv.proxyRequest(mockRequest, 'proxy-test')

      expect(response.status).toBe(502)
      
      const body = await response.json()
      expect(body.error).toBe('Proxy error')
    })
  })

  describe('File Management', () => {
    it('should list application files', async () => {
      const mockFiles = [
        { name: 'index.js', size: 1024, isDirectory: false },
        { name: 'package.json', size: 512, isDirectory: false },
        { name: 'node_modules', size: 0, isDirectory: true }
      ]

      mockWebVMManager.listFiles.mockResolvedValue(mockFiles)

      const files = await runtimeEnv.listFiles('runtime-1', '/app')

      expect(files).toEqual(mockFiles)
      expect(mockWebVMManager.listFiles).toHaveBeenCalledWith('runtime-1', '/app')
    })

    it('should read application file', async () => {
      const fileContent = 'console.log("Hello World")'

      mockWebVMManager.readFile.mockResolvedValue(fileContent)

      const content = await runtimeEnv.readFile('runtime-1', '/app/index.js')

      expect(content).toBe(fileContent)
      expect(mockWebVMManager.readFile).toHaveBeenCalledWith('runtime-1', '/app/index.js')
    })

    it('should write application file', async () => {
      const fileContent = 'console.log("Updated content")'

      mockWebVMManager.writeFile.mockResolvedValue(undefined)

      await runtimeEnv.writeFile('runtime-1', '/app/index.js', fileContent)

      expect(mockWebVMManager.writeFile).toHaveBeenCalledWith(
        'runtime-1',
        '/app/index.js',
        fileContent
      )
    })
  })

  describe('Application Health Monitoring', () => {
    it('should check application health', async () => {
      mockProcessManager.isProcessResponding.mockResolvedValue(true)

      const isHealthy = await runtimeEnv.checkHealth('runtime-1', 3000)

      expect(isHealthy).toBe(true)
      expect(mockProcessManager.isProcessResponding).toHaveBeenCalledWith('runtime-1', 3000)
    })

    it('should detect unhealthy application', async () => {
      mockProcessManager.isProcessResponding.mockResolvedValue(false)

      const isHealthy = await runtimeEnv.checkHealth('runtime-1', 3000)

      expect(isHealthy).toBe(false)
    })

    it('should get application processes', async () => {
      const mockProcesses = [
        {
          pid: 1001,
          command: 'node index.js',
          status: 'running' as const,
          cpu: 2.5,
          memory: 128,
          startTime: new Date(),
          logs: []
        }
      ]

      mockProcessManager.getProcesses.mockResolvedValue(mockProcesses)

      const processes = await runtimeEnv.getProcesses('runtime-1')

      expect(processes).toEqual(mockProcesses)
      expect(mockProcessManager.getProcesses).toHaveBeenCalledWith('runtime-1')
    })
  })

  describe('Application Management', () => {
    it('should restart unresponsive application', async () => {
      const mockMetadata: RuntimeMetadata = {
        appId: 'restart-test',
        entryPoint: 'index.js',
        environmentVariables: {},
        workingDirectory: '/app'
      }

      const restartedInstance: RuntimeInstance = {
        id: 'runtime-1-restarted',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'running',
        startedAt: new Date(),
        metadata: mockMetadata
      }

      mockWebVMManager.getRuntimeForApp.mockResolvedValue({
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'running',
        startedAt: new Date(),
        metadata: mockMetadata
      })

      mockProcessManager.isProcessResponding.mockResolvedValue(false)
      mockWebVMManager.restartRuntime.mockResolvedValue(restartedInstance)

      const result = await runtimeEnv.attemptRecovery('restart-test')

      expect(result).toBe(true)
      expect(mockWebVMManager.restartRuntime).toHaveBeenCalledWith('runtime-1')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Application recovery successful',
        expect.objectContaining({ appId: 'restart-test' })
      )
    })

    it('should handle recovery failure', async () => {
      mockWebVMManager.getRuntimeForApp.mockResolvedValue({
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'running',
        startedAt: new Date(),
        metadata: { appId: 'restart-test', entryPoint: 'index.js', environmentVariables: {}, workingDirectory: '/app' }
      })

      mockProcessManager.isProcessResponding.mockResolvedValue(false)
      mockWebVMManager.restartRuntime.mockRejectedValue(new Error('Restart failed'))

      const result = await runtimeEnv.attemptRecovery('restart-test')

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Application recovery failed',
        expect.objectContaining({ appId: 'restart-test' })
      )
    })

    it('should not restart healthy application', async () => {
      mockWebVMManager.getRuntimeForApp.mockResolvedValue({
        id: 'runtime-1',
        type: 'node',
        version: '18.0.0',
        port: 3000,
        status: 'running',
        startedAt: new Date(),
        metadata: { appId: 'healthy-test', entryPoint: 'index.js', environmentVariables: {}, workingDirectory: '/app' }
      })

      mockProcessManager.isProcessResponding.mockResolvedValue(true)

      const result = await runtimeEnv.attemptRecovery('healthy-test')

      expect(result).toBe(true)
      expect(mockWebVMManager.restartRuntime).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle runtime not found errors', async () => {
      mockWebVMManager.getRuntimeStatus.mockResolvedValue(null)

      const status = await runtimeEnv.getRuntimeStatus('non-existent')

      expect(status).toBeNull()
    })

    it('should propagate WebVM errors', async () => {
      const runtimeError = new RuntimeFailureError('Runtime creation failed')
      mockWebVMManager.startRuntime.mockRejectedValue(runtimeError)

      const metadata: RuntimeMetadata = {
        appId: 'error-test',
        entryPoint: 'index.js',
        environmentVariables: {},
        workingDirectory: '/app'
      }

      await expect(runtimeEnv.startRuntime(metadata))
        .rejects.toThrow('Runtime creation failed')
    })

    it('should handle file operation errors', async () => {
      mockWebVMManager.writeFile.mockRejectedValue(new Error('Disk full'))

      await expect(runtimeEnv.writeFile('runtime-1', '/app/test.txt', 'content'))
        .rejects.toThrow('Disk full')
    })
  })
})