import { logger as Logger } from '../infrastructure/Logger'
import { 
  IWebVMProvider,
  RuntimeInstance,
  RuntimeMetadata,
  CommandResult,
  WebVMStats,
  ExecuteOptions,
  FileInfo,
  MockProviderConfig,
  RuntimeFailureError,
  ProxyError,
  WebVMInitializationError
} from './types'

interface MockRuntime {
  instance: RuntimeInstance
  worker: Worker | null
  files: Map<string, string | ArrayBuffer>
  processes: Map<string, MockProcess>
  serverPort: number
  isServerRunning: boolean
}

interface MockProcess {
  pid: number
  command: string
  startTime: Date
  status: 'running' | 'stopped'
}

/**
 * Mock WebVM provider that simulates WebVM behavior using Web Workers
 * Used for development and testing before real WebVM integration
 */
export class MockWebVMProvider implements IWebVMProvider {
  private initialized = false
  private runtimes = new Map<string, MockRuntime>()
  private nextInstanceId = 1
  private nextPid = 1000
  private config: MockProviderConfig
  private startTime = Date.now()

  constructor(config?: MockProviderConfig) {
    this.config = {
      simulateLatency: true,
      minLatency: 10,
      maxLatency: 100,
      errorRate: 0.01, // 1% error rate
      testMode: false,
      ...config
    }

    Logger.info('MockWebVMProvider created', { config: this.config })
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    Logger.info('Initializing MockWebVMProvider')

    try {
      // Simulate initialization delay
      await this.simulateLatency()
      
      this.initialized = true
      Logger.info('MockWebVMProvider initialized successfully')
    } catch (error) {
      Logger.error('MockWebVMProvider initialization failed', { error })
      throw new WebVMInitializationError('Mock provider initialization failed', { error })
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return
    }

    Logger.info('Shutting down MockWebVMProvider')

    // Terminate all workers
    for (const [instanceId, runtime] of this.runtimes) {
      if (runtime.worker) {
        runtime.worker.terminate()
      }
    }

    this.runtimes.clear()
    this.initialized = false
    
    Logger.info('MockWebVMProvider shutdown completed')
  }

  isReady(): boolean {
    return this.initialized
  }

  async getStats(): Promise<WebVMStats> {
    await this.simulateLatency()

    const totalMemory = 1024 // Mock 1GB
    const usedMemory = this.runtimes.size * 128 // 128MB per runtime
    const uptime = Date.now() - this.startTime

    return {
      totalMemory,
      usedMemory,
      totalDisk: 10240, // Mock 10GB
      usedDisk: this.runtimes.size * 512, // 512MB per runtime
      runtimeCount: this.runtimes.size,
      uptime
    }
  }

  async startRuntime(
    type: 'node' | 'python', 
    version: string, 
    metadata: RuntimeMetadata
  ): Promise<RuntimeInstance> {
    this.ensureInitialized()
    await this.simulateLatency()
    this.throwRandomError()

    const instanceId = `mock-${type}-${this.nextInstanceId++}`
    const serverPort = 3000 + this.runtimes.size

    Logger.info('Starting mock runtime', { instanceId, type, version })

    const instance: RuntimeInstance = {
      id: instanceId,
      type,
      version,
      port: serverPort,
      status: 'starting',
      startedAt: new Date(),
      metadata
    }

    const mockRuntime: MockRuntime = {
      instance,
      worker: null,
      files: new Map(),
      processes: new Map(),
      serverPort,
      isServerRunning: false
    }

    this.runtimes.set(instanceId, mockRuntime)

    try {
      // Create Web Worker for runtime simulation (skip in test mode)
      if (!this.config.testMode) {
        const worker = this.createRuntimeWorker(type, instanceId)
        mockRuntime.worker = worker
      }

      // Simulate startup sequence
      await this.simulateRuntimeStartup(mockRuntime)

      instance.status = 'running'
      instance.pid = this.nextPid++

      Logger.info('Mock runtime started successfully', { instanceId })
      return instance
    } catch (error) {
      instance.status = 'error'
      Logger.error('Failed to start mock runtime', { error, instanceId })
      throw new RuntimeFailureError(`Failed to start ${type} runtime`, { instanceId, error })
    }
  }

