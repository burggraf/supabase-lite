import type { ParsedQuery } from './QueryParser'
import { PostgRESTErrorMapper } from './PostgRESTErrorMapper'

export interface FormattedResponse {
  data: any
  status: number
  headers: Record<string, string>
}

export interface CountResult {
  count: number
  estimatedCount?: boolean
}

export class ResponseFormatter {
  /**
   * Get standard CORS headers for all responses
   */
  private static getCorsHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Access-Control-Expose-Headers': 'Content-Range'
    }
  }

  /**
   * Format query results according to PostgREST conventions
   */
  static formatSelectResponse(
    results: any[],
    query: ParsedQuery,
    totalCount?: CountResult
  ): FormattedResponse {
    const headers = { ...this.getCorsHeaders() }

    // Handle count header
    if (totalCount && query.count) {
      const countHeader = query.count === 'exact' 
        ? totalCount.count.toString()
        : `${totalCount.count}${totalCount.estimatedCount ? '~' : ''}`
      
      headers['Content-Range'] = `${query.offset || 0}-${(query.offset || 0) + results.length - 1}/${countHeader}`
    }

    // Handle Range header response
    if (query.limit || query.offset) {
      const start = query.offset || 0
      const end = start + results.length - 1
      headers['Content-Range'] = headers['Content-Range'] || `${start}-${end}/*`
    }

    // Handle Prefer header response
    let status = 200
    if (query.preferReturn === 'minimal') {
      status = 204
      return {
        data: null,
        status,
        headers
      }
    }

    // Format embedded resources
    const formattedResults = this.formatEmbeddedResources(results, query)

    return {
      data: formattedResults,
      status,
      headers
    }
  }

  /**
   * Format INSERT response
   */
  static formatInsertResponse(
    results: any[],
    query: ParsedQuery
  ): FormattedResponse {
    const headers: Record<string, string> = {
      ...this.getCorsHeaders(),
    }

    let status = 201
    let data = results

    // Handle Prefer header
    if (query.preferReturn === 'minimal') {
      status = 201
      data = []
    } else if (query.preferReturn === 'headers-only') {
      status = 201
      data = []
      // Add Location header for single insert
      if (results.length === 1 && results[0].id) {
        headers['Location'] = `/${results[0].id}`
      }
    }

    // Handle duplicate resolution
    if (query.preferResolution === 'merge-duplicates') {
      // This would require more complex logic to merge duplicates
      status = 200 // Changed from 201 for merges
    } else if (query.preferResolution === 'ignore-duplicates') {
      status = 200 // Changed from 201 for ignores
    }

    return {
      data,
      status,
      headers
    }
  }

  /**
   * Format UPDATE response
   */
  static formatUpdateResponse(
    results: any[],
    query: ParsedQuery
  ): FormattedResponse {
    const headers: Record<string, string> = {
      ...this.getCorsHeaders(),
    }

    let status = 200
    let data = results

    // Handle Prefer header
    if (query.preferReturn === 'minimal') {
      status = 204
      data = []
    }

    return {
      data,
      status,
      headers
    }
  }

  /**
   * Format DELETE response
   */
  static formatDeleteResponse(
    results: any[],
    query: ParsedQuery
  ): FormattedResponse {
    const headers: Record<string, string> = {
      ...this.getCorsHeaders(),
    }

    let status = 200
    let data = results

    // Handle Prefer header
    if (query.preferReturn === 'minimal') {
      status = 204
      data = []
    }

    return {
      data,
      status,
      headers
    }
  }

  /**
   * Format RPC response
   */
  static formatRpcResponse(
    result: any,
    functionName: string
  ): FormattedResponse {
    const headers: Record<string, string> = {
      ...this.getCorsHeaders(),
    }

    return {
      data: result,
      status: 200,
      headers
    }
  }

  /**
   * Format error response in PostgREST format
   */
  static formatErrorResponse(
    error: Error | any,
    statusCode?: number
  ): FormattedResponse {
    // Use PostgRESTErrorMapper for proper error handling
    const errorResponse = PostgRESTErrorMapper.mapError(error)
    
    // Override status code if explicitly provided
    const finalStatus = statusCode ?? errorResponse.status
    
    return {
      data: errorResponse.error,
      status: finalStatus,
      headers: {
        ...this.getCorsHeaders(),
        ...errorResponse.headers
      }
    }
  }

  /**
   * Format embedded resources in results
   */
  private static formatEmbeddedResources(results: any[], query: ParsedQuery): any[] {
    if (!query.embedded || query.embedded.length === 0) {
      return results
    }

    return results.map(row => {
      const formattedRow = { ...row }

      // Process each embedded resource
      for (const embedded of query.embedded || []) {
        const alias = embedded.alias || `${embedded.table}_embed`
        const embeddedData: Record<string, any> = {}

        // Extract embedded columns
        for (const [key, value] of Object.entries(row)) {
          if (key.startsWith(`${alias}_`)) {
            const embeddedColumn = key.substring(alias.length + 1)
            embeddedData[embeddedColumn] = value
            delete formattedRow[key]
          }
        }

        // Only add embedded resource if it has data (not all null)
        const hasData = Object.values(embeddedData).some(value => value !== null)
        if (hasData) {
          formattedRow[embedded.table] = embeddedData
        } else {
          formattedRow[embedded.table] = null
        }
      }

      return formattedRow
    })
  }


  /**
   * Calculate total count for pagination
   */
  static async calculateCount(
    query: ParsedQuery,
    countQuery: string,
    executeQuery: (sql: string) => Promise<{ rows: any[] }>
  ): Promise<CountResult | undefined> {
    if (!query.count) {
      return undefined
    }

    try {
      const result = await executeQuery(countQuery)
      const count = result.rows[0]?.count || 0

      return {
        count: parseInt(count, 10),
        estimatedCount: query.count === 'estimated' || query.count === 'planned'
      }
    } catch (error) {
      console.error('Error calculating count:', error)
      return { count: 0, estimatedCount: true }
    }
  }

  /**
   * Build count query from main query
   */
  static buildCountQuery(sql: string): string {
    // Remove ORDER BY, LIMIT, OFFSET clauses and replace SELECT with COUNT
    const cleanSql = sql
      .replace(/ORDER BY[^)]*(?=LIMIT|OFFSET|$)/gi, '')
      .replace(/LIMIT \d+/gi, '')
      .replace(/OFFSET \d+/gi, '')
      .trim()

    // Replace SELECT clause with COUNT
    const selectMatch = cleanSql.match(/^SELECT\s+.*?\s+FROM/si)
    if (selectMatch) {
      return cleanSql.replace(selectMatch[0], 'SELECT COUNT(*) FROM')
    }

    return `SELECT COUNT(*) FROM (${cleanSql}) AS count_query`
  }
}