# Application Server Feature Specification

## Executive Summary

Replace the existing "App Hosting" feature with a comprehensive Application Server that provides multiple runtime environments for hosting full-stack applications. This will use browser-based virtualization technologies to run Node.js, Python, static sites, and potentially Edge Functions entirely within the browser.

## Background & Current State

### Existing App Hosting Limitations
- Only supports static file hosting
- Limited to simple HTML/CSS/JS files
- No server-side processing capabilities
- No runtime environment management

### Files to Remove/Replace
- `src/components/app-hosting/AppHosting.tsx`
- `src/components/app-hosting/AppDeploymentModal.tsx`
- `src/components/app-hosting/SampleAppInstaller.tsx`
- Related MSW handlers in `src/mocks/handlers/app.ts`
- VFS SPA handling in `src/lib/vfs/VFSBridge.ts`

## Technical Architecture

### 1. WebVM 2.0 Virtual Machine

#### Core Technology: WebVM 2.0
- **What**: Complete Linux environment running in browser via WebAssembly/CheerpX
- **Architecture**: Full x86 virtualization engine with Linux syscall emulation
- **Capabilities**: Real Linux OS with package managers (apt, npm, pip, etc.)
- **File System**: Virtual block-based file system with IndexedDB persistence
- **Networking**: Integrated networking support via WebSocket transport
- **Licensing**: Open source, no licensing concerns

#### Supported Runtime Environments
All runtimes run as native Linux applications within the WebVM:

1. **Static Web Server** - nginx or simple HTTP server
2. **Node.js** - Full Node.js with npm package ecosystem
3. **Next.js** - Complete Next.js framework with build tools
4. **Python** - Full Python with pip, Flask, FastAPI, Django
5. **Edge Functions** - Custom Deno-compatible runtime (future)

#### WebVM Integration Benefits
- **Universal Runtime Support**: Any Linux software can be pre-installed
- **Real Process Isolation**: True Linux processes, not browser limitations
- **Persistent File System**: Changes survive browser restarts via IndexedDB
- **No Browser API Constraints**: Full server capabilities

#### ⚠️ Critical Networking Limitations
**By default, WebVM instances have NO internet access.** This is a fundamental constraint that affects the entire architecture:

- **Default State**: WebVM runs completely offline
- **Optional Internet**: Users can manually install Tailscale on their system and provide API keys for internet access
- **Design Implication**: We CANNOT rely on `apt install`, `npm install`, or `pip install` during runtime
- **Solution Required**: All runtimes must be pre-bundled into custom WebVM disk images

### 2. Single Runtime Environment Strategy

#### Performance Requirements
- MUST NOT impact main application startup time
- WebVM loaded only when user first accesses Application Server
- Progressive loading with clear user feedback
- Single runtime environment per WebVM instance

#### Environment Selection & WebVM Loading
```typescript
interface WebVMManager {
  selectEnvironment(environment: RuntimeEnvironment): Promise<void>
  initialize(environment: RuntimeEnvironment): Promise<void>
  isRunning(): boolean
  deployApp(config: AppConfig): Promise<void>
  getStatus(): WebVMStatus
}

interface WebVMStatus {
  state: 'unloaded' | 'selecting' | 'loading' | 'booting' | 'ready' | 'error'
  loadProgress: number
  currentEnvironment?: RuntimeEnvironment
  runningApps: ApplicationInstance[]
}

type RuntimeEnvironment = 'static' | 'nodejs' | 'nextjs' | 'python' | 'edge-functions'
```

#### Loading States
- **Unloaded**: WebVM not yet downloaded, user must select environment
- **Selecting**: User choosing runtime environment
- **Loading**: WebVM + runtime environment downloading (~100-200MB)
- **Booting**: Linux kernel and runtime environment starting up
- **Ready**: WebVM ready for application deployment in selected environment
- **Error**: WebVM or runtime environment failed to load

### 3. Pre-Built Runtime Environment Strategy

#### ⚠️ Simplified Offline-First Architecture
Since WebVM has no internet access by default, we create complete pre-built disk images for each runtime environment.

#### Single Runtime Environment Philosophy
**Key Requirement**: Users select one runtime environment per WebVM instance:

- **Choose Environment First**: User selects runtime environment before WebVM loads
- **Complete Environment**: Each disk image contains everything needed for that environment
- **Single Focus**: One environment per WebVM instance (static OR Node.js OR Next.js OR Python)
- **Restart to Switch**: To change environments, user must restart WebVM with different disk image

#### Pre-Built Environment Repository
We'll bundle complete disk images for each runtime environment:

```typescript
interface RuntimeEnvironment {
  id: string                    // 'static', 'nodejs', 'nextjs', 'python'
  name: string                  // 'Static Web Server', 'Node.js Runtime'
  description: string           // Human readable description
  version: string               // Environment version
  diskImageUrl: string          // URL to download disk image
  diskImageSize: number         // Size in MB
  capabilities: string[]        // ['nginx', 'nodejs-20', 'npm', 'git']
  ports: number[]               // Default ports this environment uses
  status: 'available' | 'downloading' | 'loaded' | 'error'
  loadTime: number             // Estimated load time in seconds
}

interface EnvironmentRepository {
  getAvailableEnvironments(): RuntimeEnvironment[]
  getCurrentEnvironment(): RuntimeEnvironment | null
  canSwitchTo(environmentId: string): { success: boolean, warnings: string[] }
  loadEnvironment(environmentId: string): Promise<LoadResult>
}
```

#### Pre-Built Disk Image Strategy
Create complete environments as single disk images:

1. **Static Environment** - Ubuntu + nginx for static sites
2. **Node.js Environment** - Ubuntu + nginx + Node.js 20 + npm
3. **Next.js Environment** - Ubuntu + nginx + Node.js 20 + Next.js CLI tools
4. **Python Environment** - Ubuntu + nginx + Python 3.11 + pip + common packages
5. **Edge Functions Environment** - Ubuntu + nginx + Deno runtime (future)

#### Environment Disk Image Creation Process
Create complete environments during build time:

```bash
# Build process for creating environment disk images (during our app build)

# Static Environment
FROM i386/ubuntu:22.04 as static-env
RUN apt-get update && apt-get install -y nginx git curl
RUN systemctl enable nginx
# Export as disk image: static-environment.img

# Node.js Environment
FROM i386/ubuntu:22.04 as nodejs-env
RUN apt-get update && apt-get install -y nginx git curl
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
RUN apt-get install -y nodejs npm
RUN systemctl enable nginx
# Export as disk image: nodejs-environment.img

# Next.js Environment
FROM nodejs-env as nextjs-env
RUN npm install -g next@latest create-next-app@latest
# Export as disk image: nextjs-environment.img

# Python Environment
FROM i386/ubuntu:22.04 as python-env
RUN apt-get update && apt-get install -y nginx git curl python3 python3-pip
RUN pip3 install flask fastapi django gunicorn
RUN systemctl enable nginx
# Export as disk image: python-environment.img
```

#### Environment Loading Implementation
```typescript
interface EnvironmentLoader {
  // Load a complete environment disk image
  async loadEnvironment(environmentId: string): Promise<LoadResult> {
    const environment = this.getEnvironment(environmentId)

    // 1. Download disk image if not cached
    if (!this.isCached(environment.diskImageUrl)) {
      await this.downloadDiskImage(environment)
    }

    // 2. Initialize WebVM with the disk image
    await this.webvm.loadDiskImage(environment.diskImageUrl)

    // 3. Boot WebVM with the loaded environment
    await this.webvm.boot()

    // 4. Verify environment is ready
    return await this.verifyEnvironment(environmentId)
  }

  // Verify environment loaded correctly
  async verifyEnvironment(environmentId: string): Promise<LoadResult> {
    const environment = this.getEnvironment(environmentId)
    const verificationTests = []

    // Test basic services
    if (environment.capabilities.includes('nginx')) {
      verificationTests.push(this.testNginx())
    }

    if (environment.capabilities.includes('nodejs')) {
      verificationTests.push(this.testNodeJS())
    }

    const results = await Promise.all(verificationTests)

    return {
      success: results.every(r => r.success),
      environment: environmentId,
      capabilities: environment.capabilities,
      readyServices: results.filter(r => r.success).map(r => r.service),
      errors: results.filter(r => !r.success).map(r => r.error)
    }
  }
}
```

