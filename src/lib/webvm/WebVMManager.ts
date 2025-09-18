import { logger as Logger } from '../infrastructure/Logger'
import { WebVMErrorHandler, ErrorHandlerConfig } from './ErrorHandler'
import { 
  IWebVMProvider, 
  RuntimeInstance, 
  RuntimeMetadata, 
  CommandResult,
  WebVMStats,
  ExecuteOptions,
  FileInfo,
  ProviderConfig,
  WebVMError,
  RuntimeNotFoundError,
  WebVMInitializationError
} from './types'

/**
 * Main WebVM manager class - provides unified interface for WebVM operations
 * Supports provider switching between mock and real WebVM implementations
 */
export class WebVMManager {
  private static instance: WebVMManager | null = null
  private provider: IWebVMProvider | null = null
  private config: ProviderConfig
  private initialized = false
  private runtimeInstances = new Map<string, RuntimeInstance>()
  private errorHandler: WebVMErrorHandler
  private healthCheckInterval: NodeJS.Timeout | null = null
  private providerFallbackAttempted = false

  private constructor(config: ProviderConfig, errorConfig?: Partial<ErrorHandlerConfig>) {
    this.config = config
    this.errorHandler = new WebVMErrorHandler(errorConfig)
    this.startHealthMonitoring()
  }

  /**
   * Get or create the singleton WebVMManager instance
   */
  static getInstance(
    config?: ProviderConfig, 
    errorConfig?: Partial<ErrorHandlerConfig>
  ): WebVMManager {
    if (!WebVMManager.instance) {
      if (!config) {
        throw new WebVMInitializationError('WebVMManager requires initial configuration')
      }
      WebVMManager.instance = new WebVMManager(config, errorConfig)
    }
    return WebVMManager.instance
  }

  /**
   * Initialize the WebVM system with the configured provider
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      Logger.warn('WebVMManager already initialized')
      return
    }

    return this.errorHandler.execute(
      async () => {
        Logger.info('Initializing WebVM system', { providerType: this.config.type })
        
        // Lazy load provider based on configuration with fallback
        await this.loadProviderWithFallback()
        
        if (!this.provider) {
          throw new WebVMInitializationError('Failed to load WebVM provider')
        }

        await this.provider.initialize()
        this.initialized = true
        
        Logger.info('WebVM system initialized successfully')
      },
      {
        name: 'initialize',
        timeout: 120000, // 2 minutes for initialization
        retryable: true,
        circuitBreakerKey: 'initialization'
      }
    )
  }

  /**
   * Switch to a different WebVM provider (for testing or feature flags)
   */
  async switchProvider(newConfig: ProviderConfig): Promise<void> {
    Logger.info('Switching WebVM provider', { 
      from: this.config.type, 
      to: newConfig.type 
    })

    // Shutdown current provider
    if (this.provider && this.initialized) {
      await this.provider.shutdown()
    }

    // Update configuration and load new provider
    this.config = newConfig
    this.initialized = false
    this.runtimeInstances.clear()

    await this.initialize()
  }

  /**
   * Get current system status and statistics
   */
  async getSystemStatus(): Promise<{
    initialized: boolean
    providerType: string
    stats: WebVMStats | null
    runtimeCount: number
  }> {
    const stats = this.provider && this.initialized 
      ? await this.provider.getStats()
      : null

    return {
      initialized: this.initialized,
      providerType: this.config.type,
      stats,
      runtimeCount: this.runtimeInstances.size
    }
  }

  // Runtime Management Methods

  /**
   * Start a new runtime instance for an application
   */
  async startRuntime(
    type: 'node' | 'python', 
    version: string, 
    metadata: RuntimeMetadata
  ): Promise<RuntimeInstance> {
    this.ensureInitialized()

    return this.errorHandler.execute(
      async () => {
        Logger.info('Starting runtime instance', { type, version, appId: metadata.appId })

        const instance = await this.provider!.startRuntime(type, version, metadata)
        this.runtimeInstances.set(instance.id, instance)
        
        Logger.info('Runtime instance started successfully', { 
          instanceId: instance.id,
          appId: metadata.appId 
        })
        
        return instance
      },
      {
        name: 'startRuntime',
        timeout: 120000, // 2 minutes for startup
        retryable: true,
        circuitBreakerKey: `runtime-${type}`
      }
    )
  }

