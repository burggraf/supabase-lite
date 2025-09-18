/**
 * TypeScript types for Application Server feature
 * Based on data-model.md specifications
 */

// Core Entity Types

export interface Application {
  id: string; // Unique application identifier (used in /app/{id} routing)
  name: string; // Human-readable application name
  description?: string; // Optional application description
  runtimeId: string; // Reference to runtime environment
  status: ApplicationStatus; // Current application state
  url?: string; // Application URL when running (e.g., http://localhost:5174/app/app-123)
  createdAt: Date; // Application creation timestamp
  updatedAt: Date; // Last modification timestamp
  deploymentId?: string; // Reference to current deployment
  metadata: ApplicationMetadata; // Additional configuration
}

export interface RuntimeEnvironment {
  id: string; // Unique runtime identifier (e.g., "nodejs-20", "nextjs-15")
  name: string; // Display name (e.g., "Node.js 20.x")
  type: RuntimeType; // Runtime category
  version: string; // Specific version identifier
  dockerImage?: string; // Docker image reference for WebVM
  status: RuntimeStatus; // Installation and availability status
  installedAt?: Date; // Installation timestamp
  lastUsed?: Date; // Last usage timestamp
  config: RuntimeConfig; // Runtime-specific configuration
}

export interface WebVMInstance {
  id: string; // Unique WebVM instance identifier
  status: WebVMStatus; // Current VM state
  runtimeIds: string[]; // Installed runtime environments
  activeApplicationId?: string; // Currently running application
  lastSnapshot?: Date; // Last state snapshot timestamp
  memoryUsage?: number; // Current memory usage in MB
  createdAt: Date; // Instance creation time
  config: WebVMConfig; // VM configuration and limits
}

export interface ApplicationDeployment {
  id: string; // Unique deployment identifier
  applicationId: string; // Target application reference
  status: DeploymentStatus; // Deployment state
  artifacts: DeploymentArtifacts; // Uploaded files and metadata
  runtimeId: string; // Target runtime environment
  deployedAt?: Date; // Successful deployment timestamp
  deployedBy?: string; // User or system identifier
  config: DeploymentConfig; // Deployment-specific settings
  logs: DeploymentLog[]; // Deployment operation logs
}

export interface RoutingRule {
  pattern: string; // URL pattern (e.g., "/app/{appId}")
  applicationId: string; // Target application
  priority: number; // Routing priority (lower = higher priority)
  active: boolean; // Whether rule is currently active
  config: RoutingConfig; // Additional routing configuration
}

// Enum Types (using const objects for better compatibility)

export const ApplicationStatus = {
  STOPPED: 'stopped',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  DEPLOYING: 'deploying',
  ERROR: 'error'
} as const;

export const RuntimeType = {
  STATIC: 'static',
  NODEJS: 'nodejs',
  NEXTJS: 'nextjs',
  PYTHON: 'python',
  EDGE_FUNCTIONS: 'edge-functions'
} as const;

export const RuntimeStatus = {
  AVAILABLE: 'available',
  INSTALLING: 'installing',
  INSTALLED: 'installed',
  ERROR: 'error'
} as const;

export const WebVMStatus = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  READY: 'ready',
  RUNNING: 'running',
  ERROR: 'error'
} as const;

export const DeploymentStatus = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  DEPLOYED: 'deployed',
  FAILED: 'failed'
} as const;

// Type aliases for the const values
export type ApplicationStatus = typeof ApplicationStatus[keyof typeof ApplicationStatus];
export type RuntimeType = typeof RuntimeType[keyof typeof RuntimeType];
export type RuntimeStatus = typeof RuntimeStatus[keyof typeof RuntimeStatus];
export type WebVMStatus = typeof WebVMStatus[keyof typeof WebVMStatus];
export type DeploymentStatus = typeof DeploymentStatus[keyof typeof DeploymentStatus];

// Complex Types

export interface ApplicationMetadata {
  entryPoint?: string;
  buildCommand?: string;
  startCommand?: string;
  environmentVariables?: Record<string, string>;
  dependencies?: string[];
}

export interface RuntimeConfig {
  defaultPort: number;
  supportedExtensions: string[];
  buildRequired: boolean;
  startupTimeout: number;
  resourceLimits: {
    memory: number;
    cpu: number;
  };
}

export interface WebVMConfig {
  memoryLimit: number;
  diskLimit: number;
  networkEnabled: boolean;
  snapshotEnabled: boolean;
}

export interface DeploymentArtifacts {
  files: FileDescriptor[];
  totalSize: number;
  checksum: string;
}

export interface DeploymentConfig {
  buildArgs?: Record<string, string>;
  environmentVariables?: Record<string, string>;
  healthCheck?: HealthCheckConfig;
}

export interface RoutingConfig {
  rewriteRules?: RewriteRule[];
  headers?: Record<string, string>;
  cors?: CorsConfig;
}

export interface FileDescriptor {
  path: string;
  size: number;
  type: string;
  lastModified: Date;
  content?: Uint8Array;
}

