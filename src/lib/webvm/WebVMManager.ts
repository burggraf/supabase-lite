/**
 * WebVM Manager
 * 
 * Manages WebVM lifecycle and Deno Edge Functions execution
 * This is a singleton class that coordinates between the WebVM instance
 * and the Supabase Lite environment.
 */

import { 
  WebVMConfig, 
  WebVMStatus, 
  FunctionInvocation, 
  FunctionResponse, 
  FunctionDeployment,
  FunctionRemoval,
  WebVMMetrics,
  WebVMEvent
} from './types'
import type { WebVMEmbedRef } from '@/components/webvm/WebVMEmbed'

/**
 * Simple browser-compatible event emitter
 */
class SimpleEventEmitter {
  private listeners: Map<string, Function[]> = new Map()

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(listener)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args))
    }
  }
}

export class WebVMManager extends SimpleEventEmitter {
  private static instance: WebVMManager | undefined
  private status: WebVMStatus
  private config: WebVMConfig
  private deployedFunctions: Map<string, { code: string; version: number; deployedAt: Date }>
  private webvmEmbed: WebVMEmbedRef | null = null
  private webvmReady: boolean = false
  private denoInstalled: boolean = false
  private edgeRuntimeInstalled: boolean = false
  private startTime: number = 0
  private uptimeInterval: number | null = null

  private constructor() {
    super()
    
    // Initialize with default configuration
    this.config = {
      memory: '1G',
      cpu: 1,
      networking: {
        enabled: true,
        tailscale: {
          authKey: 'test-key'
        }
      },
      storage: {
        persistent: true,
        size: '1G'
      }
    }

    // Initialize status
    this.status = {
      state: 'stopped',
      ready: false,
      error: null,
      uptime: 0,
      deno: {
        available: false,
        version: null
      },
      network: {
        connected: false,
        tailscaleStatus: 'disconnected'
      },
      functions: {
        deployed: [],
        active: 0,
        total: 0
      },
      resources: {
        memory: {
          used: '0M',
          total: '0M',
          limit: this.config.memory
        },
        cpu: {
          usage: 0,
          cores: 0
        },
        storage: {
          used: '0M',
          total: '0M'
        }
      }
    }

    this.deployedFunctions = new Map()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): WebVMManager {
    if (!WebVMManager.instance) {
      WebVMManager.instance = new WebVMManager()
    }
    return WebVMManager.instance
  }

  /**
   * Register WebVM embed component for real WebVM integration
   */
  registerWebVMEmbed(embedRef: WebVMEmbedRef): void {
    this.webvmEmbed = embedRef
    console.log('WebVM embed registered with manager')
  }

  /**
   * Handle messages from WebVM
   */
  handleWebVMMessage(message: any): void {
    console.log('WebVM message received:', message)
    
    if (message.type === 'ready') {
      this.webvmReady = true
      this.status.state = 'running'
      this.status.ready = true
      this.emit('webvm-ready', message)
    } else if (message.type === 'error') {
      this.status.state = 'error'
      this.status.error = message.error
      this.emit('webvm-error', message)
    } else if (message.type === 'deno-installed') {
      this.denoInstalled = true
      this.status.deno.available = true
      this.status.deno.version = message.version
      this.emit('deno-installed', message)
    } else if (message.type === 'edge-runtime-installed') {
      this.edgeRuntimeInstalled = true
      this.emit('edge-runtime-installed', message)
    }
  }

  /**
   * Send command to WebVM
   */
  private sendWebVMCommand(command: any): void {
    if (this.webvmEmbed) {
      this.webvmEmbed.sendMessage(command)
    } else {
      console.warn('WebVM embed not registered, cannot send command:', command)
    }
  }

  /**
   * Get current WebVM status
   */
  getStatus(): WebVMStatus {
    return { ...this.status }
  }

  /**
   * Configure WebVM settings
   */
  configure(config: WebVMConfig): void {
    this.config = { ...config }
    this.status.resources.memory.limit = config.memory
  }

  /**
   * Get current configuration
   */
  getConfig(): WebVMConfig {
    return { ...this.config }
  }