  /**
   * Stop a running runtime instance
   */
  async stopRuntime(instanceId: string): Promise<void> {
    this.ensureInitialized()

    Logger.info('Stopping runtime instance', { instanceId })

    try {
      await this.provider!.stopRuntime(instanceId)
      this.runtimeInstances.delete(instanceId)
      
      Logger.info('Runtime instance stopped successfully', { instanceId })
    } catch (error) {
      Logger.error('Failed to stop runtime instance', { error, instanceId })
      throw error
    }
  }

  /**
   * Restart a runtime instance
   */
  async restartRuntime(instanceId: string): Promise<RuntimeInstance> {
    this.ensureInitialized()
    
    Logger.info('Restarting runtime instance', { instanceId })

    try {
      const instance = await this.provider!.restartRuntime(instanceId)
      this.runtimeInstances.set(instance.id, instance)
      
      Logger.info('Runtime instance restarted successfully', { instanceId })
      return instance
    } catch (error) {
      Logger.error('Failed to restart runtime instance', { error, instanceId })
      throw error
    }
  }

  /**
   * Get status of a specific runtime instance
   */
  async getRuntimeStatus(instanceId: string): Promise<RuntimeInstance | null> {
    this.ensureInitialized()

    const cachedInstance = this.runtimeInstances.get(instanceId)
    if (!cachedInstance) {
      return null
    }

    try {
      const currentStatus = await this.provider!.getRuntimeStatus(instanceId)
      if (currentStatus) {
        this.runtimeInstances.set(instanceId, currentStatus)
      }
      return currentStatus
    } catch (error) {
      Logger.error('Failed to get runtime status', { error, instanceId })
      return cachedInstance // Return cached version on error
    }
  }

  /**
   * List all running runtime instances
   */
  async listRuntimes(): Promise<RuntimeInstance[]> {
    this.ensureInitialized()

    try {
      const instances = await this.provider!.listRuntimes()
      
      // Update local cache
      this.runtimeInstances.clear()
      instances.forEach(instance => {
        this.runtimeInstances.set(instance.id, instance)
      })
      
      return instances
    } catch (error) {
      Logger.error('Failed to list runtime instances', { error })
      return Array.from(this.runtimeInstances.values())
    }
  }

  /**
   * Find runtime instance by application ID
   */
  async getRuntimeForApp(appId: string): Promise<RuntimeInstance | null> {
    const instances = await this.listRuntimes()
    return instances.find(instance => instance.metadata.appId === appId) || null
  }

  // HTTP Proxy Methods

  /**
   * Proxy an HTTP request to a runtime instance
   */
  async proxyHTTPRequest(instanceId: string, request: Request): Promise<Response> {
    this.ensureInitialized()

    return this.errorHandler.execute(
      async () => {
        const instance = await this.getRuntimeStatus(instanceId)
        if (!instance) {
          throw new RuntimeNotFoundError(instanceId)
        }

        if (instance.status !== 'running') {
          throw new WebVMError(
            `Runtime instance is not running: ${instance.status}`,
            'RUNTIME_NOT_RUNNING',
            { instanceId, status: instance.status }
          )
        }

        Logger.debug('Proxying HTTP request', { 
          instanceId, 
          method: request.method, 
          url: request.url 
        })

        const response = await this.provider!.proxyHTTPRequest(instanceId, request)
        
        Logger.debug('HTTP request proxied successfully', { 
          instanceId, 
          status: response.status 
        })
        
        return response
      },
      {
        name: 'proxyHTTPRequest',
        instanceId,
        timeout: 15000, // 15 seconds for HTTP proxy
        retryable: true,
        circuitBreakerKey: instanceId
      }
    )
  }

  // Command Execution Methods

