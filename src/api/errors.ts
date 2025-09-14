/**
 * Standardized API Error Handling
 *
 * Provides consistent error formats and handling across all API endpoints.
 * All executors should throw ApiError instances for proper error formatting.
 */

/**
 * Standard API error codes used across the system
 */
export enum ApiErrorCode {
  // Generic errors
  UNKNOWN = 'UNKNOWN',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Authentication errors
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  INVALID_MFA_CODE = 'INVALID_MFA_CODE',

  // Database errors
  QUERY_ERROR = 'QUERY_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION',
  UNIQUE_VIOLATION = 'UNIQUE_VIOLATION',
  TABLE_NOT_FOUND = 'TABLE_NOT_FOUND',
  COLUMN_NOT_FOUND = 'COLUMN_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Request parsing errors
  INVALID_QUERY_SYNTAX = 'INVALID_QUERY_SYNTAX',
  INVALID_FILTER = 'INVALID_FILTER',
  INVALID_ORDER_BY = 'INVALID_ORDER_BY',
  INVALID_LIMIT = 'INVALID_LIMIT',
  MISSING_REQUIRED_PARAMETER = 'MISSING_REQUIRED_PARAMETER',
  INVALID_PARAMETER_TYPE = 'INVALID_PARAMETER_TYPE',

  // Storage errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  BUCKET_NOT_FOUND = 'BUCKET_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',

  // Project management errors
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  PROJECT_ACCESS_DENIED = 'PROJECT_ACCESS_DENIED',

  // Edge function errors
  FUNCTION_NOT_FOUND = 'FUNCTION_NOT_FOUND',
  FUNCTION_TIMEOUT = 'FUNCTION_TIMEOUT',
  FUNCTION_ERROR = 'FUNCTION_ERROR'
}

/**
 * Standard HTTP status codes for different error types
 */
export const ERROR_STATUS_MAP: Record<ApiErrorCode, number> = {
  // Generic errors
  [ApiErrorCode.UNKNOWN]: 500,
  [ApiErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ApiErrorCode.BAD_REQUEST]: 400,
  [ApiErrorCode.UNAUTHORIZED]: 401,
  [ApiErrorCode.FORBIDDEN]: 403,
  [ApiErrorCode.NOT_FOUND]: 404,
  [ApiErrorCode.METHOD_NOT_ALLOWED]: 405,
  [ApiErrorCode.CONFLICT]: 409,
  [ApiErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ApiErrorCode.TOO_MANY_REQUESTS]: 429,

  // Authentication errors
  [ApiErrorCode.INVALID_TOKEN]: 401,
  [ApiErrorCode.TOKEN_EXPIRED]: 401,
  [ApiErrorCode.INVALID_CREDENTIALS]: 401,
  [ApiErrorCode.ACCOUNT_LOCKED]: 423,
  [ApiErrorCode.EMAIL_NOT_VERIFIED]: 400,
  [ApiErrorCode.MFA_REQUIRED]: 400,
  [ApiErrorCode.INVALID_MFA_CODE]: 400,

  // Database errors
  [ApiErrorCode.QUERY_ERROR]: 400,
  [ApiErrorCode.CONSTRAINT_VIOLATION]: 409,
  [ApiErrorCode.FOREIGN_KEY_VIOLATION]: 409,
  [ApiErrorCode.UNIQUE_VIOLATION]: 409,
  [ApiErrorCode.TABLE_NOT_FOUND]: 404,
  [ApiErrorCode.COLUMN_NOT_FOUND]: 404,
  [ApiErrorCode.PERMISSION_DENIED]: 403,

  // Request parsing errors
  [ApiErrorCode.INVALID_QUERY_SYNTAX]: 400,
  [ApiErrorCode.INVALID_FILTER]: 400,
  [ApiErrorCode.INVALID_ORDER_BY]: 400,
  [ApiErrorCode.INVALID_LIMIT]: 400,
  [ApiErrorCode.MISSING_REQUIRED_PARAMETER]: 400,
  [ApiErrorCode.INVALID_PARAMETER_TYPE]: 400,

  // Storage errors
  [ApiErrorCode.FILE_NOT_FOUND]: 404,
  [ApiErrorCode.BUCKET_NOT_FOUND]: 404,
  [ApiErrorCode.FILE_TOO_LARGE]: 413,
  [ApiErrorCode.INVALID_FILE_TYPE]: 415,
  [ApiErrorCode.STORAGE_QUOTA_EXCEEDED]: 507,

  // Project management errors
  [ApiErrorCode.PROJECT_NOT_FOUND]: 404,
  [ApiErrorCode.PROJECT_ACCESS_DENIED]: 403,

  // Edge function errors
  [ApiErrorCode.FUNCTION_NOT_FOUND]: 404,
  [ApiErrorCode.FUNCTION_TIMEOUT]: 408,
  [ApiErrorCode.FUNCTION_ERROR]: 500
}

