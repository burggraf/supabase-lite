import { ResponseFormatter, type FormattedResponse } from '../../postgrest'
import type { ParsedQuery } from '../../postgrest'
import type { ResponseMetadata } from '../types/APITypes'

export class ResponseComposer {
  /**
   * Compose responses using existing ResponseFormatter to maintain exact compatibility
   * This preserves all critical logic including status injection for tests
   */
  static composeSelectResponse(
    results: any[],
    query: ParsedQuery,
    totalCount?: { count: number; estimatedCount?: boolean }
  ): FormattedResponse {
    return ResponseFormatter.formatSelectResponse(results, query, totalCount)
  }

  static composeInsertResponse(
    results: any[],
    query: ParsedQuery
  ): FormattedResponse {
    return ResponseFormatter.formatInsertResponse(results, query)
  }

  static composeUpdateResponse(
    results: any[],
    query: ParsedQuery
  ): FormattedResponse {
    return ResponseFormatter.formatUpdateResponse(results, query)
  }

  static composeDeleteResponse(
    results: any[],
    query: ParsedQuery
  ): FormattedResponse {
    return ResponseFormatter.formatDeleteResponse(results, query)
  }

  static composeRpcResponse(
    results: any[],
    functionName: string,
    query?: ParsedQuery | null
  ): FormattedResponse {
    return ResponseFormatter.formatRpcResponse(results, functionName, query)
  }

  static composeHeadResponse(selectResponse: FormattedResponse): FormattedResponse {
    return {
      ...selectResponse,
      data: null
    }
  }

  static composeErrorResponse(
    error: any,
    operation: string,
    table?: string
  ): FormattedResponse {
    const headers: Record<string, string> = {
      'Access-Control-Expose-Headers': 'Content-Range',
      'Content-Type': 'application/json'
    }

    if (error.code) {
      return {
        data: {
          code: error.code,
          message: error.message || 'Unknown error',
          details: error.details || null,
          hint: error.hint || null
        },
        status: error.status || 500,
        headers
      }
    }

    return {
      data: {
        code: '42000',
        message: error.message || `Error in ${operation}${table ? ` on table ${table}` : ''}`,
        details: error.stack || null,
        hint: null
      },
      status: 500,
      headers
    }
  }
}