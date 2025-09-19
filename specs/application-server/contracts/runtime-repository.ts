/**
 * Runtime Repository Contract
 *
 * Defines the interface for managing offline runtime packages,
 * dependency resolution, and package installation within WebVM.
 */

export interface RuntimeRepository {
  // Package Discovery
  getAvailablePackages(): Promise<RuntimePackage[]>
  getInstalledPackages(): Promise<RuntimePackage[]>
  getPackageInfo(packageId: string): Promise<RuntimePackage | null>
  searchPackages(query: string): Promise<RuntimePackage[]>

  // Dependency Management
  resolveDependencies(packageId: string): Promise<string[]>
  checkConflicts(packageId: string): Promise<ConflictCheck[]>
  validateInstallation(packageId: string): Promise<ValidationResult>
  validateRemoval(packageId: string): Promise<ValidationResult>

  // Package Operations
  installPackage(packageId: string, options?: InstallOptions): Promise<InstallResult>
  removePackage(packageId: string, options?: RemoveOptions): Promise<RemoveResult>
  updatePackageMetadata(packageId: string, metadata: Partial<RuntimePackage>): Promise<void>

  // Repository Management
  refreshRepository(): Promise<void>
  getRepositoryMetadata(): Promise<RepositoryMetadata>
  validateRepositoryIntegrity(): Promise<IntegrityCheck>

  // Event Handling
  onPackageInstalled(callback: (packageId: string) => void): () => void
  onPackageRemoved(callback: (packageId: string) => void): () => void
  onRepositoryUpdated(callback: () => void): () => void
}

export interface RuntimePackage {
  id: string                    // 'nodejs-20', 'python-311', 'nginx'
  name: string                  // 'Node.js 20.x LTS'
  description: string
  category: RuntimeCategory
  version: string
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

  // URLs and sources
  sourceUrl?: string           // Where the package was sourced from
  documentationUrl?: string    // Link to documentation
  homepageUrl?: string        // Project homepage

  // Timing and history
  installDate?: Date
  lastUsed?: Date
  installDuration?: number      // Milliseconds
}

export type RuntimeCategory =
  | 'web-server'    // nginx, apache
  | 'runtime'       // nodejs, python, deno
  | 'framework'     // nextjs, express, flask
  | 'database'      // postgresql, sqlite
  | 'tool'          // git, curl, development tools

export type PackageStatus =
  | 'available'     // Ready for installation
  | 'downloading'   // Package files being transferred
  | 'installing'    // Installation in progress
  | 'installed'     // Successfully installed and ready
  | 'updating'      // Package being updated
  | 'removing'      // Removal in progress
  | 'error'         // Installation/removal failed

export interface ConflictCheck {
  type: 'port' | 'file' | 'service' | 'dependency'
  severity: 'error' | 'warning'
  conflictingPackage: string
  description: string
  resolution?: string
  autoResolvable: boolean
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  suggestions?: string[]
  requiredActions?: RequiredAction[]
}

export interface RequiredAction {
  type: 'install_dependency' | 'remove_conflict' | 'configure_service' | 'allocate_port'
  description: string
  packageId?: string
  automatic: boolean
}

export interface InstallOptions {
  force?: boolean               // Override conflict warnings
  skipDependencies?: boolean    // Don't install dependencies
  enableServices?: boolean      // Auto-enable systemd services
  timeout?: number             // Installation timeout in seconds
  dryRun?: boolean             // Validate without installing
}

export interface RemoveOptions {
  force?: boolean               // Remove even if apps depend on it
  removeUnused?: boolean        // Remove unused dependencies
  disableServices?: boolean     // Disable services before removal
  backup?: boolean             // Create backup before removal
  dryRun?: boolean             // Validate without removing
}

export interface InstallResult {
  success: boolean
  packageId: string
  installedPackages: string[]   // Including dependencies
  skippedPackages: string[]     // Already installed
  warnings: string[]
  logs: string[]
  timeElapsed: number
  diskSpaceUsed: number        // MB
  servicesStarted: string[]
  error?: InstallError
}

export interface RemoveResult {
  success: boolean
  packageId: string
  removedPackages: string[]
  keptPackages: string[]       // Dependencies kept for other packages
  affectedApps: string[]       // Apps that may be impacted
  warnings: string[]
  logs: string[]
  timeElapsed: number
  diskSpaceFreed: number       // MB
  servicesStopped: string[]
  error?: RemoveError
}

