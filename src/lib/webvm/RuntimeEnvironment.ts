import { WebVMManager } from './WebVMManager'
import { logger as Logger } from '../infrastructure/Logger'
import { 
  RuntimeInstance, 
  RuntimeMetadata, 
  CommandResult,
  RuntimeFailureError,
  WebVMError
} from './types'

/**
 * High-level runtime environment management
 * Provides application-focused abstractions over WebVM operations
 */
export class RuntimeEnvironment {
  private webvmManager: WebVMManager
  private instance: RuntimeInstance | null = null
  private deployedFiles: Set<string> = new Set()

  constructor(
    private appId: string,
    private runtimeType: 'node' | 'python',
    private version: string,
    webvmManager?: WebVMManager
  ) {
    this.webvmManager = webvmManager || WebVMManager.getInstance()
  }

  /**
   * Deploy application files and start the runtime
   */
  async deploy(files: Map<string, string | ArrayBuffer>, metadata: RuntimeMetadata): Promise<void> {
    Logger.info('Deploying application', { appId: this.appId, fileCount: files.size })

    try {
      // Start runtime instance if not already running
      if (!this.instance || this.instance.status !== 'running') {
        await this.startRuntime(metadata)
      }

      // Deploy files to runtime filesystem
      await this.deployFiles(files)

      // Install dependencies if package file exists
      await this.installDependencies(files)

      // Start application server
      await this.startApplicationServer(metadata)

      Logger.info('Application deployed successfully', { appId: this.appId })
    } catch (error) {
      Logger.error('Application deployment failed', { error, appId: this.appId })
      throw new RuntimeFailureError('Application deployment failed', { appId: this.appId, error })
    }
  }

  /**
   * Start the application server process
   */
  async start(): Promise<void> {
    if (!this.instance) {
      throw new RuntimeFailureError('Runtime not initialized', { appId: this.appId })
    }

    Logger.info('Starting application server', { appId: this.appId, instanceId: this.instance.id })

    try {
      const startCommand = this.getStartCommand()
      const result = await this.webvmManager.executeCommand(this.instance.id, startCommand, {
        workingDirectory: '/app',
        environmentVariables: this.instance.metadata.environmentVariables
      })

      if (result.exitCode !== 0) {
        throw new RuntimeFailureError(`Start command failed: ${result.stderr}`, {
          appId: this.appId,
          exitCode: result.exitCode,
          stderr: result.stderr
        })
      }

      Logger.info('Application server started', { appId: this.appId })
    } catch (error) {
      Logger.error('Failed to start application server', { error, appId: this.appId })
      throw error
    }
  }

  /**
   * Stop the application server
   */
  async stop(): Promise<void> {
    if (!this.instance) {
      Logger.warn('No runtime instance to stop', { appId: this.appId })
      return
    }

    Logger.info('Stopping application', { appId: this.appId, instanceId: this.instance.id })

    try {
      await this.webvmManager.stopRuntime(this.instance.id)
      this.instance = null
      this.deployedFiles.clear()
      
      Logger.info('Application stopped successfully', { appId: this.appId })
    } catch (error) {
      Logger.error('Failed to stop application', { error, appId: this.appId })
      throw error
    }
  }

  /**
   * Restart the application
   */
  async restart(): Promise<void> {
    if (!this.instance) {
      throw new RuntimeFailureError('No runtime instance to restart', { appId: this.appId })
    }

    Logger.info('Restarting application', { appId: this.appId })

    try {
      const newInstance = await this.webvmManager.restartRuntime(this.instance.id)
      this.instance = newInstance
      
      // Restart application server
      await this.start()
      
      Logger.info('Application restarted successfully', { appId: this.appId })
    } catch (error) {
      Logger.error('Failed to restart application', { error, appId: this.appId })
      throw error
    }
  }

  /**
   * Get current runtime status
   */
  async getStatus(): Promise<{
    runtime: RuntimeInstance | null
    isDeployed: boolean
    deployedFileCount: number
    isServerRunning: boolean
  }> {
    const runtime = this.instance ? 
      await this.webvmManager.getRuntimeStatus(this.instance.id) : 
      null

    // Update local instance if status changed
    if (runtime) {
      this.instance = runtime
    }

    const isServerRunning = runtime?.status === 'running'

    return {
      runtime,
      isDeployed: this.deployedFiles.size > 0,
      deployedFileCount: this.deployedFiles.size,
      isServerRunning
    }
  }

  /**
   * Execute command in the runtime environment
   */
  async executeCommand(command: string, options?: {
    workingDirectory?: string
    timeout?: number
  }): Promise<CommandResult> {
    if (!this.instance) {
      throw new RuntimeFailureError('Runtime not initialized', { appId: this.appId })
    }

    return await this.webvmManager.executeCommand(this.instance.id, command, {
      workingDirectory: options?.workingDirectory || '/app',
      timeout: options?.timeout,
      environmentVariables: this.instance.metadata.environmentVariables
    })
  }

  /**
   * Proxy HTTP request to the application
   */
  async proxyRequest(request: Request): Promise<Response> {
    if (!this.instance) {
      throw new RuntimeFailureError('Runtime not initialized', { appId: this.appId })
    }

    return await this.webvmManager.proxyHTTPRequest(this.instance.id, request)
  }