  /**
   * Execute a command in a runtime instance
   */
  async executeCommand(
    instanceId: string, 
    command: string, 
    options?: ExecuteOptions
  ): Promise<CommandResult> {
    this.ensureInitialized()

    const instance = await this.getRuntimeStatus(instanceId)
    if (!instance) {
      throw new RuntimeNotFoundError(instanceId)
    }

    try {
      Logger.debug('Executing command', { instanceId, command })
      
      const result = await this.provider!.executeCommand(instanceId, command, options)
      
      Logger.debug('Command executed', { 
        instanceId, 
        exitCode: result.exitCode, 
        duration: result.duration 
      })
      
      return result
    } catch (error) {
      Logger.error('Command execution failed', { error, instanceId, command })
      throw error
    }
  }

  // File Operations

  /**
   * Install packages in a runtime instance
   */
  async installPackages(instanceId: string, packages: string[]): Promise<CommandResult> {
    this.ensureInitialized()

    const instance = await this.getRuntimeStatus(instanceId)
    if (!instance) {
      throw new RuntimeNotFoundError(instanceId)
    }

    Logger.info('Installing packages', { instanceId, packages })

    try {
      const result = await this.provider!.installPackages(instanceId, packages)
      
      Logger.info('Package installation completed', { 
        instanceId, 
        exitCode: result.exitCode 
      })
      
      return result
    } catch (error) {
      Logger.error('Package installation failed', { error, instanceId, packages })
      throw error
    }
  }

  /**
   * Write file to runtime instance filesystem
   */
  async writeFile(
    instanceId: string, 
    path: string, 
    content: string | ArrayBuffer
  ): Promise<void> {
    this.ensureInitialized()
    
    try {
      await this.provider!.writeFile(instanceId, path, content)
      Logger.debug('File written successfully', { instanceId, path })
    } catch (error) {
      Logger.error('Failed to write file', { error, instanceId, path })
      throw error
    }
  }

  /**
   * Read file from runtime instance filesystem
   */
  async readFile(instanceId: string, path: string): Promise<string | ArrayBuffer> {
    this.ensureInitialized()
    
    try {
      const content = await this.provider!.readFile(instanceId, path)
      Logger.debug('File read successfully', { instanceId, path })
      return content
    } catch (error) {
      Logger.error('Failed to read file', { error, instanceId, path })
      throw error
    }
  }

  /**
   * List files in runtime instance directory
   */
  async listFiles(instanceId: string, path: string): Promise<FileInfo[]> {
    this.ensureInitialized()
    
    try {
      const files = await this.provider!.listFiles(instanceId, path)
      Logger.debug('Files listed successfully', { instanceId, path, count: files.length })
      return files
    } catch (error) {
      Logger.error('Failed to list files', { error, instanceId, path })
      throw error
    }
  }

  // Note: Enhanced shutdown method is provided below with comprehensive cleanup

  // Private helper methods

  private async loadProvider(): Promise<void> {
    switch (this.config.type) {
      case 'mock':
        const { MockWebVMProvider } = await import('./MockWebVMProvider')
        this.provider = new MockWebVMProvider(this.config.mock)
        break
      
      case 'cheerpx':
        const { CheerpXProvider } = await import('./CheerpXProvider')
        this.provider = new CheerpXProvider(this.config.webvm)
        break
      
      default:
        throw new WebVMInitializationError(`Unknown provider type: ${this.config.type}`)
    }
  }

  /**
   * Load provider with automatic fallback to mock provider if real provider fails
   */
  private async loadProviderWithFallback(): Promise<void> {
    try {
      await this.loadProvider()
    } catch (error) {
      Logger.warn('Primary provider failed to load, attempting fallback', { 
        primaryType: this.config.type, 
        error: error.message 
      })

      // Only attempt fallback once
      if (!this.providerFallbackAttempted && this.config.type !== 'mock') {
        this.providerFallbackAttempted = true
        
        Logger.info('Falling back to mock provider for development')
        
        // Fallback to mock provider
        const originalConfig = { ...this.config }
        this.config = {
          type: 'mock',
          mock: {
            simulateLatency: true,
            minLatency: 10,
            maxLatency: 50,
            errorRate: 0.001 // Very low error rate for fallback
          }
        }

        try {
          await this.loadProvider()
          Logger.info('Successfully fell back to mock provider', { 
            originalType: originalConfig.type 
          })
        } catch (fallbackError) {
          // Restore original config and rethrow
          this.config = originalConfig
          Logger.error('Fallback provider also failed', { fallbackError })
          throw error // Throw original error
        }
      } else {
        throw error
      }
    }
  }

