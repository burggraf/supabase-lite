import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RLSFilteringService } from '../RLSFilteringService'
import { SessionContextService } from '../SessionContextService'
import * as Logger from '../../../infrastructure/Logger'

// Mock the dependencies
vi.mock('../SessionContextService')
vi.mock('../../../infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn()
  }
}))

describe('RLSFilteringService', () => {
  let service: RLSFilteringService
  let mockSessionContextService: vi.Mocked<SessionContextService>

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create a mock instance of SessionContextService
    mockSessionContextService = {
      createSessionContext: vi.fn()
    } as any

    // Mock the constructor to return our mock
    vi.mocked(SessionContextService).mockImplementation(() => mockSessionContextService)

    service = new RLSFilteringService()
  })

  describe('applyRLSFiltering', () => {
    const mockQuery = {
      table: 'users',
      select: ['id', 'name'],
      filters: [{ column: 'active', operator: 'eq', value: true }],
      orders: [],
      limit: null,
      offset: null
    }

    const mockHeaders = {
      apikey: 'test-api-key',
      authorization: 'Bearer test-token'
    }

    it('should create session context and return unmodified query', async () => {
      const mockContext = {
        role: 'authenticated',
        userId: 'user-123',
        claims: { sub: 'user-123', role: 'authenticated' }
      }

      mockSessionContextService.createSessionContext.mockResolvedValue(mockContext)

      const result = await service.applyRLSFiltering('users', mockQuery, mockHeaders)

      expect(mockSessionContextService.createSessionContext).toHaveBeenCalledWith(mockHeaders)
      expect(result).toEqual({
        query: mockQuery,
        context: mockContext
      })
    })

    it('should log debug information with correct parameters', async () => {
      const mockContext = {
        role: 'service_role',
        claims: { role: 'service_role', iss: 'supabase-lite' }
      }

      mockSessionContextService.createSessionContext.mockResolvedValue(mockContext)

      await service.applyRLSFiltering('products', mockQuery, mockHeaders)

      expect(Logger.logger.debug).toHaveBeenCalledWith(
        'Created session context for RLS',
        {
          table: 'products',
          role: 'service_role',
          userId: undefined
        }
      )
    })

    it('should handle authenticated user context', async () => {
      const mockContext = {
        role: 'authenticated',
        userId: 'user-456',
        claims: {
          sub: 'user-456',
          role: 'authenticated',
          iss: 'supabase-lite'
        }
      }

      mockSessionContextService.createSessionContext.mockResolvedValue(mockContext)

      const result = await service.applyRLSFiltering('orders', mockQuery, mockHeaders)

      expect(result.context).toBe(mockContext)
      expect(result.query).toBe(mockQuery)

      expect(Logger.logger.debug).toHaveBeenCalledWith(
        'Created session context for RLS',
        {
          table: 'orders',
          role: 'authenticated',
          userId: 'user-456'
        }
      )
    })

    it('should handle anonymous user context', async () => {
      const mockContext = {
        role: 'anon',
        claims: {
          role: 'anon',
          iss: 'supabase-lite'
        }
      }

      mockSessionContextService.createSessionContext.mockResolvedValue(mockContext)

      const result = await service.applyRLSFiltering('public_data', mockQuery, mockHeaders)

      expect(result.context).toBe(mockContext)
      expect(result.query).toBe(mockQuery)

      expect(Logger.logger.debug).toHaveBeenCalledWith(
        'Created session context for RLS',
        {
          table: 'public_data',
          role: 'anon',
          userId: undefined
        }
      )
    })

    it('should handle service role context', async () => {
      const mockContext = {
        role: 'service_role',
        claims: {
          role: 'service_role',
          iss: 'supabase-lite'
        }
      }

      mockSessionContextService.createSessionContext.mockResolvedValue(mockContext)

      const result = await service.applyRLSFiltering('admin_table', mockQuery, mockHeaders)

      expect(result.context).toBe(mockContext)
      expect(result.query).toBe(mockQuery)

      expect(Logger.logger.debug).toHaveBeenCalledWith(
        'Created session context for RLS',
        {
          table: 'admin_table',
          role: 'service_role',
          userId: undefined
        }
      )
    })

    it('should pass through complex query objects unchanged', async () => {
      const complexQuery = {
        table: 'complex_table',
        select: ['id', 'name', 'nested.field', 'count(*)'],
        filters: [
          { column: 'status', operator: 'eq', value: 'active' },
          { column: 'created_at', operator: 'gte', value: '2023-01-01' },
          { column: 'category', operator: 'in', value: ['A', 'B', 'C'] }
        ],
        orders: [
          { column: 'created_at', ascending: false },
          { column: 'name', ascending: true }
        ],
        limit: 50,
        offset: 100,
        count: 'exact',
        preferResolution: 'merge-duplicates'
      }

      const mockContext = {
        role: 'authenticated',
        userId: 'user-789',
        claims: { sub: 'user-789', role: 'authenticated' }
      }

      mockSessionContextService.createSessionContext.mockResolvedValue(mockContext)

      const result = await service.applyRLSFiltering('complex_table', complexQuery, mockHeaders)

      expect(result.query).toEqual(complexQuery)
      expect(result.context).toBe(mockContext)
    })

    it('should work with minimal headers', async () => {
      const minimalHeaders = { apikey: 'basic-key' }
      const mockContext = {
        role: 'anon',
        claims: { role: 'anon', iss: 'supabase-lite' }
      }

      mockSessionContextService.createSessionContext.mockResolvedValue(mockContext)

      const result = await service.applyRLSFiltering('simple_table', mockQuery, minimalHeaders)

      expect(mockSessionContextService.createSessionContext).toHaveBeenCalledWith(minimalHeaders)
      expect(result.context).toBe(mockContext)
      expect(result.query).toBe(mockQuery)
    })

    it('should work with empty headers object', async () => {
      const emptyHeaders = {}
      const mockContext = {
        role: 'anon',
        claims: { role: 'anon', iss: 'supabase-lite' }
      }

      mockSessionContextService.createSessionContext.mockResolvedValue(mockContext)

      const result = await service.applyRLSFiltering('public_table', mockQuery, emptyHeaders)

      expect(mockSessionContextService.createSessionContext).toHaveBeenCalledWith(emptyHeaders)
      expect(result.context).toBe(mockContext)
      expect(result.query).toBe(mockQuery)
    })

    it('should propagate errors from SessionContextService', async () => {
      const error = new Error('Session creation failed')
      mockSessionContextService.createSessionContext.mockRejectedValue(error)

      await expect(
        service.applyRLSFiltering('test_table', mockQuery, mockHeaders)
      ).rejects.toThrow('Session creation failed')

      expect(mockSessionContextService.createSessionContext).toHaveBeenCalledWith(mockHeaders)
    })

    it('should handle different table names correctly', async () => {
      const mockContext = {
        role: 'authenticated',
        userId: 'user-123',
        claims: { sub: 'user-123', role: 'authenticated' }
      }

      mockSessionContextService.createSessionContext.mockResolvedValue(mockContext)

      const tableNames = [
        'users',
        'user_profiles',
        'orders',
        'public.posts',
        'auth.users',
        'storage.objects'
      ]

      for (const tableName of tableNames) {
        await service.applyRLSFiltering(tableName, mockQuery, mockHeaders)

        expect(Logger.logger.debug).toHaveBeenCalledWith(
          'Created session context for RLS',
          {
            table: tableName,
            role: 'authenticated',
            userId: 'user-123'
          }
        )
      }

      expect(Logger.logger.debug).toHaveBeenCalledTimes(tableNames.length)
    })

    it('should maintain query object reference integrity', async () => {
      const mockContext = {
        role: 'authenticated',
        userId: 'user-123',
        claims: { sub: 'user-123', role: 'authenticated' }
      }

      mockSessionContextService.createSessionContext.mockResolvedValue(mockContext)

      const result = await service.applyRLSFiltering('test_table', mockQuery, mockHeaders)

      // The query should be the exact same object reference (not a copy)
      expect(result.query).toBe(mockQuery)
      expect(result.query === mockQuery).toBe(true)
    })

    it('should handle context without userId', async () => {
      const mockContext = {
        role: 'anon',
        claims: { role: 'anon', iss: 'supabase-lite' }
        // Note: no userId property
      }

      mockSessionContextService.createSessionContext.mockResolvedValue(mockContext)

      const result = await service.applyRLSFiltering('public_table', mockQuery, mockHeaders)

      expect(result.context).toBe(mockContext)

      expect(Logger.logger.debug).toHaveBeenCalledWith(
        'Created session context for RLS',
        {
          table: 'public_table',
          role: 'anon',
          userId: undefined
        }
      )
    })
  })
})