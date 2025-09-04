import { WebVMDatabaseBridge } from './WebVMDatabaseBridge'
import type { DatabaseRequest } from './types'

/**
 * Supabase client configuration for WebVM environment
 */
export interface WebVMSupabaseConfig {
  url: string
  key: string
  projectId: string
  timeout?: number
}

/**
 * Supabase-compatible error type
 */
export interface PostgrestError {
  message: string
  details?: string
  hint?: string | null
  code?: string
}

/**
 * Generic response type for Supabase operations
 */
export interface PostgrestResponse<T> {
  data: T | null
  error: PostgrestError | null
  count?: number | null
  status?: number
  statusText?: string
}

/**
 * Query builder interface for chaining operations
 */
export interface PostgrestQueryBuilder<T> {
  select(columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated' }): PostgrestQueryBuilder<T>
  insert(value: Partial<T> | Partial<T>[], options?: { returning?: 'minimal' | 'representation' }): PostgrestQueryBuilder<T>
  update(value: Partial<T>, options?: { returning?: 'minimal' | 'representation' }): PostgrestQueryBuilder<T>
  delete(): PostgrestQueryBuilder<T>
  
  // Filters
  eq(column: string, value: any): PostgrestQueryBuilder<T>
  neq(column: string, value: any): PostgrestQueryBuilder<T>
  gt(column: string, value: any): PostgrestQueryBuilder<T>
  gte(column: string, value: any): PostgrestQueryBuilder<T>
  lt(column: string, value: any): PostgrestQueryBuilder<T>
  lte(column: string, value: any): PostgrestQueryBuilder<T>
  like(column: string, pattern: string): PostgrestQueryBuilder<T>
  ilike(column: string, pattern: string): PostgrestQueryBuilder<T>
  in(column: string, values: any[]): PostgrestQueryBuilder<T>
  is(column: string, value: any): PostgrestQueryBuilder<T>
  
  // Modifiers
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): PostgrestQueryBuilder<T>
  limit(count: number): PostgrestQueryBuilder<T>
  offset(count: number): PostgrestQueryBuilder<T>
  range(from: number, to: number): PostgrestQueryBuilder<T>
  single(): PostgrestQueryBuilder<T>
  maybeSingle(): PostgrestQueryBuilder<T>
  
  // Execution
  then<TResult1 = PostgrestResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: PostgrestResponse<T>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2>
}

/**
 * Query builder implementation for PostgrestQueryBuilder
 */
class WebVMPostgrestQueryBuilder<T> implements PostgrestQueryBuilder<T> {
  private tableName: string
  private bridge: WebVMDatabaseBridge
  private auth: string | null = null
  
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private selectColumns: string = '*'
  private insertData: any = null
  private updateData: any = null
  private filters: Array<{ column: string; operator: string; value: any }> = []
  private ordering: Array<{ column: string; ascending: boolean }> = []
  private limitCount: number | null = null
  private offsetCount: number | null = null
  private isSingle: boolean = false
  private countOption: 'exact' | 'planned' | 'estimated' | null = null
  private prefer: string[] = []
  private apikey: string | null = null

  constructor(
    tableName: string, 
    bridge: WebVMDatabaseBridge, 
    auth: string | null = null,
    apikey: string | null = null
  ) {
    this.tableName = tableName
    this.bridge = bridge
    this.auth = auth
    this.apikey = apikey
  }

  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated' }): PostgrestQueryBuilder<T> {
    // Only change operation to 'select' if no other operation has been set
    if (this.operation === 'select' && this.insertData === null && this.updateData === null) {
      this.operation = 'select'
    }
    
    this.selectColumns = columns
    if (options?.count) {
      this.countOption = options.count
    }
    
    // For insert/update operations, select() means we want to return data
    if (this.operation === 'insert' || this.operation === 'update') {
      this.prefer.push('return=representation')
    }
    
