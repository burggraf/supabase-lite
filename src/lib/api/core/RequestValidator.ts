import type { APIRequest, ValidationResult, ValidationError } from '../types/APITypes'

export class RequestValidator {
  static validate(request: APIRequest): ValidationResult {
    const errors: ValidationError[] = []

    // Validate table name
    if (!request.table || typeof request.table !== 'string') {
      errors.push({
        field: 'table',
        message: 'Table name is required and must be a string',
        code: 'INVALID_TABLE'
      })
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(request.table)) {
      errors.push({
        field: 'table',
        message: 'Table name must be a valid identifier',
        code: 'INVALID_TABLE_FORMAT'
      })
    }

    // Validate HTTP method
    const validMethods = ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'RPC']
    if (!validMethods.includes(request.method)) {
      errors.push({
        field: 'method',
        message: `Method must be one of: ${validMethods.join(', ')}`,
        code: 'INVALID_METHOD'
      })
    }

    // Validate URL
    if (!request.url || !(request.url instanceof URL)) {
      errors.push({
        field: 'url',
        message: 'URL is required and must be a valid URL object',
        code: 'INVALID_URL'
      })
    }

    // Validate headers
    if (!request.headers || typeof request.headers !== 'object') {
      errors.push({
        field: 'headers',
        message: 'Headers must be an object',
        code: 'INVALID_HEADERS'
      })
    }

    // Method-specific validations
    if (request.method === 'POST' || request.method === 'PATCH') {
      if (request.body === undefined) {
        errors.push({
          field: 'body',
          message: `Body is required for ${request.method} requests`,
          code: 'MISSING_BODY'
        })
      }
    }

    // RPC-specific validations
    if (request.method === 'RPC') {
      if (!request.table) {
        errors.push({
          field: 'table',
          message: 'Function name is required for RPC calls',
          code: 'MISSING_FUNCTION_NAME'
        })
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  static validateTableAccess(tableName: string, method: string): ValidationResult {
    const errors: ValidationError[] = []

    // System tables validation
    const systemTables = ['information_schema', 'pg_catalog', 'pg_']
    if (systemTables.some(prefix => tableName.startsWith(prefix))) {
      if (method !== 'GET' && method !== 'HEAD') {
        errors.push({
          field: 'table',
          message: 'System tables are read-only',
          code: 'SYSTEM_TABLE_READONLY'
        })
      }
    }

    // Auth schema validation
    if (tableName.startsWith('auth.')) {
      const authTable = tableName.replace('auth.', '')
      const allowedAuthTables = ['users', 'sessions', 'refresh_tokens']
      if (!allowedAuthTables.includes(authTable)) {
        errors.push({
          field: 'table',
          message: 'Access to this auth table is not allowed',
          code: 'AUTH_TABLE_ACCESS_DENIED'
        })
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}