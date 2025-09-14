import { DatabaseManager, type SessionContext } from '../../lib/database/connection'
import { logger } from '../../lib/infrastructure/Logger'
import { QueryParser, SQLBuilder, ResponseFormatter, type ParsedQuery, type FormattedResponse } from '../../lib/postgrest'
import { RLSFilteringService } from '../../lib/api/services/RLSFilteringService'
import { ErrorMapper } from '../../lib/api/utils/ErrorMapper'
import type { ApiRequest, ApiContext } from '../types'

/**
 * Unified Query Engine - Phase 3 Implementation
 *
 * Consolidates the enhanced-bridge.ts and simplified-bridge.ts into a single,
 * optimized query processing engine. Uses fast paths for simple queries and
 * falls back to complex parsing only when needed.
 */
export class QueryEngine {
  private dbManager: DatabaseManager
  private sqlBuilder: SQLBuilder
  private rlsFilteringService: RLSFilteringService
  constructor() {
    this.dbManager = DatabaseManager.getInstance()
    this.sqlBuilder = new SQLBuilder(this.dbManager)
    this.rlsFilteringService = new RLSFilteringService()
  }

  /**
   * Process a database request through the unified query engine
   */
  async processRequest(request: ApiRequest, context: ApiContext): Promise<FormattedResponse> {
    try {
      // Ensure database is initialized
      await this.ensureInitialized()

      // Fast path detection - check for simple queries that don't need complex parsing
      const canUseFastPath = this.canUseFastPath(request)

      // Extract table from URL path
      const pathParts = request.url.pathname.split('/').filter(Boolean)
      const table = pathParts[pathParts.length - 1] // Last part is table name

      let parsedQuery: ParsedQuery
      if (canUseFastPath) {
        // Use optimized fast path parsing
        parsedQuery = this.parseFastPath(request)
        logger.debug('Using fast path query processing', { table, method: request.method })
      } else {
        // Use full PostgREST syntax parsing for complex queries
        parsedQuery = QueryParser.parseQuery(request.url, request.headers)
        logger.debug('Using full syntax query processing', { table, method: request.method })
      }

      // Apply RLS filtering if user context is available
      if (context.userId) {
        parsedQuery = await this.rlsFilteringService.applyFilters(parsedQuery, {
          userId: context.userId,
          role: context.role || 'authenticated'
        })
      }

      // Generate SQL query based on HTTP method
      let sqlQuery: { sql: string, parameters?: any[] }
      if (request.method === 'POST') {
        const insertData = Array.isArray(request.body) ? request.body : [request.body]

        // Check if this is an upsert operation (merge-duplicates preference)
        if (parsedQuery.preferResolution === 'merge-duplicates') {
          // UPSERT operation
          sqlQuery = await this.sqlBuilder.buildUpsertQuery(table, insertData, parsedQuery.onConflict, parsedQuery.schema)
        } else {
          // INSERT operation
          sqlQuery = this.sqlBuilder.buildInsertQuery(table, insertData, parsedQuery.schema)
        }
      } else if (request.method === 'PATCH') {
        // UPDATE operation
        if (!request.body || typeof request.body !== 'object') {
          throw new Error('UPDATE requires a request body with data to update')
        }
        sqlQuery = this.sqlBuilder.buildUpdateQuery(table, request.body, parsedQuery.filters, parsedQuery.schema)
      } else if (request.method === 'DELETE') {
        // DELETE operation
        sqlQuery = this.sqlBuilder.buildDeleteQuery(table, parsedQuery.filters, parsedQuery.schema)
      } else {
        // SELECT operations (GET, HEAD)
        const result = await this.sqlBuilder.buildQuery(table, parsedQuery)
        sqlQuery = { sql: result.sql, parameters: result.parameters }
      }

      // Execute query
      const sessionContext: SessionContext = {
        projectId: context.projectId || 'default',
        userId: context.userId,
        role: context.role || 'anon'
      }

      const result = await this.dbManager.queryWithContext(sqlQuery.sql, sessionContext, sqlQuery.parameters)

      logger.debug('QueryEngine: Database result', {
        result: result,
        sql: sqlQuery.sql,
        params: sqlQuery.parameters,
        resultKeys: Object.keys(result || {}),
        rows: result?.rows
      })

      // Execute count query if requested
      let totalCount = undefined
      if (parsedQuery.count && (request.method === 'GET' || request.method === 'HEAD')) {
        try {
          const countQuery = await this.sqlBuilder.buildCountQuery(table, parsedQuery)
          const countResult = await this.dbManager.queryWithContext(countQuery.sql, sessionContext, countQuery.parameters)
          totalCount = {
            count: parseInt(countResult.rows?.[0]?.count || '0'),
            estimatedCount: parsedQuery.count !== 'exact'
          }
          logger.debug('QueryEngine: Count result', {
            countSql: countQuery.sql,
            totalCount: totalCount
          })
        } catch (error) {
          logger.warn('QueryEngine: Failed to execute count query', { error })
        }
      }

      // Format response based on request method
      let response: FormattedResponse
      if (request.method === 'GET' || request.method === 'HEAD') {
        response = ResponseFormatter.formatSelectResponse(result.rows || [], parsedQuery, totalCount)
      } else if (request.method === 'POST') {
        response = ResponseFormatter.formatInsertResponse(result.rows || [], parsedQuery)
      } else if (request.method === 'PATCH') {
        response = ResponseFormatter.formatUpdateResponse(result.rows || [], parsedQuery)
      } else if (request.method === 'DELETE') {
        response = ResponseFormatter.formatDeleteResponse(result.rows || [], parsedQuery)
      } else {
        // Fallback for any other methods
        response = ResponseFormatter.formatSelectResponse(result.rows || [], parsedQuery)
      }

      logger.debug('QueryEngine: Final response', {
        responseData: response.data,
        responseStatus: response.status,
        responseHeaders: Object.keys(response.headers),
        dataType: typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'not_array'
      })

      return response

    } catch (error) {
      logger.error('Query engine error', { error, requestId: context.requestId })

      // Let PostgreSQL errors bubble up naturally for proper error mapping
      // Don't wrap them - the REST executor will handle ApiError conversion
      throw error
    }
  }

