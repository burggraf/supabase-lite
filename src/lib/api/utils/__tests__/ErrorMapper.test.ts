import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies at the top level before any imports
const mockLogError = vi.fn()
const mockCreateAPIError = vi.fn((message: string, status: number) => {
  const error = new Error(message) as any
  error.status = status
  return error
})
const mockFormatErrorResponse = vi.fn()

vi.mock('../../../infrastructure/Logger', () => ({
  logError: mockLogError,
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../../../infrastructure/ErrorHandler', () => ({
  createAPIError: mockCreateAPIError
}))

vi.mock('../../../postgrest', () => ({
  ResponseFormatter: {
    formatErrorResponse: mockFormatErrorResponse
  }
}))

// Import after mocking
import { ErrorMapper } from '../ErrorMapper'

describe('ErrorMapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('mapAndLogError', () => {
    it('should log the error and return formatted response', () => {
      const error = new Error('Test error')
      const context = {
        operation: 'test operation',
        table: 'test_table'
      }
      const mockFormattedResponse = { error: 'formatted error' }

      mockFormatErrorResponse.mockReturnValue(mockFormattedResponse)

      const result = ErrorMapper.mapAndLogError(error, context)

      expect(mockLogError).toHaveBeenCalledWith('test operation failed', error, context)
      expect(mockFormatErrorResponse).toHaveBeenCalledWith(error)
      expect(result).toBe(mockFormattedResponse)
    })

    it('should map database errors before logging', () => {
      const error = new Error('relation "users" does not exist')
      const context = {
        operation: 'SELECT query',
        table: 'users'
      }

      ErrorMapper.mapAndLogError(error, context)

      // Should have called logError with the mapped error
      const loggedError = mockLogError.mock.calls[0][1]
      expect(loggedError.message).toBe("Table 'users' does not exist")
      expect((loggedError as any).status).toBe(404)
    })
  })

  describe('mapDatabaseError', () => {
    const context = { operation: 'test', table: 'test_table' }

    it('should map table does not exist errors', () => {
      const error = new Error('relation "users" does not exist')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith("Table 'test_table' does not exist", 404)
      expect(mappedError).toEqual(expect.objectContaining({
        message: "Table 'test_table' does not exist"
      }))
    })

    it('should map column does not exist errors', () => {
      const error = new Error('column "invalid_column" does not exist')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith("Column does not exist in table 'test_table'", 400)
    })

    it('should map duplicate key errors', () => {
      const error = new Error('duplicate key value violates unique constraint')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Duplicate key violation - record already exists', 409)
    })

    it('should map foreign key constraint errors', () => {
      const error = new Error('violates foreign key constraint')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Foreign key constraint violation', 400)
    })

    it('should map not null constraint errors', () => {
      const error = new Error('null value in column "name" violates not-null constraint')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Required field cannot be null', 400)
    })

    it('should map check constraint errors', () => {
      const error = new Error('new row for relation violates check constraint')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Data validation failed - check constraint violation', 400)
    })

    it('should map syntax errors', () => {
      const error = new Error('syntax error at or near "SELECT"')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Invalid query syntax', 400)
    })

    it('should map permission denied errors', () => {
      const error = new Error('permission denied for relation users')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Access denied to the requested resource', 403)
    })

    it('should map authentication errors', () => {
      const error = new Error('invalid credentials')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Invalid credentials provided', 401)
    })

    it('should map user already exists errors', () => {
      const error = new Error('user already exists')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('User with this email already exists', 409)
    })

    it('should map invalid refresh token errors', () => {
      const error = new Error('invalid refresh token')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Invalid or expired refresh token', 401)
    })

    it('should map validation errors', () => {
      const error = new Error('request body is required')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Request body is required for this operation', 400)
    })

    it('should map WHERE condition requirement errors', () => {
      const error = new Error('UPDATE requires where conditions')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('WHERE conditions are required for this operation', 400)
    })

    it('should map unsupported method errors', () => {
      const error = new Error('unsupported method: PATCH')
      const context = { operation: 'test', method: 'PATCH' }
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Unsupported HTTP method: PATCH', 405)
    })

    it('should map unsupported auth endpoint errors', () => {
      const error = new Error('unsupported auth endpoint')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Authentication endpoint not supported', 404)
    })

    it('should return original error if no mapping found', () => {
      const error = new Error('some unmapped error')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mappedError).toBe(error)
      expect(mockCreateAPIError).not.toHaveBeenCalled()
    })

    it('should handle case-insensitive error messages', () => {
      const error = new Error('DUPLICATE KEY value violates constraint')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Duplicate key violation - record already exists', 409)
    })
  })

  describe('error creator methods', () => {
    it('should create validation errors', () => {
      const error = ErrorMapper.createValidationError('Invalid input')
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Invalid input', 400)
    })

    it('should create authentication errors', () => {
      const error = ErrorMapper.createAuthenticationError('Invalid token')
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Invalid token', 401)
    })

    it('should create authorization errors', () => {
      const error = ErrorMapper.createAuthorizationError('Access denied')
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Access denied', 403)
    })

    it('should create not found errors', () => {
      const error = ErrorMapper.createNotFoundError('Resource not found')
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Resource not found', 404)
    })

    it('should create conflict errors', () => {
      const error = ErrorMapper.createConflictError('Resource already exists')
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Resource already exists', 409)
    })

    it('should create method not allowed errors', () => {
      const error = ErrorMapper.createMethodNotAllowedError('Method not allowed')
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Method not allowed', 405)
    })
  })
})