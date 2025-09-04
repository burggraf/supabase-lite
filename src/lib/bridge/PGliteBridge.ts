/**
 * PGlite HTTP Bridge
 * 
 * Provides HTTP bridge interface for communication between browser-based PGlite
 * and WebVM-hosted PostgREST/Envoy services in the hybrid architecture.
 * 
 * This bridge allows PostgREST running in WebVM to communicate with PGlite
 * running in the browser context while maintaining data persistence via IndexedDB.
 */

import { DatabaseManager } from '../database/connection'
import type { SessionContext } from '../database/connection'
import type { QueryResult } from '@/types'
import { logger } from '../infrastructure/Logger'
import { createDatabaseError } from '../infrastructure/ErrorHandler'

/**
 * Bridge request interface for PostgREST compatibility
 */
export interface BridgeRequest {
  id: string
  sql: string
  params?: any[]
  sessionContext?: SessionContext
  timeout?: number
}

/**
 * Bridge response interface
 */
export interface BridgeResponse {
  id: string
  success: boolean
  data?: any
  error?: string
  executionTime?: number
}

/**
 * Schema metadata for PostgREST introspection
 */
export interface SchemaMetadata {
  tables: TableInfo[]
  functions: FunctionInfo[]
  views: ViewInfo[]
}

export interface TableInfo {
  table_name: string
  table_schema: string
  columns: ColumnInfo[]
  primary_keys: string[]
  foreign_keys: ForeignKeyInfo[]
}

export interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: boolean
  column_default?: string
}

export interface ForeignKeyInfo {
  column_name: string
  foreign_table_name: string
  foreign_column_name: string
}

export interface FunctionInfo {
  function_name: string
  function_schema: string
  return_type: string
  parameters: ParameterInfo[]
}

export interface ParameterInfo {
  parameter_name: string
  data_type: string
  parameter_mode: 'IN' | 'OUT' | 'INOUT'
}

export interface ViewInfo {
  view_name: string
  view_schema: string
  is_updatable: boolean
}

/**
 * PostgREST-compatible query interface
 */
export interface PostgRESTQuery {
  table: string
  schema?: string
  select?: string[]
  where?: Record<string, any>
  order?: Array<{ column: string; ascending: boolean }>
  limit?: number
  offset?: number
  single?: boolean
}

/**
 * PGlite Bridge Class
 * 
 * Provides HTTP-style interface for PGlite database operations
 * Compatible with PostgREST query patterns and responses
 */
export class PGliteBridge {
  private static instance: PGliteBridge
  private databaseManager: DatabaseManager
  private requestHandlers: Map<string, (request: BridgeRequest) => Promise<BridgeResponse>> = new Map()

  private constructor() {
    this.databaseManager = DatabaseManager.getInstance()
    this.setupRequestHandlers()
  }

  public static getInstance(): PGliteBridge {
    if (!PGliteBridge.instance) {
      PGliteBridge.instance = new PGliteBridge()
    }
    return PGliteBridge.instance
  }

  /**
   * Initialize the bridge and ensure database is ready
   */
  public async initialize(): Promise<void> {
    try {
      await this.databaseManager.initialize()
      logger.info('PGlite bridge initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize PGlite bridge', { error })
      throw createDatabaseError('Bridge initialization failed', { cause: error })
    }
  }

  /**
   * Handle incoming bridge requests from WebVM PostgREST
   */
  public async handleRequest(request: BridgeRequest): Promise<BridgeResponse> {
    const startTime = performance.now()
    
    try {
      logger.debug('Processing bridge request', { 
        id: request.id, 
        sql: request.sql?.substring(0, 100) + '...' 
      })

      // Set session context if provided
      if (request.sessionContext) {
        await this.databaseManager.setSessionContext(request.sessionContext)
      }

      // Execute the SQL query
      const result = await this.databaseManager.query(request.sql, request.params || [])
      
      const executionTime = performance.now() - startTime
      
      logger.debug('Bridge request completed', { 
        id: request.id, 
        executionTime, 
        rowCount: result.rows?.length || 0 
      })

      return {
        id: request.id,
        success: true,
        data: result,
        executionTime
      }

    } catch (error) {
      const executionTime = performance.now() - startTime
      
      logger.error('Bridge request failed', { 
        id: request.id, 
        error: error.message,
        executionTime 
      })

      return {
        id: request.id,
        success: false,
        error: error.message,
        executionTime
      }
    }
  }