  /**
   * Check if request can use optimized fast path processing
   */
  private canUseFastPath(request: ApiRequest): boolean {
    const url = new URL(request.url)

    // Check for complex query features that require full PostgREST parsing
    const hasComplexQuery =
      url.searchParams.has('select') && (
        url.searchParams.get('select')?.includes('(') || // embedded resources like instruments(name)
        url.searchParams.get('select')?.includes('.')    // dotted selects
      ) ||
      url.searchParams.has('order') && url.searchParams.get('order')?.includes('.') || // complex ordering
      Array.from(url.searchParams.keys()).some(key => key.includes('.')) || // nested filters
      url.searchParams.has('and') || url.searchParams.has('or') || // logical operators
      request.headers['prefer']?.includes('return=representation') || // INSERT/UPDATE with RETURNING
      request.headers['Prefer']?.includes('return=representation') ||
      request.headers['prefer']?.includes('count=exact') || // count operations
      request.headers['Prefer']?.includes('count=exact') ||
      // Check for any parameter values that contain PostgREST operators (eq., neq., gt., etc.)
      Array.from(url.searchParams.values()).some(value =>
        value.includes('.') && /^(eq|neq|gt|gte|lt|lte|like|ilike|in|is|not|cs|cd)\./i.test(value)
      )

    // DISABLE fast path for now - the fast path parsing is broken and causing most test failures
    // All queries should use the full PostgREST parser until fast path is properly implemented
    return false
  }

  /**
   * Fast path parsing for simple queries
   */
  private parseFastPath(request: ApiRequest): ParsedQuery {
    const url = new URL(request.url)

    const parsedQuery: ParsedQuery = {
      schema: 'public',
      select: url.searchParams.get('select')?.split(',') || ['*'],
      filters: [],
      order: [],
      limit: url.searchParams.has('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
      offset: url.searchParams.has('offset') ? parseInt(url.searchParams.get('offset')!) : undefined,
      count: url.searchParams.get('count') === 'exact' ? 'exact' : undefined,
      preferReturn: url.searchParams.get('Prefer')?.includes('return=minimal') ? 'minimal' : 'representation'
    }

    // Parse simple filters
    for (const [key, value] of url.searchParams.entries()) {
      if (!['select', 'order', 'limit', 'offset', 'count'].includes(key) && !key.startsWith('Prefer')) {
        // Simple equality filter
        parsedQuery.filters.push({
          column: key,
          operator: 'eq',
          value: value
        })
      }
    }

    // Parse simple ordering
    const orderParam = url.searchParams.get('order')
    if (orderParam) {
      parsedQuery.order = orderParam.split(',').map(item => {
        const [column, direction] = item.trim().split('.')
        return {
          column,
          ascending: direction !== 'desc',
          nullsFirst: false
        }
      })
    }

    return parsedQuery
  }

  /**
   * Ensure database manager is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.dbManager.isConnected()) {
      try {
        await this.dbManager.initialize()
      } catch (error) {
        // In HTTP middleware context, database initialization may fail
        // This is expected behavior when serving mock data
        logger.debug('Database initialization failed, will serve mock data', { error })
      }
    }
  }

  /**
   * Get query engine statistics for debugging
   */
  getStats() {
    return {
      fastPathQueries: 0, // TODO: Add counters
      fullParseQueries: 0,
      totalQueries: 0,
      averageResponseTime: 0
    }
  }
}