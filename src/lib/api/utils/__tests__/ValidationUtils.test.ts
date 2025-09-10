import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationUtils } from '../ValidationUtils'
import * as ErrorHandler from '../../../infrastructure/ErrorHandler'

// Mock the dependencies
vi.mock('../../../infrastructure/ErrorHandler', () => ({
  createAPIError: vi.fn((message: string, status: number) => {
    const error = new Error(message) as any
    error.status = status
    return error
  })
}))

describe('ValidationUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validateTableName', () => {
    it('should accept valid table names', () => {
      const validNames = [
        'users',
        'user_accounts',
        'UserAccounts',
        'table123',
        'T1',
        'a',
        'schema.table',
        'public.users',
        'auth.users'
      ]

      validNames.forEach(name => {
        expect(() => ValidationUtils.validateTableName(name)).not.toThrow()
      })
    })

    it('should reject empty or null table names', () => {
      expect(() => ValidationUtils.validateTableName('')).toThrow()
      expect(() => ValidationUtils.validateTableName(null as any)).toThrow()
      expect(() => ValidationUtils.validateTableName(undefined as any)).toThrow()

      expect(ErrorHandler.createAPIError).toHaveBeenCalledWith(
        'Table name is required and must be a string', 
        400
      )
    })

    it('should reject non-string table names', () => {
      expect(() => ValidationUtils.validateTableName(123 as any)).toThrow()
      expect(() => ValidationUtils.validateTableName({} as any)).toThrow()
      expect(() => ValidationUtils.validateTableName([] as any)).toThrow()

      expect(ErrorHandler.createAPIError).toHaveBeenCalledWith(
        'Table name is required and must be a string', 
        400
      )
    })

    it('should reject table names starting with numbers', () => {
      const invalidNames = ['1users', '123table', '9invalid']

      invalidNames.forEach(name => {
        expect(() => ValidationUtils.validateTableName(name)).toThrow()
      })

      expect(ErrorHandler.createAPIError).toHaveBeenCalledWith(
        'Invalid table name format', 
        400
      )
    })

    it('should reject table names with invalid characters', () => {
      const invalidNames = [
        'user-table',
        'user table',
        'user@table',
        'user#table',
        'user$table',
        'user%table',
        'table!',
        'table?',
        'table*',
        'table+',
        'table=',
        'table|',
        'table\\',
        'table/',
        'table<>',
        'table[]',
        'table{}',
        'table()',
        'table"',
        "table'",
        'table`',
        'table~',
        'table^',
        'table&'
      ]

      invalidNames.forEach(name => {
        expect(() => ValidationUtils.validateTableName(name)).toThrow()
      })
    })

    it('should accept schema-qualified table names', () => {
      const validSchemaNames = [
        'public.users',
        'auth.sessions',
        'storage.buckets',
        'schema123.table456',
        'my_schema.my_table'
      ]

      validSchemaNames.forEach(name => {
        expect(() => ValidationUtils.validateTableName(name)).not.toThrow()
      })
    })

    it('should reject invalid schema-qualified names', () => {
      const invalidSchemaNames = [
        'public.',
        '.users',
        'public..users',
        '123schema.users',
        'schema.123table',
        'schema-name.users',
        'schema name.users',
        'schema.user-table'
      ]

      invalidSchemaNames.forEach(name => {
        expect(() => ValidationUtils.validateTableName(name)).toThrow()
      })
    })
  })

  describe('validateHttpMethod', () => {
    it('should accept valid HTTP methods', () => {
      const validMethods = ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'RPC']

      validMethods.forEach(method => {
        expect(() => ValidationUtils.validateHttpMethod(method)).not.toThrow()
      })
    })

    it('should reject invalid HTTP methods', () => {
      const invalidMethods = [
        'PUT',
        'OPTIONS',
        'TRACE',
        'CONNECT',
        'get',
        'post',
        'INVALID',
        '',
        'GET POST',
        '123',
        null,
        undefined
      ]

      invalidMethods.forEach(method => {
        expect(() => ValidationUtils.validateHttpMethod(method as any)).toThrow()
        expect(ErrorHandler.createAPIError).toHaveBeenLastCalledWith(
          `Invalid HTTP method: ${method}`, 
          405
        )
      })
    })
  })

  describe('validateRequestBody', () => {
    it('should require body for POST requests', () => {
      expect(() => ValidationUtils.validateRequestBody(null, 'POST')).toThrow()
      expect(() => ValidationUtils.validateRequestBody(undefined, 'POST')).toThrow()
      expect(() => ValidationUtils.validateRequestBody('', 'POST')).toThrow()
      expect(() => ValidationUtils.validateRequestBody(0, 'POST')).toThrow()
      expect(() => ValidationUtils.validateRequestBody(false, 'POST')).toThrow()

      expect(ErrorHandler.createAPIError).toHaveBeenCalledWith(
        'Request body is required for POST/PATCH operations', 
        400
      )
    })

    it('should require body for PATCH requests', () => {
      expect(() => ValidationUtils.validateRequestBody(null, 'PATCH')).toThrow()
      expect(() => ValidationUtils.validateRequestBody(undefined, 'PATCH')).toThrow()

      expect(ErrorHandler.createAPIError).toHaveBeenCalledWith(
        'Request body is required for POST/PATCH operations', 
        400
      )
    })

    it('should accept valid bodies for POST/PATCH', () => {
      const validBodies = [
        { name: 'test' },
        [{ id: 1 }],
        { field: null },
        { array: [] },
        { nested: { object: true } }
      ]

      validBodies.forEach(body => {
        expect(() => ValidationUtils.validateRequestBody(body, 'POST')).not.toThrow()
        expect(() => ValidationUtils.validateRequestBody(body, 'PATCH')).not.toThrow()
      })
    })

    it('should not require body for GET requests', () => {
      expect(() => ValidationUtils.validateRequestBody(null, 'GET')).not.toThrow()
      expect(() => ValidationUtils.validateRequestBody(undefined, 'GET')).not.toThrow()
    })

    it('should not require body for DELETE requests', () => {
      expect(() => ValidationUtils.validateRequestBody(null, 'DELETE')).not.toThrow()
      expect(() => ValidationUtils.validateRequestBody(undefined, 'DELETE')).not.toThrow()
    })

    it('should not require body for HEAD requests', () => {
      expect(() => ValidationUtils.validateRequestBody(null, 'HEAD')).not.toThrow()
      expect(() => ValidationUtils.validateRequestBody(undefined, 'HEAD')).not.toThrow()
    })
  })

  describe('validateColumnName', () => {
    it('should accept valid column names', () => {
      const validNames = [
        'id',
        'user_name',
        'firstName',
        'created_at',
        'column123',
        'a',
        'C1'
      ]

      validNames.forEach(name => {
        expect(() => ValidationUtils.validateColumnName(name)).not.toThrow()
      })
    })

    it('should reject empty or null column names', () => {
      expect(() => ValidationUtils.validateColumnName('')).toThrow()
      expect(() => ValidationUtils.validateColumnName(null as any)).toThrow()
      expect(() => ValidationUtils.validateColumnName(undefined as any)).toThrow()

      expect(ErrorHandler.createAPIError).toHaveBeenCalledWith(
        'Column name is required and must be a string', 
        400
      )
    })

    it('should reject non-string column names', () => {
      expect(() => ValidationUtils.validateColumnName(123 as any)).toThrow()
      expect(() => ValidationUtils.validateColumnName({} as any)).toThrow()
      expect(() => ValidationUtils.validateColumnName([] as any)).toThrow()

      expect(ErrorHandler.createAPIError).toHaveBeenCalledWith(
        'Column name is required and must be a string', 
        400
      )
    })

    it('should reject column names starting with numbers', () => {
      const invalidNames = ['1column', '123field', '9invalid']

      invalidNames.forEach(name => {
        expect(() => ValidationUtils.validateColumnName(name)).toThrow()
      })

      expect(ErrorHandler.createAPIError).toHaveBeenCalledWith(
        'Invalid column name format', 
        400
      )
    })

    it('should reject column names with invalid characters', () => {
      const invalidNames = [
        'column-name',
        'column name',
        'column@name',
        'column.name',
        'column#name',
        'column$name',
        'column%name',
        'column!',
        'column?',
        'column*',
        'column+',
        'column=',
        'column|',
        'column\\',
        'column/',
        'column<>',
        'column[]',
        'column{}',
        'column()',
        'column"',
        "column'",
        'column`',
        'column~',
        'column^',
        'column&'
      ]

      invalidNames.forEach(name => {
        expect(() => ValidationUtils.validateColumnName(name)).toThrow()
      })

      expect(ErrorHandler.createAPIError).toHaveBeenLastCalledWith(
        'Invalid column name format', 
        400
      )
    })
  })

  describe('validateRequiredHeaders', () => {
    it('should accept headers with apikey', () => {
      const headers = { apikey: 'test-key' }
      expect(() => ValidationUtils.validateRequiredHeaders(headers)).not.toThrow()
    })

    it('should accept headers with x-api-key', () => {
      const headers = { 'x-api-key': 'test-key' }
      expect(() => ValidationUtils.validateRequiredHeaders(headers)).not.toThrow()
    })

    it('should prefer apikey over x-api-key', () => {
      const headers = { 
        apikey: 'preferred-key',
        'x-api-key': 'fallback-key'
      }
      expect(() => ValidationUtils.validateRequiredHeaders(headers)).not.toThrow()
    })

    it('should reject headers without API key', () => {
      const invalidHeaders = [
        {},
        { authorization: 'Bearer token' },
        { 'content-type': 'application/json' },
        { apikey: '' },
        { 'x-api-key': '' },
        { apikey: null },
        { 'x-api-key': null }
      ]

      invalidHeaders.forEach(headers => {
        expect(() => ValidationUtils.validateRequiredHeaders(headers as any)).toThrow()
      })

      expect(ErrorHandler.createAPIError).toHaveBeenCalledWith(
        'API key is required', 
        401
      )
    })

    it('should handle case-sensitive header names', () => {
      const headers = { 'X-API-KEY': 'test-key' }
      expect(() => ValidationUtils.validateRequiredHeaders(headers)).toThrow()

      expect(ErrorHandler.createAPIError).toHaveBeenCalledWith(
        'API key is required', 
        401
      )
    })
  })
})