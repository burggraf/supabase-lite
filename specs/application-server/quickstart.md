# Application Server - Developer Quickstart Guide

## Overview

This quickstart guide helps developers get started implementing the Application Server feature that replaces App Hosting with a comprehensive WebVM-based runtime environment. Follow this guide to understand the architecture, set up your development environment, and implement your first feature.

## Prerequisites

### Development Environment
- Node.js 18+ with npm/yarn
- Modern browser with SharedArrayBuffer support (Chrome 88+, Firefox 89+, Safari 14+)
- Git for version control
- Docker (for building runtime packages)

### Required Knowledge
- TypeScript/React development
- WebAssembly basics
- Linux command line
- Container/virtualization concepts

## Quick Setup

### 1. Environment Setup
```bash
# Clone the repository
git clone <repository-url>
cd supabase-lite

# Switch to application server branch
git checkout application-server

# Install dependencies
npm install

# Start development server
npm run dev
```

### 2. Verify Base System
```bash
# Run tests to ensure everything works
npm test

# Check linting
npm run lint

# Verify build
npm run build
```

## Architecture Quick Reference

### Core Components
```
src/
├── components/application-server/    # Main UI components
│   ├── ApplicationServer.tsx        # Main orchestrator
│   ├── RuntimeBrowser.tsx          # Runtime package browser
│   ├── ApplicationManager.tsx      # App lifecycle management
│   └── WebVMStatus.tsx            # WebVM monitoring
├── lib/application-server/         # Core services
│   ├── WebVMManager.ts            # WebVM lifecycle
│   ├── RuntimeRepository.ts       # Package management
│   ├── ApplicationDeployer.ts     # App deployment
│   └── state/                     # State management
└── mocks/application-server/       # MSW handlers
    └── webvm-handlers.ts          # WebVM API simulation
```

### Key Design Patterns
- **Singleton Services**: WebVMManager, RuntimeRepository
- **Bridge Pattern**: MSW handlers for WebVM communication
- **State Management**: React hooks with IndexedDB persistence
- **Offline-First**: All operations work without internet

## Implementation Workflow

### Phase 1: Basic WebVM Integration

#### Step 1: Create WebVM Manager
```typescript
// src/lib/application-server/WebVMManager.ts
export class WebVMManager implements IWebVMManager {
  private static instance: WebVMManager;
  private webvm: any = null;

  static getInstance(): WebVMManager {
    if (!WebVMManager.instance) {
      WebVMManager.instance = new WebVMManager();
    }
    return WebVMManager.instance;
  }

  async initialize(): Promise<void> {
    // Load WebVM assets
    // Initialize virtual machine
    // Set up file system
  }
}
```

#### Step 2: Create React Hook
```typescript
// src/hooks/useWebVM.ts
export function useWebVM() {
  const [status, setStatus] = useState<WebVMStatus>('unloaded');
  const webvmManager = WebVMManager.getInstance();

  const initialize = useCallback(async () => {
    try {
      setStatus('loading');
      await webvmManager.initialize();
      setStatus('ready');
    } catch (error) {
      setStatus('error');
    }
  }, []);

  return { status, initialize };
}
```

#### Step 3: Create UI Component
```typescript
// src/components/application-server/ApplicationServer.tsx
export function ApplicationServer() {
  const { status, initialize } = useWebVM();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Application Server</h1>
        <WebVMStatus status={status} />
      </div>

      {status === 'unloaded' && (
        <Button onClick={initialize}>Initialize WebVM</Button>
      )}

      {status === 'ready' && (
        <Tabs defaultValue="runtimes">
          <TabsList>
            <TabsTrigger value="runtimes">Runtimes</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
          </TabsList>

          <TabsContent value="runtimes">
            <RuntimeBrowser />
          </TabsContent>

          <TabsContent value="applications">
            <ApplicationManager />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
```

### Phase 2: Runtime Package Management

#### Step 1: Define Package Structure
```typescript
// src/types/application-server.ts
export interface RuntimePackage {
  id: string;                     // 'nodejs-20'
  name: string;                   // 'Node.js 20.x LTS'
  category: RuntimeCategory;
  version: string;
  dependencies: string[];
  debPackages: string[];          // .deb files to install
  size: number;                   // MB
  status: PackageStatus;
}
```

#### Step 2: Implement Package Repository
```typescript
// src/lib/application-server/RuntimeRepository.ts
export class RuntimeRepository implements IRuntimeRepository {
  async getAvailablePackages(): Promise<RuntimePackage[]> {
    // Load package metadata from bundled JSON
    // Return available packages for installation
  }

  async installPackage(packageId: string): Promise<InstallResult> {
    // Transfer .deb files to WebVM
    // Run dpkg installation commands
    // Update package status
    // Handle dependencies
  }
}
```

