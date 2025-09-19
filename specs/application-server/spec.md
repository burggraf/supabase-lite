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

### 2. Lazy Loading Strategy

#### Performance Requirements
- MUST NOT impact main application startup time
- WebVM loaded only when user first accesses Application Server
- Progressive loading with clear user feedback

#### WebVM Loading Implementation
```typescript
interface WebVMManager {
  initialize(): Promise<void>
  isRunning(): boolean
  installRuntime(runtime: string): Promise<void>
  deployApp(config: AppConfig): Promise<void>
  getStatus(): WebVMStatus
}

interface WebVMStatus {
  state: 'unloaded' | 'loading' | 'booting' | 'ready' | 'error'
  loadProgress: number
  installedRuntimes: string[]
  runningApps: ApplicationInstance[]
}
```

#### Loading States
- **Unloaded**: WebVM not yet downloaded (~50-100MB)
- **Loading**: WebVM downloading with progress indicator
- **Booting**: Linux kernel starting up
- **Ready**: WebVM available for runtime installation and app deployment
- **Error**: WebVM failed to load or boot

### 3. Additive Runtime Management System

#### ⚠️ Critical: Offline-First Architecture
Since WebVM has no internet access by default, we must provide offline package management for additive runtime installation.

#### Additive Runtime Philosophy
**Key Requirement**: Users must be able to dynamically add/remove runtimes without affecting other installed runtimes:

- **Start with Base**: WebVM boots with minimal base system (essential tools only)
- **Add as Needed**: User can install nginx, Node.js, Python, Next.js individually
- **Remove Safely**: Uninstalling one runtime doesn't affect others
- **Cumulative**: Installing Node.js + Python + nginx = all three available simultaneously

#### Runtime Package Repository
We'll bundle a complete offline package repository within our application:

```typescript
interface RuntimePackage {
  id: string                    // 'nodejs-20', 'python-311', 'nginx'
  name: string                  // 'Node.js 20.x LTS'
  description: string           // Human readable description
  version: string               // Semantic version
  dependencies: string[]        // Other runtime packages required
  conflicts: string[]           // Packages that cannot coexist
  debPackages: string[]         // List of .deb files to install
  size: number                  // Total size in MB
  status: 'available' | 'installing' | 'installed' | 'removing' | 'error'
  postInstallScript?: string    // Commands to run after installation
  preRemoveScript?: string      // Commands to run before removal
}

interface RuntimeRepository {
  getAvailablePackages(): RuntimePackage[]
  getInstalledPackages(): RuntimePackage[]
  canInstall(packageId: string): { success: boolean, issues: string[] }
  canRemove(packageId: string): { success: boolean, dependents: string[] }
  installPackage(packageId: string): Promise<InstallResult>
  removePackage(packageId: string, force?: boolean): Promise<RemoveResult>
}
```

#### Base WebVM Image Strategy
Instead of multiple pre-built images, we use one minimal base image plus additive packages:

1. **Minimal Base Image** - Ubuntu i386 with essential tools, dpkg, user account
2. **Runtime Packages** - Individual .deb package bundles for each runtime
3. **Offline Repository** - Complete dependency trees for each runtime
4. **Package Injector** - System to transfer packages from browser to WebVM filesystem

#### Runtime Package Creation Process
Instead of monolithic disk images, we create individual runtime packages:

```bash
# Build process for creating runtime packages (during our app build)

# 1. Create individual runtime containers
FROM i386/ubuntu:22.04 as nodejs-builder
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
RUN apt-get install -y nodejs npm

# 2. Extract .deb packages from each runtime
mkdir -p runtime-packages/nodejs/
dpkg-query -W -f='${Package}\n' | while read pkg; do
  if [[ $pkg == *node* ]] || [[ $pkg == *npm* ]]; then
    dpkg-repack $pkg --output runtime-packages/nodejs/
  fi
done

# 3. Bundle packages into our application
tar czf nodejs-runtime.tar.gz runtime-packages/nodejs/
```