  /**
   * Get application logs
   */
  async getLogs(lines: number = 100): Promise<string[]> {
    if (!this.instance) {
      return []
    }

    try {
      const result = await this.webvmManager.executeCommand(
        this.instance.id, 
        `tail -n ${lines} /app/logs/app.log 2>/dev/null || echo "No logs available"`
      )
      
      return result.stdout.split('\n').filter(line => line.trim())
    } catch (error) {
      Logger.error('Failed to get application logs', { error, appId: this.appId })
      return []
    }
  }

  /**
   * Get runtime instance ID
   */
  getInstanceId(): string | null {
    return this.instance?.id || null
  }

  // Private helper methods

  private async startRuntime(metadata: RuntimeMetadata): Promise<void> {
    Logger.info('Starting runtime instance', { 
      appId: this.appId, 
      type: this.runtimeType, 
      version: this.version 
    })

    try {
      this.instance = await this.webvmManager.startRuntime(
        this.runtimeType,
        this.version,
        metadata
      )

      Logger.info('Runtime instance started', { 
        appId: this.appId, 
        instanceId: this.instance.id 
      })
    } catch (error) {
      Logger.error('Failed to start runtime instance', { error, appId: this.appId })
      throw error
    }
  }

  private async deployFiles(files: Map<string, string | ArrayBuffer>): Promise<void> {
    if (!this.instance) {
      throw new RuntimeFailureError('Runtime not initialized', { appId: this.appId })
    }

    Logger.info('Deploying files to runtime', { 
      appId: this.appId, 
      fileCount: files.size 
    })

    const deployPromises: Promise<void>[] = []

    for (const [filePath, content] of files) {
      const fullPath = filePath.startsWith('/') ? filePath : `/app/${filePath}`
      
      deployPromises.push(
        this.webvmManager.writeFile(this.instance.id, fullPath, content)
          .then(() => {
            this.deployedFiles.add(fullPath)
            Logger.debug('File deployed', { appId: this.appId, path: fullPath })
          })
          .catch(error => {
            Logger.error('Failed to deploy file', { 
              error, 
              appId: this.appId, 
              path: fullPath 
            })
            throw error
          })
      )
    }

    await Promise.all(deployPromises)
    
    Logger.info('All files deployed successfully', { 
      appId: this.appId, 
      fileCount: this.deployedFiles.size 
    })
  }

  private async installDependencies(files: Map<string, string | ArrayBuffer>): Promise<void> {
    if (!this.instance) {
      throw new RuntimeFailureError('Runtime not initialized', { appId: this.appId })
    }

    let packageFile: string | null = null
    let packages: string[] = []

    // Detect package files and extract dependencies
    switch (this.runtimeType) {
      case 'node':
        if (files.has('package.json')) {
          packageFile = 'package.json'
          try {
            const packageJson = JSON.parse(files.get('package.json') as string)
            packages = Object.keys(packageJson.dependencies || {})
          } catch (error) {
            Logger.warn('Failed to parse package.json', { error, appId: this.appId })
          }
        }
        break

      case 'python':
        if (files.has('requirements.txt')) {
          packageFile = 'requirements.txt'
          const requirements = files.get('requirements.txt') as string
          packages = requirements.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
        }
        break
    }

    if (packageFile && packages.length > 0) {
      Logger.info('Installing dependencies', { 
        appId: this.appId, 
        packageFile, 
        packageCount: packages.length 
      })

      try {
        const result = await this.webvmManager.installPackages(this.instance.id, packages)
        
        if (result.exitCode !== 0) {
          Logger.warn('Package installation had warnings', { 
            appId: this.appId, 
            stderr: result.stderr 
          })
        }

        Logger.info('Dependencies installed successfully', { appId: this.appId })
      } catch (error) {
        Logger.error('Failed to install dependencies', { error, appId: this.appId })
        // Don't throw - allow deployment to continue without dependencies
      }
    }
  }

  private async startApplicationServer(metadata: RuntimeMetadata): Promise<void> {
    if (!this.instance) {
      throw new RuntimeFailureError('Runtime not initialized', { appId: this.appId })
    }

    // Use custom start command if provided, otherwise use defaults
    const startCommand = metadata.entryPoint ? 
      this.getCustomStartCommand(metadata.entryPoint) :
      this.getDefaultStartCommand()

    Logger.info('Starting application server process', { 
      appId: this.appId, 
      command: startCommand 
    })

    try {
      // Start server in background (don't wait for completion)
      const result = await this.webvmManager.executeCommand(
        this.instance.id, 
        `nohup ${startCommand} > /app/logs/app.log 2>&1 &`,
        {
          workingDirectory: '/app',
          environmentVariables: metadata.environmentVariables
        }
      )

      // Give server time to start
      await new Promise(resolve => setTimeout(resolve, 2000))

      Logger.info('Application server started', { appId: this.appId })
    } catch (error) {
      Logger.error('Failed to start application server', { error, appId: this.appId })
      throw error
    }
  }

  private getStartCommand(): string {
    if (this.instance?.metadata.entryPoint) {
      return this.getCustomStartCommand(this.instance.metadata.entryPoint)
    }
    return this.getDefaultStartCommand()
  }

  private getCustomStartCommand(entryPoint: string): string {
    switch (this.runtimeType) {
      case 'node':
        return `node ${entryPoint}`
      case 'python':
        return `python ${entryPoint}`
      default:
        throw new RuntimeFailureError(`Unsupported runtime type: ${this.runtimeType}`)
    }
  }

  private getDefaultStartCommand(): string {
    switch (this.runtimeType) {
      case 'node':
        return 'npm start'
      case 'python':
        return 'python main.py'
      default:
        throw new RuntimeFailureError(`Unsupported runtime type: ${this.runtimeType}`)
    }
  }
}