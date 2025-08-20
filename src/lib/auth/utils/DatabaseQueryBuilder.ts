import type { DatabaseManager } from '../../database/connection'

/**
 * DatabaseQueryBuilder provides secure, consistent database operations
 * for PGlite compatibility while preventing SQL injection
 */
export class DatabaseQueryBuilder {
  constructor(private dbManager: DatabaseManager) {}

  /**
   * Execute a parameterized query safely
   * PGlite supports parameterized queries, so we should use them instead of manual formatting
   */
  async query(sql: string, params: any[] = []): Promise<any> {
    // Use the updated DatabaseManager method that supports parameters
    if (params && params.length > 0) {
      return this.dbManager.query(sql, params)
    } else {
      return this.dbManager.query(sql)
    }
  }

  /**
   * Execute a parameterized query that returns a single row or null
   */
  async queryOne(sql: string, params: any[] = []): Promise<any | null> {
    const result = await this.query(sql, params)
    return result.rows.length > 0 ? result.rows[0] : null
  }

  /**
   * Execute a parameterized query that returns multiple rows
   */
  async queryMany(sql: string, params: any[] = []): Promise<any[]> {
    const result = await this.query(sql, params)
    return result.rows
  }

  /**
   * Insert a single record
   */
  async insert(table: string, data: Record<string, any>, schema: string = 'public'): Promise<void> {
    const columns = Object.keys(data)
    const values = Object.values(data)
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ')
    
    const sql = `
      INSERT INTO ${schema}.${table} (${columns.join(', ')})
      VALUES (${placeholders})
    `
    
    await this.query(sql, values)
  }

  /**
   * Update a record by ID
   */
  async update(
    table: string, 
    data: Record<string, any>, 
    whereColumn: string, 
    whereValue: any,
    schema: string = 'public'
  ): Promise<void> {
    const updates = Object.keys(data)
    const values = Object.values(data)
    
    const setClause = updates.map((col, index) => `${col} = $${index + 1}`).join(', ')
    const whereParam = `$${values.length + 1}`
    
    const sql = `
      UPDATE ${schema}.${table}
      SET ${setClause}
      WHERE ${whereColumn} = ${whereParam}
    `
    
    await this.query(sql, [...values, whereValue])
  }

  /**
   * Delete a record by ID
   */
  async delete(
    table: string, 
    whereColumn: string, 
    whereValue: any,
    schema: string = 'public'
  ): Promise<void> {
    const sql = `DELETE FROM ${schema}.${table} WHERE ${whereColumn} = $1`
    await this.query(sql, [whereValue])
  }

  /**
   * Find a single record by column value
   */
  async findOne(
    table: string, 
    whereColumn: string, 
    whereValue: any,
    schema: string = 'public'
  ): Promise<any | null> {
    const sql = `SELECT * FROM ${schema}.${table} WHERE ${whereColumn} = $1`
    return this.queryOne(sql, [whereValue])
  }

  /**
   * Find multiple records by column value
   */
  async findMany(
    table: string, 
    whereColumn: string, 
    whereValue: any,
    schema: string = 'public'
  ): Promise<any[]> {
    const sql = `SELECT * FROM ${schema}.${table} WHERE ${whereColumn} = $1`
    return this.queryMany(sql, [whereValue])
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(queries: Array<{ sql: string; params?: any[] }>): Promise<any[]> {
    return this.dbManager.transaction(
      queries.map(({ sql, params = [] }) => () => this.query(sql, params))
    )
  }

  /**
   * Escape a value for safe inclusion in SQL (fallback for edge cases)
   * This should rarely be used - parameterized queries are preferred
   */
  static escapeValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL'
    }
    
    if (typeof value === 'string') {
      // Properly escape single quotes by doubling them
      return `'${value.replace(/'/g, "''")}'`
    }
    
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false'
    }
    
    if (typeof value === 'number') {
      return String(value)
    }
    
    if (typeof value === 'object') {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`
    }
    
    return `'${String(value).replace(/'/g, "''")}'`
  }

  /**
   * Build WHERE clause with parameters
   */
  static buildWhereClause(
    conditions: Record<string, any>, 
    startParamIndex: number = 1
  ): { clause: string; params: any[] } {
    const keys = Object.keys(conditions)
    
    if (keys.length === 0) {
      return { clause: '', params: [] }
    }
    
    const clauses = keys.map((key, index) => `${key} = $${startParamIndex + index}`)
    const params = Object.values(conditions)
    
    return {
      clause: `WHERE ${clauses.join(' AND ')}`,
      params
    }
  }

  /**
   * Build INSERT clause with parameters
   */
  static buildInsertClause(data: Record<string, any>): { 
    columns: string; 
    values: string; 
    params: any[] 
  } {
    const keys = Object.keys(data)
    const params = Object.values(data)
    
    const columns = keys.join(', ')
    const values = keys.map((_, index) => `$${index + 1}`).join(', ')
    
    return { columns, values, params }
  }

  /**
   * Build UPDATE SET clause with parameters
   */
  static buildUpdateClause(
    data: Record<string, any>, 
    startParamIndex: number = 1
  ): { clause: string; params: any[] } {
    const keys = Object.keys(data)
    const params = Object.values(data)
    
    const clauses = keys.map((key, index) => `${key} = $${startParamIndex + index}`)
    
    return {
      clause: clauses.join(', '),
      params
    }
  }
}

/**
 * Utility functions for common auth database operations
 */
export class AuthQueryBuilder extends DatabaseQueryBuilder {
  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<any | null> {
    return this.findOne('users', 'email', email, 'auth')
  }

  /**
   * Get user by phone
   */
  async getUserByPhone(phone: string): Promise<any | null> {
    return this.findOne('users', 'phone', phone, 'auth')
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<any | null> {
    return this.findOne('users', 'id', id, 'auth')
  }

  /**
   * Create user with proper Supabase schema
   */
  async createUser(userData: {
    id: string
    email?: string
    phone?: string
    encrypted_password?: string
    email_confirmed_at?: string | null
    phone_confirmed_at?: string | null
    created_at: string
    updated_at: string
    role: string
    raw_app_meta_data: any
    raw_user_meta_data: any
    is_anonymous: boolean
  }): Promise<void> {
    await this.insert('users', userData, 'auth')
  }

  /**
   * Update user data
   */
  async updateUser(userId: string, updates: Record<string, any>): Promise<void> {
    await this.update('users', updates, 'id', userId, 'auth')
  }


  /**
   * Create session record
   */
  async createSession(sessionData: {
    id: string
    user_id: string
    created_at: string
    updated_at: string
    aal?: string
    not_after?: string
    user_agent?: string
    ip?: string
  }): Promise<void> {
    await this.insert('sessions', sessionData, 'auth')
  }

  /**
   * Update session
   */
  async updateSession(sessionId: string, updates: Record<string, any>): Promise<void> {
    await this.update('sessions', updates, 'id', sessionId, 'auth')
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.delete('sessions', 'id', sessionId, 'auth')
  }

  /**
   * Create refresh token
   */
  async createRefreshToken(tokenData: {
    id: string
    token: string
    user_id: string
    session_id: string
    created_at: string
    updated_at: string
  }): Promise<void> {
    await this.insert('refresh_tokens', tokenData, 'auth')
  }

  /**
   * Store audit log entry
   */
  async storeAuditLog(auditData: {
    id: string
    payload: any
    created_at: string
    ip_address?: string
  }): Promise<void> {
    // Handle audit logging failures gracefully
    try {
      await this.insert('audit_log_entries', auditData, 'auth')
    } catch (error) {
      console.warn('Audit logging failed:', error)
    }
  }
}