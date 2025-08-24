import { logger } from '../infrastructure/Logger'

export interface PostgRESTError {
  code: string
  message: string
  details: string | null
  hint: string | null
}

export interface PostgRESTErrorResponse {
  error: PostgRESTError
  status: number
  headers: Record<string, string>
}

/**
 * Maps PostgreSQL and database errors to PostgREST-compatible error responses
 * following the exact format used by PostgREST
 */
export class PostgRESTErrorMapper {
  /**
   * Map a caught error to a PostgREST-compatible error response
   */
  static mapError(error: any): PostgRESTErrorResponse {
    logger.debug('Mapping error to PostgREST format', { error })

    // Handle PostgreSQL errors (from PGlite)
    if (this.isPostgreSQLError(error)) {
      return this.mapPostgreSQLError(error)
    }

    // Handle standard JavaScript errors
    if (error instanceof Error) {
      return this.mapStandardError(error)
    }

    // Handle string errors
    if (typeof error === 'string') {
      return this.createErrorResponse('PGRST100', error, null, null, 400)
    }

    // Fallback for unknown error types
    return this.createErrorResponse(
      'PGRST000',
      'An unexpected error occurred',
      null,
      null,
      500
    )
  }

  /**
   * Check if an error is a PostgreSQL error from PGlite
   */
  private static isPostgreSQLError(error: any): boolean {
    return (
      error &&
      typeof error === 'object' &&
      (error.code || error.severity || error.detail || error.hint)
    )
  }

  /**
   * Map PostgreSQL errors to PostgREST format
   */
  private static mapPostgreSQLError(pgError: any): PostgRESTErrorResponse {
    const code = pgError.code
    const message = pgError.message || 'Database error occurred'
    const details = pgError.detail || null
    const hint = pgError.hint || null

    // Map PostgreSQL error codes to HTTP status codes
    const statusCode = this.getHttpStatusFromPGCode(code)

    logger.debug('Mapped PostgreSQL error', {
      pgCode: code,
      httpStatus: statusCode,
      message
    })

    return this.createErrorResponse(code, message, details, hint, statusCode)
  }

  /**
   * Map standard JavaScript errors to PostgREST format
   */
  private static mapStandardError(error: Error): PostgRESTErrorResponse {
    const message = error.message

    // Check for specific error patterns in the message
    if (message.includes('relation') && message.includes('does not exist')) {
      // PostgreSQL-style table not found error
      return this.createErrorResponse('42P01', message, null, null, 404)
    }

    // Handle generic "Database query failed" that might be wrapping a table not found error
    // This is a fallback for when the actual PostgreSQL error is not preserved
    if (message === 'Database query failed' && error.stack && error.stack.includes('relation')) {
      // Try to extract table name from stack trace or generate generic message
      return this.createErrorResponse('42P01', 'relation does not exist', null, null, 404)
    }

    if (message.includes('column') && message.includes('does not exist')) {
      // PostgreSQL-style column not found error
      return this.createErrorResponse('42703', message, null, null, 400)
    }

    if (message.includes('duplicate key')) {
      // Unique constraint violation
      return this.createErrorResponse('23505', message, null, null, 409)
    }

    if (message.includes('foreign key')) {
      // Foreign key constraint violation
      return this.createErrorResponse('23503', message, null, null, 409)
    }

    if (message.includes('not null')) {
      // Not null constraint violation
      return this.createErrorResponse('23502', message, null, null, 400)
    }

    if (message.includes('permission denied') || message.includes('insufficient privilege')) {
      // Permission error
      return this.createErrorResponse('42501', message, null, null, 403)
    }

    if (message.includes('function') && message.includes('does not exist')) {
      // Function not found
      return this.createErrorResponse('PGRST202', message, null, null, 404)
    }

    if (message.includes('Invalid limit parameter') || message.includes('Invalid offset parameter')) {
      // Invalid query parameter error
      return this.createErrorResponse('PGRST100', 'Parsing error in the query string parameter', null, null, 400)
    }

    if (message.includes('Invalid JWT') || message.includes('JWT')) {
      // JWT authentication error
      return this.createErrorResponse('PGRST301', message, null, null, 401)
    }

    if (message.includes('Authentication required')) {
      // Missing authentication
      return this.createErrorResponse('PGRST302', message, null, null, 401)
    }

    // Default to bad request for unrecognized errors
    return this.createErrorResponse('PGRST100', message, null, null, 400)
  }

  /**
   * Get HTTP status code from PostgreSQL error code
   */
  private static getHttpStatusFromPGCode(pgCode: string): number {
    switch (pgCode) {
      // Class 42 — Syntax Error or Access Rule Violation
      case '42P01': // undefined_table
      case '42P02': // undefined_parameter
        return 404

      case '42703': // undefined_column
      case '42883': // undefined_function
      case '42P18': // indeterminate_datatype
      case '42601': // syntax_error
        return 400

      case '42501': // insufficient_privilege
        return 403

      // Class 23 — Integrity Constraint Violation
      case '23505': // unique_violation
      case '23503': // foreign_key_violation
      case '23514': // check_violation
        return 409

      case '23502': // not_null_violation
        return 400

      // Class 08 — Connection Exception
      case '08000': // connection_exception
      case '08003': // connection_does_not_exist
      case '08006': // connection_failure
        return 503

      // Class 53 — Insufficient Resources
      case '53300': // too_many_connections
        return 503

      // Class 57 — Operator Intervention
      case '57014': // query_canceled
        return 408

      // Default to bad request for unknown codes
      default:
        return 400
    }
  }

  /**
   * Create a standardized PostgREST error response
   */
  private static createErrorResponse(
    code: string,
    message: string,
    details: string | null,
    hint: string | null,
    status: number
  ): PostgRESTErrorResponse {
    return {
      error: {
        code,
        message,
        details,
        hint
      },
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    }
  }

  /**
   * Create a custom PostgREST error for specific scenarios
   */
  static createCustomError(
    code: string,
    message: string,
    details?: string,
    hint?: string,
    status: number = 400
  ): PostgRESTErrorResponse {
    return this.createErrorResponse(code, message, details || null, hint || null, status)
  }

  /**
   * Create a table not found error (most common case)
   */
  static createTableNotFoundError(tableName: string, schema: string = 'public'): PostgRESTErrorResponse {
    const fullTableName = schema === 'public' ? tableName : `${schema}.${tableName}`
    return this.createErrorResponse(
      '42P01',
      `relation "${fullTableName}" does not exist`,
      null,
      null,
      404
    )
  }

  /**
   * Create a function not found error for RPC calls
   */
  static createFunctionNotFoundError(functionName: string): PostgRESTErrorResponse {
    return this.createErrorResponse(
      'PGRST202',
      `Function not found in schema cache`,
      `Could not find the function "${functionName}" in the schema cache`,
      null,
      404
    )
  }

  /**
   * Create an authentication required error
   */
  static createAuthenticationRequiredError(): PostgRESTErrorResponse {
    return this.createErrorResponse(
      'PGRST302',
      'Anonymous access is disabled',
      null,
      'Try again with a valid JWT token',
      401
    )
  }

  /**
   * Create an invalid JWT error
   */
  static createInvalidJWTError(): PostgRESTErrorResponse {
    return this.createErrorResponse(
      'PGRST301',
      'Invalid JWT token',
      null,
      'Check the JWT token format and signature',
      401
    )
  }
}