#### Offline Package Installation in WebVM
```typescript
interface PackageInstaller {
  // Transfer packages from browser to WebVM filesystem
  async transferPackages(packageId: string): Promise<void> {
    const packages = this.getRuntimePackages(packageId)
    await this.copyToWebVM('/tmp/packages/', packages)
  }

  // Install packages within WebVM using dpkg
  async installInWebVM(packageId: string): Promise<void> {
    const commands = [
      'cd /tmp/packages/',
      'sudo dpkg -i *.deb',
      'sudo apt-get -f install', // Fix any dependency issues
      'sudo systemctl enable nginx' // Enable services if needed
    ]
    await this.executeInWebVM(commands)
  }

  // Remove packages within WebVM
  async removeFromWebVM(packageId: string): Promise<void> {
    const packages = this.getRuntimePackages(packageId)
    const removeCommands = packages.map(pkg => `sudo dpkg -r ${pkg}`)
    await this.executeInWebVM(removeCommands)
  }
}
```

#### Runtime Dependency Checking & Error Handling

**Critical Requirement**: Apps must gracefully handle missing runtime dependencies.

```typescript
interface ApplicationRuntime {
  requiredRuntimes: string[]    // ['nodejs-20', 'nginx']
  optionalRuntimes: string[]    // ['python-311'] (for enhanced features)
  minimumVersions: Record<string, string> // {'nodejs': '18.0.0'}
}

interface RuntimeChecker {
  checkAppCanStart(appId: string): Promise<RuntimeCheckResult>
  getRuntimeStatus(runtimeId: string): RuntimeStatus
  validateDependencies(requiredRuntimes: string[]): DependencyValidation[]
}

interface RuntimeCheckResult {
  canStart: boolean
  missingRuntimes: string[]
  conflictingRuntimes: string[]
  versionMismatches: VersionMismatch[]
  suggestedActions: string[]
}

interface VersionMismatch {
  runtime: string
  required: string
  installed: string
  severity: 'error' | 'warning'
}

// Example usage in app startup
async function startApplication(appId: string): Promise<StartResult> {
  const runtimeCheck = await runtimeChecker.checkAppCanStart(appId)

  if (!runtimeCheck.canStart) {
    return {
      success: false,
      error: 'Runtime dependencies not met',
      missingRuntimes: runtimeCheck.missingRuntimes,
      actions: [
        {
          type: 'install_runtime',
          runtime: 'nodejs-20',
          message: 'Install Node.js 20.x to run this application'
        }
      ]
    }
  }

  // Proceed with app startup...
}
```

#### Error Handling UI Components

**Missing Runtime Error Display:**
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Cannot Start Application: my-todo-app                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ This application requires the following runtimes that       │
│ are not currently installed in your WebVM:                 │
│                                                             │
│ ❌ Node.js 20.x LTS (Required)                              │
│ ❌ nginx Web Server (Required)                              │
│ ⚠️ Python 3.11 (Optional - for data processing features)   │
│                                                             │
│ Choose an action:                                           │
│ [📥 Install Missing Runtimes] [⚙️ Manage Runtimes]         │
│ [📱 View App Details] [❌ Cancel]                          │
└─────────────────────────────────────────────────────────────┘
```

#### Runtime Dependency Metadata
```typescript
interface ApplicationMetadata {
  // ... existing fields ...
  runtime: ApplicationRuntime
  runtimeStatus: {
    lastChecked: Date
    canStart: boolean
    missingDependencies: string[]
    issues: string[]
  }
}
```

#### Real-time Dependency Monitoring
```typescript
interface RuntimeMonitor {
  // Monitor runtime availability and notify apps
  onRuntimeInstalled(runtimeId: string): void
  onRuntimeRemoved(runtimeId: string): void

  // Update app statuses when runtimes change
  updateAppStatuses(): Promise<void>

  // Prevent runtime removal if apps depend on it
  checkSafeToRemove(runtimeId: string): SafetyCheck
}

interface SafetyCheck {
  safe: boolean
  dependentApps: string[]
  warnings: string[]
  forceRemovalConsequences: string[]
}
```

### 4. Runtime Package Management Implementation

#### Package Storage Architecture
```typescript
interface RuntimePackageManager {
  // Core package operations
  listAvailable(): RuntimePackage[]
  listInstalled(): RuntimePackage[]
  getPackageInfo(packageId: string): RuntimePackage | null

  // Installation/removal operations
  install(packageId: string, options?: InstallOptions): Promise<InstallResult>
  remove(packageId: string, options?: RemoveOptions): Promise<RemoveResult>

  // Dependency management
  resolveDependencies(packageId: string): string[]
  checkConflicts(packageId: string): ConflictCheck[]
  validateRemoval(packageId: string): ValidationResult
}

interface InstallOptions {
  force?: boolean               // Override conflict warnings
  skipDependencies?: boolean    // Don't install dependencies
  enableServices?: boolean      // Auto-enable systemd services
}

