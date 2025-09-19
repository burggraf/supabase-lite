# Application Server - Data Model

## Overview

This document defines the core data models and state management structure for the Application Server feature. The data model is designed to support additive runtime management, application lifecycle tracking, and persistent state across browser sessions.

## Core Domain Models

### 1. WebVM System Model

```typescript
interface WebVMStatus {
  state: WebVMState
  loadProgress: number
  bootTime?: Date
  lastHeartbeat?: Date
  installedRuntimes: string[]
  runningApps: string[]
  systemResources: SystemResources
  errorMessage?: string
}

type WebVMState =
  | 'unloaded'    // WebVM not yet initialized
  | 'loading'     // Downloading WebVM assets
  | 'booting'     // Linux kernel starting up
  | 'ready'       // Available for operations
  | 'hibernating' // Suspended to save resources
  | 'error'       // Failed to load or operate

interface SystemResources {
  memoryUsed: number      // MB
  memoryTotal: number     // MB
  diskUsed: number        // MB
  diskTotal: number       // MB
  cpuUsage: number        // Percentage
  processCount: number
}
```

### 2. Runtime Package Model

```typescript
interface RuntimePackage {
  id: string                    // 'nodejs-20', 'python-311', 'nginx'
  name: string                  // 'Node.js 20.x LTS'
  description: string           // Human readable description
  category: RuntimeCategory
  version: string               // Semantic version
  dependencies: string[]        // Other runtime packages required
  conflicts: string[]           // Packages that cannot coexist

  // Package data
  debPackages: string[]         // List of .deb files to install
  size: number                  // Total size in MB
  extractedSize: number         // Size after installation
  checksums: Record<string, string> // File integrity verification

  // Installation metadata
  status: PackageStatus
  installScript?: string        // Commands to run during installation
  postInstallScript?: string    // Commands to run after installation
  preRemoveScript?: string      // Commands to run before removal
  serviceNames?: string[]       // Systemd services managed by this package

  // Timing and history
  installDate?: Date
  lastUsed?: Date
  installDuration?: number      // Milliseconds
}

type RuntimeCategory =
  | 'web-server'    // nginx, apache
  | 'runtime'       // nodejs, python, deno
  | 'framework'     // nextjs, express, flask
  | 'database'      // postgresql, sqlite
  | 'tool'          // git, curl, development tools

type PackageStatus =
  | 'available'     // Ready for installation
  | 'downloading'   // Package files being transferred
  | 'installing'    // Installation in progress
  | 'installed'     // Successfully installed and ready
  | 'removing'      // Removal in progress
  | 'error'         // Installation/removal failed
```

### 3. Application Model

```typescript
interface Application {
  id: string                    // Auto-generated UUID
  name: string                  // User-defined, used for routing
  description?: string          // User-defined description

  // Runtime requirements
  runtime: ApplicationRuntime
  runtimeStatus: RuntimeCompatibility

  // Application state
  status: ApplicationStatus
  healthCheck?: HealthCheckStatus

  // Deployment configuration
  deployment: DeploymentConfig

  // Runtime configuration
  execution: ExecutionConfig

  // Monitoring and metrics
  metrics: ApplicationMetrics

  // Timestamps
  createdAt: Date
  lastDeployed: Date
  lastStarted?: Date
  lastStopped?: Date
}

interface ApplicationRuntime {
  requiredRuntimes: string[]    // ['nodejs-20', 'nginx']
  optionalRuntimes: string[]    // ['python-311'] (for enhanced features)
  minimumVersions: Record<string, string> // {'nodejs': '18.0.0'}
  recommendedVersions: Record<string, string> // {'nodejs': '20.11.0'}
}

interface RuntimeCompatibility {
  canStart: boolean
  missingRuntimes: string[]
  conflictingRuntimes: string[]
  versionMismatches: VersionMismatch[]
  lastChecked: Date
  issues: string[]
}

interface VersionMismatch {
  runtime: string
  required: string
  installed: string
  severity: 'error' | 'warning'
  recommendation: string
}

type ApplicationStatus =
  | 'draft'         // Created but not deployed
  | 'deploying'     // Deployment in progress
  | 'deployed'      // Deployed but not running
  | 'starting'      // Start sequence initiated
  | 'running'       // Active and serving requests
  | 'stopping'      // Shutdown sequence initiated
  | 'stopped'       // Cleanly stopped
  | 'error'         // Runtime error occurred
  | 'runtime-missing' // Required runtimes not available
  | 'failed'        // Failed to start or deploy
```

