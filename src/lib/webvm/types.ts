// WebVM abstraction types and interfaces

export interface RuntimeInstance {
  id: string
  type: 'node' | 'python' | 'static'
  version: string
  port: number
  status: 'starting' | 'running' | 'stopped' | 'error'
  pid?: number
  startedAt?: Date
  metadata: RuntimeMetadata
}

export interface RuntimeMetadata {
  appId: string
  entryPoint?: string
  environmentVariables: Record<string, string>
  workingDirectory: string
  packageFile?: string // package.json, requirements.txt, etc.
}

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
  duration: number
}

export interface ProcessInfo {
  pid: number
  command: string
  status: 'running' | 'stopped' | 'crashed'
  cpu: number
  memory: number
  startTime: Date
}

export interface WebVMStats {
  totalMemory: number
  usedMemory: number
  totalDisk: number
  usedDisk: number
  runtimeCount: number
  uptime: number
}

export interface IWebVMProvider {
  // Lifecycle management
  initialize(): Promise<void>
  shutdown(): Promise<void>
  isReady(): boolean
  getStats(): Promise<WebVMStats>

  // Runtime management
  startRuntime(type: 'node' | 'python', version: string, metadata: RuntimeMetadata): Promise<RuntimeInstance>
  stopRuntime(instanceId: string): Promise<void>
  restartRuntime(instanceId: string): Promise<RuntimeInstance>
  getRuntimeStatus(instanceId: string): Promise<RuntimeInstance | null>
  listRuntimes(): Promise<RuntimeInstance[]>

  // Command execution
  executeCommand(instanceId: string, command: string, options?: ExecuteOptions): Promise<CommandResult>

  // HTTP proxying
  proxyHTTPRequest(instanceId: string, request: Request): Promise<Response>

  // File operations
  writeFile(instanceId: string, path: string, content: string | ArrayBuffer): Promise<void>
  readFile(instanceId: string, path: string): Promise<string | ArrayBuffer>
  listFiles(instanceId: string, path: string): Promise<FileInfo[]>
  deleteFile(instanceId: string, path: string): Promise<void>

  // Package management
  installPackages(instanceId: string, packages: string[]): Promise<CommandResult>
}

export interface ExecuteOptions {
  workingDirectory?: string
  timeout?: number
  environmentVariables?: Record<string, string>
}

export interface FileInfo {
  name: string
  path: string
  size: number
  isDirectory: boolean
  modified: Date
}

// Error types
export class WebVMError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: any) {
    super(message)
    this.name = 'WebVMError'
  }
}

export class RuntimeNotFoundError extends WebVMError {
  constructor(instanceId: string) {
    super(`Runtime instance not found: ${instanceId}`, 'RUNTIME_NOT_FOUND', { instanceId })
  }
}

export class RuntimeFailureError extends WebVMError {
  constructor(message: string, details?: any) {
    super(message, 'RUNTIME_FAILURE', details)
  }
}

export class WebVMInitializationError extends WebVMError {
  constructor(message: string, details?: any) {
    super(message, 'WEBVM_INIT_FAILED', details)
  }
}

export class ProxyError extends WebVMError {
  constructor(message: string, public readonly statusCode: number, details?: any) {
    super(message, 'PROXY_ERROR', details)
  }
}

// Configuration types
export interface WebVMConfig {
  // CheerpX-specific properties
  diskImage?: string
  memorySize?: number // MB
  persistent?: boolean
  
  // General WebVM properties
  maxMemory?: number // MB
  maxDisk?: number // MB
  maxRuntimes?: number
  defaultTimeout?: number // ms
  enableSnapshots?: boolean
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
}

export interface ProviderConfig {
  type: 'mock' | 'cheerpx'
  webvm?: WebVMConfig
  mock?: MockProviderConfig
}

export interface MockProviderConfig {
  simulateLatency: boolean
  minLatency: number // ms
  maxLatency: number // ms
  errorRate: number // 0-1
  testMode?: boolean // If true, bypass Web Workers for testing
}