### 4. Environment Management Enhancements

#### Background Preloading Strategy
To minimize user wait times, implement intelligent background preloading of popular environments:

```typescript
interface EnvironmentPreloader {
  // Preload environments based on usage patterns
  preloadPopularEnvironments(): Promise<void>

  // Background download with priority
  preloadEnvironment(environmentId: string, priority: 'high' | 'medium' | 'low'): Promise<void>

  // Check preload status
  getPreloadStatus(environmentId: string): PreloadStatus

  // Cancel ongoing preloads
  cancelPreload(environmentId: string): void
}

interface PreloadStatus {
  environmentId: string
  status: 'queued' | 'downloading' | 'cached' | 'failed'
  progress: number  // 0-100
  estimatedTimeRemaining: number  // seconds
  downloadSpeed: number  // bytes/sec
}

// Usage analytics for intelligent preloading
interface EnvironmentUsageAnalytics {
  mostUsedEnvironment(): string
  popularEnvironments(): string[]
  userEnvironmentHistory(): EnvironmentUsageRecord[]
  predictNextEnvironment(): string | null
}
```

#### Preloading Implementation Strategy
1. **Smart Defaults**: Automatically queue Node.js environment for preloading (most popular)
2. **Usage Learning**: Track which environments users access and preload accordingly
3. **Bandwidth Awareness**: Adjust preload speed based on connection quality
4. **Storage Limits**: Respect IndexedDB quotas and user preferences

#### Environment Auto-Update System
Implement secure, non-disruptive updates for pre-built disk images:

```typescript
interface EnvironmentUpdateManager {
  // Check for updates
  checkForUpdates(): Promise<EnvironmentUpdate[]>

  // Download updated environment
  downloadUpdate(environmentId: string, version: string): Promise<void>

  // Apply update with migration
  applyUpdate(environmentId: string, options: UpdateOptions): Promise<UpdateResult>

  // Rollback to previous version
  rollbackUpdate(environmentId: string): Promise<void>
}

interface EnvironmentUpdate {
  environmentId: string
  currentVersion: string
  availableVersion: string
  updateType: 'security' | 'feature' | 'bugfix'
  severity: 'critical' | 'important' | 'optional'
  releaseNotes: string
  downloadSize: number
  migrationRequired: boolean
}

interface UpdateOptions {
  migrateUserData: boolean
  preserveRunningApps: boolean
  createBackup: boolean
  scheduleUpdate?: Date  // For deferred updates
}
```

#### Update Strategy Implementation
1. **Version Manifests**: Centralized manifest file listing available versions
2. **Incremental Updates**: Delta downloads for minor updates to reduce bandwidth
3. **Zero-Downtime Migration**: Maintain running apps during environment updates
4. **User Control**: Allow users to defer non-critical updates
5. **Automatic Rollback**: Detect failed updates and auto-rollback

#### Storage Management & Cleanup
Provide comprehensive disk space management for IndexedDB limitations:

```typescript
interface StorageManager {
  // Storage usage analytics
  getStorageUsage(): StorageUsageReport

  // Environment management
  deleteEnvironment(environmentId: string): Promise<void>
  clearEnvironmentCache(environmentId: string): Promise<void>

  // Cleanup operations
  cleanupOrphanedData(): Promise<CleanupResult>
  optimizeStorage(): Promise<OptimizationResult>

  // Quota management
  checkQuotaLimits(): QuotaStatus
  requestQuotaIncrease(): Promise<boolean>
}

interface StorageUsageReport {
  totalUsed: number
  totalAvailable: number
  environments: {
    [environmentId: string]: {
      diskImageSize: number
      userDataSize: number
      cacheSize: number
      lastAccessed: Date
    }
  }
  recommendations: StorageRecommendation[]
}

interface StorageRecommendation {
  type: 'delete_unused' | 'clear_cache' | 'optimize_data'
  environmentId?: string
  potentialSavings: number
  description: string
  action: () => Promise<void>
}
```

#### Storage Management Features
1. **Visual Usage Dashboard**: Clear breakdown of disk usage by environment
2. **Intelligent Cleanup**: Suggest removal of unused environments and old caches
3. **Compression Optimization**: Re-compress user data and caches for space savings
4. **Quota Monitoring**: Proactive warnings before hitting IndexedDB limits
5. **Export Before Delete**: Automatic backup creation before environment deletion

### 5. Application Management

#### Simplified Application Model
```typescript
interface Application {
  id: string                    // Auto-generated UUID
  name: string                  // User-defined, used for routing
  description?: string          // User-defined description

  // Environment compatibility
  compatibleEnvironments: RuntimeEnvironment[]  // Which environments can run this app
  preferredEnvironment: RuntimeEnvironment      // Best environment for this app

  status: AppStatus             // 'stopped' | 'starting' | 'running' | 'error' | 'sleeping'
  createdAt: Date
  lastDeployed: Date
  lastStarted?: Date

  // Deployment info
  sourceType: 'upload' | 'url' | 'github'
  sourceConfig: SourceConfig

  // Runtime configuration
  entryPoint: string            // 'index.js', 'app.py', 'package.json', 'index.html'
  environment: Record<string, string>  // Environment variables
  port?: number                 // For server apps (optional, auto-assigned if not specified)

  // Metrics
  memoryUsage?: number          // MB
  cpuUsage?: number            // Percentage
  requestCount?: number
  lastError?: string
}

type AppStatus = 'stopped' | 'starting' | 'running' | 'error' | 'sleeping'

interface SourceConfig {
  // For upload
  files?: FileList

  // For URL/GitHub
  url?: string
  branch?: string
  token?: string
}
```

#### Deployment Sources
1. **Folder Upload**: Drag-and-drop or file picker
2. **Remote URL**: Download and extract ZIP files
3. **GitHub Repository**: Clone specific branch/commit
4. **Local Folder Sync**: Watch local folder for changes (File System Access API)

### 5. Routing & Request Handling

#### URL Structure
- **Application URLs**: `https://supabase-lite.com/app/[app-name]/**`
- **Management URLs**: `https://supabase-lite.com/application-server`

#### MSW Integration with WebVM
```typescript
// Replace existing app handlers
const applicationHandlers = [
  // Application Server management UI
  http.get('/application-server', applicationServerHandler),

  // Runtime requests to user applications via WebVM
  http.all('/app/:appName/*', withProjectResolution(createWebVMHandler())),
  http.all('/:projectId/app/:appName/*', withProjectResolution(createWebVMHandler())),
]

async function createWebVMHandler() {
  // 1. Resolve app name from URL
  // 2. Find application in WebVM file system
  // 3. Ensure WebVM and app runtime are started
  // 4. Forward request to WebVM application server
  // 5. Return response with proper headers
}
```

#### Request Flow via WebVM
1. Browser request: `/app/my-todo-app/api/todos`
2. MSW intercepts and routes to `createWebVMHandler`
3. Handler identifies app "my-todo-app"
4. Handler ensures WebVM is running and app is started
5. Handler forwards request to WebVM internal network
6. WebVM processes request (nginx proxy to Node.js/Python server)
7. Response returned through WebVM network stack to browser

#### Advanced Routing Features
- **WebSocket Support**: Proxy WebSocket connections through WebVM network
- **Authentication**: Inject Supabase auth headers automatically
- **CORS**: Handle cross-origin requests properly
- **Static Assets**: Efficient serving through nginx within WebVM
- **API Routing**: Full REST endpoint support via WebVM applications

### 5. Persistence & State Management

#### ⚠️ Simplified Persistence Requirements
All user data and configuration must survive browser restarts and page refreshes with the current environment:

#### Application Data Persistence
- **User Applications**: All deployed app code, data, and files in current environment
- **Environment Selection**: Remember which environment was last loaded
- **Application State**: Database files, uploaded content, user-generated data
- **Process State**: Running services for apps in current environment

