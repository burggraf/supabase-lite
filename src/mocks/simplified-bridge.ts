import { DatabaseManager, type SessionContext } from '../lib/database/connection'
import { logger, logError } from '../lib/infrastructure/Logger'
import { createAPIError } from '../lib/infrastructure/ErrorHandler'
import { RLSEnforcer } from '../lib/auth/rls-enforcer'
import bcrypt from 'bcryptjs'

// Simplified interfaces - focus on common use cases
interface SupabaseRequest {
  table: string
  method: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE' | 'RPC'
  body?: any
  headers: Record<string, string>
  url: URL
}

interface SimplifiedQuery {
  select?: string[]
  filters: SimplifiedFilter[]
  order?: SimplifiedOrder[]
  limit?: number
  offset?: number
  count?: boolean
  preferReturn?: 'representation' | 'minimal'
  preferResolution?: 'merge-duplicates' | 'ignore-duplicates'
  returnSingle?: boolean
  onConflict?: string
  schema?: string
  // Simplified embedding - only one level, explicit relationships only
  embed?: { [key: string]: { columns: string[], fkHint?: string } } // table -> columns to select + optional FK hint
}

interface SimplifiedFilter {
  column: string
  operator: string
  value: any
  negated?: boolean
}

interface SimplifiedOrder {
  column: string
  ascending: boolean
}

interface FormattedResponse {
  data: any
  status: number
  headers: Record<string, string>
}

// Reduced operator set - focus on commonly used ones
const COMMON_OPERATORS: Record<string, string> = {
  eq: '= {value}',
  neq: '!= {value}',
  gt: '> {value}',
  gte: '>= {value}',
  lt: '< {value}',
  lte: '<= {value}',
  like: 'LIKE {value}',
  ilike: 'ILIKE {value}',
  in: 'IN ({value})',
  is: 'IS {value}',
  cs: '@> {value}',   // contains (JSON/array)
  cd: '<@ {value}',   // contained by (JSON/array)
  ov: '&& {value}'    // overlap (array)
}

export class SimplifiedSupabaseAPIBridge {
  private dbManager: DatabaseManager

  constructor() {
    this.dbManager = DatabaseManager.getInstance()
  }

  async ensureInitialized(): Promise<void> {
    if (!this.dbManager.isConnected()) {
      try {
        await this.dbManager.initialize()
      } catch (error) {
        logger.debug('Database initialization failed, will serve mock data', { error })
      }
    }
  }

  /**
   * Main request handler - single processing path
   */
  async handleRestRequest(request: SupabaseRequest): Promise<FormattedResponse> {
    await this.ensureInitialized()

    if (!this.dbManager.isConnected()) {
      return this.serveMockData(request)
    }

    try {
      // Parse request into simplified query structure
      const query = this.parseRequest(request.url, request.headers)
      
      // Get session context for RLS
      const context = await this.getSessionContext(request.headers)

      // Single processing path based on HTTP method
      switch (request.method) {
        case 'GET':
        case 'HEAD':
          return await this.handleSelect(request.table, query, context, request.method === 'HEAD')
        case 'POST':
          return await this.handleInsert(request.table, query, request.body, context)
        case 'PATCH':
          return await this.handleUpdate(request.table, query, request.body, context)
        case 'DELETE':
          return await this.handleDelete(request.table, query, context)
        default:
          throw new Error(`Unsupported method: ${request.method}`)
      }
    } catch (error) {
      console.error(`❌ SimplifiedBridge error for ${request.method} ${request.table}:`, error)
      return this.formatError(error)
    }
  }

  /**
   * Handle RPC calls - simplified implementation
   */
  async handleRpc(functionName: string, params: Record<string, any> = {}, headers?: Record<string, string>, url?: URL): Promise<FormattedResponse> {
    await this.ensureInitialized()

    if (!this.dbManager.isConnected()) {
      return { data: [], status: 200, headers: { 'Content-Type': 'application/json' } }
    }

    try {
      const context = await this.getSessionContext(headers || {})
      
      // Build RPC query - much simpler than current implementation
      const paramList = Object.entries(params)
        .map(([key, value]) => `${key} => '${this.escapeSQLValue(value)}'`)
        .join(', ')
      
      const sql = `SELECT * FROM ${functionName}(${paramList})`
      
      // Apply filters from URL if provided
      let query: SimplifiedQuery = { filters: [] }
      if (url) {
        query = this.parseRequest(url, headers || {})
      }
      
      const result = await this.executeWithContext(sql, context)
      let rows = result.rows || []

      // Apply client-side filtering for RPC results (simplified approach)
      if (query.filters.length > 0) {
        rows = this.applyClientFilters(rows, query.filters)
      }

      return this.formatResponse(rows, query, 200)
    } catch (error) {
      return this.formatError(error)
    }
  }

