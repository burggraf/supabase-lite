/**
 * WebVM Types and Interfaces
 * 
 * Type definitions for WebVM integration with Supabase Lite Edge Functions
 */

// WebVM Configuration Types
export interface WebVMConfig {
  memory: string                    // '1G', '2G', etc.
  cpu: number                      // Number of CPU cores
  networking: {
    enabled: boolean
    tailscale: {
      authKey: string
      exitNode?: string
    }
  }
  storage: {
    persistent: boolean
    size: string                   // '1G', '2G', etc.
  }
}

// WebVM Status Types
export interface WebVMStatus {
  state: 'stopped' | 'starting' | 'running' | 'stopping' | 'error'
  ready: boolean
  error: string | null
  uptime: number                   // milliseconds
  deno: {
    available: boolean
    version: string | null
  }
  postgrest: {
    installed: boolean
    running: boolean
    version: string | null
    port: number | null
    bridgeConnected: boolean
  }
  edgeRuntime: {
    installed: boolean
    running: boolean
    denoVersion: string | null
    runtimeVersion: string | null
    port: number | null
  }
  network: {
    connected: boolean
    tailscaleStatus: 'connected' | 'disconnected' | 'connecting' | 'error'
  }
  functions: {
    deployed: string[]             // Function names
    active: number                 // Currently executing
    total: number                  // Total deployed
  }
  resources: {
    memory: {
      used: string
      total: string
      limit: string
    }
    cpu: {
      usage: number                // 0-1 scale
      cores: number
    }
    storage: {
      used: string
      total: string
    }
  }
}

// Function Execution Types
export interface FunctionInvocation {
  method: string
  headers: Record<string, string>
  body?: unknown
  context: {
    user?: {
      id: string
      email: string
      role: string
    }
    project: {
      id: string
      name: string
    }
  }
}

export interface FunctionResponse {
  status: number
  headers: Record<string, string>
  body: unknown
  logs: string[]
  metrics: {
    duration: number               // milliseconds
    memory: number                 // MB
    cpu: number                    // 0-1 scale
  }
}

// Function Deployment Types
export interface FunctionDeployment {
  success: boolean
  functionName: string
  version: number | null
  deployedAt: Date | null
  error: string | null
  codeSize: number                 // bytes
  compilationTime: number | null   // milliseconds
}

// Metrics Types
export interface WebVMMetrics {
  memory: {
    used: number                   // bytes
    total: number                  // bytes
    available: number              // bytes
  }
  cpu: {
    usage: number                  // 0-1 scale
    cores: number
    load: number[]                 // [1min, 5min, 15min]
  }
  network: {
    bytesIn: number
    bytesOut: number
    connectionsActive: number
  }
  functions: {
    totalExecutions: number
    averageExecutionTime: number   // milliseconds
    errorRate: number              // 0-1 scale
  }
}

// Event Types
export interface WebVMEvent {
  type: 'started' | 'stopped' | 'error' | 'function-deployed' | 'function-removed' | 'function-executed' | 'postgrest-ready' | 'postgrest-installed' | 'edge-runtime-ready' | 'edge-runtime-installed' | 'networking-ready'
  timestamp: Date
  data: Record<string, unknown>
}

// Function Removal Result
export interface FunctionRemoval {
  success: boolean
  functionName: string
  error?: string
}

// Database Bridge Types
export interface DatabaseRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  headers: Record<string, string>
  body?: string
}

export interface DatabaseResponse {
  status: number
  data?: any
  error?: string
  message?: string
}