### 4. Deployment Configuration

```typescript
interface DeploymentConfig {
  sourceType: DeploymentSource
  sourceConfig: SourceConfig
  buildConfig?: BuildConfig
  deploymentPath: string        // Path within WebVM filesystem
  entryPoint: string           // 'index.js', 'app.py', 'package.json'
}

type DeploymentSource =
  | 'upload'        // Direct file upload
  | 'github'        // GitHub repository
  | 'url'           // Remote URL/ZIP
  | 'local-sync'    // Local folder synchronization

interface SourceConfig {
  // For upload
  files?: File[]

  // For GitHub
  repository?: string           // 'user/repo'
  branch?: string              // 'main'
  commit?: string              // Specific commit hash
  token?: string               // Access token

  // For URL
  url?: string

  // For local sync
  localPath?: string
  watchEnabled?: boolean
}

interface BuildConfig {
  enabled: boolean
  buildCommand: string          // 'npm run build'
  buildDirectory: string       // 'dist', 'build'
  environmentVars: Record<string, string>
  timeout: number              // Build timeout in seconds
}
```

### 5. Execution Configuration

```typescript
interface ExecutionConfig {
  command: string              // Startup command
  arguments: string[]          // Command arguments
  workingDirectory: string     // Working directory path

  // Network configuration
  port?: number               // Primary port for the application
  additionalPorts?: number[]  // Additional ports if needed

  // Environment
  environment: Record<string, string>
  secretEnvironment: Record<string, string> // Encrypted storage

  // Process management
  autoRestart: boolean
  restartPolicy: RestartPolicy
  healthCheckConfig?: HealthCheckConfig

  // Resource limits
  memoryLimit?: number        // MB
  cpuLimit?: number          // Percentage
  timeout?: number           // Startup timeout in seconds
}

type RestartPolicy =
  | 'never'         // Never restart automatically
  | 'on-failure'    // Restart only on non-zero exit
  | 'always'        // Always restart
  | 'unless-stopped' // Restart unless manually stopped

interface HealthCheckConfig {
  enabled: boolean
  path?: string              // HTTP health check path
  interval: number           // Check interval in seconds
  timeout: number           // Check timeout in seconds
  retries: number           // Failure threshold
  startPeriod: number       // Grace period before first check
}
```

### 6. Application Metrics

```typescript
interface ApplicationMetrics {
  // Resource usage
  memoryUsage: number         // Current MB
  cpuUsage: number           // Current percentage
  diskUsage: number          // Current MB

  // Network metrics
  requestCount: number       // Total requests served
  requestRate: number        // Requests per minute
  responseTime: number       // Average response time (ms)
  errorRate: number          // Error percentage

  // Uptime tracking
  startTime?: Date
  uptime: number             // Seconds
  restartCount: number

  // Logs and events
  lastError?: string
  lastHealthCheck?: Date
  healthStatus: 'healthy' | 'unhealthy' | 'unknown'

  // Historical data (limited retention)
  recentLogs: LogEntry[]
  performanceHistory: PerformanceSnapshot[]
}

interface LogEntry {
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  source: 'application' | 'system' | 'webvm'
  details?: Record<string, any>
}

interface PerformanceSnapshot {
  timestamp: Date
  memory: number
  cpu: number
  requests: number
  responseTime: number
}
```

## State Management Architecture

### 1. WebVM State Store

```typescript
interface WebVMStore {
  // Current WebVM state
  status: WebVMStatus

  // Package management
  availablePackages: RuntimePackage[]
  installedPackages: Record<string, RuntimePackage>
  packageOperations: PackageOperation[]

  // System monitoring
  systemLogs: LogEntry[]
  performanceMetrics: SystemPerformanceMetrics

  // Error handling
  lastError?: Error
  errorHistory: ErrorEvent[]
}

interface PackageOperation {
  id: string
  packageId: string
  operation: 'install' | 'remove' | 'update'
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime: Date
  endTime?: Date
  logs: string[]
  error?: string
}
```

