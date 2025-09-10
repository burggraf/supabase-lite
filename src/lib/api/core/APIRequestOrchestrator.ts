import { DatabaseManager, type SessionContext } from '../../database/connection'
import { logger, logError } from '../../infrastructure/Logger'
import { createAPIError } from '../../infrastructure/ErrorHandler'
import {
  QueryParser,
  SQLBuilder,
  ResponseFormatter,
} from '../../postgrest'
import type { ParsedQuery, FormattedResponse } from '../../postgrest'
import { RLSFilteringService } from '../services/RLSFilteringService'
import { ErrorMapper } from '../utils/ErrorMapper'
import { RequestValidator } from './RequestValidator'
import { ResponseComposer } from './ResponseComposer'
import type { APIRequest } from '../types/APITypes'

export class APIRequestOrchestrator {
  private dbManager: DatabaseManager
  private sqlBuilder: SQLBuilder
  private rlsFilteringService: RLSFilteringService

  constructor() {
    this.dbManager = DatabaseManager.getInstance()
    this.sqlBuilder = new SQLBuilder(this.dbManager)
    this.rlsFilteringService = new RLSFilteringService()
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
   * Main entry point for handling REST requests
   * Maintains exact same interface as EnhancedSupabaseAPIBridge
   */
  async handleRestRequest(request: APIRequest): Promise<FormattedResponse> {
    await this.ensureInitialized()

    // Validate the request
    const validation = RequestValidator.validate(request)
    if (!validation.isValid) {
      return ResponseComposer.composeErrorResponse({
        code: 'VALIDATION_ERROR',
        message: validation.errors.map(e => e.message).join(', '),
        status: 400
      }, 'Request validation')
    }

    // If database is not connected (HTTP middleware context), serve mock data
    if (!this.dbManager.isConnected()) {
      return this.serveMockData(request)
    }

    logger.debug('Handling REST request', {
      method: request.method,
      table: request.table,
      url: request.url.toString(),
      headers: request.headers
    })

    try {
      // Parse the request into structured query
      const query = QueryParser.parseQuery(request.url, request.headers)

      // Apply RLS filtering for user-scoped tables
      const { query: enhancedQuery, context } = await this.rlsFilteringService.applyRLSFiltering(
        request.table, 
        query, 
        request.headers
      )

      logger.debug('Parsed query with RLS', { query: enhancedQuery, context: context.role })

      // Route to appropriate handler based on method
      switch (request.method) {
        case 'GET':
          return await this.handleSelect(request.table, enhancedQuery, context)
        case 'HEAD':
          const headResult = await this.handleSelect(request.table, enhancedQuery, context)
          return ResponseComposer.composeHeadResponse(headResult)
        case 'POST':
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
          throw ErrorMapper.createMethodNotAllowedError(`Unsupported method: ${request.method}`)
      }
    } catch (error) {
      console.error(`❌ API Orchestrator error for ${request.method} ${request.table}:`, error)
      return ErrorMapper.mapAndLogError(error, {
        operation: 'APIRequestOrchestrator request',
        method: request.method,
        table: request.table,
      })
    }
  }

  /**
   * Handle RPC (stored procedure) calls
   * Maintains exact same interface as EnhancedSupabaseAPIBridge
   */
  async handleRpc(
    functionName: string, 
    params: Record<string, any> = {},
    headers?: Record<string, string>,
    url?: URL
  ): Promise<FormattedResponse> {
    await this.ensureInitialized()

    logger.debug('Handling RPC call', { functionName, params, url: url?.toString() })

    if (!this.dbManager.isConnected()) {
      logger.debug('Database not connected, serving mock RPC data')
      return ResponseComposer.composeRpcResponse([], functionName)
    }

    try {
      let query = null
      let context = null
      
      if (url && headers) {
        query = QueryParser.parseQuery(url, headers)
        const rlsResult = await this.rlsFilteringService.applyRLSFiltering('rpc_function', query, headers)
        query = rlsResult.query
        context = rlsResult.context
        logger.debug('Parsed RPC query with filters', { query, context: context.role })
      }

      const sqlQuery = this.sqlBuilder.buildRpcQuery(functionName, params)
      logger.debug('Built RPC SQL', sqlQuery)

      const result = context 
        ? await this.executeQueryWithContext(sqlQuery.sql, sqlQuery.parameters, context)
        : await this.executeQuery(sqlQuery.sql, sqlQuery.parameters)

      logger.debug('RPC result before filtering', { rows: result.rows, query })

      if (query && result.rows && result.rows.length > 0) {
        let filteredRows = result.rows

        if (query.filters && query.filters.length > 0) {
          filteredRows = this.applyFiltersToRows(filteredRows, query.filters)
          logger.debug('Applied filters to RPC result', { 
            originalCount: result.rows.length, 
            filteredCount: filteredRows.length,
            filters: query.filters
          })
        }

        if (query.order && query.order.length > 0) {
          filteredRows = this.applyOrderingToRows(filteredRows, query.order)
          logger.debug('Applied ordering to RPC result', { ordering: query.order })
        }

        if (query.limit !== undefined || query.offset !== undefined) {
          const offset = query.offset || 0
          const limit = query.limit
          filteredRows = limit !== undefined 
            ? filteredRows.slice(offset, offset + limit)
            : filteredRows.slice(offset)
          logger.debug('Applied pagination to RPC result', { offset, limit, finalCount: filteredRows.length })
        }

        return ResponseComposer.composeRpcResponse(filteredRows, functionName, query)
      }

      return ResponseComposer.composeRpcResponse(result.rows, functionName, query)
    } catch (error) {
      return ErrorMapper.mapAndLogError(error, {
        operation: 'RPC call failed',
        functionName,
        params
      })
    }
  }

  // Private methods to be extracted as services in Phase 2
  private async handleSelect(table: string, query: ParsedQuery, context: SessionContext): Promise<FormattedResponse> {
    try {
      const sqlQuery = await this.sqlBuilder.buildQuery(table, query)
      logger.debug('Built SELECT SQL', sqlQuery)

      const result = await this.executeQueryWithContext(sqlQuery.sql, sqlQuery.parameters, context)

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

      return ResponseComposer.composeSelectResponse(result.rows, query, totalCount)
    } catch (error) {
      return ErrorMapper.mapAndLogError(error, {
        operation: 'SELECT query failed',
        table,
        query
      })
    }
  }

  private async handleInsert(table: string, query: ParsedQuery, body: any, context: SessionContext): Promise<FormattedResponse> {
    if (!body || typeof body !== 'object') {
      throw ErrorMapper.createValidationError('Request body is required for INSERT')
    }

    try {
      const data = Array.isArray(body) ? body : [body]
      const sqlQuery = this.sqlBuilder.buildInsertQuery(table, data, query.schema)
      logger.debug('Built INSERT SQL', sqlQuery)

      const result = await this.executeQueryWithContext(sqlQuery.sql, sqlQuery.parameters, context)
      return ResponseComposer.composeInsertResponse(result.rows, query)
    } catch (error) {
      return ErrorMapper.mapAndLogError(error, {
        operation: 'INSERT query failed',
        table,
        body
      })
    }
  }

  private async handleUpdate(table: string, query: ParsedQuery, body: any, context: SessionContext): Promise<FormattedResponse> {
    if (!body || typeof body !== 'object') {
      throw ErrorMapper.createValidationError('Request body is required for UPDATE')
    }

    try {
      const sqlQuery = await this.sqlBuilder.buildUpdateQuery(table, body, query.filters, query.schema)
      logger.debug('Built UPDATE SQL', sqlQuery)

      const result = await this.executeQueryWithContext(sqlQuery.sql, sqlQuery.parameters, context)
      return ResponseComposer.composeUpdateResponse(result.rows, query)
    } catch (error) {
      return ErrorMapper.mapAndLogError(error, {
        operation: 'UPDATE query failed',
        table,
        body
      })
    }
  }

  private async handleDelete(table: string, query: ParsedQuery, context: SessionContext): Promise<FormattedResponse> {
    try {
      const sqlQuery = await this.sqlBuilder.buildDeleteQuery(table, query.filters, query.schema)
      logger.debug('Built DELETE SQL', sqlQuery)

      const result = await this.executeQueryWithContext(sqlQuery.sql, sqlQuery.parameters, context)
      return ResponseComposer.composeDeleteResponse(result.rows, query)
    } catch (error) {
      return ErrorMapper.mapAndLogError(error, {
        operation: 'DELETE query failed',
        table
      })
    }
  }

  private async handleUpsert(table: string, query: ParsedQuery, body: any, context: SessionContext): Promise<FormattedResponse> {
    if (!body || typeof body !== 'object') {
      throw ErrorMapper.createValidationError('Request body is required for UPSERT')
    }

    try {
      const data = Array.isArray(body) ? body : [body]
      const sqlQuery = await this.sqlBuilder.buildUpsertQuery(table, data, query.onConflict, query.schema)
      logger.debug('Built UPSERT SQL', sqlQuery)

      const result = await this.executeQueryWithContext(sqlQuery.sql, sqlQuery.parameters, context)
      return ResponseComposer.composeInsertResponse(result.rows, query)
    } catch (error) {
      return ErrorMapper.mapAndLogError(error, {
        operation: 'UPSERT query failed',
        table,
        body
      })
    }
  }

  // Database execution methods - preserved exactly from EnhancedSupabaseAPIBridge
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
      ErrorMapper.mapAndLogError(error, {
        operation: 'SQL execution failed',
        sql: formattedSql
      })
      throw error
    }
  }

  private async executeQueryWithContext(sql: string, parameters: any[] = [], context: SessionContext): Promise<{ rows: any[] }> {
    const { RLSEnforcer } = await import('../../auth/rls-enforcer')
    
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
      const result = await this.dbManager.query(modifiedSql)
      return result
    } catch (error) {
      ErrorMapper.mapAndLogError(error, {
        operation: 'SQL execution with context failed',
        sql: modifiedSql.substring(0, 100),
        context: context.role
      })
      throw error
    }
  }

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

  // Filter and ordering methods - preserved exactly from EnhancedSupabaseAPIBridge
  private applyFiltersToRows(rows: any[], filters: any[]): any[] {
    // Implementation preserved from original bridge
    return rows.filter(row => {
      return filters.every(filter => {
        const value = row[filter.column]
        switch (filter.operator) {
          case 'eq': return this.compareValues(value, filter.value, 'eq')
          case 'neq': return this.compareValues(value, filter.value, 'neq')
          case 'gt': return this.compareValues(value, filter.value, 'gt')
          case 'gte': return this.compareValues(value, filter.value, 'gte')
          case 'lt': return this.compareValues(value, filter.value, 'lt')
          case 'lte': return this.compareValues(value, filter.value, 'lte')
          case 'like': return String(value).includes(filter.value)
          case 'ilike': return String(value).toLowerCase().includes(filter.value.toLowerCase())
          case 'in': return filter.value.includes(value)
          case 'is': return filter.value === null ? value === null : value === filter.value
          default: return true
        }
      })
    })
  }

  /**
   * Compare values with proper type coercion for database values vs URL parameters
   */
  private compareValues(dbValue: any, filterValue: any, operator: string): boolean {
    // Handle null values
    if (dbValue === null || filterValue === null) {
      return operator === 'eq' ? dbValue === filterValue : dbValue !== filterValue
    }

    // If both are the same type, use direct comparison
    if (typeof dbValue === typeof filterValue) {
      switch (operator) {
        case 'eq': return dbValue === filterValue
        case 'neq': return dbValue !== filterValue
        case 'gt': return dbValue > filterValue
        case 'gte': return dbValue >= filterValue
        case 'lt': return dbValue < filterValue
        case 'lte': return dbValue <= filterValue
        default: return false
      }
    }

    // Handle numeric string comparisons (common case: DB integer vs URL string)
    if (typeof dbValue === 'number' && typeof filterValue === 'string') {
      const numericFilterValue = Number(filterValue)
      if (!isNaN(numericFilterValue)) {
        switch (operator) {
          case 'eq': return dbValue === numericFilterValue
          case 'neq': return dbValue !== numericFilterValue
          case 'gt': return dbValue > numericFilterValue
          case 'gte': return dbValue >= numericFilterValue
          case 'lt': return dbValue < numericFilterValue
          case 'lte': return dbValue <= numericFilterValue
          default: return false
        }
      }
    }

    // Handle reverse case: DB string vs numeric filter (less common)
    if (typeof dbValue === 'string' && typeof filterValue === 'number') {
      const numericDbValue = Number(dbValue)
      if (!isNaN(numericDbValue)) {
        switch (operator) {
          case 'eq': return numericDbValue === filterValue
          case 'neq': return numericDbValue !== filterValue
          case 'gt': return numericDbValue > filterValue
          case 'gte': return numericDbValue >= filterValue
          case 'lt': return numericDbValue < filterValue
          case 'lte': return numericDbValue <= filterValue
          default: return false
        }
      }
    }

    // Fallback to string comparison for mixed types
    const dbStr = String(dbValue)
    const filterStr = String(filterValue)
    switch (operator) {
      case 'eq': return dbStr === filterStr
      case 'neq': return dbStr !== filterStr
      case 'gt': return dbStr > filterStr
      case 'gte': return dbStr >= filterStr
      case 'lt': return dbStr < filterStr
      case 'lte': return dbStr <= filterStr
      default: return false
    }
  }

  private applyOrderingToRows(rows: any[], ordering: any[]): any[] {
    return rows.sort((a, b) => {
      for (const order of ordering) {
        const aVal = a[order.column]
        const bVal = b[order.column]
        
        if (aVal < bVal) return order.ascending ? -1 : 1
        if (aVal > bVal) return order.ascending ? 1 : -1
      }
      return 0
    })
  }

  // Mock data fallback - preserved exactly
  private serveMockData(request: APIRequest): FormattedResponse {
    logger.debug('Serving mock data for HTTP middleware context')
    
    return ResponseComposer.composeSelectResponse([], {
      select: ['*'],
      filters: [],
      order: [],
      limit: undefined,
      offset: undefined,
      count: null,
      preferReturn: 'representation',
      returnSingle: false
    })
  }
}