#### WebVM Built-in Persistence
WebVM provides automatic persistence via IndexedDB for:
- **Disk Image State**: File system modifications saved incrementally
- **User Files**: All files created/modified in current environment persist automatically

#### Additional Persistence Needs
```typescript
interface PersistenceManager {
  // Environment persistence
  saveCurrentEnvironment(environmentId: string): void
  loadCurrentEnvironment(): string | null

  // Application settings persistence
  saveAppSettings(appId: string, settings: AppSettings): void
  loadAppSettings(appId: string): AppSettings

  // Environment variables persistence
  saveEnvironmentVars(appId: string, vars: Record<string, string>): void
  loadEnvironmentVars(appId: string): Record<string, string>

  // Service state persistence
  saveServiceState(appId: string, state: ServiceState): void
  loadServiceState(appId: string): ServiceState
}

interface AppSettings {
  autoStart: boolean
  port: number
  memoryLimit: number
  logLevel: string
  backupEnabled: boolean
}
```

#### Persistence Implementation Strategy
- **WebVM Auto-Persistence**: Leverage built-in IndexedDB file system persistence
- **Environment Memory**: Remember last selected environment in localStorage
- **Configuration Storage**: Store app configs in browser localStorage/IndexedDB
- **State Restoration**: Automatically restart configured apps when environment loads
- **Data Backup**: Optional export/import functionality for current environment

#### What Must Be Solved
1. **Environment Restoration**: Automatically load last used environment on restart
2. **Service Auto-Start**: Apps must restart automatically when environment boots
3. **Configuration Preservation**: App settings persist within environment
4. **Environment Variables**: Custom env vars maintained per application
5. **Process Management**: Background services resume after environment restart
6. **Data Integrity**: User data protected against corruption or loss

#### Advanced Backup & Restore System

##### Incremental Backup Strategy
Implement sophisticated backup system to handle large environment data efficiently:

```typescript
interface BackupManager {
  // Incremental backup operations
  createIncrementalBackup(environmentId: string): Promise<IncrementalBackup>

  // Full backup operations
  createFullBackup(environmentId: string, options: BackupOptions): Promise<FullBackup>

  // Restore operations
  restoreFromBackup(backupId: string, options: RestoreOptions): Promise<RestoreResult>

  // Backup management
  listBackups(environmentId?: string): BackupMetadata[]
  deleteBackup(backupId: string): Promise<void>
  verifyBackupIntegrity(backupId: string): Promise<IntegrityResult>
}

interface IncrementalBackup {
  id: string
  environmentId: string
  timestamp: Date
  type: 'incremental' | 'full'
  baseBackupId?: string  // For incremental backups
  size: number
  changes: BackupChange[]
  checksum: string
}

interface BackupChange {
  type: 'file_added' | 'file_modified' | 'file_deleted' | 'app_config'
  path: string
  content?: ArrayBuffer  // For new/modified files
  metadata: ChangeMetadata
}

interface BackupOptions {
  includeEnvironmentCache: boolean
  includeApplicationLogs: boolean
  compression: 'none' | 'gzip' | 'lz4'
  encryption: boolean
  description?: string
}
```

##### Conflict Resolution System
Handle conflicts when restoring backups with different environment states:

```typescript
interface ConflictResolver {
  // Detect conflicts during restore
  detectConflicts(backup: BackupMetadata, currentState: EnvironmentState): ConflictReport

  // Resolve conflicts with user choices
  resolveConflicts(conflicts: Conflict[], resolutions: ConflictResolution[]): Promise<void>

  // Auto-resolution strategies
  autoResolveConflicts(conflicts: Conflict[], strategy: AutoResolveStrategy): ConflictResolution[]
}

interface Conflict {
  type: 'environment_version_mismatch' | 'app_already_exists' | 'file_collision' | 'config_conflict'
  path: string
  description: string
  currentValue: any
  backupValue: any
  severity: 'low' | 'medium' | 'high'
  suggestedResolution: ConflictResolution
}

interface ConflictResolution {
  conflictId: string
  action: 'keep_current' | 'use_backup' | 'merge' | 'rename' | 'skip'
  customValue?: any
}

type AutoResolveStrategy = 'prefer_current' | 'prefer_backup' | 'interactive' | 'safe_merge'
```

##### Backup UI and User Experience
```
┌─────────────────────────────────────────────────────────────┐
│ 💾 Backup & Restore Manager                         [✕]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📊 Current Environment: Node.js (127MB user data)          │
│                                                             │
│ 🔄 Recent Backups:                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📅 2024-01-15 14:30  Full Backup     [45MB] [Restore]  │ │
│ │ 📅 2024-01-15 16:45  Incremental     [2.3MB] [Restore] │ │
│ │ 📅 2024-01-15 18:20  Incremental     [1.1MB] [Restore] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 🛠️ Backup Actions:                                          │
│ [💾 Create Full Backup] [⚡ Create Incremental Backup]     │
│                                                             │
│ ⚙️ Backup Settings:                                         │
│ [✓] Include application logs        [✓] Compress backup    │
│ [✓] Include environment cache       [ ] Encrypt backup     │
│                                                             │
│ 📤 Export/Import:                                           │
│ [📤 Export Backup] [📥 Import Backup] [☁️ Cloud Sync]      │
│                                                             │
│ 🔍 Backup Details: backup_20240115_1430                    │
│ • Environment: Node.js v20.11.0                            │
│ • Applications: 3 apps (my-api, dashboard, portfolio)      │
│ • Size: 45.2MB (compressed from 127MB)                     │
│ • Integrity: ✅ Verified                                   │
│                                                             │
│                                    [Close] [Create Backup] │
└─────────────────────────────────────────────────────────────┘
```

##### Backup Storage Architecture
```typescript
interface BackupStorage {
  // Local storage (IndexedDB)
  storeBackupLocally(backup: BackupData): Promise<string>

  // Export to file
  exportBackupToFile(backupId: string): Promise<Blob>

  // Import from file
  importBackupFromFile(file: File): Promise<BackupMetadata>

  // Cloud storage integration (optional)
  syncToCloud(backupId: string, provider: CloudProvider): Promise<void>

  // Backup verification
  verifyBackupChain(environmentId: string): BackupChainStatus
}

interface BackupChainStatus {
  isValid: boolean
  missingBackups: string[]
  corruptedBackups: string[]
  recommendations: string[]
}
```

##### Automatic Backup Policies
```typescript
interface AutoBackupPolicy {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'on_environment_switch' | 'on_app_deploy'
  retentionPolicy: {
    keepDaily: number      // Keep last N daily backups
    keepWeekly: number     // Keep last N weekly backups
    keepMonthly: number    // Keep last N monthly backups
  }
  maxBackupSize: number    // Maximum backup size in MB
  incrementalThreshold: number  // Size threshold for incremental vs full
}
```

### 6. User Interface Design

#### Enhanced UI/UX Features

