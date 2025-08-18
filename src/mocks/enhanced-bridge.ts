import { DatabaseManager } from '../lib/database/connection'
import { logger, logError } from '../lib/infrastructure/Logger'
import { errorHandler, createAPIError } from '../lib/infrastructure/ErrorHandler'
import {
  QueryParser,
  SQLBuilder,
  ResponseFormatter
} from '../lib/postgrest'
import type { ParsedQuery, FormattedResponse } from '../lib/postgrest'

interface SupabaseRequest {
  table: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'RPC'
  body?: any
  headers: Record<string, string>
  url: URL
}

export class EnhancedSupabaseAPIBridge {
  private dbManager: DatabaseManager
  private sqlBuilder: SQLBuilder

  constructor() {
    this.dbManager = DatabaseManager.getInstance()
    this.sqlBuilder = new SQLBuilder()
  }

  async ensureInitialized(): Promise<void> {
    if (!this.dbManager.isConnected()) {
      await this.dbManager.initialize()
    }
  }

  /**
   * Handle REST requests with full PostgREST compatibility
   */
  async handleRestRequest(request: SupabaseRequest): Promise<FormattedResponse> {
    await this.ensureInitialized()

    logger.debug('Handling enhanced REST request', {
      method: request.method,
      table: request.table,
      url: request.url.toString(),
      headers: request.headers
    })

    try {
      // Parse the request into structured query
      const query = QueryParser.parseQuery(request.url, request.headers)

      logger.debug('Parsed query', { query })

      switch (request.method) {
        case 'GET':
          return await this.handleSelect(request.table, query)
        case 'POST':
          return await this.handleInsert(request.table, query, request.body)
        case 'PATCH':
          return await this.handleUpdate(request.table, query, request.body)
        case 'DELETE':
          return await this.handleDelete(request.table, query)
        default:
          throw createAPIError(`Unsupported method: ${request.method}`)
      }
    } catch (error) {
      logError('EnhancedSupabaseAPIBridge request', error as Error, {
        method: request.method,
        table: request.table,
      })
      return ResponseFormatter.formatErrorResponse(error as Error)
    }
  }

  /**
   * Handle RPC (stored procedure) calls
   */
  async handleRpc(functionName: string, params: Record<string, any> = {}): Promise<FormattedResponse> {
    await this.ensureInitialized()

    logger.debug('Handling RPC call', { functionName, params })

    try {
      const sqlQuery = this.sqlBuilder.buildRpcQuery(functionName, params)
      logger.debug('Built RPC SQL', sqlQuery)

      const result = await this.executeQuery(sqlQuery.sql, sqlQuery.parameters)
      return ResponseFormatter.formatRpcResponse(result.rows, functionName)
    } catch (error) {
      logError('RPC call failed', error as Error, { functionName, params })
      return ResponseFormatter.formatErrorResponse(error as Error)
    }
  }

  /**
   * Handle SELECT queries with full PostgREST features
   */
  private async handleSelect(table: string, query: ParsedQuery): Promise<FormattedResponse> {
    try {
      // Build the main query
      const sqlQuery = this.sqlBuilder.buildQuery(table, query)
      logger.debug('Built SELECT SQL', sqlQuery)

      // Execute the query
      const result = await this.executeQuery(sqlQuery.sql, sqlQuery.parameters)

      // Calculate count if requested
      let totalCount
      if (query.count) {
        const countSql = ResponseFormatter.buildCountQuery(sqlQuery.sql)
        logger.debug('Built count SQL', { countSql })
        
        totalCount = await ResponseFormatter.calculateCount(
          query,
          countSql,
          (sql) => this.executeQuery(sql, [])
        )
      }

      return ResponseFormatter.formatSelectResponse(result.rows, query, totalCount)
    } catch (error) {
      logError('SELECT query failed', error as Error, { table, query })
      throw error
    }
  }