  /**
   * Simplified request parsing - focus on common patterns
   */
  private parseRequest(url: URL, headers: Record<string, string>): SimplifiedQuery {
    const params = new URLSearchParams(url.search)
    const query: SimplifiedQuery = { filters: [] }

    // Parse select - handle basic embedded resources
    const select = params.get('select')
    if (select) {
      const { columns, embeds } = this.parseSelectWithEmbedding(select)
      query.select = columns
      query.embed = embeds
    }

    // Parse filters - simplified approach
    for (const [key, value] of params.entries()) {
      if (['select', 'limit', 'offset', 'order', 'on_conflict'].includes(key)) {
        continue
      }

      const filter = this.parseSimpleFilter(key, value)
      if (filter) {
        query.filters.push(filter)
      }
    }

    // Parse order
    const order = params.get('order')
    if (order) {
      query.order = this.parseSimpleOrder(order)
    }

    // Parse pagination
    const limit = params.get('limit')
    if (limit) {
      query.limit = Math.max(0, parseInt(limit, 10) || 0)
    }

    const offset = params.get('offset')
    if (offset) {
      query.offset = Math.max(0, parseInt(offset, 10) || 0)
    }

    // Parse conflict resolution
    const onConflict = params.get('on_conflict')
    if (onConflict) {
      query.onConflict = onConflict
    }

    // Parse headers
    const prefer = headers['prefer'] || headers['Prefer']
    if (prefer) {
      this.parsePreferHeader(prefer, query)
    }

    const accept = headers['accept'] || headers['Accept']
    if (accept?.includes('application/vnd.pgrst.object+json')) {
      query.returnSingle = true
    }

    const acceptProfile = headers['accept-profile'] || headers['Accept-Profile']
    if (acceptProfile) {
      query.schema = acceptProfile.trim()
    }

    return query
  }

  /**
   * Parse select with simple embedded resources
   * Only supports one level: table(columns), no nested embedding
   */
  private parseSelectWithEmbedding(select: string): { columns: string[], embeds: { [key: string]: { columns: string[], fkHint?: string } } } {
    const columns: string[] = []
    const embeds: { [key: string]: { columns: string[], fkHint?: string } } = {}
    
    // Simple parsing - look for table(columns) patterns
    const parts = select.split(',').map(s => s.trim())
    
    for (const part of parts) {
      if (part.includes('(') && part.includes(')')) {
        // This is an embedded resource: table(column1,column2) or table!hint(columns)
        const match = part.match(/^([^!()]+)(?:!([^()]+))?\(([^)]+)\)$/)
        if (match) {
          const [, tableName, fkHint, columnList] = match
          const embeddedColumns = columnList.split(',').map(c => c.trim()).filter(Boolean)
          
          embeds[tableName.trim()] = {
            columns: embeddedColumns,
            fkHint: fkHint?.trim()
          }
        }
      } else {
        // Regular column
        columns.push(part)
      }
    }
    