##### Environment Switch Warning Dialog
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Switch Runtime Environment                        [✕]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ You are about to switch from Node.js to Python environment │
│                                                             │
│ ⚠️ This action will:                                        │
│   • Stop all currently running applications (3 apps)      │
│   • Restart WebVM with Python environment                  │
│   • Cause temporary downtime (~30 seconds)                 │
│                                                             │
│ 💾 Before switching:                                        │
│   ✅ User data will be preserved automatically             │
│   ✅ Environment configurations will be saved              │
│   ⚠️ Unsaved application logs may be lost                  │
│                                                             │
│ Running applications that will be stopped:                 │
│ • my-api-server (Node.js) - 23 active requests            │
│ • admin-dashboard (Node.js) - 5 active requests           │
│ • portfolio-site (Static) - 0 active requests             │
│                                                             │
│ [ ] Create backup before switching                         │
│ [ ] Download current environment logs                      │
│                                                             │
│                [Cancel] [Continue with Environment Switch] │
└─────────────────────────────────────────────────────────────┘
```

##### App Compatibility Filtering in Deploy Modal
```
┌─────────────────────────────────────────────────────────────┐
│ Deploy New Application to Node.js Environment       [✕]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🎯 App Type Detection: Node.js Application (Detected)      │
│ ✅ Compatible with current Node.js Environment             │
│                                                             │
│ Detected files: package.json, index.js, /src               │
│ Framework: Express.js (auto-detected)                      │
│ Entry point: index.js (from package.json)                  │
│                                                             │
│ ❌ Incompatible Apps (Hidden):                             │
│    Requirements.txt detected but Python not available      │
│    Use [Switch to Python Environment] to deploy Python apps│
│                                                             │
│ App Name: [my-express-api   ] (used in URL)                │
│ Description: [REST API...   ] (optional)                   │
│                                                             │
│ Recommended Configuration for Express.js:                  │
│ Port: [3000] (auto-detected from package.json)             │
│ Start Command: [npm start] (from package.json)             │
│                                                             │
│ Environment Variables:                                      │
│ NODE_ENV: [production] [Remove]                             │
│ [+ Add Variable]                                            │
│                                                             │
│                           [Cancel] [Deploy Application]     │
└─────────────────────────────────────────────────────────────┘
```

##### Environment Status Indicators Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│ 🖥️  Application Server (Node.js Environment)   [+ Deploy App] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📊 Environment Health & Performance:                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🟢 Node.js 20.11.0 + nginx     Status: Healthy        │ │
│ │                                                         │ │
│ │ Memory:  [████████░░] 85MB/150MB (57%)                 │ │
│ │ CPU:     [███░░░░░░░] 23% avg (last 5min)               │ │
│ │ Storage: [██░░░░░░░░] 127MB/500MB (25%)                 │ │
│ │ Network: [████░░░░░░] 12 req/sec                        │ │
│ │                                                         │ │
│ │ Uptime: 2h 34m  •  Last restart: Manual switch         │ │
│ │ Load Average: 0.24, 0.18, 0.15                         │ │
│ │                                                         │ │
│ │ [📊 Detailed Metrics] [🔄 Restart Environment]         │ │
│ │ [⚙️ Environment Settings] [🔄 Switch Environment]       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 🚨 Alerts & Recommendations:                               │
│ • Memory usage approaching limit - consider restarting apps│
│ • Node.js security update available (v20.11.1)            │
│                                                             │
│ 📱 Applications (3 running):                               │
│ [Applications list continues...]                            │
└─────────────────────────────────────────────────────────────┘
```

##### Error Recovery Interface
```
┌─────────────────────────────────────────────────────────────┐
│ ❌ Environment Loading Failed                        [✕]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Failed to load Python Environment (v3.11.2)                │
│                                                             │
│ 🔍 Error Details:                                           │
│ • Disk image download failed after 3 attempts             │
│ • Network timeout during environment verification          │
│ • Error Code: ENV_LOAD_TIMEOUT_001                         │
│                                                             │
│ 🛠️ Suggested Actions:                                       │
│                                                             │
│ 1. [🔄 Retry Loading] Try loading the environment again    │
│                                                             │
│ 2. [🗑️ Clear Cache] Clear cached environment data          │
│    This will force a fresh download (~130MB)               │
│                                                             │
│ 3. [🔄 Switch Environment] Load a different environment     │
│    Try Node.js or Static environment instead               │
│                                                             │
│ 4. [📋 Copy Error Details] Copy technical details          │
│    For troubleshooting or support                          │
│                                                             │
│ 5. [📶 Check Connection] Test network connectivity          │
│    Verify internet connection and retry                    │
│                                                             │
│ 🏥 Recovery Mode:                                           │
│ [🔧 Advanced Recovery] [📊 Environment Diagnostics]        │
│                                                             │
│                           [Close] [Contact Support]        │
└─────────────────────────────────────────────────────────────┘
```

#### Main Application Server Page (No Environment Loaded)
```
┌─────────────────────────────────────────────────────────────┐
│ 🖥️  Application Server                    [Select Environment] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ⚠️ No Runtime Environment Loaded                           │
│                                                             │
│ To deploy and run applications, you must first select and   │
│ load a runtime environment. Each environment provides       │
│ specific capabilities for different types of applications.  │
│                                                             │
│ 🎯 Available Runtime Environments:                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🌐 Static Web Server (nginx only)        ~85MB  [Load]  │ │
│ │    Perfect for: HTML, CSS, JS, static sites              │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 🟢 Node.js Runtime (nginx + Node.js 20)  ~140MB  [Load]  │ │
│ │    Perfect for: Express, APIs, full-stack Node.js apps   │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ⚡ Next.js Environment (Node.js + Next.js) ~160MB  [Load]  │ │
│ │    Perfect for: Next.js apps, React SSR, full-stack     │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 🐍 Python Environment (nginx + Python 3.11) ~130MB  [Load]  │ │
│ │    Perfect for: Flask, FastAPI, Django, data science     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ⚠️ Note: You can only run one environment at a time.        │
│ All apps will be deployed to the selected environment.     │
└─────────────────────────────────────────────────────────────┘
```

#### Main Application Server Page (Environment Loaded)
```
┌─────────────────────────────────────────────────────────────┐
│ 🖥️  Application Server (Node.js Environment)   [+ Deploy App] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📊 Environment Status:                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🟢 Node.js 20.11.0 + nginx    3 Apps Running    140MB   │ │
│ │ Capabilities: nginx, Node.js, npm, git                 │ │
│ │ [Switch Environment] [Environment Settings]            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 📱 Applications in Node.js Environment:                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🟢 my-api-server      Express API    Port 3001 [●●●] [⚙️] │ │
│ │    Running • 8MB • 23 requests/min                       │ │
│ │    https://supabase-lite.com/app/my-api-server          │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 🟢 admin-dashboard    Node.js App    Port 3002 [●●●] [⚙️] │ │
│ │    Running • 12MB • 5 requests/min                        │ │
│ │    https://supabase-lite.com/app/admin-dashboard        │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 🔴 portfolio-site    Static Files   Port 8080 [▶️] [⚙️] │ │
│ │    Stopped • 3MB • Last run 1h ago                       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Deploy App Modal (Environment Loaded)
```
┌─────────────────────────────────────────────────────────────┐
│ Deploy New Application to Node.js Environment       [✕]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. Application Details:                                     │
│    App Name: [my-api-server    ] (used in URL)             │
│    Description: [REST API for...] (optional)               │
│                                                             │
│ 2. Current Environment:                                     │
│    🟢 Node.js 20.11.0 + nginx                              │
│    Available: Node.js, npm, nginx, git                     │
│    Perfect for: Express apps, APIs, Node.js backends       │
│                                                             │
│    Want to deploy to a different environment?              │
│    [Switch Environment] (will restart WebVM)               │
│                                                             │
│ 3. Source Code:                                             │
│    ◉ Upload Folder     ○ GitHub Repo     ○ Remote URL      │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ 📁 Drop folder here or click to browse              │ │
│    │    package.json, index.js, /src, /public            │ │
│    └─────────────────────────────────────────────────────┘ │
│                                                             │
│ 4. Configuration:                                           │
│    Entry Point: [index.js        ] (auto-detected)         │
│    Port: [3001] (auto-assigned if empty)                   │
│    Environment Variables:                                   │
│    NODE_ENV: [production        ] [Remove]                 │
│    [+ Add Variable]                                         │
│                                                             │
│                           [Cancel] [Deploy Application]     │
└─────────────────────────────────────────────────────────────┘
```

#### Environment Selection Modal
```
┌─────────────────────────────────────────────────────────────┐
│ Select Runtime Environment                           [✕]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Choose the runtime environment for your applications:       │
│                                                             │
│    ◉ 🌐 Static Web Server (~85MB)                         │
│       • nginx web server                                    │
│       • Perfect for: HTML, CSS, JS, static sites          │
│       • Load time: ~15 seconds                             │
│                                                             │
│    ○ 🟢 Node.js Runtime (~140MB)                          │
│       • nginx + Node.js 20 + npm                          │
│       • Perfect for: Express APIs, Node.js apps           │
│       • Load time: ~25 seconds                             │
│                                                             │
│    ○ ⚡ Next.js Environment (~160MB)                       │
│       • nginx + Node.js 20 + Next.js CLI                  │
│       • Perfect for: Next.js apps, React SSR             │
│       • Load time: ~30 seconds                             │
│                                                             │
│    ○ 🐍 Python Environment (~130MB)                       │
│       • nginx + Python 3.11 + pip                        │
│       • Perfect for: Flask, FastAPI, Django              │
│       • Load time: ~25 seconds                             │
│                                                             │
│ ⚠️ Note: Loading an environment will download and cache    │
│ the disk image. Switching environments requires restarting  │
│ WebVM and will stop all currently running applications.     │
│                                                             │
│                     [Cancel] [Load Selected Environment]    │
└─────────────────────────────────────────────────────────────┘
```

#### Application Details View
```
┌─────────────────────────────────────────────────────────────┐
│ 🟢 my-todo-app                                   [🔄] [⚙️]  │
├─────────────────────────────────────────────────────────────┤
│ Status: Running • Runtime: Next.js 14.1 • Port: 3000       │
│ URL: https://supabase-lite.com/app/my-todo-app              │
│                                                             │
│ 📊 Metrics (last 1h):                                       │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│ │ 47 Requests │ │ 12MB Memory │ │ 2.3% CPU    │             │
│ └─────────────┘ └─────────────┘ └─────────────┘             │
│                                                             │
│ 📜 Recent Logs:                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [15:23:42] Server started on port 3000                 │ │
│ │ [15:24:01] GET /api/todos - 200 (45ms)                 │ │
│ │ [15:24:03] POST /api/todos - 201 (123ms)               │ │
│ │ [15:24:15] GET / - 200 (12ms)                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 🔧 Actions:                                                 │
│ [▶️ Start] [⏸️ Stop] [🔄 Restart] [📁 Files] [⚙️ Settings]    │
└─────────────────────────────────────────────────────────────┘
```

### 7. User Experience Flows for Environment Selection

#### Flow 1: First-Time User Selects Environment
```
1. User opens Application Server for the first time
2. Sees "No Runtime Environment Loaded" message
3. Must choose from available environments:
   - Static Web Server (~85MB)
   - Node.js Runtime (~140MB)
   - Next.js Environment (~160MB)
   - Python Environment (~130MB)
