/**
 * WebVM Bridge
 * 
 * Provides HTTP bridge between WebVM-hosted Deno functions and PGlite database.
 * This enables functions running in WebVM to access the local database seamlessly.
 */

import { WebVMManager } from './WebVMManager'
import { FunctionInvocation, FunctionResponse } from './types'

interface DatabaseRequest {
  method: string
  path: string
  body: unknown
  headers: Record<string, string>
}

interface DatabaseResponse {
  status: number
  data?: unknown
  error?: string
  headers?: Record<string, string>
}

interface FunctionContext {
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

interface NetworkConfiguration {
  allowedHosts: string[]
  allowedProtocols: string[]
  dnsResolvers: string[]
}

interface FunctionEnvironment {
  [key: string]: string
}

interface PerformanceMetrics {
  totalRequests: number
  averageResponseTime: number
  errorRate: number
  activeConnections: number
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  webvmConnection: 'connected' | 'disconnected'
  databaseConnection: 'connected' | 'disconnected'
  uptime: number
}

export class WebVMBridge {
  private enabled: boolean = false
  private webvmManager: WebVMManager
  private requestCount: number = 0
  private errorCount: number = 0
  private responseTimes: number[] = []
  private rateLimitMap: Map<string, number[]> = new Map()
  private startTime: number = Date.now()
  
  // Rate limiting configuration
  private readonly RATE_LIMIT_WINDOW = 60000 // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 100

  constructor() {
    this.webvmManager = WebVMManager.getInstance()
  }

  /**
   * Check if bridge is enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Enable the bridge
   */
  async enable(): Promise<void> {
    const status = this.webvmManager.getStatus()
    
    if (status.state !== 'running') {
      throw new Error('WebVM is not running')
    }
    
    this.enabled = true
    console.log('[WebVMBridge] Bridge enabled successfully')
  }

  /**
   * Disable the bridge
   */
  disable(): void {
    this.enabled = false
    console.log('[WebVMBridge] Bridge disabled')
  }

  /**
   * Proxy database request from WebVM to PGlite
   */
  async proxyDatabaseRequest(
    method: string,
    path: string,
    body: unknown,
    headers: Record<string, string>
  ): Promise<DatabaseResponse> {
    if (!this.enabled) {
      throw new Error('WebVM Bridge is not enabled')
    }

    const startTime = Date.now()
    this.requestCount++

    // Log the request
    console.log(`[WebVMBridge] ${method} ${path}`)

    try {
      // Build full URL
      const url = `http://localhost:5173${path}`
      
      // Prepare headers
      const requestHeaders = {
        'Content-Type': 'application/json',
        ...headers
      }

      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : null
      }

      // Make the request
      const response = await fetch(url, requestOptions)
      
      // Track response time
      const responseTime = Date.now() - startTime
      this.responseTimes.push(responseTime)
      
      // Parse response
      let data: unknown
      const contentType = response.headers.get('content-type') || ''
      
      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      if (!response.ok) {
        this.errorCount++
        return {
          status: response.status,
          error: typeof data === 'object' && data && 'error' in data 
            ? (data as any).error 
            : response.statusText,
          data,
          headers: Object.fromEntries(response.headers.entries())
        }
      }

      return {
        status: response.status,
        data,
        headers: Object.fromEntries(response.headers.entries())
      }

    } catch (error) {
      this.errorCount++
      const responseTime = Date.now() - startTime
      this.responseTimes.push(responseTime)
      
      return {
        status: 500,
        error: (error as Error).message,
        data: null
      }
    }
  }

  /**
   * Create function execution context with database access
   */
  createFunctionContext(context: FunctionContext): {
    environment: FunctionEnvironment,
    networkConfig: NetworkConfiguration
  } {
    const environment = this.getFunctionEnvironment(context)
    const networkConfig = this.getNetworkConfiguration()
    
    return {
      environment,
      networkConfig
    }
  }

  /**
   * Get network configuration for WebVM
   */
  getNetworkConfiguration(): NetworkConfiguration {
    return {
      allowedHosts: [
        'localhost:5173',
        '*.github.com',
        '*.deno.land',
        '*.jsdelivr.net'
      ],
      allowedProtocols: ['http', 'https'],
      dnsResolvers: ['8.8.8.8', '8.8.4.4']
    }
  }

  /**
   * Get function execution environment
   */
  getFunctionEnvironment(context: FunctionContext): FunctionEnvironment {
    return {
      // Supabase configuration
      SUPABASE_URL: 'http://localhost:5173',
      SUPABASE_ANON_KEY: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDk5NTIwMCwiaXNzIjoic3VwYWJhc2UifQ.test',
      SUPABASE_JWT: context.user ? this.generateUserJWT(context.user) : '',
      
      // Deno permissions
      DENO_PERMISSIONS: '--allow-net=localhost:5173,deno.land,cdn.jsdelivr.net --allow-env --allow-read',
      
      // User context
      USER_ID: context.user?.id || '',
      USER_EMAIL: context.user?.email || '',
      USER_ROLE: context.user?.role || 'anon',
      
      // Project context
      PROJECT_ID: context.project.id,
      PROJECT_NAME: context.project.name
    }
  }