  /**
   * Start health monitoring for runtime instances
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (!this.initialized || !this.provider) return

      try {
        await this.performHealthChecks()
      } catch (error) {
        Logger.error('Health check failed', { error })
      }
    }, 30000) // Health check every 30 seconds
  }

  /**
   * Perform health checks on all runtime instances
   */
  private async performHealthChecks(): Promise<void> {
    const instances = Array.from(this.runtimeInstances.values())
    
    for (const instance of instances) {
      try {
        const currentStatus = await this.provider!.getRuntimeStatus(instance.id)
        
        if (currentStatus) {
          // Update cached instance
          this.runtimeInstances.set(instance.id, currentStatus)
          
          // Check if instance became unhealthy
          if (instance.status === 'running' && currentStatus.status !== 'running') {
            Logger.warn('Runtime instance became unhealthy', {
              instanceId: instance.id,
              previousStatus: instance.status,
              currentStatus: currentStatus.status
            })

            // Attempt automatic recovery for critical instances
            if (instance.metadata.autoRestart) {
              this.attemptRuntimeRecovery(instance.id)
            }
          }
        } else {
          // Instance no longer exists
          Logger.warn('Runtime instance no longer exists', { instanceId: instance.id })
          this.runtimeInstances.delete(instance.id)
        }
      } catch (error) {
        Logger.debug('Health check failed for instance', { 
          instanceId: instance.id, 
          error: error.message 
        })
      }
    }
  }

  /**
   * Attempt to recover a failed runtime instance
   */
  private async attemptRuntimeRecovery(instanceId: string): Promise<void> {
    try {
      Logger.info('Attempting runtime recovery', { instanceId })
      
      const instance = this.runtimeInstances.get(instanceId)
      if (!instance) return

      // Try to restart the runtime
      const newInstance = await this.restartRuntime(instanceId)
      
      Logger.info('Runtime recovery successful', { 
        instanceId, 
        newInstanceId: newInstance.id 
      })
    } catch (error) {
      Logger.error('Runtime recovery failed', { instanceId, error })
    }
  }

  /**
   * Get comprehensive system metrics including error handler metrics
   */
  getSystemMetrics(): {
    webvm: {
      initialized: boolean
      providerType: string
      runtimeCount: number
      providerFallbackAttempted: boolean
    }
    errorHandler: {
      activeOperations: number
      circuitBreakers: Array<{
        key: string
        state: string
        failures: number
        successes: number
      }>
    }
  } {
    return {
      webvm: {
        initialized: this.initialized,
        providerType: this.config.type,
        runtimeCount: this.runtimeInstances.size,
        providerFallbackAttempted: this.providerFallbackAttempted
      },
      errorHandler: this.errorHandler.getMetrics()
    }
  }

  /**
   * Reset circuit breaker for specific component
   */
  resetCircuitBreaker(key: string): void {
    this.errorHandler.resetCircuitBreaker(key)
    Logger.info('Circuit breaker manually reset', { key })
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.provider) {
      throw new WebVMError(
        'WebVM system not initialized. Call initialize() first.',
        'NOT_INITIALIZED'
      )
    }
  }

  /**
   * Enhanced shutdown with cleanup
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return
    }

    Logger.info('Shutting down WebVM system with enhanced cleanup')

    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = null
      }

      // Stop all running instances
      const stopPromises = Array.from(this.runtimeInstances.keys()).map(
        instanceId => this.stopRuntime(instanceId).catch(error => 
          Logger.error('Failed to stop instance during shutdown', { error, instanceId })
        )
      )
      
      await Promise.all(stopPromises)

      // Shutdown provider
      if (this.provider) {
        await this.provider.shutdown()
      }

      // Shutdown error handler
      this.errorHandler.shutdown()

      this.initialized = false
      this.runtimeInstances.clear()
      
      Logger.info('WebVM system shutdown completed with enhanced cleanup')
    } catch (error) {
      Logger.error('Error during enhanced WebVM shutdown', { error })
      throw error
    }
  }
}