4. User selects "Node.js Runtime"
5. System downloads and loads Node.js disk image (~25 seconds)
6. WebVM boots with Node.js environment
7. Application Server page now shows "Node.js Environment" loaded
8. User can now deploy Node.js applications
```

#### Flow 2: User Wants to Deploy Different App Type
```
1. User has Node.js environment loaded
2. Wants to deploy a Python Flask app
3. Clicks "Deploy App" but realizes current environment is Node.js
4. Clicks "Switch Environment" in deploy modal
5. System shows environment selection modal
6. User selects "Python Environment"
7. Warning: "This will restart WebVM and stop all running apps"
8. User confirms switch
9. System loads Python disk image (~25 seconds)
10. All previous Node.js apps now stopped
11. User can now deploy Python applications
```

#### Flow 3: Environment Loading Process
```
1. User selects an environment
2. System checks if disk image is cached
3. If not cached:
   - Downloads disk image with progress bar
   - Caches locally for future use
4. Initializes WebVM with selected disk image
5. Boots Linux environment
6. Starts required services (nginx, runtime)
7. Verifies environment is ready
8. Shows "Environment Ready" status
9. User can now deploy compatible applications
```

#### Flow 4: Multiple Apps in Single Environment
```
Starting state: Node.js environment loaded

User Journey:
1. Deploys "my-api-server" (Express app) → runs on port 3001
2. Deploys "admin-dashboard" (Node.js app) → runs on port 3002
3. Deploys "portfolio-site" (static files) → runs on port 8080
4. All apps run simultaneously in Node.js environment
5. nginx proxies requests to appropriate app ports
6. User can manage all apps independently (start/stop/restart)

Result: Multiple compatible apps in single environment
```

#### Flow 5: Environment Persistence and Recovery
```
1. User loads Node.js environment and deploys apps
2. Closes browser tab
3. Returns later, opens Application Server
4. System automatically restores:
   - Last used environment (Node.js)
   - All deployed applications
   - Auto-starts apps that were running before
5. Apps resume normal operation
6. No re-download of environment needed (cached)

Result: Seamless environment persistence across sessions
```

### 8. Advanced Features

#### Hot Reload & Live Development
```typescript
interface LocalFolderSync {
  watch(localPath: string, appId: string): Promise<void>
  onFileChange(handler: (files: ChangedFile[]) => void): void
  stop(): void
}
```

#### GitHub Integration
```typescript
interface GitHubDeployment {
  repo: string                  // 'user/repo'
  branch: string               // 'main'
  token?: string               // Personal access token
  webhook?: string             // Auto-deploy on push
}
```

#### Environment Variables
- Secure storage in browser (encrypted in IndexedDB)
- Support for Supabase connection strings
- Development vs production configurations
- Secret masking in UI

#### Enhanced Resource Monitoring
```typescript
interface AdvancedMonitoring {
  // Real-time metrics collection
  collectMetrics(environmentId: string): Promise<EnvironmentMetrics>

  // Performance analytics
  analyzePerformance(appId: string, timeRange: TimeRange): PerformanceAnalysis

  // Resource optimization
  getOptimizationSuggestions(environmentId: string): OptimizationSuggestion[]

  // Alerting system
  configureAlerts(rules: AlertRule[]): Promise<void>
  getActiveAlerts(): Alert[]
}

interface EnvironmentMetrics {
  timestamp: Date
  environmentId: string
  cpu: {
    usage: number          // Percentage
    loadAverage: number[]  // 1min, 5min, 15min
    processes: number
  }
  memory: {
    used: number          // MB
    available: number     // MB
    cached: number        // MB
    buffers: number       // MB
  }
  disk: {
    used: number          // MB
    available: number     // MB
    ioReadMB: number      // MB/sec
    ioWriteMB: number     // MB/sec
  }
  network: {
    requestsPerSecond: number
    bytesInPerSecond: number
    bytesOutPerSecond: number
    activeConnections: number
  }
  applications: ApplicationMetrics[]
}

interface ApplicationMetrics {
  appId: string
  status: AppStatus
  pid: number
  cpu: number            // Percentage
  memory: number         // MB
  uptime: number         // Seconds
  requestCount: number
  errorCount: number
  responseTime: {
    p50: number          // Milliseconds
    p95: number
    p99: number
  }
}
```

#### Intelligent Resource Management
```typescript
interface ResourceManager {
  // Auto-scaling within environment limits
  autoScaleApplication(appId: string, policy: AutoScalePolicy): Promise<void>

  // Resource allocation optimization
  optimizeResourceAllocation(environmentId: string): Promise<OptimizationResult>

  // Memory management
  performGarbageCollection(appId?: string): Promise<void>
  clearUnusedCaches(): Promise<void>

  // Process management
  hibernateIdleApps(thresholdMinutes: number): Promise<string[]>
  wakeUpApplication(appId: string): Promise<void>
}

interface AutoScalePolicy {
  enabled: boolean
  minInstances: number
  maxInstances: number
  targetCpuUtilization: number
  targetMemoryUtilization: number
  scaleUpThreshold: number
  scaleDownThreshold: number
  cooldownPeriod: number  // Seconds
}
```

#### Advanced Development Tools
```typescript
interface DevelopmentTools {
  // Hot reload with intelligent change detection
  enableHotReload(appId: string, options: HotReloadOptions): Promise<void>

  // Live debugging
  attachDebugger(appId: string, debuggerType: 'node' | 'chrome' | 'python'): Promise<DebugSession>

  // Performance profiling
  startProfiling(appId: string, duration: number): Promise<ProfileResult>

  // Code analysis
  analyzeCode(appId: string): Promise<CodeAnalysisResult>
}

interface HotReloadOptions {
  watchPatterns: string[]
  ignorePatterns: string[]
  debounceMs: number
  reloadStrategy: 'full' | 'incremental' | 'module'
  preserveState: boolean
}
```

### 9. Security & Isolation

#### Enhanced Sandbox Isolation
Implement multi-layered security to prevent apps from interfering with each other or the host environment:

```typescript
interface SecurityManager {
  // Application isolation
  createAppSandbox(appId: string, config: SandboxConfig): Promise<AppSandbox>