  /**
   * Execute function in WebVM with database access
   */
  async executeFunctionWithDatabaseAccess(
    functionName: string,
    invocation: FunctionInvocation
  ): Promise<{
    status: number,
    data?: unknown,
    error?: string,
    logs?: string[],
    metrics?: { duration: number, memory: number, cpu: number }
  }> {
    if (!this.enabled) {
      throw new Error('WebVM Bridge is not enabled')
    }

    try {
      // Execute function in WebVM
      const response = await this.webvmManager.invokeFunction(functionName, invocation)
      
      // Parse response body if it's a JSON string
      let data = response.body
      if (typeof response.body === 'string') {
        try {
          data = JSON.parse(response.body)
        } catch {
          // Keep as string if not valid JSON
          data = response.body
        }
      }

      if (response.status >= 400) {
        return {
          status: response.status,
          error: typeof data === 'object' && data && 'error' in data 
            ? (data as any).error 
            : 'Function execution failed',
          logs: response.logs,
          metrics: response.metrics
        }
      }

      return {
        status: response.status,
        data,
        logs: response.logs,
        metrics: response.metrics
      }

    } catch (error) {
      return {
        status: 500,
        error: (error as Error).message,
        logs: [`Error: ${(error as Error).message}`],
        metrics: { duration: 0, memory: 0, cpu: 0 }
      }
    }
  }

  /**
   * Validate JWT token (mock implementation)
   */
  validateJWTToken(token: string): boolean {
    // In a real implementation, this would validate against the JWT secret
    // For now, just check if it looks like a JWT
    const parts = token.split('.')
    return parts.length === 3 && parts.every(part => part.length > 0)
  }

  /**
   * Sanitize database request path
   */
  sanitizePath(path: string): string {
    // Remove potentially dangerous SQL injection attempts
    const sanitized = path
      .replace(/[';]/g, '') // Remove semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove multiline comment start
      .replace(/\*\//g, '') // Remove multiline comment end
      .replace(/DROP\s+TABLE/gi, '') // Remove DROP TABLE
      .replace(/DELETE\s+FROM/gi, '') // Remove DELETE FROM (basic protection)
      .replace(/INSERT\s+INTO/gi, '') // Remove INSERT INTO (basic protection)
    
    return sanitized
  }

  /**
   * Check rate limiting for client
   */
  checkRateLimit(clientId: string): boolean {
    const now = Date.now()
    const windowStart = now - this.RATE_LIMIT_WINDOW
    
    // Get existing requests for this client
    let requests = this.rateLimitMap.get(clientId) || []
    
    // Remove old requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart)
    
    // Check if under the limit
    if (requests.length >= this.RATE_LIMIT_MAX_REQUESTS) {
      return false
    }
    
    // Add this request
    requests.push(now)
    this.rateLimitMap.set(clientId, requests)
    
    return true
  }

  /**
   * Check if database operation is allowed
   */
  isOperationAllowed(operation: string): boolean {
    const allowedOps = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'WITH']
    const restrictedOps = ['DROP', 'CREATE', 'ALTER', 'TRUNCATE', 'EXEC', 'EXECUTE']
    
    const upperOp = operation.toUpperCase()
    
    // Explicitly blocked operations
    if (restrictedOps.some(restricted => upperOp.includes(restricted))) {
      return false
    }
    
    // Check if it starts with an allowed operation
    return allowedOps.some(allowed => upperOp.startsWith(allowed))
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const avgResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0
    
    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0
    
    return {
      totalRequests: this.requestCount,
      averageResponseTime: Math.round(avgResponseTime),
      errorRate: parseFloat(errorRate.toFixed(4)),
      activeConnections: this.enabled ? 1 : 0
    }
  }

  /**
   * Get bridge health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const webvmStatus = this.webvmManager.getStatus()
    
    return {
      status: this.enabled && webvmStatus.ready ? 'healthy' : 'unhealthy',
      webvmConnection: webvmStatus.ready ? 'connected' : 'disconnected',
      databaseConnection: 'connected', // Assume database is connected if bridge is enabled
      uptime: Date.now() - this.startTime
    }
  }

  /**
   * Generate user JWT token (mock implementation)
   */
  private generateUserJWT(user: { id: string; email: string; role: string }): string {
    // In a real implementation, this would generate a proper JWT
    // For now, return a mock JWT with user info
    const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'HS256' }))
    const payload = btoa(JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    }))
    const signature = btoa('mock-signature')
    
    return `${header}.${payload}.${signature}`
  }
}