#### Step 3: Create Package Browser UI
```typescript
// src/components/application-server/RuntimeBrowser.tsx
export function RuntimeBrowser() {
  const [packages, setPackages] = useState<RuntimePackage[]>([]);
  const [installedPackages, setInstalledPackages] = useState<string[]>([]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map(pkg => (
          <PackageCard
            key={pkg.id}
            package={pkg}
            isInstalled={installedPackages.includes(pkg.id)}
            onInstall={() => handleInstall(pkg.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

### Phase 3: Application Deployment

#### Step 1: Create Application Deployer
```typescript
// src/lib/application-server/ApplicationDeployer.ts
export class ApplicationDeployer {
  async deployApplication(config: DeploymentConfig): Promise<DeploymentResult> {
    // Validate runtime requirements
    // Transfer application files to WebVM
    // Run build process if needed
    // Configure application execution
    // Start application process
  }
}
```

#### Step 2: Add MSW Request Routing
```typescript
// src/mocks/application-server/webvm-handlers.ts
export const webvmHandlers = [
  http.all('/app/:appId/*', async ({ request, params }) => {
    const appId = params.appId as string;

    // Forward request to WebVM application
    // Handle response and return to browser
    return new Response(responseData, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }),
];
```

## Development Best Practices

### 1. Testing Strategy
```typescript
// Always write tests first (TDD)
describe('WebVMManager', () => {
  it('should initialize WebVM successfully', async () => {
    const manager = WebVMManager.getInstance();
    await expect(manager.initialize()).resolves.not.toThrow();
  });
});
```

### 2. Error Handling
```typescript
// Implement comprehensive error handling
try {
  await webvmManager.installPackage('nodejs-20');
} catch (error) {
  if (error instanceof PackageConflictError) {
    // Show conflict resolution dialog
  } else if (error instanceof InsufficientSpaceError) {
    // Show cleanup suggestions
  } else {
    // Generic error handling
  }
}
```

### 3. State Management
```typescript
// Use React hooks for local state, IndexedDB for persistence
const [webvmStatus, setWebvmStatus] = useState<WebVMStatus>();

useEffect(() => {
  // Load persisted state on mount
  const loadState = async () => {
    const saved = await PersistenceManager.loadWebVMState();
    if (saved) setWebvmStatus(saved);
  };
  loadState();
}, []);

useEffect(() => {
  // Persist state changes
  if (webvmStatus) {
    PersistenceManager.saveWebVMState(webvmStatus);
  }
}, [webvmStatus]);
```

### 4. Performance Optimization
```typescript
// Use React.memo for expensive components
export const RuntimeBrowser = React.memo(function RuntimeBrowser() {
  // Component implementation
});

// Implement lazy loading for WebVM
const WebVMManager = lazy(() => import('./WebVMManager'));

// Use IndexedDB for large data storage
const persistLargeData = async (data: ArrayBuffer) => {
  const db = await openDB('webvm-storage');
  await db.put('packages', data, 'nodejs-20-package');
};
```

## Common Development Tasks

### Adding a New Runtime Package

1. **Create Package Metadata**
```json
{
  "id": "python-311",
  "name": "Python 3.11",
  "category": "runtime",
  "version": "3.11.0",
  "dependencies": [],
  "debPackages": ["python3.11.deb", "python3-pip.deb"],
  "size": 45
}
```

2. **Build Package Bundle**
```bash
# Create Dockerfile for package
# Build .deb files
# Generate checksums
# Bundle for distribution
```

3. **Add Package Logic**
```typescript
// Add to RuntimeRepository
// Implement installation logic
// Add conflict detection
// Update UI components
```

### Debugging WebVM Issues

1. **Enable Debug Logging**
```typescript
// Add to WebVMManager
console.log('[WebVM]', 'Command:', command);
console.log('[WebVM]', 'Output:', output);
```

2. **Use Browser DevTools**
```javascript
// Check WebVM status in console
window.webvmManager.getStatus();

// Monitor memory usage
performance.measureUserAgentSpecificMemory();
```

3. **Inspect IndexedDB State**
```javascript
// Check persisted data
const db = await openDB('supabase-lite');
const state = await db.get('webvm', 'status');
console.log(state);
```

### Performance Monitoring

1. **Add Performance Metrics**
```typescript
const startTime = performance.now();
await operation();
const duration = performance.now() - startTime;
Logger.info('Operation completed', { duration });
```

2. **Monitor Memory Usage**
```typescript
const getMemoryUsage = () => {
  if ('memory' in performance) {
    return {
      used: (performance as any).memory.usedJSHeapSize,
      total: (performance as any).memory.totalJSHeapSize
    };
  }
  return null;
};
```

## Troubleshooting

### Common Issues

#### WebVM Won't Load
- Check browser compatibility (SharedArrayBuffer support)
- Verify WebAssembly is enabled
- Check for CORS issues with assets
- Ensure sufficient memory available

#### Package Installation Fails
- Verify package checksums
- Check dependency resolution
- Ensure sufficient disk space in WebVM
- Validate .deb package integrity

#### Application Won't Start
- Check runtime requirements are met
- Verify application files transferred correctly
- Check for port conflicts
- Review application logs in WebVM

### Debug Commands
```typescript
// Check WebVM status
await webvmManager.getStatus();

// List installed packages
await runtimeRepository.getInstalledPackages();

// Execute command in WebVM
await webvmManager.execute('ps aux');

// Check application logs
await webvmManager.getLogs('application', 'my-app');
```

## Next Steps

1. **Study the Contracts**: Review interface definitions in `specs/application-server/contracts/`
2. **Read the Research**: Understand technical constraints in `specs/application-server/research.md`
3. **Follow the Tasks**: Implement features according to `specs/application-server/tasks.md`
4. **Test Everything**: Use TDD methodology for all new code
5. **Optimize Performance**: Monitor memory and loading times throughout development

## Resources

- [WebVM 2.0 Documentation](https://webvm.io/docs)
- [WebAssembly Developer Guide](https://webassembly.org/getting-started/developers-guide/)
- [IndexedDB API Reference](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Mock Service Worker Documentation](https://mswjs.io/docs/)

This quickstart guide provides the foundation for implementing the Application Server feature. Follow the phases systematically, write tests first, and refer to the detailed specifications for complete requirements.