export interface InstallError {
  code: 'DEPENDENCY_FAILED' | 'CONFLICT_DETECTED' | 'INSUFFICIENT_SPACE' | 'PACKAGE_CORRUPTED' | 'TIMEOUT'
  message: string
  failedPackage?: string
  details?: Record<string, any>
}

export interface RemoveError {
  code: 'DEPENDENCY_VIOLATION' | 'SERVICE_STOP_FAILED' | 'FILE_ACCESS_ERROR' | 'TIMEOUT'
  message: string
  blockedBy?: string[]
  details?: Record<string, any>
}

export interface RepositoryMetadata {
  version: string
  lastUpdated: Date
  totalPackages: number
  totalSize: number            // MB
  categories: Record<RuntimeCategory, number>
  integrity: 'valid' | 'corrupted' | 'unknown'
}

export interface IntegrityCheck {
  valid: boolean
  checkedPackages: number
  corruptedPackages: string[]
  missingFiles: string[]
  checksumMismatches: string[]
  recommendations: string[]
}

/**
 * Offline Package Repository
 *
 * Manages the offline package storage and retrieval within the browser
 */
export interface OfflineRepository {
  // Package Storage
  storePackage(packageId: string, packageData: PackageData): Promise<void>
  retrievePackage(packageId: string): Promise<PackageData | null>
  removePackage(packageId: string): Promise<void>
  listStoredPackages(): Promise<string[]>

  // Package Transfer
  transferToWebVM(packageId: string): Promise<void>
  verifyPackageIntegrity(packageId: string): Promise<boolean>

  // Storage Management
  getStorageUsage(): Promise<StorageInfo>
  cleanupStorage(): Promise<void>
  optimizeStorage(): Promise<void>
}

export interface PackageData {
  metadata: RuntimePackage
  debFiles: ArrayBuffer[]       // .deb package files
  checksums: Record<string, string>
  manifest: PackageManifest
}

export interface PackageManifest {
  files: FileDescriptor[]
  dependencies: DependencyInfo[]
  services: ServiceDescriptor[]
  ports: PortRequirement[]
  postInstallSteps: InstallStep[]
}

export interface FileDescriptor {
  path: string
  size: number
  checksum: string
  permissions: string
  type: 'binary' | 'config' | 'script' | 'data'
}

export interface DependencyInfo {
  packageId: string
  version: string
  type: 'required' | 'optional' | 'recommended'
  reason: string
}

export interface ServiceDescriptor {
  name: string
  type: 'systemd' | 'init' | 'manual'
  autoStart: boolean
  dependencies: string[]
  ports: number[]
}

export interface PortRequirement {
  port: number
  protocol: 'tcp' | 'udp'
  service: string
  configurable: boolean
  defaultAlternatives: number[]
}

export interface InstallStep {
  order: number
  command: string
  description: string
  required: boolean
  timeout: number
}

export interface StorageInfo {
  totalUsed: number            // MB
  totalAvailable: number       // MB
  packageCount: number
  oldestPackage?: Date
  largestPackage?: string
}

/**
 * Package Installer
 *
 * Handles the actual installation and removal of packages within WebVM
 */
export interface PackageInstaller {
  // Core Installation
  install(packageId: string, packageData: PackageData, options?: InstallOptions): Promise<InstallResult>
  remove(packageId: string, options?: RemoveOptions): Promise<RemoveResult>

  // Installation Steps
  transferPackages(packageId: string): Promise<void>
  installPackages(packageId: string): Promise<void>
  configureServices(packageId: string): Promise<void>
  runPostInstallScripts(packageId: string): Promise<void>

  // Validation
  validatePrerequisites(packageId: string): Promise<ValidationResult>
  validatePostInstallation(packageId: string): Promise<ValidationResult>

  // Monitoring
  getInstallationProgress(packageId: string): Promise<InstallationProgress>
  cancelInstallation(packageId: string): Promise<void>
}

export interface InstallationProgress {
  packageId: string
  phase: 'transferring' | 'installing' | 'configuring' | 'validating' | 'complete'
  progress: number             // 0-100
  currentStep: string
  timeElapsed: number
  estimatedTimeRemaining?: number
  logs: string[]
}