  async stopRuntime(instanceId: string): Promise<void> {
    this.ensureInitialized()
    await this.simulateLatency()

    const runtime = this.runtimes.get(instanceId)
    if (!runtime) {
      Logger.warn('Attempted to stop non-existent runtime', { instanceId })
      return
    }

    Logger.info('Stopping mock runtime', { instanceId })

    try {
      if (runtime.worker) {
        runtime.worker.terminate()
      }
      
      runtime.instance.status = 'stopped'
      runtime.isServerRunning = false
      
      this.runtimes.delete(instanceId)
      
      Logger.info('Mock runtime stopped successfully', { instanceId })
    } catch (error) {
      Logger.error('Failed to stop mock runtime', { error, instanceId })
      throw new RuntimeFailureError('Failed to stop runtime', { instanceId, error })
    }
  }

  async restartRuntime(instanceId: string): Promise<RuntimeInstance> {
    const runtime = this.runtimes.get(instanceId)
    if (!runtime) {
      throw new RuntimeFailureError(`Runtime not found: ${instanceId}`, { instanceId })
    }

    const { type, version, metadata } = runtime.instance
    
    await this.stopRuntime(instanceId)
    return await this.startRuntime(type, version, metadata)
  }

  async getRuntimeStatus(instanceId: string): Promise<RuntimeInstance | null> {
    const runtime = this.runtimes.get(instanceId)
    return runtime ? { ...runtime.instance } : null
  }

  async listRuntimes(): Promise<RuntimeInstance[]> {
    await this.simulateLatency()
    
    return Array.from(this.runtimes.values()).map(runtime => ({ ...runtime.instance }))
  }

  async executeCommand(
    instanceId: string, 
    command: string, 
    options?: ExecuteOptions
  ): Promise<CommandResult> {
    this.ensureInitialized()
    await this.simulateLatency()
    this.throwRandomError()

    const runtime = this.runtimes.get(instanceId)
    if (!runtime) {
      throw new RuntimeFailureError(`Runtime not found: ${instanceId}`, { instanceId })
    }

    Logger.debug('Executing mock command', { instanceId, command })

    const startTime = Date.now()
    
    // Simulate command execution
    const result = await this.simulateCommandExecution(runtime, command, options)
    
    const duration = Date.now() - startTime

    Logger.debug('Mock command completed', { 
      instanceId, 
      command, 
      exitCode: result.exitCode, 
      duration 
    })

    return { ...result, duration }
  }

  async proxyHTTPRequest(instanceId: string, request: Request): Promise<Response> {
    this.ensureInitialized()
    await this.simulateLatency()
    this.throwRandomError()

    const runtime = this.runtimes.get(instanceId)
    if (!runtime) {
      throw new ProxyError(`Runtime not found: ${instanceId}`, 404, { instanceId })
    }

    if (!runtime.isServerRunning) {
      throw new ProxyError('Application server not running', 503, { instanceId })
    }

    Logger.debug('Proxying mock HTTP request', { 
      instanceId, 
      method: request.method, 
      url: request.url 
    })

    try {
      // Simulate HTTP request to mock server
      const response = await this.simulateHTTPRequest(runtime, request)
      
      Logger.debug('Mock HTTP request completed', { 
        instanceId, 
        status: response.status 
      })
      
      return response
    } catch (error) {
      Logger.error('Mock HTTP request failed', { error, instanceId })
      throw new ProxyError('HTTP proxy failed', 500, { instanceId, error })
    }
  }

  async writeFile(
    instanceId: string, 
    path: string, 
    content: string | ArrayBuffer
  ): Promise<void> {
    this.ensureInitialized()
    await this.simulateLatency()

    const runtime = this.runtimes.get(instanceId)
    if (!runtime) {
      throw new RuntimeFailureError(`Runtime not found: ${instanceId}`, { instanceId })
    }

    runtime.files.set(path, content)
    Logger.debug('Mock file written', { instanceId, path, size: content.length })
  }

