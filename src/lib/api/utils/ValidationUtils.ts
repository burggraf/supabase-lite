import { createAPIError } from '../../infrastructure/ErrorHandler'

export class ValidationUtils {
  /**
   * Validate table name to prevent SQL injection
   */
  static validateTableName(tableName: string): void {
    if (!tableName || typeof tableName !== 'string') {
      throw createAPIError('Table name is required and must be a string', 400)
    }

    // Only allow alphanumeric characters, underscores, and periods
    const validTableNameRegex = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)?$/
    if (!validTableNameRegex.test(tableName)) {
      throw createAPIError('Invalid table name format', 400)
    }
  }

  /**
   * Validate HTTP method
   */
  static validateHttpMethod(method: string): void {
    const validMethods = ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'RPC']
    if (!validMethods.includes(method)) {
      throw createAPIError(`Invalid HTTP method: ${method}`, 405)
    }
  }

  /**
   * Validate request body for mutations
   */
  static validateRequestBody(body: any, method: string): void {
    if (['POST', 'PATCH'].includes(method)) {
      if (!body || (typeof body !== 'object' && !Array.isArray(body))) {
        throw createAPIError('Request body is required for POST/PATCH operations', 400)
      }
    }
  }

  /**
   * Validate column names to prevent SQL injection
   */
  static validateColumnName(columnName: string): void {
    if (!columnName || typeof columnName !== 'string') {
      throw createAPIError('Column name is required and must be a string', 400)
    }

    // Only allow alphanumeric characters and underscores
    const validColumnNameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/
    if (!validColumnNameRegex.test(columnName)) {
      throw createAPIError('Invalid column name format', 400)
    }
  }

  /**
   * Validate that required headers are present
   */
  static validateRequiredHeaders(headers: Record<string, string>): void {
    // Ensure apikey is present
    const apiKey = headers.apikey || headers['x-api-key']
    if (!apiKey) {
      throw createAPIError('API key is required', 401)
    }
  }
}