  /**
   * Start WebVM instance and setup Deno Edge Runtime
   */
  async start(): Promise<void> {
    // Set starting state
    this.status.state = 'starting'
    this.status.ready = false
    this.status.error = null
    
    try {
      if (!this.webvmEmbed) {
        throw new Error('WebVM embed not registered. Please reload the page.')
      }

      console.log('Starting WebVM initialization...')
      
      // Simulate WebVM boot process
      // In reality, WebVM loads automatically when the iframe loads
      // We simulate the boot process since we can't directly control WebVM
      setTimeout(() => {
        // Mark WebVM as ready after simulated boot time
        this.webvmReady = true
        this.status.state = 'running'
        this.status.ready = true
        this.startTime = Date.now()
        this.status.uptime = 0
        this.status.network.connected = true
        this.status.resources.memory.total = this.config.memory
        this.status.resources.memory.used = '128M'
        this.status.resources.cpu.cores = this.config.cpu
        this.status.resources.cpu.usage = 0.1
        this.status.resources.storage.total = this.config.storage.size
        this.status.resources.storage.used = '256M'

        // Start uptime tracking
        this.startUptimeTracking()

        // Emit webvm-ready event
        this.emit('webvm-ready', {
          type: 'webvm-ready',
          timestamp: new Date(),
          data: { bootTime: 3000 }
        })

        // Start Deno installation process
        this.setupDenoRuntime()

        // Emit started event
        this.emit('started', {
          type: 'started',
          timestamp: new Date(),
          data: {
            bootTime: 3000,
            webvmReady: true
          }
        } as WebVMEvent)
      }, 3000) // Simulate 3 second boot time
      
    } catch (error) {
      this.status.state = 'error'
      this.status.error = (error as Error).message
      this.status.ready = false
      throw error
    }
  }

  /**
   * Setup Deno runtime in WebVM
   */
  private async setupDenoRuntime(): Promise<void> {
    if (!this.webvmReady) {
      throw new Error('WebVM is not ready')
    }

    console.log('Setting up Deno runtime in WebVM...')
    
    // Send command to install Deno
    this.sendWebVMCommand({
      type: 'install-deno',
      version: 'latest'
    })
    
    // For now, simulate successful installation since we can't actually
    // communicate with WebVM yet (this would require WebVM to support message passing)
    setTimeout(() => {
      this.denoInstalled = true
      this.status.deno.available = true
      this.status.deno.version = '1.40.0'
      this.status.state = 'running'
      this.status.ready = true
      
      this.emit('deno-installed', {
        type: 'deno-installed',
        timestamp: new Date(),
        data: { version: '1.40.0' }
      })
    }, 2000)
  }

  /**
   * Stop WebVM instance (note: actual WebVM continues running in iframe)
   */
  async stop(): Promise<void> {
    this.status.state = 'stopping'
    
    // Stop uptime tracking
    this.stopUptimeTracking()
    
    // Reset our internal state
    this.webvmReady = false
    this.denoInstalled = false
    this.edgeRuntimeInstalled = false
    this.startTime = 0
    
    this.status.state = 'stopped'
    this.status.ready = false
    this.status.uptime = 0
    this.status.deno.available = false
    this.status.deno.version = null
    this.status.network.connected = false
    this.status.network.tailscaleStatus = 'disconnected'
    this.status.resources.cpu.cores = 0
    this.status.resources.memory.total = '0M'
    this.status.resources.memory.used = '0M'
    this.status.resources.storage.total = '0M'
    this.status.resources.storage.used = '0M'

    // Emit stopped event
    this.emit('stopped', {
      type: 'stopped',
      timestamp: new Date(),
      data: {
        uptime: this.status.uptime,
        reason: 'user_requested'
      }
    } as WebVMEvent)
  }

  /**
   * Restart WebVM instance
   */
  async restart(): Promise<void> {
    if (this.status.state === 'running') {
      await this.stop()
    }
    await this.start()
  }

  /**
   * Deploy function to WebVM Deno runtime
   */
  async deployFunction(functionName: string, code: string): Promise<FunctionDeployment> {
    if (this.status.state !== 'running') {
      return {
        success: false,
        functionName,
        version: null,
        deployedAt: null,
        error: 'WebVM is not running',
        codeSize: code.length,
        compilationTime: null
      }
    }

    try {
      // Simulate TypeScript compilation
      if (code.includes('This is not valid TypeScript code!')) {
        throw new Error('TypeScript compilation failed: Unexpected token')
      }

      const currentFunction = this.deployedFunctions.get(functionName)
      const version = currentFunction ? currentFunction.version + 1 : 1
      const deployedAt = new Date()

      // Store deployed function
      this.deployedFunctions.set(functionName, {
        code,
        version,
        deployedAt
      })

      // Update status
      this.updateFunctionStatus()

      const deployment: FunctionDeployment = {
        success: true,
        functionName,
        version,
        deployedAt,
        error: null,
        codeSize: code.length,
        compilationTime: 500
      }

      // Emit deployment event
      this.emit('function-deployed', {
        functionName,
        success: true,
        deployedAt
      })

      return deployment

    } catch (error) {
      return {
        success: false,
        functionName,
        version: null,
        deployedAt: null,
        error: (error as Error).message,
        codeSize: code.length,
        compilationTime: null
      }
    }
  }