export interface DeploymentLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckConfig {
  enabled: boolean;
  path?: string;
  interval?: number;
  timeout?: number;
  retries?: number;
}

export interface RewriteRule {
  from: string;
  to: string;
  conditions?: string[];
}

export interface CorsConfig {
  origins: string[];
  methods: string[];
  headers: string[];
  credentials: boolean;
}

// API Request/Response Types

export interface CreateApplicationRequest {
  id: string;
  name: string;
  description?: string;
  runtimeId: string;
  metadata?: ApplicationMetadata;
}

export interface UpdateApplicationRequest {
  name?: string;
  description?: string;
  metadata?: ApplicationMetadata;
}

export interface WebVMInitRequest {
  config?: WebVMConfig;
  restoreFromSnapshot?: boolean;
}

export interface SnapshotResponse {
  snapshotId: string;
  status: 'creating' | 'completed' | 'failed';
  createdAt: Date;
  size?: number;
}

export interface RestoreRequest {
  snapshotId: string;
}

// WebVM Bridge Communication Types

export interface WebVMMessage {
  type: string;
  id: string;
  payload: Record<string, unknown>;
}

export interface WebVMHttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string | ArrayBuffer;
}

export interface WebVMHttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string | ArrayBuffer;
}

// Error Types

export class ApplicationServerError extends Error {
  public code: string;
  public details?: Record<string, unknown>;
  public timestamp: Date;

  constructor(errorInfo: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: Date;
  }) {
    super(errorInfo.message);
    this.name = 'ApplicationServerError';
    this.code = errorInfo.code;
    this.details = errorInfo.details;
    this.timestamp = errorInfo.timestamp;
  }
}

export interface ApplicationServerErrorInfo {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export class ValidationError extends ApplicationServerError {
  public field: string;
  public rule: string;

  constructor(errorInfo: {
    code: string;
    message: string;
    field: string;
    rule: string;
    details?: Record<string, unknown>;
    timestamp: Date;
  }) {
    super(errorInfo);
    this.name = 'ValidationError';
    this.field = errorInfo.field;
    this.rule = errorInfo.rule;
  }
}

// Storage Types (for IndexedDB persistence)

export interface ApplicationStorageItem {
  application: Application;
  deployments: ApplicationDeployment[];
  routing: RoutingRule[];
}

export interface RuntimeStorageItem {
  runtime: RuntimeEnvironment;
  installations: Date[];
  usage: {
    applicationIds: string[];
    lastAccessed: Date;
  };
}

export interface WebVMStorageItem {
  instance: WebVMInstance;
  snapshots: {
    id: string;
    timestamp: Date;
    size: number;
    data: ArrayBuffer;
  }[];
}

// Hook Return Types

export interface UseApplicationServerReturn {
  applications: Application[];
  runtimes: RuntimeEnvironment[];
  webvm: WebVMInstance | null;
  loading: boolean;
  error: ApplicationServerError | null;
  
  // Application management
  createApplication: (request: CreateApplicationRequest) => Promise<Application>;
  updateApplication: (id: string, request: UpdateApplicationRequest) => Promise<Application>;
  deleteApplication: (id: string) => Promise<void>;
  startApplication: (id: string) => Promise<Application>;
  stopApplication: (id: string) => Promise<Application>;
  deployApplication: (id: string, files: File[], config?: DeploymentConfig) => Promise<ApplicationDeployment>;
  
  // Runtime management
  installRuntime: (runtimeId: string) => Promise<RuntimeEnvironment>;
  uninstallRuntime: (runtimeId: string, force?: boolean) => Promise<RuntimeEnvironment>;
  
  // WebVM management
  initializeWebVM: (config?: WebVMConfig) => Promise<WebVMInstance>;
  snapshotWebVM: () => Promise<SnapshotResponse>;
  restoreWebVM: (snapshotId: string) => Promise<WebVMInstance>;
  resetWebVM: () => Promise<WebVMInstance>;
}

export interface UseWebVMReturn {
  instance: WebVMInstance | null;
  status: WebVMStatus;
  loading: boolean;
  error: ApplicationServerError | null;
  
  initialize: (config?: WebVMConfig) => Promise<WebVMInstance>;
  snapshot: () => Promise<SnapshotResponse>;
  restore: (snapshotId: string) => Promise<WebVMInstance>;
  reset: () => Promise<WebVMInstance>;
  sendMessage: (message: WebVMMessage) => Promise<WebVMMessage>;
}

export interface UseApplicationDeploymentReturn {
  deployments: ApplicationDeployment[];
  loading: boolean;
  error: ApplicationServerError | null;
  
  deploy: (applicationId: string, files: File[], config?: DeploymentConfig) => Promise<ApplicationDeployment>;
  getDeployment: (deploymentId: string) => ApplicationDeployment | null;
  getDeploymentLogs: (deploymentId: string) => DeploymentLog[];
}