  // Resource isolation
  enforceResourceLimits(appId: string, limits: ResourceLimits): void

  // Network isolation
  configureNetworkPolicy(appId: string, policy: NetworkPolicy): void

  // File system isolation
  createIsolatedFileSystem(appId: string): IsolatedFileSystem
}

interface SandboxConfig {
  memoryLimit: number          // MB
  cpuQuota: number            // Percentage
  diskQuota: number           // MB
  networkAccess: NetworkAccessLevel
  fileSystemAccess: FileSystemAccessLevel
  allowedPorts: number[]
  environmentVariables: Record<string, string>
}

type NetworkAccessLevel = 'none' | 'localhost_only' | 'supabase_apis' | 'full'
type FileSystemAccessLevel = 'app_directory_only' | 'user_data' | 'full_environment'

interface ResourceLimits {
  maxMemoryMB: number
  maxCpuPercent: number
  maxDiskMB: number
  maxFileHandles: number
  maxNetworkConnections: number
  maxProcesses: number
}
```

#### Process Isolation Implementation
```typescript
interface ProcessIsolation {
  // Container-like isolation within WebVM
  createProcessGroup(appId: string): ProcessGroup

  // Resource monitoring and enforcement
  monitorResourceUsage(processGroupId: string): ResourceUsageMetrics

  // Process lifecycle management
  killProcessGroup(processGroupId: string): Promise<void>

  // Inter-process communication controls
  allowIPC(fromApp: string, toApp: string, permissions: IPCPermissions): void
}

interface ProcessGroup {
  id: string
  appId: string
  processes: ProcessInfo[]
  resourceUsage: ResourceUsageMetrics
  isolationLevel: IsolationLevel
}

type IsolationLevel = 'strict' | 'moderate' | 'permissive'
```

#### Environment-Specific Secrets Management
Secure storage and management of sensitive data scoped per environment and application:

```typescript
interface SecretsManager {
  // Environment-scoped secrets
  setEnvironmentSecret(environmentId: string, key: string, value: string): Promise<void>
  getEnvironmentSecret(environmentId: string, key: string): Promise<string | null>

  // App-scoped secrets
  setAppSecret(appId: string, key: string, value: string): Promise<void>
  getAppSecret(appId: string, key: string): Promise<string | null>

  // Encryption and security
  rotateEncryptionKeys(): Promise<void>
  auditSecretAccess(timeRange: TimeRange): SecretAccessLog[]
}

interface SecretMetadata {
  key: string
  scope: 'environment' | 'application'
  scopeId: string
  encrypted: boolean
  lastUpdated: Date
  lastAccessed: Date
  accessCount: number
}

interface SecretAccessLog {
  timestamp: Date
  operation: 'read' | 'write' | 'delete'
  secretKey: string
  appId?: string
  success: boolean
  source: string  // Which part of the app accessed it
}
```

#### Encryption Implementation
```typescript
interface EncryptionService {
  // Environment data encryption
  encryptEnvironmentData(data: ArrayBuffer, environmentId: string): Promise<EncryptedData>
  decryptEnvironmentData(encryptedData: EncryptedData, environmentId: string): Promise<ArrayBuffer>

  // Secrets encryption (separate key)
  encryptSecret(value: string, scope: string): Promise<EncryptedSecret>
  decryptSecret(encryptedSecret: EncryptedSecret, scope: string): Promise<string>

  // Key management
  generateEnvironmentKey(environmentId: string): Promise<CryptoKey>
  rotateKeys(environmentId: string): Promise<void>
}

interface EncryptedData {
  data: ArrayBuffer
  iv: ArrayBuffer
  algorithm: string
  keyId: string
}
```

#### Network Security Controls
For optional network connectivity features (like Tailscale integration):

```typescript
interface NetworkSecurity {
  // Network access control
  configureFirewall(rules: FirewallRule[]): Promise<void>

  // Traffic monitoring
  monitorNetworkTraffic(appId: string): NetworkTrafficLog[]

  // VPN/Tunnel management
  configureTunnel(config: TunnelConfig): Promise<TunnelStatus>

  // Access auditing
  logNetworkAccess(event: NetworkAccessEvent): void
}

interface FirewallRule {
  id: string
  appId?: string  // If app-specific
  action: 'allow' | 'deny' | 'log'
  protocol: 'tcp' | 'udp' | 'http' | 'https'
  sourcePattern: string
  destinationPattern: string
  ports: number[]
}

interface TunnelConfig {
  provider: 'tailscale' | 'wireguard' | 'custom'
  apiKey?: string
  deviceName: string
  allowedPeers: string[]
  routingRules: RoutingRule[]
}
```

#### Security Audit and Compliance
```typescript
interface SecurityAuditor {
  // Security scanning
  scanEnvironmentSecurity(environmentId: string): SecurityScanResult

  // Compliance checking
  checkCompliance(standard: ComplianceStandard): ComplianceReport

  // Vulnerability assessment
  assessVulnerabilities(environmentId: string): VulnerabilityReport

  // Security monitoring
  monitorSecurityEvents(): SecurityEventStream
}

interface SecurityScanResult {
  environmentId: string
  scanDate: Date
  issues: SecurityIssue[]
  recommendations: SecurityRecommendation[]
  overallScore: number  // 0-100
}

interface SecurityIssue {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'access_control' | 'encryption' | 'network' | 'configuration'
  description: string
  remediation: string
  affectedComponents: string[]
}
```

#### Security UI Components
```
┌─────────────────────────────────────────────────────────────┐
│ 🔒 Security & Isolation Settings                    [✕]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🛡️ Environment Security Status: 🟢 Secure                  │
│                                                             │
│ 🔐 Application Isolation:                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ my-api-server    [🟢 Isolated]  Memory: 45MB/50MB      │ │
│ │ admin-dashboard  [🟢 Isolated]  Memory: 32MB/50MB      │ │
│ │ portfolio-site   [🟢 Isolated]  Memory: 8MB/50MB       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 🔑 Secrets Management:                                     │
│ Environment Secrets: 3 secrets stored securely             │
│ Application Secrets: 5 secrets across 3 apps               │
│ [🔑 Manage Secrets] [🔄 Rotate Keys]                       │
│                                                             │
│ 🌐 Network Security:                                       │
│ Status: Offline (No network access)                        │
│ [ ] Enable Tailscale VPN (requires API key)                │
│ [📋 Configure Firewall Rules]                              │
│                                                             │
│ 📊 Security Audit:                                         │
│ Last scan: 2 hours ago  •  Score: 95/100  •  2 minor issues│
│ [🔍 Run Security Scan] [📋 View Audit Report]              │
│                                                             │
│                                              [Save] [Close] │
└─────────────────────────────────────────────────────────────┘
```

### 10. Extensibility & Future Roadmap

#### Modular Environment Architecture
Design environment system to support easy addition of new runtime environments:

```typescript
interface EnvironmentTemplate {
  id: string
  name: string
  version: string
  baseImage: string  // Base Linux image to build from
  installationScript: string  // Script to install runtime
  healthChecks: HealthCheck[]
  defaultPorts: number[]
  capabilities: string[]
  resourceRequirements: ResourceRequirements
}

interface EnvironmentBuilder {
  // Create custom environments
  buildEnvironment(template: EnvironmentTemplate): Promise<EnvironmentBuildResult>

  // Template management
  createTemplate(config: TemplateConfig): Promise<EnvironmentTemplate>
  publishTemplate(templateId: string, registry: TemplateRegistry): Promise<void>

  // Community templates
  importCommunityTemplate(templateUrl: string): Promise<EnvironmentTemplate>
  searchTemplates(query: string): Promise<TemplateSearchResult[]>
}
```

#### Edge Functions Integration Strategy
Plan for modular Edge Functions runtime integration:

```typescript
interface EdgeFunctionsRuntime {
  // Runtime management
  initializeRuntime(environmentId: string): Promise<EdgeRuntime>

