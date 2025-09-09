import { DatabaseManager, type SessionContext } from '../lib/database/connection'
import { logger, logError } from '../lib/infrastructure/Logger'
import { createAPIError } from '../lib/infrastructure/ErrorHandler'
import { apiKeyGenerator } from '../lib/auth/api-keys'
import { RLSEnforcer } from '../lib/auth/rls-enforcer'
import bcrypt from 'bcryptjs'
import {
  QueryParser,
  SQLBuilder,
  ResponseFormatter,
} from '../lib/postgrest'
import type { ParsedQuery, FormattedResponse } from '../lib/postgrest'

interface SupabaseRequest {
  table: string
  method: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE' | 'RPC'
  body?: any
  headers: Record<string, string>
  url: URL
}

export class EnhancedSupabaseAPIBridge {
  private dbManager: DatabaseManager
  private sqlBuilder: SQLBuilder

  constructor() {
    this.dbManager = DatabaseManager.getInstance()
    this.sqlBuilder = new SQLBuilder(this.dbManager)
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


    // If database is not connected (HTTP middleware context), serve mock data
    if (!this.dbManager.isConnected()) {
      return this.serveMockData(request)
    }

    logger.debug('Handling enhanced REST request', {
      method: request.method,
      table: request.table,
      url: request.url.toString(),
      headers: request.headers
    })

    try {
      // Parse the request into structured query
      const query = QueryParser.parseQuery(request.url, request.headers)

      // Apply RLS filtering for user-scoped tables
      const { query: enhancedQuery, context } = await this.applyRLSFiltering(request.table, query, request.headers)

      logger.debug('Parsed query with RLS', { query: enhancedQuery, context: context.role })

      switch (request.method) {
        case 'GET':
          return await this.handleSelect(request.table, enhancedQuery, context)
        case 'HEAD':
          // HEAD requests should return same headers as GET but no body
          const headResult = await this.handleSelect(request.table, enhancedQuery, context)
          return {
            ...headResult,
            data: null // HEAD returns no body, only headers
          }
        case 'POST':
          // Check if this is an upsert request (prefer: resolution=merge-duplicates)
          if (enhancedQuery.preferResolution === 'merge-duplicates') {
            return await this.handleUpsert(request.table, enhancedQuery, request.body, context)
          } else {
            return await this.handleInsert(request.table, enhancedQuery, request.body, context)
          }
        case 'PATCH':
          return await this.handleUpdate(request.table, enhancedQuery, request.body, context)
        case 'DELETE':
          return await this.handleDelete(request.table, enhancedQuery, context)
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
   * Create session context for RLS enforcement based on request headers
   * Handles both API keys and user JWTs
   */
  private async createSessionContext(headers: Record<string, string>): Promise<SessionContext> {
    const apiKey = headers.apikey || headers['x-api-key'];
    const authHeader = headers.authorization || headers.Authorization;

    // Extract role from API key
    let apiKeyRole: 'anon' | 'service_role' = 'anon';
    if (apiKey) {
      const extractedRole = apiKeyGenerator.extractRole(apiKey);
      if (extractedRole) {
        apiKeyRole = extractedRole;
      }
    }

    // If service_role API key, create service context (bypasses RLS)
    if (apiKeyRole === 'service_role') {
      return {
        role: 'service_role',
        claims: {
          role: 'service_role',
          iss: 'supabase-lite'
        }
      };
    }

    // Extract user context from Bearer token if present
    let userClaims = null;
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        // Try to extract user ID from JWT (existing method)
        userId = this.extractUserIdFromJWT(token);
        
        // For now, create basic user claims
        if (userId) {
          userClaims = {
            sub: userId,
            role: 'authenticated',
            iss: 'supabase-lite'
          };
        }
      } catch (error) {
        logger.debug('Failed to parse user JWT', { error });
      }
    }

    // Return appropriate context
    if (userClaims && userId) {
      // Authenticated user
      return {
        role: 'authenticated',
        userId: userId,
        claims: userClaims
      };
    } else {
      // Anonymous user (with anon API key)
      return {
        role: 'anon',
        claims: {
          role: 'anon',
          iss: 'supabase-lite'
        }
      };
    }
  }

  /**
   * Apply RLS by setting session context instead of query filtering
   * RLS is now enforced at the database level via PostgreSQL policies
   */
  private async applyRLSFiltering(table: string, query: ParsedQuery, headers: Record<string, string>): Promise<{ query: ParsedQuery; context: SessionContext }> {
    // Create session context based on headers
    const context = await this.createSessionContext(headers);
    
    logger.debug('Created session context for RLS', { 
      table, 
      role: context.role, 
      userId: context.userId 
    });

    // Return query unchanged - RLS enforcement happens at database level
    return { query, context };
  }

  /**
   * Handle SELECT queries with full PostgREST features
   */
  private async handleSelect(table: string, query: ParsedQuery, context: SessionContext): Promise<FormattedResponse> {
    try {
      // Let the actual database query determine if the table exists
      // Don't pre-filter based on hardcoded table names

      // Build the main query
      const sqlQuery = await this.sqlBuilder.buildQuery(table, query)
      logger.debug('Built SELECT SQL', sqlQuery)

      // Execute the query with RLS context
      const result = await this.executeQueryWithContext(sqlQuery.sql, sqlQuery.parameters, context)

      // Calculate count if requested
      let totalCount
      if (query.count) {
        const countSql = ResponseFormatter.buildCountQuery(sqlQuery.sql)
        logger.debug('Built count SQL', { countSql })
        
        totalCount = await ResponseFormatter.calculateCount(
          query,
          countSql,
          (sql) => this.executeQueryWithContext(sql, [], context)
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
    body: any,
    context: SessionContext
  ): Promise<FormattedResponse> {
    if (!body || typeof body !== 'object') {
      throw new Error('Request body is required for INSERT')
    }

    try {
      const data = Array.isArray(body) ? body : [body]
      
      const sqlQuery = this.sqlBuilder.buildInsertQuery(table, data)
      
      logger.debug('Built INSERT SQL', sqlQuery)

      const result = await this.executeQueryWithContext(sqlQuery.sql, sqlQuery.parameters, context)
      return ResponseFormatter.formatInsertResponse(result.rows, query)
    } catch (error) {
      logError('INSERT query failed', error as Error, { table, body })
      return ResponseFormatter.formatErrorResponse(error)
    }
  }

  /**
   * Handle UPSERT queries (INSERT with ON CONFLICT DO UPDATE)
   */
  private async handleUpsert(
    table: string,
    query: ParsedQuery,
    body: any,
    context: SessionContext
  ): Promise<FormattedResponse> {
    if (!body || typeof body !== 'object') {
      throw new Error('Request body is required for UPSERT')
    }

    try {
      const data = Array.isArray(body) ? body : [body]
      
      const sqlQuery = await this.sqlBuilder.buildUpsertQuery(table, data, query.onConflict)
      
      logger.debug('Built UPSERT SQL', sqlQuery)

      const result = await this.executeQueryWithContext(sqlQuery.sql, sqlQuery.parameters, context)
      return ResponseFormatter.formatInsertResponse(result.rows, query)
    } catch (error) {
      logError('UPSERT query failed', error as Error, { table, body })
      return ResponseFormatter.formatErrorResponse(error)
    }
  }

  /**
   * Handle UPDATE queries
   */
  private async handleUpdate(
    table: string,
    query: ParsedQuery,
    body: any,
    context: SessionContext
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

      const result = await this.executeQueryWithContext(sqlQuery.sql, sqlQuery.parameters, context)
      console.log('🐛 HandleUpdate Debug:', {
        query: query,
        hasSelect: !!query.select,
        selectValue: query.select,
        preferReturn: query.preferReturn,
        resultRowsLength: result.rows.length
      })
      const formattedResponse = ResponseFormatter.formatUpdateResponse(result.rows, query)
      console.log('🐛 Formatted UPDATE response:', {
        status: formattedResponse.status,
        dataType: typeof formattedResponse.data,
        data: formattedResponse.data,
        hasStatusInjection: formattedResponse.data && typeof formattedResponse.data === 'object' && '__supabase_status' in formattedResponse.data
      })
      return formattedResponse
    } catch (error) {
      logError('UPDATE query failed', error as Error, { table, body, filters: query.filters })
      return ResponseFormatter.formatErrorResponse(error)
    }
  }

  /**
   * Handle DELETE queries
   */
  private async handleDelete(table: string, query: ParsedQuery, context: SessionContext): Promise<FormattedResponse> {
    if (query.filters.length === 0) {
      throw new Error('DELETE requires WHERE conditions')
    }

    try {
      const sqlQuery = this.sqlBuilder.buildDeleteQuery(table, query.filters)
      logger.debug('Built DELETE SQL', sqlQuery)

      const result = await this.executeQueryWithContext(sqlQuery.sql, sqlQuery.parameters, context)
      return ResponseFormatter.formatDeleteResponse(result.rows, query)
    } catch (error) {
      logError('DELETE query failed', error as Error, { table, filters: query.filters })
      return ResponseFormatter.formatErrorResponse(error)
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
   * Execute query with session context for RLS enforcement
   */
  private async executeQueryWithContext(sql: string, parameters: any[] = [], context: SessionContext): Promise<{ rows: any[] }> {
    // Format SQL with parameters for PGlite (which doesn't support parameterized queries)
    let formattedSql = sql
    parameters.forEach((param, index) => {
      const placeholder = `$${index + 1}`
      const formattedValue = this.formatParameterValue(param)
      formattedSql = formattedSql.replace(placeholder, formattedValue)
    })

    // Apply application-level RLS enforcement for PGlite compatibility
    const { modifiedSql, shouldEnforceRLS } = RLSEnforcer.applyApplicationRLS(formattedSql, context)
    
    if (shouldEnforceRLS) {
      logger.debug('Applied application-level RLS enforcement', { 
        originalSql: formattedSql.substring(0, 100), 
        modifiedSql: modifiedSql.substring(0, 100),
        role: context.role 
      });
    }
    
    logger.debug('Executing SQL with context', { sql: modifiedSql.substring(0, 100), role: context.role })
    
    try {
      const result = await this.dbManager.queryWithContext(modifiedSql, context)
      return result
    } catch (error) {
      logError('SQL execution with context failed', error as Error, { sql: formattedSql, context: context.role })
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
  async handleAuth(endpoint: string, _method: string, body?: any): Promise<any> {
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
      count: undefined,
      filters: [],
      order: [],
      limit: undefined,
      offset: undefined
    })
  }

  private async hashPassword(password: string): Promise<string> {
    // Use Web Crypto API in browser environment, bcrypt in Node.js
    if (this.isBrowserEnvironment()) {
      const encoder = new TextEncoder()
      const data = encoder.encode(password)
      const salt = crypto.getRandomValues(new Uint8Array(16))
      
      const key = await crypto.subtle.importKey(
        'raw',
        data,
        'PBKDF2',
        false,
        ['deriveBits']
      )
      
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        key,
        256
      )
      
      const hashArray = Array.from(new Uint8Array(derivedBits))
      const saltArray = Array.from(salt)
      
      // Format: $pbkdf2$salt$hash (simplified format for compatibility)
      return `$pbkdf2$${btoa(String.fromCharCode(...saltArray))}$${btoa(String.fromCharCode(...hashArray))}`
    } else {
      // Use bcrypt in Node.js environment
      return await bcrypt.hash(password, 10)
    }
  }

  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      if (this.isBrowserEnvironment()) {
        // Handle PBKDF2 format: $pbkdf2$salt$hash
        if (hashedPassword.startsWith('$pbkdf2$')) {
          const parts = hashedPassword.split('$')
          if (parts.length !== 4) return false
          
          const salt = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0))
          const expectedHash = parts[3]
          
          const encoder = new TextEncoder()
          const data = encoder.encode(password)
          
          const key = await crypto.subtle.importKey(
            'raw',
            data,
            'PBKDF2',
            false,
            ['deriveBits']
          )
          
          const derivedBits = await crypto.subtle.deriveBits(
            {
              name: 'PBKDF2',
              salt: salt,
              iterations: 100000,
              hash: 'SHA-256'
            },
            key,
            256
          )
          
          const hashArray = Array.from(new Uint8Array(derivedBits))
          const actualHash = btoa(String.fromCharCode(...hashArray))
          
          return actualHash === expectedHash
        }
        
        // Can't verify bcrypt hashes in browser
        return false
      } else {
        // Use bcrypt in Node.js environment
        return await bcrypt.compare(password, hashedPassword)
      }
    } catch (error) {
      console.error('Password verification failed:', error)
      return false
    }
  }

  private isBrowserEnvironment(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
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