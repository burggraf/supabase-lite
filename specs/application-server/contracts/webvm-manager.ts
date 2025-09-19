/**
 * WebVM Manager Contract
 *
 * Defines the interface for managing WebVM lifecycle, runtime installation,
 * and application deployment within the browser-based virtual machine.
 */

export interface WebVMManager {
  // Lifecycle Management
  initialize(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  restart(): Promise<void>
  getStatus(): WebVMStatus

  // Runtime Package Management
  installPackage(packageId: string, options?: InstallOptions): Promise<InstallResult>
  removePackage(packageId: string, options?: RemoveOptions): Promise<RemoveResult>
  listInstalledPackages(): Promise<RuntimePackage[]>
  getPackageInfo(packageId: string): Promise<RuntimePackage | null>

  // Application Management
  deployApplication(config: DeploymentConfig): Promise<DeploymentResult>
  startApplication(appId: string): Promise<StartResult>
  stopApplication(appId: string): Promise<StopResult>
  removeApplication(appId: string): Promise<RemoveResult>

  // File System Operations
  writeFile(path: string, content: ArrayBuffer | string): Promise<void>
  readFile(path: string): Promise<ArrayBuffer>
  createDirectory(path: string): Promise<void>
  listDirectory(path: string): Promise<FileEntry[]>
  deleteFile(path: string): Promise<void>

  // Command Execution
  execute(command: string | string[]): Promise<ExecutionResult>
  executeInBackground(command: string): Promise<BackgroundProcess>

  // Monitoring and Diagnostics
  getSystemResources(): Promise<SystemResources>
  getApplicationMetrics(appId: string): Promise<ApplicationMetrics>
  getLogs(source: 'system' | 'application', appId?: string): Promise<LogEntry[]>

  // Event Handling
  onStatusChange(callback: (status: WebVMStatus) => void): () => void
  onApplicationEvent(callback: (event: ApplicationEvent) => void): () => void
  onError(callback: (error: WebVMError) => void): () => void
}

export interface WebVMStatus {
  state: 'unloaded' | 'loading' | 'booting' | 'ready' | 'hibernating' | 'error'
  loadProgress: number
  bootTime?: Date
  lastHeartbeat?: Date
  installedRuntimes: string[]
  runningApps: string[]
  systemResources: SystemResources
  errorMessage?: string
}

export interface InstallOptions {
  force?: boolean               // Override conflict warnings
  skipDependencies?: boolean    // Don't install dependencies
  enableServices?: boolean      // Auto-enable systemd services
  timeout?: number             // Installation timeout in seconds
}

export interface RemoveOptions {
  force?: boolean               // Remove even if apps depend on it
  removeUnused?: boolean        // Remove unused dependencies
  disableServices?: boolean     // Disable services before removal
  backup?: boolean             // Create backup before removal
}

export interface InstallResult {
  success: boolean
  packageId: string
  installedPackages: string[]   // Including dependencies
  warnings: string[]
  logs: string[]
  timeElapsed: number
  error?: string
}

export interface RemoveResult {
  success: boolean
  packageId: string
  removedPackages: string[]
  affectedApps: string[]       // Apps that may be impacted
  warnings: string[]
  logs: string[]
  timeElapsed: number
  error?: string
}

export interface RuntimePackage {
  id: string
  name: string
  description: string
  category: 'web-server' | 'runtime' | 'framework' | 'database' | 'tool'
  version: string
  dependencies: string[]
  conflicts: string[]
  size: number
  status: 'available' | 'installing' | 'installed' | 'removing' | 'error'
  installDate?: Date
  lastUsed?: Date
}

export interface DeploymentConfig {
  applicationId: string
  name: string
  sourceType: 'upload' | 'github' | 'url' | 'local-sync'
  sourceConfig: SourceConfig
  runtime: ApplicationRuntime
  execution: ExecutionConfig
  buildConfig?: BuildConfig
}

export interface SourceConfig {
  // For upload
  files?: File[]

  // For GitHub
  repository?: string
  branch?: string
  commit?: string
  token?: string

  // For URL
  url?: string

  // For local sync
  localPath?: string
  watchEnabled?: boolean
}

export interface ApplicationRuntime {
  requiredRuntimes: string[]
  optionalRuntimes: string[]
  minimumVersions: Record<string, string>
}

export interface ExecutionConfig {
  command: string
  arguments: string[]
  workingDirectory: string
  port?: number
  environment: Record<string, string>
  autoRestart: boolean
  healthCheckConfig?: HealthCheckConfig
}

export interface BuildConfig {
  enabled: boolean
  buildCommand: string
  buildDirectory: string
  environmentVars: Record<string, string>
  timeout: number
}

export interface HealthCheckConfig {
  enabled: boolean
  path?: string
  interval: number
  timeout: number
  retries: number
  startPeriod: number
}

export interface DeploymentResult {
  success: boolean
  applicationId: string
  deploymentPath: string
  logs: string[]
  warnings: string[]
  timeElapsed: number
  error?: string
}

export interface StartResult {
  success: boolean
  applicationId: string
  processId?: number
  port?: number
  logs: string[]
  error?: string
}

export interface StopResult {
  success: boolean
  applicationId: string
  graceful: boolean
  logs: string[]
  error?: string
}

export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  created: Date
  modified: Date
  permissions: string
}

export interface ExecutionResult {
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
  timeElapsed: number
  error?: string
}

export interface BackgroundProcess {
  id: string
  command: string
  startTime: Date
  isRunning: boolean

  getOutput(): Promise<string>
  terminate(): Promise<void>
  wait(): Promise<ExecutionResult>
}

export interface SystemResources {
  memoryUsed: number
  memoryTotal: number
  diskUsed: number
  diskTotal: number
  cpuUsage: number
  processCount: number
  uptime: number
}

export interface ApplicationMetrics {
  memoryUsage: number
  cpuUsage: number
  diskUsage: number
  requestCount: number
  requestRate: number
  responseTime: number
  errorRate: number
  uptime: number
  restartCount: number
  healthStatus: 'healthy' | 'unhealthy' | 'unknown'
}

export interface LogEntry {
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  source: 'application' | 'system' | 'webvm'
  applicationId?: string
  details?: Record<string, any>
}

export interface ApplicationEvent {
  type: 'started' | 'stopped' | 'crashed' | 'deployed' | 'health-check'
  applicationId: string
  timestamp: Date
  details?: Record<string, any>
}

export interface WebVMError extends Error {
  code: 'BOOT_FAILED' | 'PACKAGE_INSTALL_FAILED' | 'APP_START_FAILED' | 'SYSTEM_ERROR'
  applicationId?: string
  packageId?: string
  details?: Record<string, any>
}