interface RemoveOptions {
  force?: boolean               // Remove even if apps depend on it
  removeUnused?: boolean        // Remove unused dependencies
  disableServices?: boolean     // Disable services before removal
}

interface InstallResult {
  success: boolean
  packageId: string
  installedPackages: string[]   // Including dependencies
  warnings: string[]
  logs: string[]
  timeElapsed: number
}
```

#### Offline Package Repository Structure
```typescript
// Bundled within our application
interface OfflineRepository {
  metadata: {
    version: string
    lastUpdated: Date
    totalPackages: number
    totalSize: number
  }

  packages: {
    [packageId: string]: {
      debFiles: ArrayBuffer[]   // .deb package files
      metadata: RuntimePackage
      checksums: string[]       // Verify package integrity
      extractedSize: number     // Size after installation
    }
  }

  dependencyGraph: {
    [packageId: string]: string[]  // Direct dependencies
  }
}

// Implementation example
class OfflinePackageRepository {
  async transferToWebVM(packageId: string): Promise<void> {
    const packageData = this.packages[packageId]

    // 1. Create temporary directory in WebVM
    await this.webvm.execute('mkdir -p /tmp/runtime-install')

    // 2. Transfer .deb files to WebVM filesystem
    for (const debFile of packageData.debFiles) {
      await this.webvm.writeFile(`/tmp/runtime-install/${debFile.name}`, debFile)
    }

    // 3. Verify checksums within WebVM
    await this.webvm.execute('cd /tmp/runtime-install && sha256sum -c checksums.txt')
  }

  async installInWebVM(packageId: string): Promise<InstallResult> {
    const startTime = Date.now()
    const logs: string[] = []

    try {
      // 1. Install packages with proper dependency handling
      const result = await this.webvm.execute([
        'cd /tmp/runtime-install',
        'sudo dpkg -i *.deb || true',  // Don't fail on dependencies
        'sudo apt-get -f install -y',  // Fix broken dependencies
        'sudo systemctl daemon-reload'  // Reload systemd if needed
      ])

      logs.push(...result.output)

      // 2. Run post-install scripts if any
      const package = this.packages[packageId]
      if (package.metadata.postInstallScript) {
        const postResult = await this.webvm.execute(package.metadata.postInstallScript)
        logs.push(...postResult.output)
      }

      // 3. Cleanup temporary files
      await this.webvm.execute('rm -rf /tmp/runtime-install')

      return {
        success: true,
        packageId,
        installedPackages: [packageId], // Should include dependencies
        warnings: this.extractWarnings(logs),
        logs,
        timeElapsed: Date.now() - startTime
      }

    } catch (error) {
      return {
        success: false,
        packageId,
        installedPackages: [],
        warnings: [],
        logs: [...logs, `Error: ${error.message}`],
        timeElapsed: Date.now() - startTime
      }
    }
  }
}
```

#### Runtime Conflict Detection
```typescript
interface ConflictDetector {
  checkPortConflicts(newPackage: string): PortConflict[]
  checkFileConflicts(newPackage: string): FileConflict[]
  checkServiceConflicts(newPackage: string): ServiceConflict[]
}

interface PortConflict {
  port: number
  existingService: string
  newService: string
  severity: 'error' | 'warning'
  resolution: string
}

// Example: nginx conflicts with other web servers on port 80
const portConflicts = [
  {
    port: 80,
    existingService: 'apache2',
    newService: 'nginx',
    severity: 'error',
    resolution: 'Remove Apache2 or configure nginx on different port'
  }
]
```

### 5. Application Management

#### Enhanced Application Model
```typescript
interface Application {
  id: string                    // Auto-generated UUID
  name: string                  // User-defined, used for routing
  description?: string          // User-defined description

  // Runtime requirements (NEW)
  runtime: ApplicationRuntime   // Required/optional runtimes
  runtimeStatus: RuntimeStatus  // Current dependency status

  status: AppStatus             // 'stopped' | 'starting' | 'running' | 'error' | 'runtime-missing'
  createdAt: Date
  lastDeployed: Date
  lastStarted?: Date

  // Deployment info
  sourceType: 'upload' | 'url' | 'github'
  sourceConfig: SourceConfig

  // Runtime configuration
  entryPoint: string            // 'index.js', 'app.py', 'package.json'
  environment: Record<string, string>  // Environment variables
  port?: number                 // For server apps

  // Metrics
  memoryUsage?: number          // MB
  cpuUsage?: number            // Percentage
  requestCount?: number
  lastError?: string
}

