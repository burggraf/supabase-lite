import type { DatabaseRequest, DatabaseResponse } from './types'

/**
 * Configuration for WebVM Database Bridge
 */
export interface WebVMDatabaseBridgeConfig {
  baseUrl: string
  projectId: string
  timeout?: number
  retryAttempts?: number
}

/**
 * Authentication context from JWT token
 */
export interface AuthContext {
  sub?: string // User ID
  role?: string // User role (authenticated, anon, etc.)
  email?: string // User email
  [key: string]: any // Additional claims
}

/**
 * Supabase client request format for transformation
 */
export interface SupabaseRequest {
  table: string
  method: 'select' | 'insert' | 'update' | 'delete'
  select?: string[]
  filters?: Array<{
    column: string
    operator: string
    value: any
  }>
  body?: any
  order?: Array<{
    column: string
    ascending?: boolean
  }>
  limit?: number
  offset?: number
}

/**
 * Message Passing Bridge for WebVM Edge Functions to access PGlite database
 * 
 * This bridge enables Edge Functions running in WebVM to communicate
 * with the local PGlite database through postMessage communication,
 * providing full Supabase client compatibility without requiring network access.
 */
export class WebVMDatabaseBridge {
  private config: Required<WebVMDatabaseBridgeConfig>
  private authContext: AuthContext | null = null
  private messageListeners: Map<string, (event: MessageEvent) => void> = new Map()
  private requestCounter: number = 0

  constructor(config: WebVMDatabaseBridgeConfig) {
    this.config = {
      ...config,
      timeout: config.timeout ?? 15000,
      retryAttempts: config.retryAttempts ?? 3
    }
  }

  /**
   * Set authentication context from JWT token
   */
  setAuthContext(context: AuthContext): void {
    this.authContext = context
  }

  /**
   * Clear authentication context
   */
  clearAuthContext(): void {
    this.authContext = null
  }

  /**
   * Get current timeout setting
   */
  getTimeout(): number {
    return this.config.timeout
  }