  // Function lifecycle
  deployFunction(code: string, metadata: FunctionMetadata): Promise<DeployResult>
  invokeFunction(functionId: string, request: Request): Promise<Response>

  // Integration with existing environments
  integrateWithEnvironment(environmentId: string): Promise<IntegrationResult>
}

// Future roadmap for Edge Functions
interface EdgeFunctionsRoadmap {
  phase1: 'Basic Deno runtime integration'
  phase2: 'Supabase Edge Functions compatibility'
  phase3: 'Advanced debugging and monitoring'
  phase4: 'Custom runtime and language support'
}
```

#### Analytics & Monitoring APIs
Provide comprehensive APIs for monitoring and optimization:

```typescript
interface AnalyticsAPI {
  // Environment metrics
  getEnvironmentMetrics(environmentId: string, timeRange: TimeRange): EnvironmentMetrics

  // Application performance
  getApplicationMetrics(appId: string, timeRange: TimeRange): ApplicationMetrics

  // User behavior analytics
  getUserBehaviorMetrics(timeRange: TimeRange): UserBehaviorMetrics

  // Custom metrics
  recordCustomMetric(metric: CustomMetric): void
  queryCustomMetrics(query: MetricsQuery): MetricsResult
}

interface MonitoringAPI {
  // Real-time monitoring
  subscribeToMetrics(subscriptions: MetricsSubscription[]): MetricsStream

  // Alerting
  createAlert(alertConfig: AlertConfig): Promise<Alert>
  getActiveAlerts(): Alert[]

  // Performance optimization
  getOptimizationRecommendations(environmentId: string): OptimizationRecommendation[]
}
```

### 11. Developer Tools & Debugging

#### In-Environment Shell Access
Provide power users with terminal access for debugging:

```typescript
interface TerminalService {
  // Terminal management
  createTerminalSession(environmentId: string, options: TerminalOptions): Promise<TerminalSession>

  // Shell access
  executeCommand(sessionId: string, command: string): Promise<CommandResult>

  // File operations
  browseFileSystem(sessionId: string, path: string): Promise<FileSystemListing>

  // Process management
  listProcesses(sessionId: string): Process[]
  killProcess(sessionId: string, pid: number): Promise<void>
}

interface TerminalSession {
  id: string
  environmentId: string
  shell: string  // 'bash', 'sh', etc.
  currentDirectory: string
  environmentVariables: Record<string, string>
  permissions: TerminalPermissions
}

interface TerminalPermissions {
  allowFileSystemAccess: boolean
  allowProcessManagement: boolean
  allowNetworkCommands: boolean
  allowSystemCommands: boolean
  restrictedDirectories: string[]
}
```

#### Terminal UI Component
```
┌─────────────────────────────────────────────────────────────┐
│ 💻 Terminal - Node.js Environment               [_][□][✕]   │
├─────────────────────────────────────────────────────────────┤
│ user@nodejs-env:~/my-api-server$ ls -la                     │
│ total 24                                                    │
│ drwxr-xr-x 4 user user 4096 Jan 15 18:30 .                 │
│ drwxr-xr-x 3 user user 4096 Jan 15 18:25 ..                │
│ -rw-r--r-- 1 user user  327 Jan 15 18:30 package.json     │
│ -rw-r--r-- 1 user user 1024 Jan 15 18:30 index.js         │
│ drwxr-xr-x 2 user user 4096 Jan 15 18:30 src               │
│ drwxr-xr-x 2 user user 4096 Jan 15 18:30 node_modules      │
│                                                             │
│ user@nodejs-env:~/my-api-server$ npm start                 │
│ > my-api-server@1.0.0 start                                │
│ > node index.js                                             │
│                                                             │
│ Server running on port 3000                                │
│ Database connected successfully                             │
│                                                             │
│ user@nodejs-env:~/my-api-server$ _                         │
├─────────────────────────────────────────────────────────────┤
│ 🔧 Quick Actions:                                          │
│ [📁 Browse Files] [⚙️ Environment Info] [📊 Process List]   │
│ [📋 Copy Session] [🗑️ Clear Terminal] [⚙️ Terminal Settings] │
└─────────────────────────────────────────────────────────────┘
```

#### Centralized Logging System
Comprehensive logging architecture for debugging and monitoring:

```typescript
interface LoggingService {
  // Application logs
  getApplicationLogs(appId: string, options: LogQueryOptions): Promise<LogEntry[]>

  // Environment logs
  getEnvironmentLogs(environmentId: string, options: LogQueryOptions): Promise<LogEntry[]>

  // System logs
  getSystemLogs(options: LogQueryOptions): Promise<LogEntry[]>

  // Log streaming
  streamLogs(filter: LogFilter): LogStream

  // Log management
  exportLogs(filter: LogFilter, format: 'json' | 'csv' | 'txt'): Promise<Blob>
  clearLogs(filter: LogFilter): Promise<void>
}

interface LogEntry {
  timestamp: Date
  level: LogLevel
  source: string  // 'app:my-api' | 'env:nodejs' | 'system'
  message: string
  metadata: Record<string, any>
  correlationId?: string
}

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogQueryOptions {
  startTime?: Date
  endTime?: Date
  levels?: LogLevel[]
  sources?: string[]
  limit?: number
  search?: string
}
```

#### Diagnostic Export System
```typescript
interface DiagnosticExporter {
  // Generate diagnostic packages
  createDiagnosticPackage(environmentId: string, options: DiagnosticOptions): Promise<DiagnosticPackage>

  // Export specific data
  exportEnvironmentState(environmentId: string): Promise<EnvironmentStateSnapshot>
  exportApplicationData(appId: string): Promise<ApplicationDataSnapshot>

  // Support information
  generateSupportBundle(issueDescription: string): Promise<SupportBundle>
}

