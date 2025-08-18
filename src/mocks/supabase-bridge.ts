import { DatabaseManager } from '../lib/database/connection';
import { logger, logError } from '../lib/infrastructure/Logger';
import { errorHandler, createAPIError } from '../lib/infrastructure/ErrorHandler';

interface SupabaseRequest {
  table: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: any
  headers: Record<string, string>
  url: URL
}

interface PostgRESTError {
  message: string
  details: string
  hint?: string
  code: string
}

export class SupabaseAPIBridge {
  private dbManager: DatabaseManager

  constructor() {
    this.dbManager = DatabaseManager.getInstance()
  }

  async ensureInitialized(): Promise<void> {
    if (!this.dbManager.isConnected()) {
      await this.dbManager.initialize()
    }
  }

  async handleRestRequest(request: SupabaseRequest): Promise<any> {
    await this.ensureInitialized()

    logger.debug('Handling REST request', {
      method: request.method,
      table: request.table,
      url: request.url.pathname,
    });

    try {
      switch (request.method) {
        case 'GET':
          return await this.handleSelect(request)
        case 'POST':
          return await this.handleInsert(request)
        case 'PATCH':
          return await this.handleUpdate(request)
        case 'DELETE':
          return await this.handleDelete(request)
        default:
          throw createAPIError(`Unsupported method: ${request.method}`)
      }
    } catch (error) {
      logError('SupabaseAPIBridge request', error as Error, {
        method: request.method,
        table: request.table,
      });
      throw this.formatError(error)
    }
  }

  private async handleSelect(request: SupabaseRequest): Promise<any> {
    const { table, url } = request
    const params = new URLSearchParams(url.search)
    
    // Parse PostgREST query parameters
    const select = params.get('select') || '*'
    const limit = params.get('limit') ? parseInt(params.get('limit')!) : undefined
    const offset = params.get('offset') ? parseInt(params.get('offset')!) : undefined
    const order = params.get('order')
    
    // Build SQL query
    let sql = `SELECT ${this.parseSelectColumns(select)} FROM ${table}`
    const whereConditions: string[] = []
    const values: any[] = []
    
    // Parse filter conditions
    for (const [key, value] of params.entries()) {
      if (this.isFilterParam(key)) {
        const condition = this.parseFilterCondition(key, value, values)
        if (condition) {
          whereConditions.push(condition)
        }
      }
    }
    
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`
    }
    
    if (order) {
      sql += ` ORDER BY ${this.parseOrderBy(order)}`
    }
    
    if (limit) {
      sql += ` LIMIT ${limit}`
    }
    
    if (offset) {
      sql += ` OFFSET ${offset}`
    }
    
    const sqlWithValues = this.formatSqlWithValues(sql, values)
    const result = await this.dbManager.query(sqlWithValues)
    return result.rows
  }

  private async handleInsert(request: SupabaseRequest): Promise<any> {
    const { table, body } = request
    
    if (!body || typeof body !== 'object') {
      throw new Error('Request body is required for INSERT')
    }
    
    const data = Array.isArray(body) ? body : [body]
    const results = []
    
    for (const row of data) {
      const columns = Object.keys(row)
      const values = Object.values(row)
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
      
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`
      const sqlWithValues = this.formatSqlWithValues(sql, values)
    const result = await this.dbManager.query(sqlWithValues)
      results.push(result.rows[0])
    }
    