  /**
   * Execute database request via message passing to parent window
   */
  async executeRequest(request: DatabaseRequest): Promise<DatabaseResponse> {
    // In WebVM context, use postMessage to communicate with parent window
    // instead of direct HTTP requests (which are blocked by lack of networking)
    
    const requestId = this.generateRequestId()
    const messageRequest = {
      type: 'database-request',
      requestId,
      request: {
        ...request,
        path: this.buildPath(request.path),
        headers: this.buildHeaders(request.headers)
      }
    }

    console.log(`🌐 WebVM Database Bridge: ${request.method} ${messageRequest.request.path} (via postMessage)`)

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = window.setTimeout(() => {
        this.cleanupMessageListener(requestId)
        console.error('❌ WebVM Database Bridge: Request timeout')
        resolve({
          status: 408,
          error: 'Request timeout',
          message: `Request exceeded ${this.config.timeout}ms timeout`
        })
      }, this.config.timeout)

      // Set up response listener
      const messageHandler = (event: MessageEvent) => {
        if (event.data.type === 'database-response' && event.data.requestId === requestId) {
          window.clearTimeout(timeoutId)
          this.cleanupMessageListener(requestId)
          
          const response = event.data.response as DatabaseResponse
          console.log(`✅ WebVM Database Bridge: ${response.status} (via postMessage)`)
          resolve(response)
        }
      }

      // Store listener for cleanup
      this.messageListeners.set(requestId, messageHandler)
      
      // Add event listener
      window.addEventListener('message', messageHandler)

      try {
        // Send message to parent window
        console.log('🔄 WebVMDatabaseBridge: Sending message to parent window', messageRequest)
        
        if (window.parent && window.parent !== window) {
          console.log('🔄 WebVMDatabaseBridge: Parent window available, sending message')
          window.parent.postMessage(messageRequest, '*')
        } else {
          // In test environments or WebVM context without parent window,
          // fall back to direct HTTP request to MSW handlers
          console.log('🔄 WebVMDatabaseBridge: No parent window, using direct HTTP fallback')
          this.fallbackToDirectHttp(request, requestId, timeoutId, resolve)
        }
      } catch (error) {
        clearTimeout(timeoutId)
        this.cleanupMessageListener(requestId)
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('❌ WebVM Database Bridge:', errorMessage)
        resolve({
          status: 500,
          error: errorMessage,
          message: 'Failed to send message to parent window'
        })
      }
    })
  }

  /**
   * Validate connection to database
   */
  async validateConnection(): Promise<boolean> {
    try {
      const healthCheck: DatabaseRequest = {
        method: 'GET',
        path: '/health',
        headers: {}
      }

      const response = await this.executeRequest(healthCheck)
      return response.status === 200
    } catch {
      return false
    }
  }

  /**
   * Transform Supabase client request to HTTP format
   */
  transformSupabaseRequest(supabaseRequest: SupabaseRequest): DatabaseRequest {
    const { table, method, select, filters, body, order, limit, offset } = supabaseRequest

    if (method === 'select') {
      return this.buildSelectRequest(table, { select, filters, order, limit, offset })
    } else if (method === 'insert') {
      return this.buildInsertRequest(table, body)
    } else if (method === 'update') {
      return this.buildUpdateRequest(table, body, filters)
    } else if (method === 'delete') {
      return this.buildDeleteRequest(table, filters)
    } else {
      throw new Error(`Unsupported method: ${method}`)
    }
  }

  /**
   * Generate unique request ID for message passing
   */
  private generateRequestId(): string {
    return `db-req-${Date.now()}-${++this.requestCounter}`
  }

  /**
   * Clean up message listener for a specific request
   */
  private cleanupMessageListener(requestId: string): void {
    const handler = this.messageListeners.get(requestId)
    if (handler) {
      window.removeEventListener('message', handler)
      this.messageListeners.delete(requestId)
    }
  }

  /**
   * Fallback to direct HTTP request when parent window is not available
   */
  private async fallbackToDirectHttp(
    request: DatabaseRequest,
    requestId: string,
    timeoutId: number,
    resolve: (response: DatabaseResponse) => void
  ): Promise<void> {
    try {
      // In test environments, MSW will intercept the request
      // In real environments, this will route through Envoy proxy
      const baseUrl = typeof window !== 'undefined' && window.location 
        ? 'http://localhost:8080'
        : 'http://localhost:8080'
      const url = `${baseUrl}${request.path}`
      console.log('🔄 WebVMDatabaseBridge: Fallback HTTP request to', url)

      const response = await fetch(url, {
        method: request.method,
        headers: request.headers,
        body: request.body
      })

      const responseData = await response.json()

      clearTimeout(timeoutId)
      this.cleanupMessageListener(requestId)

      resolve({
        status: response.status,
        data: responseData,
        error: response.ok ? null : responseData.error || 'Request failed',
        message: response.ok ? 'Success' : responseData.message
      })

    } catch (error) {
      clearTimeout(timeoutId)
      this.cleanupMessageListener(requestId)

      const errorMessage = error instanceof Error ? error.message : 'Network error'
      console.error('❌ WebVMDatabaseBridge fallback HTTP error:', errorMessage)
      resolve({
        status: 500,
        error: errorMessage,
        message: 'Direct HTTP fallback failed'
      })
    }
  }

  /**
   * Build path for request (with project ID for HTTP requests)
   */
  private buildPath(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    
    // Always include project ID for HTTP requests to match MSW handler expectations
    return `/${this.config.projectId}${cleanPath}`
  }

  /**
   * Build full URL for request (legacy method, kept for compatibility)
   */
  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${this.config.baseUrl}/${this.config.projectId}${cleanPath}`
  }

  /**
   * Build headers with authentication context
   */
  private buildHeaders(requestHeaders: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...requestHeaders
    }

    // Inject user context from JWT token
    if (this.authContext) {
      if (this.authContext.sub) {
        headers['X-User-Id'] = this.authContext.sub
      }
      if (this.authContext.role) {
        headers['X-User-Role'] = this.authContext.role
      }
      if (this.authContext.email) {
        headers['X-User-Email'] = this.authContext.email
      }
    }

    return headers
  }

  /**
   * Clean up all message listeners (called when bridge is destroyed)
   */
  public cleanup(): void {
    for (const [requestId, handler] of this.messageListeners) {
      window.removeEventListener('message', handler)
    }
    this.messageListeners.clear()
  }

  /**
   * Build SELECT request from Supabase format
   */
  private buildSelectRequest(
    table: string, 
    options: {
      select?: string[]
      filters?: Array<{ column: string; operator: string; value: any }>
      order?: Array<{ column: string; ascending?: boolean }>
      limit?: number
      offset?: number
    }
  ): DatabaseRequest {
    const queryParts: string[] = []

    // Add select clause
    if (options.select && options.select.length > 0) {
      queryParts.push(`select=${options.select.join(',')}`)
    }

    // Add filters
    if (options.filters) {
      for (const filter of options.filters) {
        const value = Array.isArray(filter.value) 
          ? `(${filter.value.join(',')})` 
          : filter.value

        queryParts.push(`${filter.column}=${filter.operator}.${value}`)
      }
    }

    // Add ordering
    if (options.order && options.order.length > 0) {
      const orderBy = options.order
        .map(o => `${o.column}.${o.ascending === false ? 'desc' : 'asc'}`)
        .join(',')
      queryParts.push(`order=${orderBy}`)
    }

    // Add pagination
    if (options.limit) {
      queryParts.push(`limit=${options.limit}`)
    }
    if (options.offset) {
      queryParts.push(`offset=${options.offset}`)
    }

    const queryString = queryParts.join('&')
    const path = `/rest/v1/${table}${queryString ? '?' + queryString : ''}`

    return {
      method: 'GET',
      path,
      headers: {}
    }
  }

  /**
   * Build INSERT request from Supabase format
   */
  private buildInsertRequest(table: string, body: any): DatabaseRequest {
    return {
      method: 'POST',
      path: `/rest/v1/${table}`,
      headers: {
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body)
    }
  }

  /**
   * Build UPDATE request from Supabase format
   */
  private buildUpdateRequest(
    table: string, 
    body: any, 
    filters?: Array<{ column: string; operator: string; value: any }>
  ): DatabaseRequest {
    const queryParts: string[] = []

    // Add filters
    if (filters) {
      for (const filter of filters) {
        queryParts.push(`${filter.column}=${filter.operator}.${filter.value}`)
      }
    }

    const queryString = queryParts.join('&')
    const path = `/rest/v1/${table}${queryString ? '?' + queryString : ''}`

    return {
      method: 'PATCH',
      path,
      headers: {
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body)
    }
  }

  /**
   * Build DELETE request from Supabase format
   */
  private buildDeleteRequest(
    table: string, 
    filters?: Array<{ column: string; operator: string; value: any }>
  ): DatabaseRequest {
    const queryParts: string[] = []

    // Add filters
    if (filters) {
      for (const filter of filters) {
        queryParts.push(`${filter.column}=${filter.operator}.${filter.value}`)
      }
    }

    const queryString = queryParts.join('&')
    const path = `/rest/v1/${table}${queryString ? '?' + queryString : ''}`

    return {
      method: 'DELETE',
      path,
      headers: {}
    }
  }
}