type AppStatus = 'stopped' | 'starting' | 'running' | 'error' | 'sleeping' | 'runtime-missing'

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

### 6. Persistence & State Management

#### ⚠️ Critical Persistence Requirements
All user data and configuration must survive browser restarts and page refreshes:

#### Application Data Persistence
- **User Applications**: All deployed app code, data, and files
- **Runtime Configurations**: Environment variables, service configurations
- **Application State**: Database files, uploaded content, user-generated data
- **Process State**: Running services, background jobs, scheduled tasks

#### WebVM Built-in Persistence
WebVM provides automatic persistence via IndexedDB for:
- **Disk Image Changes**: File system modifications saved incrementally
- **User Files**: All files created/modified in WebVM persist automatically

#### Additional Persistence Needs
```typescript
interface PersistenceManager {
  // Configuration persistence
  saveRuntimeConfig(appId: string, config: RuntimeConfig): void
  loadRuntimeConfig(appId: string): RuntimeConfig

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

interface RuntimeConfig {
  nodeVersion?: string
  pythonVersion?: string
  nginxConfig?: string
  customPackages?: string[]
  startupCommands?: string[]
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
- **Configuration Storage**: Store app configs in browser localStorage/IndexedDB
- **State Restoration**: Automatically restart configured services on WebVM boot
- **Data Backup**: Optional export/import functionality for user data

#### What Must Be Solved
1. **Service Auto-Start**: Apps must restart automatically when WebVM boots
2. **Configuration Preservation**: Runtime settings persist across sessions
3. **Environment Variables**: Custom env vars maintained per application
4. **Process Management**: Background services resume after restart
5. **Data Integrity**: User data protected against corruption or loss

### 7. User Interface Design

#### Main Application Server Page
```
┌─────────────────────────────────────────────────────────────┐
│ 🖥️  Application Server                    [+ Deploy App]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📊 Quick Stats:                                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│ │ 3 Apps      │ │ 2 Runtimes  │ │ 45MB Used   │             │
│ │ Running     │ │ Installed   │ │ Storage     │             │
│ └─────────────┘ └─────────────┘ └─────────────┘             │
│                                                             │
│ 📱 Applications:                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🟢 my-todo-app        Next.js 14.1      [●●●] [⚙️] [🗑️] │ │
│ │    Running • 12MB • 47 requests                        │ │
│ │    https://supabase-lite.com/app/my-todo-app            │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 🔴 data-dashboard     Python 3.11       [▶️] [⚙️] [🗑️]  │ │
│ │    Stopped • 8MB • Last run 2h ago                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ⚙️ WebVM Runtimes (Additive Management):                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✅ nginx 1.18.0      Installed    [🗑️] [⚙️]            │ │
│ │ ✅ Node.js 20.11.0   Installed    [🗑️] [⚙️]            │ │
│ │ ⏸️ Python 3.11.7    Available    [📥 Install]          │ │
│ │ ⏸️ Next.js 14.1     Available    [📥 Install]          │ │
│ │ ⏸️ Edge Functions    Available    [📥 Install]          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 📊 Runtime Storage: 127MB used of WebVM filesystem         │
│ [📥 Install All Common Runtimes] [🔧 Advanced Settings]    │
└─────────────────────────────────────────────────────────────┘
```

#### Deploy App Modal
```
┌─────────────────────────────────────────────────────────────┐
│ Deploy New Application                              [✕]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. Application Details:                                     │
│    App Name: [my-api-server    ] (used in URL)             │
│    Description: [REST API for...] (optional)               │
│                                                             │
│ 2. Runtime Environment:                                     │
│    ◉ Node.js + nginx (✅ Installed)                        │
│    ○ Next.js + nginx (⚠️ Next.js not installed)           │
│    ○ Python + nginx (⚠️ Python not installed)             │
│    ○ Static nginx only (✅ Installed)                      │
│                                                             │
│ ⚠️ Missing Runtime Notice:                                  │
│ Next.js and Python runtimes are not installed. You can     │
│ install them now or deploy a compatible app type.          │
│ [📥 Install Next.js] [📥 Install Python] [Skip]           │
│                                                             │
│ 3. Source Code:                                             │
│    ◉ Upload Folder     ○ GitHub Repo     ○ Remote URL      │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ 📁 Drop folder here or click to browse              │ │
│    │    package.json, index.js, /src, /public            │ │
│    └─────────────────────────────────────────────────────┘ │
│                                                             │
│ 4. Configuration:                                           │
│    Entry Point: [index.js        ]                         │
│    Port: [3000]                                             │
│    Environment Variables:                                   │
│    [+ Add Variable]                                         │
│                                                             │
│                           [Cancel] [Deploy Application]     │
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