### 2. Application State Store

```typescript
interface ApplicationStore {
  // Application registry
  applications: Record<string, Application>

  // Runtime dependency graph
  dependencyGraph: DependencyGraph

  // Active operations
  deployments: Record<string, DeploymentOperation>

  // Global settings
  settings: ApplicationServerSettings
}

interface DependencyGraph {
  // Which apps depend on which runtimes
  runtimeDependencies: Record<string, string[]> // runtime -> app[]

  // Which runtimes depend on other runtimes
  packageDependencies: Record<string, string[]> // package -> dependencies[]
}

interface DeploymentOperation {
  id: string
  applicationId: string
  status: 'preparing' | 'uploading' | 'building' | 'deploying' | 'completed' | 'failed'
  progress: number // 0-100
  logs: string[]
  startTime: Date
  endTime?: Date
  error?: string
}
```

### 3. Persistence Strategy

```typescript
interface PersistenceManager {
  // WebVM state persistence (leverages WebVM's built-in IndexedDB)
  saveWebVMState(state: WebVMStatus): Promise<void>
  loadWebVMState(): Promise<WebVMStatus | null>

  // Application configuration persistence
  saveApplicationConfig(appId: string, config: Application): Promise<void>
  loadApplicationConfig(appId: string): Promise<Application | null>
  listApplicationConfigs(): Promise<string[]>

  // Runtime package metadata persistence
  savePackageMetadata(packages: RuntimePackage[]): Promise<void>
  loadPackageMetadata(): Promise<RuntimePackage[]>

  // Settings and preferences
  saveSettings(settings: ApplicationServerSettings): Promise<void>
  loadSettings(): Promise<ApplicationServerSettings>

  // Export/Import functionality
  exportApplicationServer(): Promise<ApplicationServerBackup>
  importApplicationServer(backup: ApplicationServerBackup): Promise<void>
}

interface ApplicationServerBackup {
  version: string
  timestamp: Date
  webvmState: WebVMStatus
  applications: Application[]
  packages: RuntimePackage[]
  settings: ApplicationServerSettings
}
```

## Data Validation and Constraints

### Business Rules

1. **Application Names**: Must be unique, URL-safe, 3-50 characters
2. **Runtime Dependencies**: Must form a valid dependency graph (no cycles)
3. **Port Allocation**: Each app gets unique port assignment
4. **Resource Limits**: Total memory usage cannot exceed WebVM capacity
5. **Package Conflicts**: Conflicting packages cannot be installed simultaneously

### Data Integrity Constraints

```typescript
interface ValidationRules {
  // Application validation
  validateApplicationName(name: string): ValidationResult
  validateRuntimeRequirements(runtime: ApplicationRuntime): ValidationResult
  validateDeploymentConfig(config: DeploymentConfig): ValidationResult

  // Package validation
  validatePackageInstallation(packageId: string): ValidationResult
  validatePackageRemoval(packageId: string): ValidationResult

  // System validation
  validateSystemResources(): ValidationResult
  validateNetworkConfiguration(): ValidationResult
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  suggestions?: string[]
}
```

## Migration Strategy

### From Existing App Hosting

```typescript
interface AppHostingMigration {
  // Detect existing apps
  discoverExistingApps(): Promise<LegacyApp[]>

  // Convert to new format
  migrateApp(legacyApp: LegacyApp): Promise<Application>

  // Preserve data
  preserveAppData(appId: string): Promise<void>

  // Clean up old system
  cleanupLegacySystem(): Promise<void>
}

interface LegacyApp {
  name: string
  files: File[]
  deployedAt: Date
  lastUpdated: Date
}
```

## Performance Considerations

### Memory Management

- **Application Metadata**: ~1KB per application
- **Runtime Packages**: ~5KB metadata, variable package size
- **Logs**: Rolling buffer, max 1000 entries per app
- **Metrics**: 24-hour retention, 5-minute sampling

### Storage Requirements

- **Configuration Data**: ~10-50KB per project
- **Package Metadata**: ~1-5MB total
- **WebVM State**: Managed by WebVM's built-in persistence
- **Backup Data**: Variable based on deployed applications

This data model provides a comprehensive foundation for implementing the Application Server feature while maintaining performance, reliability, and extensibility.