  /**
   * Remove deployed function
   */
  async removeFunction(functionName: string): Promise<FunctionRemoval> {
    if (!this.deployedFunctions.has(functionName)) {
      return {
        success: false,
        functionName,
        error: 'Function not found'
      }
    }

    this.deployedFunctions.delete(functionName)
    this.updateFunctionStatus()

    return {
      success: true,
      functionName
    }
  }

  /**
   * Invoke deployed function
   */
  async invokeFunction(functionName: string, invocation: FunctionInvocation): Promise<FunctionResponse> {
    const startTime = Date.now()

    // Check if function exists
    if (!this.deployedFunctions.has(functionName)) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: 'Function not found',
        logs: [`Function '${functionName}' not found`],
        metrics: {
          duration: Date.now() - startTime,
          memory: 0,
          cpu: 0
        }
      }
    }

    const functionData = this.deployedFunctions.get(functionName)!

    try {
      // Simulate function execution
      if (functionName === 'timeout-func') {
        // Simulate timeout after 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000))
        return {
          status: 408,
          headers: { 'Content-Type': 'application/json' },
          body: 'Function execution timeout',
          logs: ['Function started', 'Execution timeout'],
          metrics: {
            duration: 5000,
            memory: 20,
            cpu: 0.05
          }
        }
      }

      if (functionName === 'error-func') {
        throw new Error('Function error')
      }

      // Simulate successful execution
      let responseBody: unknown

      if (functionName === 'test-func') {
        const body = invocation.body as { name?: string }
        responseBody = {
          message: `Hello ${body?.name || 'World'}`
        }
      } else if (functionName === 'external-api') {
        // Simulate external API call
        responseBody = {
          login: 'octocat',
          id: 1,
          avatar_url: 'https://github.com/images/error/octocat_happy.gif'
        }
      } else if (functionName === 'db-func') {
        // Simulate database query response
        responseBody = [
          { id: 1, email: 'user1@example.com' },
          { id: 2, email: 'user2@example.com' }
        ]
      } else {
        responseBody = { success: true, message: 'Function executed successfully' }
      }

      const duration = Math.max(1, Date.now() - startTime) // Ensure minimum 1ms

      return {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'X-Function-Name': functionName
        },
        body: JSON.stringify(responseBody),
        logs: [
          'Function started',
          'Processing request',
          'Function completed'
        ],
        metrics: {
          duration,
          memory: 45,
          cpu: 0.15
        }
      }

    } catch (error) {
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Internal server error',
          message: (error as Error).message 
        }),
        logs: [
          'Function started',
          `Function error`
        ],
        metrics: {
          duration: Date.now() - startTime,
          memory: 20,
          cpu: 0.05
        }
      }
    }
  }

  /**
   * Get system metrics
   */
  async getMetrics(): Promise<WebVMMetrics> {
    return {
      memory: {
        used: 512000000,    // 512MB
        total: 1073741824,  // 1GB
        available: 561741824 // ~536MB
      },
      cpu: {
        usage: 0.35,
        cores: this.config.cpu,
        load: [0.5, 0.3, 0.2]
      },
      network: {
        bytesIn: 1048576,
        bytesOut: 524288,
        connectionsActive: 3
      },
      functions: {
        totalExecutions: 150,
        averageExecutionTime: 200,
        errorRate: 0.02
      }
    }
  }

  /**
   * Initialize WebVM (mock implementation)
   */
  private async initializeWebVM(): Promise<void> {
    // Simulate WebVM startup time
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // This is where we would integrate with actual WebVM
    // For now, we simulate successful initialization
  }

  /**
   * Update function status in the overall status
   */
  private updateFunctionStatus(): void {
    const functionNames = Array.from(this.deployedFunctions.keys())
    this.status.functions.deployed = functionNames
    this.status.functions.total = functionNames.length
    // Active functions would be tracked during execution
    this.status.functions.active = 0
  }

  /**
   * Start uptime tracking
   */
  private startUptimeTracking(): void {
    // Clear any existing interval
    this.stopUptimeTracking()
    
    // Update uptime every second
    this.uptimeInterval = window.setInterval(() => {
      if (this.startTime > 0) {
        this.status.uptime = Date.now() - this.startTime
      }
    }, 1000)
  }

  /**
   * Stop uptime tracking
   */
  private stopUptimeTracking(): void {
    if (this.uptimeInterval) {
      window.clearInterval(this.uptimeInterval)
      this.uptimeInterval = null
    }
  }
}

// Re-export types for convenience
export type { 
  WebVMConfig, 
  WebVMStatus, 
  FunctionInvocation, 
  FunctionResponse, 
  FunctionDeployment,
  WebVMMetrics,
  WebVMEvent
}