interface DiagnosticPackage {
  id: string
  environmentId: string
  timestamp: Date
  contents: {
    environmentState: EnvironmentStateSnapshot
    applicationData: ApplicationDataSnapshot[]
    logs: LogEntry[]
    metrics: MetricsSnapshot
    configuration: ConfigurationSnapshot
  }
  size: number
  downloadUrl: string
}
```

## Implementation Plan

### Phase 1: Environment Foundation (3-4 weeks)
1. **Remove existing App Hosting**
   - Delete old components and handlers
   - Create migration path for existing apps

2. **Create Pre-Built Environment Disk Images**
   - Build complete environment images:
     - Static Environment: Ubuntu + nginx
     - Node.js Environment: Ubuntu + nginx + Node.js 20
     - Next.js Environment: Ubuntu + nginx + Node.js + Next.js
     - Python Environment: Ubuntu + nginx + Python 3.11
   - Host disk images for download during environment selection
   - Implement disk image caching and verification

3. **WebVM Integration**
   - Integrate WebVM 2.0 library with environment loading
   - Implement lazy loading (only when Application Server accessed)
   - Create environment selection and loading process
   - Environment status monitoring and management

4. **Application Server UI**
   - Environment selection page (no environment loaded)
   - Main dashboard with current environment status
   - Environment selection modal
   - Simplified deployment process

### Phase 2: Core Environment Support (3-4 weeks)
1. **Static Environment Implementation**
   - nginx-only environment for static sites
   - File upload and serving via nginx

2. **Node.js Environment Implementation**
   - Complete Node.js runtime with npm
   - Application deployment and process management
   - Request routing through WebVM network

3. **Environment Switching**
   - Environment switching with WebVM restart
   - Application state preservation during switches
   - Environment persistence and restoration

### Phase 3: Enhanced Environments (2-3 weeks)
1. **Python Environment Implementation**
   - Python 3.11 with pip and common packages
   - Flask/FastAPI application support

2. **Next.js Environment Implementation**
   - Next.js CLI tools and framework support
   - Build process and SSR capabilities

3. **Application Lifecycle Management**
   - Process management within environments
   - Auto-restart and monitoring
   - Port management and routing

### Phase 4: Advanced Features (2-3 weeks)
1. **Enhanced Deployment Sources**
   - GitHub repository deployment
   - Local folder sync (File System Access API)
   - Remote URL deployment

2. **Environment Optimization**
   - Environment caching and optimization
   - Resource monitoring and management
   - Performance metrics and analytics

### Phase 5: Enhanced Management Features (2-3 weeks)
1. **Environment Management Enhancements**
   - Background preloading system
   - Auto-update mechanism for disk images
   - Storage management and cleanup tools

2. **Advanced Backup & Restore**
   - Incremental backup implementation
   - Conflict resolution system
   - Automated backup policies

3. **Enhanced UI/UX**
   - Environment switch warning dialogs
   - App compatibility filtering
   - Environment status indicators
   - Error recovery interfaces

### Phase 6: Security & Isolation (2-3 weeks)
1. **Sandbox Isolation Implementation**
   - Process isolation within WebVM
   - Resource limits enforcement
   - File system isolation

2. **Secrets Management**
   - Environment-specific secrets storage
   - Encryption implementation
   - Secrets rotation and auditing

3. **Network Security**
   - Optional Tailscale integration
   - Firewall rules and traffic monitoring
   - Security audit system

### Phase 7: Developer Tools & Debugging (2-3 weeks)
1. **Terminal Access**
   - In-environment shell implementation
   - Permission-based access control
   - Terminal UI integration

2. **Centralized Logging**
   - Application and environment logging
   - Log export and search functionality
   - Real-time log streaming

3. **Diagnostic Tools**
   - Environment state export
   - Support bundle generation
   - Performance profiling tools

### Phase 8: Extensibility & Future Features (2-3 weeks)
1. **Modular Environment System**
   - Environment template architecture
   - Custom environment builder
   - Community template support

2. **Analytics & Monitoring APIs**
   - Comprehensive metrics collection
   - Performance analytics
   - Alerting and notification system

3. **Edge Functions Integration Planning**
   - Deno runtime integration strategy
   - Supabase Edge Functions compatibility
   - Modular runtime architecture

### Phase 9: Production Polish & Optimization (2-3 weeks)
1. **Performance Optimization**
   - Environment switching optimization
   - Advanced resource monitoring
   - Intelligent resource management

2. **Security Hardening**
   - Security configuration and sandboxing
   - Vulnerability assessment
   - Compliance checking

3. **Quality Assurance**
   - Comprehensive testing suite
   - Documentation and user guides
   - Performance benchmarking

## Technical Challenges & Solutions

### 1. ✅ Simplified Environment Management
**Challenge**: Providing complete runtime environments without complexity
**Solution**: Pre-built complete disk images eliminate all runtime installation issues

**Implementation**:
1. **Complete Environment Images**
   - Each disk image contains everything needed for that environment
   - Built during our application build process with full internet access
   - No runtime installation or dependency management needed
   - Users simply select and load complete environments

2. **Environment Caching**
   - Disk images cached locally after first download
   - Fast environment switching for cached environments
   - Background pre-loading of popular environments

3. **Environment Verification**
   - Built-in health checks verify environment is ready
   - Automatic service startup and validation
   - Clear error messages if environment fails to load

### 2. Environment Persistence & Restoration
**Challenge**: Ensuring environment and application state survive browser restarts
**Simplified Requirements**: Environment selection and app state must persist

**Solutions**:
- **WebVM Auto-Persistence**: File system changes saved to IndexedDB automatically
- **Environment Memory**: Remember last selected environment in localStorage
- **Automatic Environment Restoration**: Reload last environment on startup
- **Service Auto-Start**: Applications automatically restart in restored environment
- **Data Backup**: Export/import entire environment disk image

### 3. Environment Switching Performance
**Challenge**: Fast switching between different runtime environments
**Solutions**:
- Environment disk image caching for instant loading
- Progressive environment pre-loading in background
- Compressed disk images to reduce download time
- Environment hibernation when not actively used

### 4. Application Routing Within Environment
**Challenge**: Routing requests to applications within single environment
**Solutions**:
- nginx-based reverse proxy within each environment
- Port-based application routing and management
- WebSocket proxying for real-time applications
- Clear URL patterns for application access

### 5. Environment Resource Management
**Challenge**: Managing disk space and memory across environments
**Solutions**:
- Single environment loaded at a time reduces resource usage
- Disk image compression and efficient caching
- Environment cleanup and garbage collection
- Resource monitoring and usage alerts
- Optional environment deletion to free space

## Updated Requirements Based on Clarifications

### 1. Performance Focus ✅
- **Single powerful app optimization** (confirmed)
- WebVM hibernation when not in use
- Focus on application performance over multi-app concurrency

### 2. Edge Functions Priority ✅
- **Not a priority for initial implementation** (confirmed)
- Research feasibility: Deno can be installed in WebVM via standard Linux package
- Implementation: Future phase after core runtimes are stable

### 3. Technology Choice ✅
- **WebVM 2.0 only** (confirmed)
- No external dependencies or licensing concerns
- Pure open-source solution

### 4. Browser Compatibility ✅
- **Modern browsers only** (confirmed)
- Required: Chrome/Edge 88+, Firefox 89+, Safari 14+
- WebAssembly and SharedArrayBuffer support required

### 5. Storage Approach ✅
- **No storage limits concerns** (confirmed)
- Full WebVM disk persistence via IndexedDB
- Expect 100-500MB storage usage for typical setups

## Success Criteria

### Core Technical Requirements
- ✅ Browser-only operation (no server dependencies)
- ✅ Lazy loading (no impact on main app startup)
- ✅ State persistence across browser sessions
- ✅ Full Supabase API access from applications
- ✅ Support for modern web frameworks
- ✅ Single-runtime environment architecture with clean switching
- ✅ Pre-built disk image compatibility with WebVM 2.0

### Environment Management Requirements
- ✅ Environment preloading and caching system
- ✅ Automatic environment updates with version management
- ✅ Storage optimization with cleanup and size monitoring
- ✅ Environment switching with proper warnings and confirmations
- ✅ Compatibility filtering for application deployment

### User Experience Requirements
- ✅ Intuitive deployment workflow
- ✅ Real-time application status and logs
- ✅ Quick startup times (< 5 seconds for cached runtimes)
- ✅ Clear error messages and recovery options
- ✅ Consistent with existing Supabase Lite UI
- ✅ Environment switching warnings and confirmation dialogs
- ✅ Deployment compatibility validation and recommendations

### Persistence & Backup Requirements
- ✅ Incremental backup system with conflict resolution
- ✅ Full backup with compression and integrity verification
- ✅ Cross-browser restore capability
- ✅ Backup history management with automatic cleanup
- ✅ State migration between environment versions

### Security & Isolation Requirements
- ✅ Enhanced process isolation within WebVM
- ✅ Application sandboxing with resource limits
- ✅ Secure secrets management with environment-specific encryption
- ✅ Network access controls and filtering
- ✅ Security audit logging and monitoring

### Developer Tools Requirements
- ✅ In-environment terminal access with permission controls
- ✅ Centralized logging system with real-time streaming
- ✅ Performance diagnostics and optimization recommendations
- ✅ Debug mode with enhanced visibility
- ✅ File system browsing and management tools

### Performance Requirements
- ✅ Main application startup time unchanged
- ✅ Runtime loading < 30 seconds (with progress indicator)
- ✅ Application cold start < 10 seconds
- ✅ Hot reload < 2 seconds for file changes
- ✅ Environment preloading < 60 seconds in background
- ✅ Backup creation < 30 seconds for incremental, < 2 minutes for full
- ✅ Environment switching < 45 seconds with proper cleanup

### Monitoring & Analytics Requirements
- ✅ Real-time performance metrics collection
- ✅ Application resource usage tracking
- ✅ Environment health monitoring
- ✅ Alert system for resource limits and errors
- ✅ Usage analytics and optimization insights

### Extensibility Requirements
- ✅ Modular environment template system
- ✅ Plugin architecture for future enhancements
- ✅ API extensibility for third-party integrations
- ✅ Custom environment creation and sharing capabilities
- ✅ Future-proof architecture for Edge Functions integration

This specification provides a comprehensive roadmap for replacing the existing App Hosting with a much more capable Application Server while maintaining the browser-only architecture that makes Supabase Lite unique.