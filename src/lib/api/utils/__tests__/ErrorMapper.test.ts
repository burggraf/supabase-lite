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

    it('should map database errors before logging (non-PostgreSQL fallback)', () => {
      const error = new Error('relation "users" does not exist')
      const context = {
        operation: 'SELECT query',
        table: 'users'
      }

      ErrorMapper.mapAndLogError(error, context)

      // Should have called logError with the mapped error (fallback mapping for non-PG errors)
      const loggedError = mockLogError.mock.calls[0][1]
      expect(loggedError.message).toBe("Table 'users' does not exist")
      expect((loggedError as any).status).toBe(404)
    })

    it('should preserve PostgreSQL errors during logging', () => {
      const error = new Error('duplicate key value violates unique constraint "countries_pkey"')
      ;(error as any).code = '23505'
      ;(error as any).detail = 'Key (id)=(1) already exists.'
      
      const context = {
        operation: 'INSERT query',
        table: 'countries'
      }

      ErrorMapper.mapAndLogError(error, context)

      // Should have called logError with the original PostgreSQL error (not mapped)
      const loggedError = mockLogError.mock.calls[0][1]
      expect(loggedError).toBe(error) // Same object reference
      expect(loggedError.message).toBe('duplicate key value violates unique constraint "countries_pkey"')
      expect((loggedError as any).code).toBe('23505')
    })
  })

  describe('mapDatabaseError', () => {
    const context = { operation: 'test', table: 'test_table' }

    it('should preserve PostgreSQL constraint violation errors', () => {
      const error = new Error('duplicate key value violates unique constraint "countries_pkey"')
      // Add PostgreSQL error properties to make it identifiable as a PG error
      ;(error as any).code = '23505'
      ;(error as any).detail = 'Key (id)=(1) already exists.'
      
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      // Should return the original PostgreSQL error unchanged
      expect(mappedError).toBe(error)
      expect(mockCreateAPIError).not.toHaveBeenCalled()
    })

    it('should preserve PostgreSQL foreign key errors', () => {
      const error = new Error('violates foreign key constraint "fk_user"')
      ;(error as any).code = '23503'
      
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mappedError).toBe(error)
      expect(mockCreateAPIError).not.toHaveBeenCalled()
    })

    it('should preserve PostgreSQL table not found errors', () => {
      const error = new Error('relation "users" does not exist')
      ;(error as any).code = '42P01'
      
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mappedError).toBe(error)
      expect(mockCreateAPIError).not.toHaveBeenCalled()
    })

    it('should map non-PostgreSQL table does not exist errors', () => {
      const error = new Error('relation "users" does not exist')
      // No PostgreSQL properties - this is a fallback case
      
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith("Table 'test_table' does not exist", 404)
    })

    it('should map non-PostgreSQL column errors', () => {
      const error = new Error('column "invalid_column" does not exist')
      
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith("Column does not exist in table 'test_table'", 400)
    })

    it('should map non-PostgreSQL duplicate key errors', () => {
      const error = new Error('duplicate key violation')
      
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Duplicate key violation - record already exists', 409)
    })

    it('should map authentication errors', () => {
      const error = new Error('invalid credentials')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mockCreateAPIError).toHaveBeenCalledWith('Invalid credentials provided', 401)
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

    it('should return original error if no mapping found', () => {
      const error = new Error('some unmapped error')
      const mappedError = ErrorMapper.mapDatabaseError(error, context)
      
      expect(mappedError).toBe(error)
      expect(mockCreateAPIError).not.toHaveBeenCalled()
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