    return { columns, embeds }
  }

  /**
   * Simplified filter parsing
   */
  private parseSimpleFilter(key: string, value: string): SimplifiedFilter | null {
    const match = value.match(/^([a-z]+)\.(.*)$/i)
    if (!match) {
      // Default to equality
      return { column: key, operator: 'eq', value: value }
    }

    const [, operator, operatorValue] = match
    
    if (!COMMON_OPERATORS[operator]) {
      console.warn(`Unsupported operator: ${operator}`)
      return null
    }

    return {
      column: key,
      operator,
      value: this.parseOperatorValue(operator, operatorValue)
    }
  }

  /**
   * Parse operator value with basic type coercion
   */
  private parseOperatorValue(operator: string, value: string): any {
    switch (operator) {
      case 'is':
        return value.toLowerCase() === 'null' ? null : value
      case 'in':
        return value.split(',').map(v => v.trim())
      case 'eq':
      case 'neq':
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        // Try to parse as number, fallback to string
        const numValue = parseFloat(value)
        return !isNaN(numValue) && isFinite(numValue) ? numValue : value
      default:
        return value
    }
  }

  /**
   * Simplified order parsing
   */
  private parseSimpleOrder(order: string): SimplifiedOrder[] {
    return order.split(',').map(item => {
      const trimmed = item.trim()
      const descMatch = trimmed.match(/^(.+?)\.(desc)$/i)
      if (descMatch) {
        return { column: descMatch[1], ascending: false }
      }
      
      const ascMatch = trimmed.match(/^(.+?)\.(asc)$/i)
      if (ascMatch) {
        return { column: ascMatch[1], ascending: true }
      }
      
      return { column: trimmed, ascending: true }
    })
  }

  /**
   * Parse Prefer header
   */
  private parsePreferHeader(prefer: string, query: SimplifiedQuery): void {
    const preferences = prefer.toLowerCase().split(',').map(p => p.trim())
    
    for (const pref of preferences) {
      if (pref.startsWith('return=')) {
        query.preferReturn = pref.split('=')[1] as any
      } else if (pref.startsWith('resolution=')) {
        query.preferResolution = pref.split('=')[1] as any
      } else if (pref.startsWith('count=')) {
        query.count = pref.split('=')[1] === 'exact'
      }
    }
  }

  /**
   * Handle SELECT requests - simplified approach
   */
  private async handleSelect(table: string, query: SimplifiedQuery, context: SessionContext, isHead: boolean = false): Promise<FormattedResponse> {
    const sql = this.buildSelectSQL(table, query)
    const result = await this.executeWithContext(sql, context)
    
    let totalCount: number | undefined
    if (query.count) {
      const countSQL = this.buildCountSQL(table, query)
      const countResult = await this.executeWithContext(countSQL, context)
      totalCount = countResult.rows[0]?.count || 0
    }

    const status = isHead ? 204 : 200
    const data = isHead ? null : result.rows

    return this.formatResponse(data, query, status, totalCount)
  }

  /**
   * Build SELECT SQL - much simpler than current implementation
   */
  private buildSelectSQL(table: string, query: SimplifiedQuery): string {
    const quotedTable = this.quoteIdentifier(table, query.schema)
    
    // SELECT clause - include embedded resources as JSON subqueries
    const selectParts: string[] = []
    
    // Add main table columns
    if (query.select && query.select.length > 0) {
      selectParts.push(...query.select.map(col => {
        // Handle basic JSON path expressions
        if (col.includes('->')) {
          return this.buildJSONPathExpression(col)
        }
        return `${quotedTable}.${col}`
      }))
    } else {
      selectParts.push(`${quotedTable}.*`)
    }
    
    // Add embedded resources as JSON subqueries (simplified approach)
    if (query.embed) {
      for (const [embeddedTable, embeddedConfig] of Object.entries(query.embed)) {
        // Find filters that apply to this embedded table
        const embeddedFilters = query.filters.filter(filter => 
          filter.column.startsWith(`${embeddedTable}.`)
        )
        
        const subquery = this.buildEmbeddedSubquery(table, embeddedTable, embeddedConfig, query.schema, embeddedFilters)
        selectParts.push(`(${subquery}) AS ${this.quoteIdentifier(embeddedTable)}`)
      }
    }
    
    const selectClause = selectParts.join(', ')

    // WHERE clause - handle both main table filters and embedded table filters for inner joins
    let whereClause = ''
    const mainTableFilters = query.filters.filter(filter => {
      // Exclude filters that target embedded tables for outer joins
      if (query.embed) {
        for (const [embeddedTable, embeddedConfig] of Object.entries(query.embed)) {
          if (filter.column.startsWith(`${embeddedTable}.`) && embeddedConfig.fkHint === 'inner') {
            // For inner joins, we need to add the filter to the main query as an EXISTS clause
            return false // We'll handle this separately
          } else if (filter.column.startsWith(`${embeddedTable}.`)) {
            return false // Regular embedded table filters are handled in subqueries
          }
        }
      }
      return true
    })
    
    // Add EXISTS clauses for inner join filters
    const existsConditions: string[] = []
    if (query.embed) {
      for (const [embeddedTable, embeddedConfig] of Object.entries(query.embed)) {
        if (embeddedConfig.fkHint === 'inner') {
          const embeddedFilters = query.filters.filter(filter => 
            filter.column.startsWith(`${embeddedTable}.`)
          )
          
          if (embeddedFilters.length > 0) {
            const quotedEmbeddedTable = this.quoteIdentifier(embeddedTable, query.schema)
            
            // Build FK join condition
            let joinCondition: string
            let fkColumnName: string
            if (table.endsWith('s')) {
              const singular = table.slice(0, -1)
              const parts = singular.split('_')
              fkColumnName = `${parts[parts.length - 1]}_id`
            } else {
              fkColumnName = `${table}_id`
            }
            joinCondition = `${quotedEmbeddedTable}.${fkColumnName} = ${quotedTable}.id`
            
            // Add embedded filters
            const filterConditions = embeddedFilters
              .map(filter => {
                const columnName = filter.column.includes('.') ? filter.column.split('.').slice(1).join('.') : filter.column
                return this.buildFilterCondition({ ...filter, column: columnName })
              })
              .filter(Boolean)
            
            const existsClause = `EXISTS (SELECT 1 FROM ${quotedEmbeddedTable} WHERE ${joinCondition} AND ${filterConditions.join(' AND ')})`
            existsConditions.push(existsClause)
          }
        }
      }
    }
    
    const allConditions = [
      ...mainTableFilters.map(filter => this.buildFilterCondition(filter)).filter(Boolean),
      ...existsConditions
    ]
    
    if (allConditions.length > 0) {
      whereClause = ` WHERE ${allConditions.join(' AND ')}`
    }

    // ORDER BY clause
    let orderClause = ''
    if (query.order && query.order.length > 0) {
      const orderItems = query.order.map(item => 
        `${item.column} ${item.ascending ? 'ASC' : 'DESC'}`
      )
      orderClause = ` ORDER BY ${orderItems.join(', ')}`
    }

    // LIMIT/OFFSET
    let limitClause = ''
    if (query.limit) {
      limitClause = ` LIMIT ${query.limit}`
    }
    if (query.offset) {
      limitClause += ` OFFSET ${query.offset}`
    }

    return `SELECT ${selectClause} FROM ${quotedTable}${whereClause}${orderClause}${limitClause}`
  }

  /**
   * Build COUNT SQL for pagination
   */
  private buildCountSQL(table: string, query: SimplifiedQuery): string {
    const quotedTable = this.quoteIdentifier(table, query.schema)
    
    let whereClause = ''
    if (query.filters.length > 0) {
      const conditions = query.filters
        .map(filter => this.buildFilterCondition(filter))
        .filter(Boolean)
      
      if (conditions.length > 0) {
        whereClause = ` WHERE ${conditions.join(' AND ')}`
      }
    }

    return `SELECT COUNT(*) as count FROM ${quotedTable}${whereClause}`
  }

  /**
   * Build filter condition - simplified
   */
  private buildFilterCondition(filter: SimplifiedFilter): string {
    const template = COMMON_OPERATORS[filter.operator]
    if (!template) {
      console.warn(`Unsupported operator: ${filter.operator}`)
      return ''
    }

    let condition = template.replace('{column}', filter.column)
    
    // Handle value replacement
    if (filter.operator === 'in') {
      const values = Array.isArray(filter.value) 
        ? filter.value.map(v => `'${this.escapeSQLValue(v)}'`).join(', ')
        : `'${this.escapeSQLValue(filter.value)}'`
      condition = condition.replace('{value}', values)
    } else if (filter.operator === 'is') {
      condition = condition.replace('{value}', filter.value === null ? 'NULL' : `'${this.escapeSQLValue(filter.value)}'`)
    } else {
      condition = condition.replace('{value}', `'${this.escapeSQLValue(filter.value)}'`)
    }

    if (filter.negated) {
      condition = `NOT (${condition})`
    }

    return condition
  }

  /**
   * Handle INSERT requests
   */
  private async handleInsert(table: string, query: SimplifiedQuery, body: any, context: SessionContext): Promise<FormattedResponse> {
    if (!body) {
      throw new Error('Request body is required for INSERT')
    }

    const isUpsert = query.preferResolution === 'merge-duplicates'
    const data = Array.isArray(body) ? body : [body]
    
    const sql = isUpsert 
      ? this.buildUpsertSQL(table, data, query)
      : this.buildInsertSQL(table, data, query)
      
    const result = await this.executeWithContext(sql, context)
    return this.formatResponse(result.rows, query, 201)
  }

  /**
   * Build INSERT SQL
   */
  private buildInsertSQL(table: string, data: Record<string, any>[], query: SimplifiedQuery): string {
    const quotedTable = this.quoteIdentifier(table, query.schema)
    const columns = Object.keys(data[0])
    const columnsList = columns.join(', ')

    const valueRows = data.map(row => {
      const values = columns.map(col => `'${this.escapeSQLValue(row[col])}'`)
      return `(${values.join(', ')})`
    })

    return `INSERT INTO ${quotedTable} (${columnsList}) VALUES ${valueRows.join(', ')} RETURNING *`
  }

  /**
   * Build UPSERT SQL - simplified
   */
  private buildUpsertSQL(table: string, data: Record<string, any>[], query: SimplifiedQuery): string {
    const quotedTable = this.quoteIdentifier(table, query.schema)
    const columns = Object.keys(data[0])
    const columnsList = columns.join(', ')

    const valueRows = data.map(row => {
      const values = columns.map(col => `'${this.escapeSQLValue(row[col])}'`)
      return `(${values.join(', ')})`
    })

    // Simple conflict resolution - use provided column or assume 'id'
    const conflictColumn = query.onConflict || 'id'
    const updateColumns = columns.filter(col => col !== conflictColumn)
    const updateClause = updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ')

    let sql = `INSERT INTO ${quotedTable} (${columnsList}) VALUES ${valueRows.join(', ')} ON CONFLICT (${conflictColumn})`
    
    if (updateColumns.length > 0) {
      sql += ` DO UPDATE SET ${updateClause}`
    } else {
      sql += ` DO NOTHING`
    }
    
    sql += ` RETURNING *`
    return sql
  }

  /**
   * Handle UPDATE requests
   */
  private async handleUpdate(table: string, query: SimplifiedQuery, body: any, context: SessionContext): Promise<FormattedResponse> {
    if (!body) {
      throw new Error('Request body is required for UPDATE')
    }

    if (query.filters.length === 0) {
      throw new Error('UPDATE requires WHERE conditions')
    }

    const sql = this.buildUpdateSQL(table, body, query)
    const result = await this.executeWithContext(sql, context)
    return this.formatResponse(result.rows, query, 200)
  }

  /**
   * Build UPDATE SQL
   */
  private buildUpdateSQL(table: string, data: Record<string, any>, query: SimplifiedQuery): string {
    const quotedTable = this.quoteIdentifier(table, query.schema)
    
    const setClause = Object.entries(data)
      .map(([key, value]) => `${key} = '${this.escapeSQLValue(value)}'`)
      .join(', ')

    const conditions = query.filters
      .map(filter => this.buildFilterCondition(filter))
      .filter(Boolean)
    
    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''

    return `UPDATE ${quotedTable} SET ${setClause}${whereClause} RETURNING *`
  }

  /**
   * Handle DELETE requests
   */
  private async handleDelete(table: string, query: SimplifiedQuery, context: SessionContext): Promise<FormattedResponse> {
    if (query.filters.length === 0) {
      throw new Error('DELETE requires WHERE conditions')
    }

    const sql = this.buildDeleteSQL(table, query)
    const result = await this.executeWithContext(sql, context)
    return this.formatResponse(result.rows, query, 200)
  }

  /**
   * Build DELETE SQL
   */
  private buildDeleteSQL(table: string, query: SimplifiedQuery): string {
    const quotedTable = this.quoteIdentifier(table, query.schema)
    
    const conditions = query.filters
      .map(filter => this.buildFilterCondition(filter))
      .filter(Boolean)
    
    if (conditions.length === 0) {
      throw new Error('DELETE requires WHERE conditions')
    }

    const whereClause = ` WHERE ${conditions.join(' AND ')}`
    return `DELETE FROM ${quotedTable}${whereClause} RETURNING *`
  }

  /**
   * Format response - unified approach
   */
  private formatResponse(data: any, query: SimplifiedQuery, status: number, totalCount?: number): FormattedResponse {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Control-Expose-Headers': 'Content-Range'
    }

    // Handle count header
    if (totalCount !== undefined && query.count) {
      headers['Content-Range'] = `${query.offset || 0}-${(query.offset || 0) + (data?.length || 0) - 1}/${totalCount}`
    }

    // Handle minimal return preference
    if (query.preferReturn === 'minimal') {
      return { data: null, status: 204, headers }
    }

    // Handle single object response
    if (query.returnSingle) {
      if (!data || data.length === 0) {
        return {
          data: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned'
          },
          status: 406,
          headers
        }
      } else if (data.length > 1) {
        return {
          data: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned'
          },
          status: 406,
          headers
        }
      }
      return { data: data[0], status, headers }
    }

    return { data: data || [], status, headers }
  }

  /**
   * Format error response
   */
  private formatError(error: any): FormattedResponse {
    const status = error.status || 500
    const message = error.message || 'Internal server error'
    
    return {
      data: { message, code: error.code || 'INTERNAL_ERROR' },
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  /**
   * Apply client-side filters (for RPC results)
   */
  private applyClientFilters(rows: any[], filters: SimplifiedFilter[]): any[] {
    return rows.filter(row => {
      return filters.every(filter => {
        const rowValue = row[filter.column]
        
        switch (filter.operator) {
          case 'eq':
            return rowValue == filter.value // Intentional loose equality
          case 'neq':
            return rowValue != filter.value
          case 'gt':
            return rowValue > filter.value
          case 'gte':
            return rowValue >= filter.value
          case 'lt':
            return rowValue < filter.value
          case 'lte':
            return rowValue <= filter.value
          case 'like':
          case 'ilike':
            const pattern = filter.value.replace(/%/g, '.*')
            const regex = new RegExp(pattern, filter.operator === 'ilike' ? 'i' : '')
            return typeof rowValue === 'string' && regex.test(rowValue)
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(rowValue)
          case 'is':
            return filter.value === null ? rowValue === null : rowValue === filter.value
          default:
            return true
        }
      })
    })
  }

  /**
   * Get session context for RLS
   */
  private async getSessionContext(headers: Record<string, string>): Promise<SessionContext> {
    // Simplified context - basic role detection
    const authHeader = headers['authorization'] || headers['Authorization']
    
    if (authHeader?.startsWith('Bearer ')) {
      // For now, just return authenticated context
      return {
        role: 'authenticated',
        userId: null,
        claims: {}
      }
    }
    
    return {
      role: 'anon',
      userId: null,
      claims: {}
    }
  }

  /**
   * Execute SQL with context
   */
  private async executeWithContext(sql: string, context: SessionContext): Promise<{ rows: any[] }> {
    // Apply RLS if needed
    const { modifiedSql } = RLSEnforcer.applyApplicationRLS(sql, context)
    logger.debug('Executing simplified SQL', { sql: modifiedSql })
    
    return await this.dbManager.queryWithContext(modifiedSql, context)
  }

  /**
   * Serve mock data when database not available
   */
  private serveMockData(request: SupabaseRequest): FormattedResponse {
    return {
      data: [],
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  /**
   * Quote SQL identifier
   */
  private quoteIdentifier(identifier: string, schema?: string): string {
    const quotedTable = identifier.includes(' ') || identifier.includes('-') 
      ? `"${identifier}"` 
      : identifier
    
    if (schema) {
      return `${schema}.${quotedTable}`
    }
    
    return quotedTable
  }

  /**
   * Escape SQL value to prevent injection
   */
  private escapeSQLValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL'
    }
    
    return String(value).replace(/'/g, "''")
  }

  /**
   * Build basic JSON path expression
   */
  private buildJSONPathExpression(expression: string): string {
    // Handle basic cases like address->city
    if (expression.includes('->')) {
      const parts = expression.split('->')
      if (parts.length === 2) {
        return `${parts[0].trim()}->'${parts[1].trim()}'`
      }
    }
    
    return expression
  }

  /**
   * Build embedded subquery for simple one-level embedding
   */
  private buildEmbeddedSubquery(mainTable: string, embeddedTable: string, config: { columns: string[], fkHint?: string }, schema?: string, embeddedFilters?: SimplifiedFilter[]): string {
    const quotedMainTable = this.quoteIdentifier(mainTable, schema)
    const quotedEmbeddedTable = this.quoteIdentifier(embeddedTable, schema)
    
    // Build column selection for embedded resource
    // Check if this is an inner join (single object expected) or regular join (array expected)
    const isInnerJoin = config.fkHint === 'inner'
    let selectClause: string
    
    if (isInnerJoin) {
      // For inner joins, return a single object, not an array
      if (config.columns.length === 1 && config.columns[0] === '*') {
        selectClause = `to_json(${quotedEmbeddedTable})`
      } else {
        const columnPairs = config.columns.map(col => 
          `'${col}', ${quotedEmbeddedTable}.${col}`
        ).join(', ')
        selectClause = `json_build_object(${columnPairs})`
      }
    } else {
      // Regular joins return arrays
      if (config.columns.length === 1 && config.columns[0] === '*') {
        selectClause = `json_agg(to_json(${quotedEmbeddedTable}))`
      } else {
        const columnPairs = config.columns.map(col => 
          `'${col}', ${quotedEmbeddedTable}.${col}`
        ).join(', ')
        selectClause = `json_agg(json_build_object(${columnPairs}))`
      }
    }
    
    // Simple FK relationship assumption
    // For most cases, embedded table has FK referencing main table
    // e.g., instruments.section_id = orchestral_sections.id
    let joinCondition: string
    if (config.fkHint && config.fkHint !== 'inner') {
      // Use explicit FK hint: mainTable.fkColumn = embeddedTable.pkColumn
      // For now, assume simple format like "section_id" means embeddedTable.section_id = mainTable.id
      if (config.fkHint.includes('_id')) {
        joinCondition = `${quotedEmbeddedTable}.${config.fkHint} = ${quotedMainTable}.id`
      } else {
        joinCondition = `${quotedMainTable}.${config.fkHint} = ${quotedEmbeddedTable}.id`
      }
    } else {
      // Default assumption: embeddedTable has a foreign key referencing mainTable
      // e.g., instruments.section_id = orchestral_sections.id
      // Create FK column name from main table name (orchestral_sections -> section_id)
      let fkColumnName: string
      if (mainTable.endsWith('s')) {
        // Remove plural 's' and add '_id': orchestral_sections -> orchestral_section_id -> section_id
        const singular = mainTable.slice(0, -1)
        // Get the last word after underscore
        const parts = singular.split('_')
        fkColumnName = `${parts[parts.length - 1]}_id`
      } else {
        fkColumnName = `${mainTable}_id`
      }
      joinCondition = `${quotedEmbeddedTable}.${fkColumnName} = ${quotedMainTable}.id`
    }
    
    // Add embedded table filters if any
    let additionalWhere = ''
    if (embeddedFilters && embeddedFilters.length > 0) {
      const filterConditions = embeddedFilters
        .map(filter => {
          // Remove the table prefix since we're already in the embedded table context
          const columnName = filter.column.includes('.') ? filter.column.split('.').slice(1).join('.') : filter.column
          return this.buildFilterCondition({ ...filter, column: columnName })
        })
        .filter(Boolean)
      
      if (filterConditions.length > 0) {
        additionalWhere = ` AND ${filterConditions.join(' AND ')}`
      }
    }
    
    const whereCondition = `${joinCondition}${additionalWhere}`
    
    return `
      SELECT CASE 
        WHEN EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} WHERE ${whereCondition}) 
        THEN ${selectClause}
        ELSE NULL 
      END
      FROM ${quotedEmbeddedTable} 
      WHERE ${whereCondition}
    `.trim()
  }

  // Keep existing auth methods for compatibility
  async handleAuth(endpoint: string, method: string, body?: any): Promise<any> {
    // Placeholder - keep existing auth implementation
    throw new Error('Auth methods not yet migrated to simplified bridge')
  }
}