    return this
  }

  insert(value: Partial<T> | Partial<T>[], options?: { returning?: 'minimal' | 'representation' }): PostgrestQueryBuilder<T> {
    this.operation = 'insert'
    this.insertData = value
    if (options?.returning === 'representation') {
      this.prefer.push('return=representation')
    }
    return this
  }

  update(value: Partial<T>, options?: { returning?: 'minimal' | 'representation' }): PostgrestQueryBuilder<T> {
    this.operation = 'update'
    this.updateData = value
    if (options?.returning === 'representation') {
      this.prefer.push('return=representation')
    }
    return this
  }

  delete(): PostgrestQueryBuilder<T> {
    this.operation = 'delete'
    return this
  }

  // Filter methods
  eq(column: string, value: any): PostgrestQueryBuilder<T> {
    this.filters.push({ column, operator: 'eq', value })
    return this
  }

  neq(column: string, value: any): PostgrestQueryBuilder<T> {
    this.filters.push({ column, operator: 'neq', value })
    return this
  }

  gt(column: string, value: any): PostgrestQueryBuilder<T> {
    this.filters.push({ column, operator: 'gt', value })
    return this
  }

  gte(column: string, value: any): PostgrestQueryBuilder<T> {
    this.filters.push({ column, operator: 'gte', value })
    return this
  }

  lt(column: string, value: any): PostgrestQueryBuilder<T> {
    this.filters.push({ column, operator: 'lt', value })
    return this
  }

  lte(column: string, value: any): PostgrestQueryBuilder<T> {
    this.filters.push({ column, operator: 'lte', value })
    return this
  }

  like(column: string, pattern: string): PostgrestQueryBuilder<T> {
    this.filters.push({ column, operator: 'like', value: pattern })
    return this
  }

  ilike(column: string, pattern: string): PostgrestQueryBuilder<T> {
    this.filters.push({ column, operator: 'ilike', value: pattern })
    return this
  }

  in(column: string, values: any[]): PostgrestQueryBuilder<T> {
    this.filters.push({ column, operator: 'in', value: values })
    return this
  }

  is(column: string, value: any): PostgrestQueryBuilder<T> {
    this.filters.push({ column, operator: 'is', value })
    return this
  }

  // Modifier methods
  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}): PostgrestQueryBuilder<T> {
    this.ordering.push({ column, ascending: options.ascending !== false })
    return this
  }

  limit(count: number): PostgrestQueryBuilder<T> {
    this.limitCount = count
    return this
  }

  offset(count: number): PostgrestQueryBuilder<T> {
    this.offsetCount = count
    return this
  }

  range(from: number, to: number): PostgrestQueryBuilder<T> {
    this.offsetCount = from
    this.limitCount = to - from + 1
    return this
  }

  single(): PostgrestQueryBuilder<T> {
    this.isSingle = true
    this.prefer.push('return=representation')
    return this
  }

  maybeSingle(): PostgrestQueryBuilder<T> {
    this.isSingle = true
    return this
  }

  /**
   * Execute the query and return results
   */
  async then<TResult1 = PostgrestResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: PostgrestResponse<T>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.executeQuery()
      if (onfulfilled) {
        return onfulfilled(result)
      }
      return result as TResult1
    } catch (error) {
      if (onrejected) {
        return onrejected(error)
      }
      throw error
    }
  }

  /**
   * Build and execute the database request
   */
  private async executeQuery(): Promise<PostgrestResponse<T>> {
    const request = this.buildRequest()
    const response = await this.bridge.executeRequest(request)

    if (response.status && response.status >= 400) {
      const error: PostgrestError = {
        message: response.error || 'Database operation failed',
        details: response.message,
        code: this.getErrorCode(response.status)
      }

      return {
        data: null,
        error,
        status: response.status
      }
    }

    let data = response.data
    let count: number | null = null

    // Handle single() responses
    if (this.isSingle && Array.isArray(data)) {
      data = data.length > 0 ? data[0] : null
    }

    // Extract count from Content-Range header (would be implemented in real scenario)
    if (this.countOption) {
      // In real implementation, this would parse the Content-Range header
      // For now, we'll simulate it
      count = Array.isArray(response.data) ? response.data.length : null
    }

    return {
      data,
      error: null,
      count,
      status: response.status
    }
  }

  /**
   * Build HTTP request from query parameters
   */
  private buildRequest(): DatabaseRequest {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    // Add authentication
    if (this.auth) {
      headers['Authorization'] = this.auth
    }
    
    // Add API key
    if (this.apikey) {
      headers['apikey'] = this.apikey
    }

    // Add preferences
    if (this.prefer.length > 0) {
      headers['Prefer'] = this.prefer.join(', ')
    }

    // Add single response preference
    if (this.isSingle) {
      headers['Accept'] = 'application/vnd.pgrst.object+json'
    }

    if (this.operation === 'select') {
      return this.buildSelectRequest(headers)
    } else if (this.operation === 'insert') {
      return this.buildInsertRequest(headers)
    } else if (this.operation === 'update') {
      return this.buildUpdateRequest(headers)
    } else if (this.operation === 'delete') {
      return this.buildDeleteRequest(headers)
    } else {
      throw new Error(`Unsupported operation: ${this.operation}`)
    }
  }

  private buildSelectRequest(headers: Record<string, string>): DatabaseRequest {
    const queryParts: string[] = []

    // Add select - normalize spaces in column list
    const normalizedColumns = this.selectColumns.replace(/\s*,\s*/g, ',')
    queryParts.push(`select=${normalizedColumns}`)

    // Add filters
    for (const filter of this.filters) {
      const value = Array.isArray(filter.value) 
        ? `(${filter.value.join(',')})` 
        : filter.value
      queryParts.push(`${filter.column}=${filter.operator}.${value}`)
    }

    // Add ordering
    if (this.ordering.length > 0) {
      const orderBy = this.ordering
        .map(o => `${o.column}.${o.ascending ? 'asc' : 'desc'}`)
        .join(',')
      queryParts.push(`order=${orderBy}`)
    }

    // Add pagination
    if (this.limitCount !== null) {
      queryParts.push(`limit=${this.limitCount}`)
    }
    if (this.offsetCount !== null) {
      queryParts.push(`offset=${this.offsetCount}`)
    }

    const queryString = queryParts.join('&')
    const path = `/rest/v1/${this.tableName}?${queryString}`

    return { method: 'GET', path, headers }
  }

  private buildInsertRequest(headers: Record<string, string>): DatabaseRequest {
    return {
      method: 'POST',
      path: `/rest/v1/${this.tableName}`,
      headers,
      body: JSON.stringify(this.insertData)
    }
  }

  private buildUpdateRequest(headers: Record<string, string>): DatabaseRequest {
    const queryParts: string[] = []

    // Add filters
    for (const filter of this.filters) {
      queryParts.push(`${filter.column}=${filter.operator}.${filter.value}`)
    }

    const queryString = queryParts.join('&')
    const path = `/rest/v1/${this.tableName}${queryString ? '?' + queryString : ''}`

    return {
      method: 'PATCH',
      path,
      headers,
      body: JSON.stringify(this.updateData)
    }
  }

  private buildDeleteRequest(headers: Record<string, string>): DatabaseRequest {
    const queryParts: string[] = []

    // Add filters
    for (const filter of this.filters) {
      queryParts.push(`${filter.column}=${filter.operator}.${filter.value}`)
    }

    const queryString = queryParts.join('&')
    const path = `/rest/v1/${this.tableName}${queryString ? '?' + queryString : ''}`

    return { method: 'DELETE', path, headers }
  }

  /**
   * Map HTTP status codes to error codes
   */
  private getErrorCode(status: number): string {
    switch (status) {
      case 401: return 'UNAUTHORIZED'
      case 403: return 'FORBIDDEN'
      case 404: return 'NOT_FOUND'
      case 409: return 'CONFLICT'
      case 422: return 'VALIDATION_ERROR'
      default: return 'DATABASE_ERROR'
    }
  }
}