  /**
   * Handle INSERT queries
   */
  private async handleInsert(
    table: string,
    query: ParsedQuery,
    body: any
  ): Promise<FormattedResponse> {
    if (!body || typeof body !== 'object') {
      throw new Error('Request body is required for INSERT')
    }

    try {
      const data = Array.isArray(body) ? body : [body]
      const sqlQuery = this.sqlBuilder.buildInsertQuery(table, data)
      
      logger.debug('Built INSERT SQL', sqlQuery)

      const result = await this.executeQuery(sqlQuery.sql, sqlQuery.parameters)
      return ResponseFormatter.formatInsertResponse(result.rows, query)
    } catch (error) {
      logError('INSERT query failed', error as Error, { table, body })
      
      // Handle specific PostgreSQL errors
      if (error instanceof Error) {
        if (error.message.includes('duplicate key')) {
          return ResponseFormatter.formatErrorResponse(error, 409)
        }
        if (error.message.includes('foreign key')) {
          return ResponseFormatter.formatErrorResponse(error, 409)
        }
        if (error.message.includes('check constraint')) {
          return ResponseFormatter.formatErrorResponse(error, 422)
        }
      }
      
      throw error
    }
  }

  /**
   * Handle UPDATE queries
   */
  private async handleUpdate(
    table: string,
    query: ParsedQuery,
    body: any
  ): Promise<FormattedResponse> {
    if (!body || typeof body !== 'object') {
      throw new Error('Request body is required for UPDATE')
    }

    if (query.filters.length === 0) {
      throw new Error('UPDATE requires WHERE conditions')
    }

    try {
      const sqlQuery = this.sqlBuilder.buildUpdateQuery(table, body, query.filters)
      logger.debug('Built UPDATE SQL', sqlQuery)

      const result = await this.executeQuery(sqlQuery.sql, sqlQuery.parameters)
      return ResponseFormatter.formatUpdateResponse(result.rows, query)
    } catch (error) {
      logError('UPDATE query failed', error as Error, { table, body, filters: query.filters })
      throw error
    }
  }

  /**
   * Handle DELETE queries
   */
  private async handleDelete(table: string, query: ParsedQuery): Promise<FormattedResponse> {
    if (query.filters.length === 0) {
      throw new Error('DELETE requires WHERE conditions')
    }

    try {
      const sqlQuery = this.sqlBuilder.buildDeleteQuery(table, query.filters)
      logger.debug('Built DELETE SQL', sqlQuery)

      const result = await this.executeQuery(sqlQuery.sql, sqlQuery.parameters)
      return ResponseFormatter.formatDeleteResponse(result.rows, query)
    } catch (error) {
      logError('DELETE query failed', error as Error, { table, filters: query.filters })
      throw error
    }
  }

  /**
   * Execute SQL query with parameters
   */
  private async executeQuery(sql: string, parameters: any[] = []): Promise<{ rows: any[] }> {
    // Format SQL with parameters for PGlite (which doesn't support parameterized queries)
    let formattedSql = sql
    parameters.forEach((param, index) => {
      const placeholder = `$${index + 1}`
      const formattedValue = this.formatParameterValue(param)
      formattedSql = formattedSql.replace(placeholder, formattedValue)
    })

    logger.debug('Executing SQL', { formattedSql })
    
    try {
      const result = await this.dbManager.query(formattedSql)
      return result
    } catch (error) {
      logError('SQL execution failed', error as Error, { sql: formattedSql })
      throw error
    }
  }