/**
 * Standardized API Error class
 *
 * All executors should throw instances of this class for consistent error handling.
 */
export class ApiError extends Error {
  public readonly statusCode: number
  public readonly errorCode: ApiErrorCode
  public readonly details?: any
  public readonly hint?: string
  public readonly requestId?: string

  constructor(
    errorCode: ApiErrorCode,
    message?: string,
    details?: any,
    hint?: string,
    requestId?: string
  ) {
    super(message || ApiError.getDefaultMessage(errorCode))
    this.name = 'ApiError'
    this.errorCode = errorCode
    this.statusCode = ERROR_STATUS_MAP[errorCode] || 500
    this.details = details
    this.hint = hint
    this.requestId = requestId

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError)
    }
  }

  /**
   * Get default error messages for common error codes
   */
  private static getDefaultMessage(errorCode: ApiErrorCode): string {
    switch (errorCode) {
      case ApiErrorCode.UNKNOWN:
        return 'An unknown error occurred'
      case ApiErrorCode.INTERNAL_SERVER_ERROR:
        return 'Internal server error'
      case ApiErrorCode.BAD_REQUEST:
        return 'Bad request'
      case ApiErrorCode.UNAUTHORIZED:
        return 'Unauthorized'
      case ApiErrorCode.FORBIDDEN:
        return 'Forbidden'
      case ApiErrorCode.NOT_FOUND:
        return 'Not found'
      case ApiErrorCode.INVALID_TOKEN:
        return 'Invalid or expired token'
      case ApiErrorCode.INVALID_CREDENTIALS:
        return 'Invalid credentials'
      case ApiErrorCode.QUERY_ERROR:
        return 'Database query failed'
      case ApiErrorCode.TABLE_NOT_FOUND:
        return 'Table not found'
      case ApiErrorCode.PROJECT_NOT_FOUND:
        return 'Project not found'
      case ApiErrorCode.INVALID_QUERY_SYNTAX:
        return 'Invalid query syntax'
      case ApiErrorCode.FILE_NOT_FOUND:
        return 'File not found'
      case ApiErrorCode.FUNCTION_NOT_FOUND:
        return 'Function not found'
      default:
        return 'An error occurred'
    }
  }

  /**
   * Convert to a plain object for JSON serialization
   */
  public toJSON() {
    return {
      error: {
        code: this.errorCode,
        message: this.message,
        details: this.details,
        hint: this.hint
      },
      status: this.statusCode,
      requestId: this.requestId
    }
  }

  /**
   * Convert to PostgREST-compatible error format
   * Returns raw PostgreSQL error codes when available for full compatibility
   */
  public toPostgRESTFormat() {
    // Check if we have original PostgreSQL error details
    if (this.details && typeof this.details === 'object' && this.details.code) {
      // Return PostgreSQL error format for database constraint violations
      return {
        code: this.details.code,           // Raw PostgreSQL code (e.g., "23505")
        message: this.details.message || this.message,
        details: this.details.detail || this.details.details || null,
        hint: this.details.hint || this.hint || null
      }
    }

    // Fallback to standard format for non-PostgreSQL errors
    return {
      code: this.errorCode,
      details: this.details,
      hint: this.hint,
      message: this.message
    }
  }

  /**
   * Create an ApiError from a generic error
   */
  static fromError(
    error: any,
    errorCode: ApiErrorCode = ApiErrorCode.UNKNOWN,
    requestId?: string
  ): ApiError {
    if (error instanceof ApiError) {
      return error
    }

    // Handle database errors with specific error codes
    if (error && typeof error === 'object') {
      // PostgreSQL error codes
      if (error.code) {
        switch (error.code) {
          case '23505': // unique_violation
            return new ApiError(ApiErrorCode.UNIQUE_VIOLATION, error.message, error, undefined, requestId)
          case '23503': // foreign_key_violation
            return new ApiError(ApiErrorCode.FOREIGN_KEY_VIOLATION, error.message, error, undefined, requestId)
          case '23514': // check_violation
          case '23502': // not_null_violation
            return new ApiError(ApiErrorCode.CONSTRAINT_VIOLATION, error.message, error, undefined, requestId)
          case '42P01': // undefined_table
            return new ApiError(ApiErrorCode.TABLE_NOT_FOUND, error.message, error, undefined, requestId)
          case '42703': // undefined_column
            return new ApiError(ApiErrorCode.COLUMN_NOT_FOUND, error.message, error, undefined, requestId)
          case '42501': // insufficient_privilege
            return new ApiError(ApiErrorCode.PERMISSION_DENIED, error.message, error, undefined, requestId)
          default:
            return new ApiError(ApiErrorCode.QUERY_ERROR, error.message, error, undefined, requestId)
        }
      }
    }

    return new ApiError(
      errorCode,
      error?.message || String(error),
      error,
      undefined,
      requestId
    )
  }

  /**
   * Create a validation error for invalid request parameters
   */
  static validation(
    message: string,
    parameter?: string,
    requestId?: string
  ): ApiError {
    return new ApiError(
      ApiErrorCode.BAD_REQUEST,
      message,
      { parameter },
      'Check the request parameters and try again',
      requestId
    )
  }

  /**
   * Create a database error
   */
  static database(
    message: string,
    originalError?: any,
    requestId?: string
  ): ApiError {
    return ApiError.fromError(originalError, ApiErrorCode.QUERY_ERROR, requestId)
  }

  /**
   * Create an authentication error
   */
  static auth(
    errorCode: ApiErrorCode = ApiErrorCode.UNAUTHORIZED,
    message?: string,
    requestId?: string
  ): ApiError {
    return new ApiError(errorCode, message, undefined, undefined, requestId)
  }

  /**
   * Create a not found error
   */
  static notFound(
    resource: string,
    requestId?: string
  ): ApiError {
    return new ApiError(
      ApiErrorCode.NOT_FOUND,
      `${resource} not found`,
      { resource },
      undefined,
      requestId
    )
  }

  /**
   * Create a forbidden error
   */
  static forbidden(
    message: string = 'Access forbidden',
    requestId?: string
  ): ApiError {
    return new ApiError(ApiErrorCode.FORBIDDEN, message, undefined, undefined, requestId)
  }
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: any): error is ApiError {
  return error instanceof ApiError
}

/**
 * Extract error information from various error types
 */
export function getErrorInfo(error: any, requestId?: string): {
  statusCode: number
  errorCode: string
  message: string
  details?: any
  hint?: string
} {
  if (isApiError(error)) {
    return {
      statusCode: error.statusCode,
      errorCode: error.errorCode,
      message: error.message,
      details: error.details,
      hint: error.hint
    }
  }

  // Handle thrown objects with status/statusCode
  if (error && typeof error === 'object') {
    return {
      statusCode: error.statusCode || error.status || 500,
      errorCode: error.errorCode || error.code || 'UNKNOWN',
      message: error.message || String(error),
      details: error.details || error
    }
  }

  // Default unknown error
  return {
    statusCode: 500,
    errorCode: 'UNKNOWN',
    message: error?.message || String(error) || 'An unknown error occurred'
  }
}