### 8. User Experience Flows for Runtime Management

#### Flow 1: First-Time User Deploys App
```
1. User clicks "Deploy App"
2. WebVM starts with minimal base image (if not already running)
3. Deploy modal shows available runtime options:
   - Shows which runtimes are installed (✅)
   - Shows which runtimes are available for install (📥)
   - Warns about missing runtimes for selected app type
4. User selects "Next.js App" but Next.js is not installed
5. Modal shows: "Next.js runtime required but not installed"
6. User clicks "Install Next.js Runtime"
7. System downloads and installs Node.js (dependency) + Next.js
8. Installation progress shown with logs
9. Once complete, user can deploy their app
```

#### Flow 2: Runtime Management Page
```
1. User navigates to "Application Server" → "Runtime Management"
2. Page shows current WebVM status and installed runtimes
3. User sees:
   - Installed: nginx, Node.js (can remove individually)
   - Available: Python, Next.js, Edge Functions (can install)
4. User clicks "Install Python"
5. System shows size requirements and dependencies
6. User confirms installation
7. Python installs successfully
8. All apps refresh their runtime status automatically
```

#### Flow 3: App Cannot Start (Missing Runtime)
```
1. User tries to start "my-django-app"
2. System checks app runtime requirements
3. Finds: requires Python 3.11, nginx
4. Current status: nginx ✅ installed, Python ❌ not installed
5. Shows error dialog:
   "Cannot start my-django-app: Python 3.11 runtime not installed"
6. Offers actions:
   - "Install Python Runtime" (recommended)
   - "View Runtime Manager"
   - "Remove App"
7. User clicks "Install Python Runtime"
8. Python installs, app automatically becomes startable
9. User clicks "Start App" and it works
```

#### Flow 4: Runtime Removal with Dependencies
```
1. User wants to remove Node.js runtime
2. System checks: "my-api-server" and "admin-dashboard" depend on Node.js
3. Shows warning:
   "2 apps depend on Node.js runtime:
    - my-api-server (will stop)
    - admin-dashboard (will stop)

   Remove anyway?"
4. Options:
   - "Stop apps and remove Node.js"
   - "Cancel"
   - "View dependent apps"
5. If user proceeds, affected apps status changes to "runtime-missing"
6. Apps can be restarted once Node.js is reinstalled
```

#### Flow 5: Additive Runtime Building
```
Starting state: Fresh WebVM with base image only

User Journey:
1. Deploys static site → nginx auto-installs → 1 runtime
2. Deploys Node.js API → Node.js installs → 2 runtimes
3. Deploys Python data processor → Python installs → 3 runtimes
4. All 3 apps run simultaneously using their respective runtimes
5. User removes Python → Python app stops, other 2 continue
6. User reinstalls Python → All 3 apps available again

Result: Flexible, additive runtime environment
```

### 9. Advanced Features

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

#### Resource Monitoring
- Real-time memory usage tracking
- CPU usage estimation
- Request rate limiting
- Automatic sleep for idle apps

## Implementation Plan

### Phase 1: WebVM Foundation (4-5 weeks)
1. **Remove existing App Hosting**
   - Delete old components and handlers
   - Create migration path for existing apps

2. **Create Custom WebVM Disk Images**
   - Build Dockerfiles for each runtime (Node.js, Python, etc.)
   - Generate ext2 disk images with pre-installed runtimes
   - Host disk images for download during deployment
   - **Critical**: Solve offline runtime installation before UI

3. **WebVM Integration**
   - Integrate WebVM 2.0 library
   - Implement lazy loading (only when Application Server accessed)
   - Create WebVM boot process and status monitoring
   - Load appropriate disk image based on runtime selection

4. **Application Server UI**
   - Main dashboard page with WebVM status
   - Application list and WebVM runtime status
   - Deploy app modal with pre-built runtime selection

### Phase 2: Core Runtime Support (4-5 weeks)
1. **Static Web Server** (pre-installed nginx in custom disk image)
2. **Node.js Runtime** (pre-installed in custom disk image)
3. **Request routing through WebVM network**
4. **Application lifecycle management via Linux processes**
5. **Implement persistence for app configurations and data**