  /**
   * Format parameter value for SQL injection safety
   */
  private formatParameterValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL'
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE'
    }

    if (typeof value === 'number') {
      return String(value)
    }

    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`
    }

    if (Array.isArray(value)) {
      const formattedItems = value.map(item => this.formatParameterValue(item))
      return `ARRAY[${formattedItems.join(', ')}]`
    }

    if (typeof value === 'object') {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
    }

    return `'${String(value).replace(/'/g, "''")}'`
  }

  // Auth methods remain the same as the original bridge
  async handleAuth(endpoint: string, method: string, body?: any): Promise<any> {
    await this.ensureInitialized()
    
    switch (endpoint) {
      case 'signup':
        return this.handleSignup(body)
      case 'signin':
        return this.handleSignin(body)
      case 'signout':
        return this.handleSignout()
      case 'user':
        return this.handleGetUser()
      case 'refresh':
        return this.handleRefreshToken(body)
      default:
        throw new Error(`Unsupported auth endpoint: ${endpoint}`)
    }
  }

  private async handleSignup(body: any): Promise<any> {
    const { email, password, ...metadata } = body
    
    // Check if user already exists
    const existingUser = await this.executeQuery(
      `SELECT id FROM auth.users WHERE email = $1`,
      [email]
    )
    
    if (existingUser.rows.length > 0) {
      throw new Error('User already exists')
    }
    
    // Create user
    const userId = crypto.randomUUID()
    const hashedPassword = await this.hashPassword(password)
    
    await this.executeQuery(
      `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data) 
       VALUES ($1, $2, $3, NOW(), NOW(), NOW(), $4)`,
      [userId, email, hashedPassword, JSON.stringify(metadata)]
    )
    
    const accessToken = this.generateJWT({ sub: userId, email })
    const refreshToken = crypto.randomUUID()
    
    // Create session
    await this.executeQuery(
      `INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())`,
      [refreshToken, userId]
    )
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 3600,
      user: {
        id: userId,
        email,
        user_metadata: metadata
      }
    }
  }

  private async handleSignin(body: any): Promise<any> {
    const { email, password } = body
    
    const user = await this.executeQuery(
      `SELECT id, email, encrypted_password, raw_user_meta_data FROM auth.users WHERE email = $1`,
      [email]
    )
    
    if (user.rows.length === 0) {
      throw new Error('Invalid credentials')
    }
    
    const userData = user.rows[0]
    const isValidPassword = await this.verifyPassword(password, userData.encrypted_password)
    
    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }
    
    const accessToken = this.generateJWT({ sub: userData.id, email })
    const refreshToken = crypto.randomUUID()
    
    // Create session
    await this.executeQuery(
      `INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())`,
      [refreshToken, userData.id]
    )
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 3600,
      user: {
        id: userData.id,
        email: userData.email,
        user_metadata: JSON.parse(userData.raw_user_meta_data || '{}')
      }
    }
  }

  private async handleSignout(): Promise<any> {
    // In a real implementation, we'd invalidate the session
    return { message: 'Signed out successfully' }
  }

  private async handleGetUser(): Promise<any> {
    // In a real implementation, we'd decode the JWT from headers
    return { user: null }
  }

  private async handleRefreshToken(body: any): Promise<any> {
    const { refresh_token } = body
    
    // Verify refresh token exists
    const session = await this.executeQuery(
      `SELECT user_id FROM auth.sessions WHERE id = $1`,
      [refresh_token]
    )
    
    if (session.rows.length === 0) {
      throw new Error('Invalid refresh token')
    }
    
    const userId = session.rows[0].user_id
    const user = await this.executeQuery(
      `SELECT email FROM auth.users WHERE id = $1`,
      [userId]
    )
    
    const accessToken = this.generateJWT({ sub: userId, email: user.rows[0].email })
    
    return {
      access_token: accessToken,
      refresh_token: refresh_token,
      token_type: 'bearer',
      expires_in: 3600
    }
  }

  private async hashPassword(password: string): Promise<string> {
    // Simple hash for development - in production you'd use bcrypt or similar
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const hash = await this.hashPassword(password)
    return hash === hashedPassword
  }

  private generateJWT(payload: any): string {
    // Simple JWT simulation for development
    const header = { alg: 'HS256', typ: 'JWT' }
    const headerEncoded = btoa(JSON.stringify(header))
    const payloadEncoded = btoa(JSON.stringify({ ...payload, exp: Date.now() + 3600000 }))
    const signature = btoa(`signature_${Date.now()}`)
    
    return `${headerEncoded}.${payloadEncoded}.${signature}`
  }
}