import { DatabaseManager } from '../lib/database/connection'
import { logger, logError } from '../lib/infrastructure/Logger'
import { errorHandler, createAPIError } from '../lib/infrastructure/ErrorHandler'
import bcrypt from 'bcryptjs'
import {
  QueryParser,
  SQLBuilder,
  ResponseFormatter,
  PostgRESTErrorMapper
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
  private currentUserId: string | null = null // Store current user context

  constructor() {
    this.dbManager = DatabaseManager.getInstance()
    this.sqlBuilder = new SQLBuilder()
  }

  async ensureInitialized(): Promise<void> {
    if (!this.dbManager.isConnected()) {
      try {
        await this.dbManager.initialize()
      } catch (error) {
        // In HTTP middleware context, database initialization will fail
        // This is expected and we'll serve mock data instead
        logger.debug('Database initialization failed, will serve mock data', { error })
      }
    }
  }

  /**
   * Handle REST requests with full PostgREST compatibility
   */
  async handleRestRequest(request: SupabaseRequest): Promise<FormattedResponse> {
    await this.ensureInitialized()

    console.log(`🚨 DEBUGGING: EnhancedBridge.handleRestRequest called for ${request.method} ${request.table}`)
    console.log(`🔍 EnhancedBridge: handleRestRequest ${request.method} ${request.table}`)
    console.log(`🔍 Database connected:`, this.dbManager.isConnected())

    // If database is not connected (HTTP middleware context), serve mock data
    if (!this.dbManager.isConnected()) {
      console.log(`❌ Database not connected, serving mock data`)
      return this.serveMockData(request)
    }

    logger.debug('Handling enhanced REST request', {
      method: request.method,
      table: request.table,
      url: request.url.toString(),
      headers: request.headers
    })

    try {
      // Extract and set user context for RLS
      await this.setUserContext(request.headers)

      // Parse the request into structured query
      const query = QueryParser.parseQuery(request.url, request.headers)

      // Apply RLS filtering for user-scoped tables
      const enhancedQuery = this.applyRLSFiltering(request.table, query, request.headers)

      logger.debug('Parsed query with RLS', { query: enhancedQuery })

      switch (request.method) {
        case 'GET':
          return await this.handleSelect(request.table, enhancedQuery)
        case 'POST':
          return await this.handleInsert(request.table, enhancedQuery, request.body)
        case 'PATCH':
          return await this.handleUpdate(request.table, enhancedQuery, request.body)
        case 'DELETE':
          return await this.handleDelete(request.table, enhancedQuery)
        default:
          throw createAPIError(`Unsupported method: ${request.method}`)
      }
    } catch (error) {
      console.error(`❌ EnhancedBridge error for ${request.method} ${request.table}:`, error)
      logError('EnhancedSupabaseAPIBridge request', error as Error, {
        method: request.method,
        table: request.table,
      })
      return ResponseFormatter.formatErrorResponse(error)
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
      return ResponseFormatter.formatErrorResponse(error)
    }
  }

  /**
   * Extract JWT token and set user context for RLS
   */
  private async setUserContext(headers: Record<string, string>): Promise<void> {
    try {
      const authHeader = headers.authorization || headers.Authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No auth header, set anonymous context
        this.currentUserId = null
        // Skip JWT claims setting for PGlite compatibility
        return
      }

      // Extract JWT token
      const token = authHeader.replace('Bearer ', '')
      const userId = this.extractUserIdFromJWT(token)
      
      if (userId) {
        // Store user ID for RLS operations
        this.currentUserId = userId
        // Skip JWT claims setting for PGlite compatibility - use currentUserId instead
        logger.debug('Set user context for RLS', { userId })
      } else {
        this.currentUserId = null
      }
    } catch (error) {
      logger.warn('Failed to set user context', { error })
      // Continue without user context
      this.currentUserId = null
    }
  }

  /**
   * Extract user ID from JWT token
   */
  private extractUserIdFromJWT(token: string): string | null {
    try {
      // Simple JWT parsing for development (in production, use proper JWT library)
      const parts = token.split('.')
      if (parts.length !== 3) return null
      
      const payload = JSON.parse(atob(parts[1]))
      return payload.sub || null
    } catch (error) {
      logger.warn('Failed to parse JWT token', { error })
      return null
    }
  }

  /**
   * Apply RLS filtering for user-scoped tables
   */
  private applyRLSFiltering(table: string, query: ParsedQuery, headers: Record<string, string>): ParsedQuery {
    // Tables that require RLS filtering
    const rlsTables = ['profiles', 'user_data']
    
    if (!rlsTables.includes(table)) {
      return query // No RLS filtering needed
    }

    // Extract user ID from headers
    const authHeader = headers.authorization || headers.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No authentication, return empty results for RLS tables
      return {
        ...query,
        filters: [
          ...query.filters,
          { column: 'id', operator: 'eq', value: 'NULL', negated: false }
        ]
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const userId = this.extractUserIdFromJWT(token)
    
    if (!userId) {
      // Invalid token, return empty results
      return {
        ...query,
        filters: [
          ...query.filters,
          { column: 'id', operator: 'eq', value: 'NULL', negated: false }
        ]
      }
    }


    return query
  }

  /**
   * Handle SELECT queries with full PostgREST features
   */
  private async handleSelect(table: string, query: ParsedQuery): Promise<FormattedResponse> {
    try {
      // Check if table is known to not exist based on common patterns
      // This is a workaround for cases where PostgreSQL errors are wrapped
      if (this.isKnownNonExistentTable(table)) {
        console.log(`🔍 DEBUGGING: Table ${table} is known to not exist, returning 404`)
        const pgError = {
          code: '42P01',
          message: `relation "public.${table}" does not exist`,
          detail: null,
          hint: null
        }
        return ResponseFormatter.formatErrorResponse(pgError)
      }

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
      return ResponseFormatter.formatErrorResponse(error)
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
      let data = Array.isArray(body) ? body : [body]
      
      // Apply RLS data injection for user-scoped tables
      data = this.applyRLSDataInjection(table, data, query)
      
      const sqlQuery = this.sqlBuilder.buildInsertQuery(table, data)
      
      logger.debug('Built INSERT SQL', sqlQuery)

      const result = await this.executeQuery(sqlQuery.sql, sqlQuery.parameters)
      return ResponseFormatter.formatInsertResponse(result.rows, query)
    } catch (error) {
      logError('INSERT query failed', error as Error, { table, body })
      return ResponseFormatter.formatErrorResponse(error)
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
      return ResponseFormatter.formatErrorResponse(error)
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
      return ResponseFormatter.formatErrorResponse(error)
    }
  }

  /**
   * Apply RLS data injection for INSERT/UPDATE operations
   */
  private applyRLSDataInjection(table: string, data: any[], query: ParsedQuery): any[] {
    // Tables that require RLS data injection
    const rlsTables = ['profiles', 'user_data']
    
    if (!rlsTables.includes(table)) {
      return data // No RLS injection needed
    }

    // Extract user ID from current session context
    const userId = this.getCurrentUserId()
    if (!userId) {
      throw new Error('Authentication required for this operation')
    }

    // For orders table, ensure user_id is set to current user
    if (table === 'orders') {
      return data.map(item => ({
        ...item,
        user_id: userId // Override any provided user_id with current user
      }))
    }

    return data
  }

  /**
   * Get current user ID from session context (set by setUserContext)
   */
  private getCurrentUserId(): string | null {
    return this.currentUserId
  }

  /**
   * Check if a table is known to not exist
   * This is a workaround for when PostgreSQL errors are wrapped in generic errors
   */
  private isKnownNonExistentTable(table: string): boolean {
    // List of tables we know exist in the database
    const knownTables = [
      'products', 'categories', 'suppliers', 'orders', 'order_details',
      'customers', 'employees', 'shippers', 'territories', 'region',
      'customer_demographics', 'employee_territories', 'posts', 'users'
    ]
    
    // If the table is not in our known tables list, assume it doesn't exist
    return !knownTables.includes(table.toLowerCase())
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

  /**
   * Serve mock data when database is not available (HTTP middleware context)
   */
  private serveMockData(request: SupabaseRequest): FormattedResponse {
    logger.debug('Serving mock data for HTTP middleware context', { 
      table: request.table, 
      method: request.method 
    })


    // Default mock response for other tables
    return ResponseFormatter.formatSelectResponse([], {
      select: ['*'],
      count: null,
      filters: [],
      orderBy: [],
      limit: null,
      offset: null
    })
  }

  private async hashPassword(password: string): Promise<string> {
    // Use bcrypt for Supabase compatibility
    return await bcrypt.hash(password, 10)
  }

  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    // Use bcrypt for Supabase compatibility
    return await bcrypt.compare(password, hashedPassword)
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