### Phase 3: Enhanced Runtimes (3-4 weeks)
1. **Python Runtime** (pre-installed in custom disk image)
2. **Next.js Framework Support** (pre-installed in custom disk image)
3. **Application deployment to WebVM file system**
4. **WebVM state persistence and automatic service restart**

### Phase 4: Advanced Features (2-3 weeks)
1. **GitHub deployment** (git clone in WebVM)
2. **Local folder sync** (File System Access API)
3. **WebVM resource monitoring**
4. **Process management and auto-restart**

### Phase 5: Production Polish (1-2 weeks)
1. **Error handling and recovery**
2. **Performance optimization**
3. **WebVM security configuration**
4. **Documentation and testing**

## Technical Challenges & Solutions

### 1. ⚠️ Offline Runtime Installation
**Challenge**: Installing runtimes without internet access in WebVM
**Critical Issue**: WebVM has no internet by default - cannot use `apt install`, `npm install`, `pip install`

**Solutions**:
1. **Pre-built Disk Images** (Primary Approach)
   - Create custom ext2 images with runtimes pre-installed
   - Build images during our application build process (not runtime)
   - Host multiple disk images for different runtime combinations
   - Users select pre-built image when deploying apps

2. **Offline Package Injection** (Backup Approach)
   - Bundle .deb, .tar.gz packages into our application
   - Inject packages into WebVM file system after boot
   - Use `dpkg -i` for offline Debian package installation
   - Requires dependency management and package versioning

3. **Tailscale Integration** (Optional Enhancement)
   - Allow users to configure Tailscale API keys
   - Enable internet access for advanced users
   - Fall back to standard `apt install` when internet available
   - Not the default experience

### 2. Configuration & Data Persistence
**Challenge**: Ensuring all user data and settings survive browser restarts
**Critical Requirements**: Apps, configs, and data must persist automatically

**Solutions**:
- **WebVM Auto-Persistence**: File system changes saved to IndexedDB automatically
- **Service Resurrection**: Create startup scripts to restart applications on WebVM boot
- **Configuration Files**: Store app configs as standard Linux config files in WebVM
- **Process Management**: Use systemd or init scripts for automatic service startup
- **Data Backup**: Optional export/import of WebVM disk image for user backup

### 3. WebVM Performance & Resource Management
**Challenge**: Managing WebVM memory and CPU usage in browser
**Solutions**:
- Single powerful app focus (as specified)
- WebVM hibernation when not in use
- Disk snapshot compression for IndexedDB storage
- Process monitoring via Linux tools within WebVM

### 4. Network Routing Through WebVM
**Challenge**: Routing browser requests to WebVM applications
**Solutions**:
- Use WebVM's integrated networking support (when available)
- Proxy requests through WebVM's WebSocket transport
- Map browser URLs to WebVM internal services
- Handle WebSocket and real-time connections

### 5. Supabase Edge Functions Runtime
**Challenge**: Running Deno runtime within offline WebVM
**Offline Considerations**:
- Cannot download Deno during runtime (no internet)
- Must pre-install Deno in custom disk image
- Edge Functions runtime must be completely self-contained

**Solutions**:
1. **Pre-bundled Deno** (Recommended)
   - Include Deno binary in custom disk image
   - Pre-install common Deno modules and dependencies
   - Create offline-compatible Edge Functions runtime

2. **Custom Runtime** (Alternative)
   - Build minimal Deno-compatible runtime for WebVM
   - Focus on Supabase-specific APIs and use cases
   - Smaller footprint than full Deno installation

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

### Technical Requirements
- ✅ Browser-only operation (no server dependencies)
- ✅ Lazy loading (no impact on main app startup)
- ✅ State persistence across browser sessions
- ✅ Full Supabase API access from applications
- ✅ Support for modern web frameworks

### User Experience Requirements
- ✅ Intuitive deployment workflow
- ✅ Real-time application status and logs
- ✅ Quick startup times (< 5 seconds for cached runtimes)
- ✅ Clear error messages and recovery options
- ✅ Consistent with existing Supabase Lite UI

### Performance Requirements
- ✅ Main application startup time unchanged
- ✅ Runtime loading < 30 seconds (with progress indicator)
- ✅ Application cold start < 10 seconds
- ✅ Hot reload < 2 seconds for file changes

This specification provides a comprehensive roadmap for replacing the existing App Hosting with a much more capable Application Server while maintaining the browser-only architecture that makes Supabase Lite unique.