/**
 * WebVM-compatible Supabase client for Edge Functions
 * 
 * This client provides full Supabase compatibility within the WebVM environment,
 * enabling Edge Functions to interact with the local PGlite database through
 * the HTTP bridge.
 */
export class WebVMSupabaseClient {
  private bridge: WebVMDatabaseBridge
  private auth: string | null = null
  private config: WebVMSupabaseConfig

  constructor(config: WebVMSupabaseConfig) {
    this.config = config
    this.bridge = new WebVMDatabaseBridge({
      baseUrl: config.url,
      projectId: config.projectId,
      timeout: config.timeout
    })
  }

  /**
   * Set authentication token
   */
  setAuth(token: string): void {
    this.auth = token
  }

  /**
   * Clear authentication token
   */
  clearAuth(): void {
    this.auth = null
  }

  /**
   * Create a query builder for a table
   */
  from<T = any>(table: string): PostgrestQueryBuilder<T> {
    return new WebVMPostgrestQueryBuilder<T>(table, this.bridge, this.auth, this.config.key)
  }

  /**
   * Call a PostgreSQL function (RPC)
   */
  async rpc<T = any>(functionName: string, params: Record<string, any> = {}): Promise<PostgrestResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.auth) {
      headers['Authorization'] = this.auth
    }

    const request: DatabaseRequest = {
      method: 'POST',
      path: `/rest/v1/rpc/${functionName}`,
      headers,
      body: JSON.stringify(params)
    }

    try {
      const response = await this.bridge.executeRequest(request)

      if (response.status && response.status >= 400) {
        const error: PostgrestError = {
          message: response.error || 'RPC call failed',
          details: response.message,
          code: this.getErrorCode(response.status)
        }

        return {
          data: null,
          error
        }
      }

      return {
        data: response.data,
        error: null
      }
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
          code: 'NETWORK_ERROR'
        }
      }
    }
  }

  /**
   * Map HTTP status codes to error codes
   */
  private getErrorCode(status: number): string {
    switch (status) {
      case 401: return 'UNAUTHORIZED'
      case 403: return 'FORBIDDEN'
      case 404: return 'NOT_FOUND'
      case 409: return 'CONFLICT'
      case 422: return 'VALIDATION_ERROR'
      default: return 'DATABASE_ERROR'
    }
  }
}

// Export a factory function for creating clients in WebVM
export function createWebVMSupabaseClient(config: WebVMSupabaseConfig): WebVMSupabaseClient {
  return new WebVMSupabaseClient(config)
}