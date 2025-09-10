import { createAPIError } from '../../infrastructure/ErrorHandler'
import { logError } from '../../infrastructure/Logger'
import { ResponseFormatter, type FormattedResponse } from '../../postgrest'

export interface ErrorContext {
  operation: string
  table?: string
  method?: string
  query?: any
  body?: any
  functionName?: string
  params?: any
  filters?: any
  sql?: string
  context?: string
}

export class ErrorMapper {
  static mapAndLogError(error: unknown, context: ErrorContext): FormattedResponse {
    const errorObj = error as Error
    
    // Log the error with appropriate context
    logError(`${context.operation} failed`, errorObj, context)
    
    // Map specific database errors to user-friendly messages
    const mappedError = this.mapDatabaseError(errorObj, context)
    
    // Format and return the error response
    return ResponseFormatter.formatErrorResponse(mappedError)
  }

  static mapDatabaseError(error: Error, context: ErrorContext): Error {
    const message = error.message.toLowerCase()
    
    // Check if this is a PostgreSQL error that should be handled by PostgRESTErrorMapper
    // Preserve PostgreSQL errors to maintain their structure and error details
    if (this.isPostgreSQLError(error)) {
      return error
    }
    
    // Handle common PostgreSQL errors (fallback for cases where PGlite error structure is lost)
    if (message.includes('relation') && message.includes('does not exist')) {
      return createAPIError(`Table '${context.table}' does not exist`, 404)
    }
    
    if (message.includes('column') && message.includes('does not exist')) {
      return createAPIError(`Column does not exist in table '${context.table}'`, 400)
    }
    
    if (message.includes('duplicate key')) {
      return createAPIError('Duplicate key violation - record already exists', 409)
    }
    
    if (message.includes('foreign key')) {
      return createAPIError('Foreign key constraint violation', 400)
    }
    
    if (message.includes('not null')) {
      return createAPIError('Required field cannot be null', 400)
    }
    
    if (message.includes('check constraint')) {
      return createAPIError('Data validation failed - check constraint violation', 400)
    }
    
    if (message.includes('syntax error')) {
      return createAPIError('Invalid query syntax', 400)
    }
    
    if (message.includes('permission denied')) {
      return createAPIError('Access denied to the requested resource', 403)
    }
    
    // Handle authentication/authorization errors
    if (message.includes('invalid credentials')) {
      return createAPIError('Invalid credentials provided', 401)
    }
    
    if (message.includes('user already exists')) {
      return createAPIError('User with this email already exists', 409)
    }
    
    if (message.includes('invalid refresh token')) {
      return createAPIError('Invalid or expired refresh token', 401)
    }
    
    // Handle validation errors
    if (message.includes('request body is required')) {
      return createAPIError('Request body is required for this operation', 400)
    }
    
    if (message.includes('requires where conditions')) {
      return createAPIError('WHERE conditions are required for this operation', 400)
    }
    
    // Handle method errors
    if (message.includes('unsupported method')) {
      return createAPIError(`Unsupported HTTP method: ${context.method}`, 405)
    }
    
    if (message.includes('unsupported auth endpoint')) {
      return createAPIError('Authentication endpoint not supported', 404)
    }
    
    // Return original error if no mapping found
    return error
  }

  /**
   * Check if an error is a PostgreSQL error that should be preserved
   */
  private static isPostgreSQLError(error: any): boolean {
    return (
      error &&
      typeof error === 'object' &&
      (error.code || error.severity || error.detail || error.hint ||
       // Check for PostgreSQL error message patterns
       (error.message && (
         error.message.includes('duplicate key value violates unique constraint') ||
         error.message.includes('violates foreign key constraint') ||
         error.message.includes('violates not-null constraint') ||
         error.message.includes('violates check constraint') ||
         error.message.includes('relation') && error.message.includes('does not exist')
       )))
    )
  }

  static createValidationError(message: string): Error {
    return createAPIError(message, 400)
  }

  static createAuthenticationError(message: string): Error {
    return createAPIError(message, 401)
  }

  static createAuthorizationError(message: string): Error {
    return createAPIError(message, 403)
  }

  static createNotFoundError(message: string): Error {
    return createAPIError(message, 404)
  }

  static createConflictError(message: string): Error {
    return createAPIError(message, 409)
  }

  static createMethodNotAllowedError(message: string): Error {
    return createAPIError(message, 405)
  }
}