  /**
   * Get database schema metadata for PostgREST introspection
   */
  public async getSchemaMetadata(schema: string = 'public'): Promise<SchemaMetadata> {
    try {
      const [tables, functions, views] = await Promise.all([
        this.getTableInfo(schema),
        this.getFunctionInfo(schema),
        this.getViewInfo(schema)
      ])

      return {
        tables,
        functions,
        views
      }
    } catch (error) {
      logger.error('Failed to get schema metadata', { error, schema })
      throw createDatabaseError('Schema introspection failed', { cause: error })
    }
  }

  /**
   * Convert PostgREST-style query to SQL
   */
  public postgrestToSQL(query: PostgRESTQuery): { sql: string; params: any[] } {
    let sql = `SELECT`
    const params: any[] = []
    let paramCount = 0

    // Handle SELECT clause
    if (query.select && query.select.length > 0) {
      sql += ` ${query.select.join(', ')}`
    } else {
      sql += ` *`
    }

    // Handle FROM clause
    const tableName = query.schema ? `${query.schema}.${query.table}` : query.table
    sql += ` FROM ${tableName}`

    // Handle WHERE clause
    if (query.where && Object.keys(query.where).length > 0) {
      const whereConditions: string[] = []
      
      for (const [column, value] of Object.entries(query.where)) {
        paramCount++
        if (value === null) {
          whereConditions.push(`${column} IS NULL`)
        } else if (Array.isArray(value)) {
          const placeholders = value.map(() => `$${++paramCount}`).join(', ')
          whereConditions.push(`${column} IN (${placeholders})`)
          params.push(...value)
          paramCount += value.length - 1
        } else {
          whereConditions.push(`${column} = $${paramCount}`)
          params.push(value)
        }
      }

      sql += ` WHERE ${whereConditions.join(' AND ')}`
    }

    // Handle ORDER BY clause
    if (query.order && query.order.length > 0) {
      const orderClauses = query.order.map(o => 
        `${o.column} ${o.ascending ? 'ASC' : 'DESC'}`
      )
      sql += ` ORDER BY ${orderClauses.join(', ')}`
    }

    // Handle LIMIT clause
    if (query.limit) {
      sql += ` LIMIT ${query.limit}`
    }

    // Handle OFFSET clause
    if (query.offset) {
      sql += ` OFFSET ${query.offset}`
    }

    return { sql, params }
  }