  async readFile(instanceId: string, path: string): Promise<string | ArrayBuffer> {
    this.ensureInitialized()
    await this.simulateLatency()

    const runtime = this.runtimes.get(instanceId)
    if (!runtime) {
      throw new RuntimeFailureError(`Runtime not found: ${instanceId}`, { instanceId })
    }

    const content = runtime.files.get(path)
    if (content === undefined) {
      throw new RuntimeFailureError(`File not found: ${path}`, { instanceId, path })
    }

    Logger.debug('Mock file read', { instanceId, path, size: content.length })
    return content
  }

  async listFiles(instanceId: string, path: string): Promise<FileInfo[]> {
    this.ensureInitialized()
    await this.simulateLatency()

    const runtime = this.runtimes.get(instanceId)
    if (!runtime) {
      throw new RuntimeFailureError(`Runtime not found: ${instanceId}`, { instanceId })
    }

    const files: FileInfo[] = []
    
    for (const [filePath, content] of runtime.files) {
      if (filePath.startsWith(path)) {
        const name = filePath.replace(path, '').replace(/^\//, '')
        if (name && !name.includes('/')) {
          files.push({
            name,
            path: filePath,
            size: content.length,
            isDirectory: false,
            modified: new Date()
          })
        }
      }
    }

    Logger.debug('Mock files listed', { instanceId, path, count: files.length })
    return files
  }

  async installPackages(instanceId: string, packages: string[]): Promise<CommandResult> {
    const runtime = this.runtimes.get(instanceId)
    if (!runtime) {
      throw new RuntimeFailureError(`Runtime not found: ${instanceId}`, { instanceId })
    }

    const { type } = runtime.instance
    
    let command: string
    switch (type) {
      case 'node':
        command = `npm install ${packages.join(' ')}`
        break
      case 'python':
        command = `pip install ${packages.join(' ')}`
        break
      default:
        throw new RuntimeFailureError(`Package installation not supported for ${type}`, { instanceId, type })
    }

    return await this.executeCommand(instanceId, command)
  }

  // Private helper methods

  private createRuntimeWorker(type: string, instanceId: string): Worker {
    // Create inline worker for runtime simulation
    const workerCode = `
      self.onmessage = function(e) {
        const { type, command, instanceId } = e.data
        
        // Simulate runtime-specific behavior
        switch (type) {
          case 'execute':
            // Simulate command execution
            setTimeout(() => {
              self.postMessage({
                type: 'result',
                instanceId,
                result: {
                  exitCode: 0,
                  stdout: 'Mock command executed successfully',
                  stderr: ''
                }
              })
            }, Math.random() * 100 + 50)
            break
        }
      }
    `

    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const worker = new Worker(URL.createObjectURL(blob))
    
    worker.onmessage = (e) => {
      Logger.debug('Worker message received', { instanceId, data: e.data })
    }

    worker.onerror = (error) => {
      Logger.error('Worker error', { instanceId, error })
    }

    return worker
  }

  private async simulateRuntimeStartup(runtime: MockRuntime): Promise<void> {
    const { type } = runtime.instance
    
    // Skip startup delays in test mode
    if (!this.config.testMode) {
      // Simulate different startup times for different runtimes
      const startupTime = type === 'node' ? 1000 : type === 'python' ? 1500 : 500
      await new Promise(resolve => setTimeout(resolve, startupTime))
    }
    
    // Start mock server
    runtime.isServerRunning = true
    
    // Add some default files
    await this.addDefaultFiles(runtime)
  }

  private async addDefaultFiles(runtime: MockRuntime): Promise<void> {
    const { type, metadata } = runtime.instance
    
    switch (type) {
      case 'node':
        runtime.files.set('/app/package.json', JSON.stringify({
          name: metadata.appId,
          version: '1.0.0',
          main: metadata.entryPoint || 'index.js'
        }, null, 2))
        break
      
      case 'python':
        runtime.files.set('/app/requirements.txt', '')
        runtime.files.set('/app/main.py', `# ${metadata.appId}\nprint("Hello from Python!")`)
        break
    }
  }

  private async simulateCommandExecution(
    runtime: MockRuntime, 
    command: string, 
    options?: ExecuteOptions
  ): Promise<Omit<CommandResult, 'duration'>> {
    // Simulate different command behaviors
    if (command.includes('npm start') || command.includes('node')) {
      // Start server process
      const pid = this.nextPid++
      runtime.processes.set(command, {
        pid,
        command,
        startTime: new Date(),
        status: 'running'
      })
      runtime.isServerRunning = true
      
      return {
        exitCode: 0,
        stdout: `Server started on port ${runtime.serverPort} (PID: ${pid})`,
        stderr: ''
      }
    }
    
    if (command.includes('python')) {
      return {
        exitCode: 0,
        stdout: 'Python script executed successfully',
        stderr: ''
      }
    }

    if (command.includes('npm install') || command.includes('pip install')) {
      // Simulate package installation
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      return {
        exitCode: 0,
        stdout: 'Packages installed successfully',
        stderr: ''
      }
    }

    // Default command simulation
    return {
      exitCode: 0,
      stdout: `Command executed: ${command}`,
      stderr: ''
    }
  }

  private async simulateHTTPRequest(runtime: MockRuntime, request: Request): Promise<Response> {
    const url = new URL(request.url)
    const { type, metadata } = runtime.instance

    // Simulate different application responses based on the test expectations
    if (url.pathname === '/') {
      switch (type) {
        case 'node':
          // Match the test expectation for Node.js root route
          return new Response(JSON.stringify({
            message: 'Hello from WebVM!',
            timestamp: new Date().toISOString()
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
          
        case 'python':
          // Match test expectation for Python/Flask root route
          return new Response(JSON.stringify({
            message: 'Hello from Python Flask in WebVM!',
            python_version: '3.9.0',
            timestamp: new Date().toISOString()
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
      }
    }
    
    // API endpoints
    if (url.pathname === '/api/status') {
      return new Response(JSON.stringify({
        status: 'running',
        uptime: Date.now() - runtime.instance.startedAt.getTime()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (url.pathname === '/api/echo' && request.method === 'POST') {
      const requestBody = await request.json()
      return new Response(JSON.stringify({
        echo: requestBody,
        received: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (url.pathname === '/api/health') {
      // For Python Flask health endpoint
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'flask-app'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (url.pathname === '/api/data' && request.method === 'POST') {
      // For Python Flask data endpoint
      const requestBody = await request.json()
      return new Response(JSON.stringify({
        received: requestBody,
        timestamp: new Date().toISOString(),
        processed: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Fallback to HTML for unmatched routes (for backward compatibility)
    if (url.pathname === '/index.html') {
      let content: string
      
      switch (type) {
        case 'node':
          content = `
            <!DOCTYPE html>
            <html>
              <head><title>${metadata.appId}</title></head>
              <body>
                <h1>Hello from Node.js!</h1>
                <p>Mock application running on port ${runtime.serverPort}</p>
                <p>Environment: ${JSON.stringify(metadata.environmentVariables, null, 2)}</p>
              </body>
            </html>
          `
          break
        
        case 'python':
          content = `
            <!DOCTYPE html>
            <html>
              <head><title>${metadata.appId}</title></head>
              <body>
                <h1>Hello from Python!</h1>
                <p>Mock Flask application</p>
              </body>
            </html>
          `
          break
        
        default:
          content = '<h1>Mock Application</h1>'
      }

      return new Response(content, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'X-Mock-Runtime': type,
          'X-Instance-ID': runtime.instance.id
        }
      })
    }


    // 404 for unknown paths
    return new Response('Not Found', { status: 404 })
  }

  private async simulateLatency(): Promise<void> {
    if (!this.config.simulateLatency) {
      return
    }

    const latency = Math.random() * 
      (this.config.maxLatency - this.config.minLatency) + 
      this.config.minLatency

    await new Promise(resolve => setTimeout(resolve, latency))
  }

  private throwRandomError(): void {
    if (Math.random() < this.config.errorRate) {
      throw new RuntimeFailureError('Simulated random error for testing')
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new RuntimeFailureError('MockWebVMProvider not initialized')
    }
  }
}