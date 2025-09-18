# Data Model: Application Server

**Phase**: 1 - Design & Contracts  
**Date**: 2025-09-17  
**Source**: Derived from feature specification entities

## Core Entities

### Application
Represents a deployed web application in the Application Server.

**Fields**:
- `id: string` - Unique application identifier (used in /app/{id} routing)
- `name: string` - Human-readable application name
- `description?: string` - Optional application description  
- `runtimeId: string` - Reference to runtime environment
- `status: ApplicationStatus` - Current application state
- `createdAt: Date` - Application creation timestamp
- `updatedAt: Date` - Last modification timestamp
- `deploymentId?: string` - Reference to current deployment
- `metadata: ApplicationMetadata` - Additional configuration

**Validation Rules**:
- `id` must be unique, alphanumeric with hyphens, 3-50 characters
- `name` required, 1-100 characters
- `description` optional, max 500 characters
- `runtimeId` must reference existing runtime environment

**State Transitions**:
- `stopped` → `starting` → `running`
- `running` → `stopping` → `stopped`  
- `*` → `error` (on failure)
- `stopped` → `deploying` → `stopped` (deployment)

### RuntimeEnvironment
Represents an available execution environment for applications.

**Fields**:
- `id: string` - Unique runtime identifier (e.g., "nodejs-20", "nextjs-15")
- `name: string` - Display name (e.g., "Node.js 20.x")
- `type: RuntimeType` - Runtime category
- `version: string` - Specific version identifier
- `dockerImage?: string` - Docker image reference for WebVM
- `status: RuntimeStatus` - Installation and availability status
- `installedAt?: Date` - Installation timestamp
- `lastUsed?: Date` - Last usage timestamp
- `config: RuntimeConfig` - Runtime-specific configuration

**Validation Rules**:
- `id` must be unique, follow naming convention
- `type` must be valid RuntimeType enum value
- `version` must follow semantic versioning
- `dockerImage` required for non-static runtimes

**Relationships**:
- One-to-many with Application (one runtime can host multiple apps)
- Referenced by Application.runtimeId

### WebVMInstance  
Represents the virtual machine state and lifecycle.

**Fields**:
- `id: string` - Unique WebVM instance identifier
- `status: WebVMStatus` - Current VM state
- `runtimeIds: string[]` - Installed runtime environments
- `activeApplicationId?: string` - Currently running application
- `lastSnapshot?: Date` - Last state snapshot timestamp
- `memoryUsage?: number` - Current memory usage in MB
- `createdAt: Date` - Instance creation time
- `config: WebVMConfig` - VM configuration and limits

**State Transitions**:
- `uninitialized` → `initializing` → `ready`
- `ready` → `running` (when app starts)
- `running` → `ready` (when app stops)
- `*` → `error` (on VM failure)

### ApplicationDeployment
Represents a deployment operation and its artifacts.

**Fields**:
- `id: string` - Unique deployment identifier
- `applicationId: string` - Target application reference
- `status: DeploymentStatus` - Deployment state
- `artifacts: DeploymentArtifacts` - Uploaded files and metadata
- `runtimeId: string` - Target runtime environment
- `deployedAt?: Date` - Successful deployment timestamp
- `deployedBy?: string` - User or system identifier
- `config: DeploymentConfig` - Deployment-specific settings
- `logs: DeploymentLog[]` - Deployment operation logs

**Validation Rules**:
- `applicationId` must reference existing application
- `runtimeId` must reference existing runtime
- `artifacts` must contain valid application files

**Relationships**:
- Many-to-one with Application (application can have multiple deployments)
- References RuntimeEnvironment

### RoutingRule
Represents URL routing configuration for applications.

**Fields**:
- `pattern: string` - URL pattern (e.g., "/app/{appId}")
- `applicationId: string` - Target application
- `priority: number` - Routing priority (lower = higher priority)
- `active: boolean` - Whether rule is currently active
- `config: RoutingConfig` - Additional routing configuration

**Validation Rules**:
- `pattern` must be valid URL pattern with parameters
- `applicationId` must reference existing application
- `priority` must be positive integer

## Type Definitions

### Enums

```typescript
enum ApplicationStatus {
  STOPPED = 'stopped',
  STARTING = 'starting', 
  RUNNING = 'running',
  STOPPING = 'stopping',
  DEPLOYING = 'deploying',
  ERROR = 'error'
}

enum RuntimeType {
  STATIC = 'static',
  NODEJS = 'nodejs',
  NEXTJS = 'nextjs', 
  PYTHON = 'python',
  EDGE_FUNCTIONS = 'edge-functions'
}

enum RuntimeStatus {
  AVAILABLE = 'available',
  INSTALLING = 'installing',
  INSTALLED = 'installed',
  ERROR = 'error'
}

enum WebVMStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  RUNNING = 'running',
  ERROR = 'error'
}

enum DeploymentStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  PROCESSING = 'processing', 
  DEPLOYED = 'deployed',
  FAILED = 'failed'
}
```

### Complex Types

```typescript
interface ApplicationMetadata {
  entryPoint?: string;
  buildCommand?: string;
  startCommand?: string;
  environmentVariables?: Record<string, string>;
  dependencies?: string[];
}

interface RuntimeConfig {
  defaultPort: number;
  supportedExtensions: string[];
  buildRequired: boolean;
  startupTimeout: number;
  resourceLimits: {
    memory: number;
    cpu: number;
  };
}

interface WebVMConfig {
  memoryLimit: number;
  diskLimit: number; 
  networkEnabled: boolean;
  snapshotEnabled: boolean;
}

interface DeploymentArtifacts {
  files: FileDescriptor[];
  totalSize: number;
  checksum: string;
}

interface DeploymentConfig {
  buildArgs?: Record<string, string>;
  environmentVariables?: Record<string, string>;
  healthCheck?: HealthCheckConfig;
}

interface RoutingConfig {
  rewriteRules?: RewriteRule[];
  headers?: Record<string, string>;
  cors?: CorsConfig;
}
```

## Storage Strategy

### IndexedDB Schema
- **Applications Store**: Application entities with indexes on status, runtimeId
- **Runtimes Store**: RuntimeEnvironment entities with indexes on type, status  
- **WebVM Store**: WebVMInstance state and snapshots
- **Deployments Store**: ApplicationDeployment history and artifacts
- **Routing Store**: RoutingRule configurations

### WebVM Filesystem
- `/apps/{appId}/` - Application files and runtime
- `/runtimes/{runtimeId}/` - Runtime environment installations
- `/snapshots/` - VM state snapshots for persistence
- `/logs/` - Application and system logs

## Data Relationships

```
Application ──────────────► RuntimeEnvironment
     │                            ▲
     │                            │
     ▼                            │ 
ApplicationDeployment ─────────────┘
     │
     ▼
RoutingRule

WebVMInstance ◄──── manages ──────► RuntimeEnvironment
     │                                    │
     └──── runs ──────► Application ──────┘
```

## Persistence Requirements

1. **Cross-session persistence**: All entities survive browser refresh/restart
2. **State consistency**: WebVM state matches entity status  
3. **Cleanup policies**: Remove unused deployments after 30 days
4. **Backup/restore**: Support export/import of application configurations
5. **Migration support**: Handle schema evolution for data model changes