    return Array.isArray(body) ? results : results[0]
  }

  private async handleUpdate(request: SupabaseRequest): Promise<any> {
    const { table, body, url } = request
    const params = new URLSearchParams(url.search)
    
    if (!body || typeof body !== 'object') {
      throw new Error('Request body is required for UPDATE')
    }
    
    const columns = Object.keys(body)
    const values = Object.values(body)
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ')
    
    let sql = `UPDATE ${table} SET ${setClause}`
    const whereConditions: string[] = []
    let paramIndex = values.length + 1
    
    // Parse filter conditions for WHERE clause
    for (const [key, value] of params.entries()) {
      if (this.isFilterParam(key)) {
        const condition = this.parseFilterCondition(key, value, values, paramIndex)
        if (condition) {
          whereConditions.push(condition)
          paramIndex++
        }
      }
    }
    
    if (whereConditions.length === 0) {
      throw new Error('UPDATE requires WHERE conditions')
    }
    
    sql += ` WHERE ${whereConditions.join(' AND ')} RETURNING *`
    
    const sqlWithValues = this.formatSqlWithValues(sql, values)
    const result = await this.dbManager.query(sqlWithValues)
    return result.rows
  }

  private async handleDelete(request: SupabaseRequest): Promise<any> {
    const { table, url } = request
    const params = new URLSearchParams(url.search)
    
    let sql = `DELETE FROM ${table}`
    const whereConditions: string[] = []
    const values: any[] = []
    
    // Parse filter conditions for WHERE clause
    for (const [key, value] of params.entries()) {
      if (this.isFilterParam(key)) {
        const condition = this.parseFilterCondition(key, value, values)
        if (condition) {
          whereConditions.push(condition)
        }
      }
    }
    
    if (whereConditions.length === 0) {
      throw new Error('DELETE requires WHERE conditions')
    }
    
    sql += ` WHERE ${whereConditions.join(' AND ')} RETURNING *`
    
    const sqlWithValues = this.formatSqlWithValues(sql, values)
    const result = await this.dbManager.query(sqlWithValues)
    return result.rows
  }

  private parseSelectColumns(select: string): string {
    if (select === '*') return '*'
    
    // Handle comma-separated columns
    return select.split(',')
      .map(col => col.trim())
      .filter(col => col.length > 0)
      .join(', ')
  }

  private isFilterParam(key: string): boolean {
    return !['select', 'limit', 'offset', 'order'].includes(key)
  }

  private parseFilterCondition(key: string, value: string, values: any[], startIndex: number = 1): string | null {
    // Parse PostgREST filter format: column=operator.value
    const match = key.match(/^(.+)$/)
    if (!match) return null
    
    const column = match[1]
    
    // Parse operator from value
    if (value.startsWith('eq.')) {
      values.push(value.substring(3))
      return `${column} = $${values.length + startIndex - 1}`
    }
    
    if (value.startsWith('neq.')) {
      values.push(value.substring(4))
      return `${column} != $${values.length + startIndex - 1}`
    }
    
    if (value.startsWith('gt.')) {
      values.push(value.substring(3))
      return `${column} > $${values.length + startIndex - 1}`
    }
    
    if (value.startsWith('gte.')) {
      values.push(value.substring(4))
      return `${column} >= $${values.length + startIndex - 1}`
    }
    
    if (value.startsWith('lt.')) {
      values.push(value.substring(3))
      return `${column} < $${values.length + startIndex - 1}`
    }
    
    if (value.startsWith('lte.')) {
      values.push(value.substring(4))
      return `${column} <= $${values.length + startIndex - 1}`
    }
    
    if (value.startsWith('like.')) {
      values.push(value.substring(5))
      return `${column} LIKE $${values.length + startIndex - 1}`
    }
    
    if (value.startsWith('ilike.')) {
      values.push(value.substring(6))
      return `${column} ILIKE $${values.length + startIndex - 1}`
    }
    
    if (value.startsWith('is.')) {
      const isValue = value.substring(3)
      if (isValue === 'null') {
        return `${column} IS NULL`
      }
      if (isValue === 'true') {
        return `${column} IS TRUE`
      }
      if (isValue === 'false') {
        return `${column} IS FALSE`
      }
    }
    
    if (value.startsWith('in.')) {
      const inValues = value.substring(3).split(',').map(v => v.trim())
      const placeholders = inValues.map((_, i) => `$${values.length + i + startIndex}`).join(', ')
      values.push(...inValues)
      return `${column} IN (${placeholders})`
    }
    
    // Default to equality
    values.push(value)
    return `${column} = $${values.length + startIndex - 1}`
  }

  private parseOrderBy(order: string): string {
    return order.split(',')
      .map(col => {
        const trimmed = col.trim()
        if (trimmed.endsWith('.desc')) {
          return `${trimmed.substring(0, trimmed.length - 5)} DESC`
        }
        if (trimmed.endsWith('.asc')) {
          return `${trimmed.substring(0, trimmed.length - 4)} ASC`
        }
        return `${trimmed} ASC`
      })
      .join(', ')
  }

  private formatError(error: any): PostgRESTError {
    const infraError = errorHandler.handleError(error);
    return {
      message: infraError.message || 'Database operation failed',
      details: infraError.details || error.detail || error.toString(),
      hint: infraError.hint || error.hint,
      code: infraError.code || 'PGRST000'
    }
  }

  // Auth-related methods
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
    const existingUser = await this.dbManager.query(
      `SELECT id FROM auth.users WHERE email = '${email.replace(/'/g, "''")}'`
    )
    
    if (existingUser.rows.length > 0) {
      throw new Error('User already exists')
    }
    
    // Create user
    const userId = crypto.randomUUID()
    const hashedPassword = await this.hashPassword(password)
    
    await this.dbManager.query(
      `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data) 
       VALUES ('${userId}', '${email.replace(/'/g, "''")}', '${hashedPassword}', NOW(), NOW(), NOW(), '${JSON.stringify(metadata).replace(/'/g, "''")}')`
    )
    
    const accessToken = this.generateJWT({ sub: userId, email })
    const refreshToken = crypto.randomUUID()
    
    // Create session
    await this.dbManager.query(
      `INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES ('${refreshToken}', '${userId}', NOW(), NOW())`
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
    
    const user = await this.dbManager.query(
      `SELECT id, email, encrypted_password, raw_user_meta_data FROM auth.users WHERE email = '${email.replace(/'/g, "''")}'`
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
    await this.dbManager.query(
      `INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES ('${refreshToken}', '${userData.id}', NOW(), NOW())`
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
    const session = await this.dbManager.query(
      `SELECT user_id FROM auth.sessions WHERE id = '${refresh_token.replace(/'/g, "''")}'`
    )
    
    if (session.rows.length === 0) {
      throw new Error('Invalid refresh token')
    }
    
    const userId = session.rows[0].user_id
    const user = await this.dbManager.query(
      `SELECT email FROM auth.users WHERE id = '${userId.replace(/'/g, "''")}'`
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

  private formatSqlWithValues(sql: string, values: any[]): string {
    let formattedSql = sql
    values.forEach((value, index) => {
      const placeholder = `$${index + 1}`
      const formattedValue = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value)
      formattedSql = formattedSql.replace(placeholder, formattedValue)
    })
    return formattedSql
  }
}