  /**
   * HTTP-style endpoint handler for REST API simulation
   */
  public async handleHTTPRequest(
    method: string, 
    path: string, 
    headers: Record<string, string>,
    body?: string
  ): Promise<Response> {
    try {
      // Parse the path to extract table and query parameters
      const url = new URL(path, 'http://localhost')
      const pathSegments = url.pathname.split('/').filter(Boolean)
      
      if (pathSegments.length === 0) {
        throw new Error('Invalid path')
      }

      const table = pathSegments[0]
      const query: PostgRESTQuery = { table }

      // Parse query parameters for PostgREST compatibility
      for (const [key, value] of url.searchParams.entries()) {
        switch (key) {
          case 'select':
            query.select = value.split(',').map(s => s.trim())
            break
          case 'limit':
            query.limit = parseInt(value)
            break
          case 'offset':
            query.offset = parseInt(value)
            break
          case 'order':
            // Parse order format: "column.asc" or "column.desc"
            const orderParts = value.split(',').map(o => {
              const [column, direction] = o.trim().split('.')
              return { column, ascending: direction !== 'desc' }
            })
            query.order = orderParts
            break
          default:
            // Handle filters (column=value format)
            if (!query.where) query.where = {}
            query.where[key] = value
            break
        }
      }

      // Convert to SQL and execute
      const { sql, params } = this.postgrestToSQL(query)
      const result = await this.databaseManager.query(sql, params)

      // Format response in PostgREST style
      const responseData = method === 'GET' && query.single 
        ? result.rows[0] 
        : result.rows

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Range': `0-${result.rows.length - 1}/${result.rows.length}`
        }
      })

    } catch (error) {
      logger.error('HTTP request handling failed', { method, path, error: error.message })
      
      return new Response(JSON.stringify({ 
        error: error.message,
        message: 'Request processing failed'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  /**
   * Setup request handlers for different operation types
   */
  private setupRequestHandlers(): void {
    this.requestHandlers.set('execute', this.handleExecuteRequest.bind(this))
    this.requestHandlers.set('schema', this.handleSchemaRequest.bind(this))
    this.requestHandlers.set('introspect', this.handleIntrospectionRequest.bind(this))
  }

  private async handleExecuteRequest(request: BridgeRequest): Promise<BridgeResponse> {
    return this.handleRequest(request)
  }

  private async handleSchemaRequest(request: BridgeRequest): Promise<BridgeResponse> {
    try {
      const schema = request.params?.[0] || 'public'
      const metadata = await this.getSchemaMetadata(schema)
      
      return {
        id: request.id,
        success: true,
        data: metadata
      }
    } catch (error) {
      return {
        id: request.id,
        success: false,
        error: error.message
      }
    }
  }

  private async handleIntrospectionRequest(request: BridgeRequest): Promise<BridgeResponse> {
    // Standard PostgREST introspection queries
    const introspectionSQL = `
      SELECT 
        schemaname as table_schema,
        tablename as table_name,
        'table' as table_type
      FROM pg_tables 
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      UNION ALL
      SELECT 
        schemaname as table_schema,
        viewname as table_name,
        'view' as table_type  
      FROM pg_views
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name
    `

    try {
      const result = await this.databaseManager.query(introspectionSQL)
      return {
        id: request.id,
        success: true,
        data: result
      }
    } catch (error) {
      return {
        id: request.id,
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get table information for schema metadata
   */
  private async getTableInfo(schema: string): Promise<TableInfo[]> {
    const sql = `
      SELECT 
        t.table_name,
        t.table_schema,
        c.column_name,
        c.data_type,
        c.is_nullable::boolean,
        c.column_default,
        COALESCE(pk.is_primary, false) as is_primary_key
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      LEFT JOIN (
        SELECT kcu.table_name, kcu.table_schema, kcu.column_name, true as is_primary
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.table_name = pk.table_name AND c.table_schema = pk.table_schema AND c.column_name = pk.column_name
      WHERE t.table_schema = $1 AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name, c.ordinal_position
    `

    const result = await this.databaseManager.query(sql, [schema])
    
    // Group columns by table
    const tablesMap = new Map<string, TableInfo>()
    
    for (const row of result.rows) {
      const tableKey = `${row.table_schema}.${row.table_name}`
      
      if (!tablesMap.has(tableKey)) {
        tablesMap.set(tableKey, {
          table_name: row.table_name,
          table_schema: row.table_schema,
          columns: [],
          primary_keys: [],
          foreign_keys: []
        })
      }

      const table = tablesMap.get(tableKey)!
      
      if (row.column_name) {
        table.columns.push({
          column_name: row.column_name,
          data_type: row.data_type,
          is_nullable: row.is_nullable,
          column_default: row.column_default
        })

        if (row.is_primary_key) {
          table.primary_keys.push(row.column_name)
        }
      }
    }

    return Array.from(tablesMap.values())
  }

  /**
   * Get function information for schema metadata
   */
  private async getFunctionInfo(schema: string): Promise<FunctionInfo[]> {
    const sql = `
      SELECT 
        p.proname as function_name,
        n.nspname as function_schema,
        pg_catalog.pg_get_function_result(p.oid) as return_type
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = $1
      ORDER BY function_name
    `

    try {
      const result = await this.databaseManager.query(sql, [schema])
      return result.rows.map(row => ({
        function_name: row.function_name,
        function_schema: row.function_schema,
        return_type: row.return_type,
        parameters: [] // Could be enhanced with parameter introspection
      }))
    } catch (error) {
      // PGlite might not support all PostgreSQL catalog functions
      logger.debug('Function introspection failed (might not be supported in PGlite)', { error })
      return []
    }
  }

  /**
   * Get view information for schema metadata
   */
  private async getViewInfo(schema: string): Promise<ViewInfo[]> {
    const sql = `
      SELECT 
        table_name as view_name,
        table_schema as view_schema,
        is_updatable::boolean
      FROM information_schema.views
      WHERE table_schema = $1
      ORDER BY view_name
    `

    const result = await this.databaseManager.query(sql, [schema])
    return result.rows.map(row => ({
      view_name: row.view_name,
      view_schema: row.view_schema,
      is_updatable: row.is_updatable
    }))
  }

  /**
   * Start HTTP server for bridge communication
   * Note: This is a placeholder for WebVM integration
   */
  async startHTTPServer(port: number = 8081): Promise<void> {
    logger.info(`HTTP server conceptually started on port ${port}`)
    // In actual implementation, this would configure WebVM HTTP endpoint
    // For now, this is handled by the existing MSW handlers
  }

  /**
   * Stop HTTP server
   */
  async stopHTTPServer(): Promise<void> {
    logger.info('HTTP server stopped')
    // Placeholder for actual server shutdown
  }

  /**
   * Check if HTTP server is running
   */
  isHTTPServerRunning(): boolean {
    // For current implementation, always return true as MSW handles the endpoints
    return true
  }
}

// Export singleton instance
export const pgliteBridge = PGliteBridge.getInstance()