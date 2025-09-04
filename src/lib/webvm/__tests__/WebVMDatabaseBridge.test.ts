import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WebVMDatabaseBridge } from '../WebVMDatabaseBridge'
import type { DatabaseRequest, DatabaseResponse } from '../types'

describe('WebVMDatabaseBridge', () => {
  let bridge: WebVMDatabaseBridge
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
    bridge = new WebVMDatabaseBridge({
      baseUrl: 'http://localhost:5173',
      projectId: 'test-project'
    })
  })

  describe('Database Queries', () => {
    it('should execute SELECT queries through HTTP bridge', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          data: [{ id: 1, name: 'John' }]
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const request: DatabaseRequest = {
        method: 'GET',
        path: '/rest/v1/users',
        headers: {
          'apikey': 'test-key',
          'Authorization': 'Bearer test-token'
        }
      }

      const response = await bridge.executeRequest(request)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/test-project/rest/v1/users',
        {
          method: 'GET',
          headers: {
            'apikey': 'test-key',
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          signal: expect.any(AbortSignal)
        }
      )

      expect(response.status).toBe(200)
      expect(response.data).toEqual([{ id: 1, name: 'John' }])
    })

    it('should execute POST queries with request body', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        json: vi.fn().mockResolvedValue({
          data: { id: 2, name: 'Jane' }
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const request: DatabaseRequest = {
        method: 'POST',
        path: '/rest/v1/users',
        headers: {
          'apikey': 'test-key',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({ name: 'Jane', email: 'jane@example.com' })
      }

      const response = await bridge.executeRequest(request)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/test-project/rest/v1/users',
        {
          method: 'POST',
          headers: {
            'apikey': 'test-key',
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: 'Jane', email: 'jane@example.com' }),
          signal: expect.any(AbortSignal)
        }
      )

      expect(response.status).toBe(201)
      expect(response.data).toEqual({ id: 2, name: 'Jane' })
    })

    it('should handle authentication errors', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: 'Unauthorized',
          message: 'Invalid JWT token'
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const request: DatabaseRequest = {
        method: 'GET',
        path: '/rest/v1/protected',
        headers: {
          'apikey': 'test-key',
          'Authorization': 'Bearer invalid-token'
        }
      }

      const response = await bridge.executeRequest(request)

      expect(response.status).toBe(401)
      expect(response.error).toBe('Unauthorized')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const request: DatabaseRequest = {
        method: 'GET',
        path: '/rest/v1/users',
        headers: { 'apikey': 'test-key' }
      }

      const response = await bridge.executeRequest(request)

      expect(response.status).toBe(500)
      expect(response.error).toBe('Network error')
    })
  })

  describe('Authentication Context', () => {
    it('should inject user context from JWT token', async () => {
      const mockJwtPayload = {
        sub: 'user-123',
        role: 'authenticated',
        email: 'user@example.com'
      }

      bridge.setAuthContext(mockJwtPayload)

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: [] })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const request: DatabaseRequest = {
        method: 'GET',
        path: '/rest/v1/profiles',
        headers: {
          'apikey': 'test-key',
          'Authorization': 'Bearer test-token'
        }
      }

      await bridge.executeRequest(request)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-User-Id': 'user-123',
            'X-User-Role': 'authenticated',
            'X-User-Email': 'user@example.com'
          })
        })
      )
    })

    it('should handle anonymous requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: [] })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const request: DatabaseRequest = {
        method: 'GET',
        path: '/rest/v1/public_data',
        headers: {
          'apikey': 'test-key'
        }
      }

      await bridge.executeRequest(request)

      const fetchCall = mockFetch.mock.calls[0][1]
      expect(fetchCall.headers).not.toHaveProperty('X-User-Id')
      expect(fetchCall.headers).not.toHaveProperty('X-User-Role')
    })
  })

  describe('Connection Management', () => {
    it('should validate connection on initialization', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ version: '1.0' })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const isValid = await bridge.validateConnection()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/test-project/health',
        expect.any(Object)
      )
      expect(isValid).toBe(true)
    })

    it('should handle connection validation failure', async () => {
      mockFetch.mockRejectedValue(new Error('Connection failed'))

      const isValid = await bridge.validateConnection()

      expect(isValid).toBe(false)
    })

    it('should support custom timeout configuration', () => {
      const customBridge = new WebVMDatabaseBridge({
        baseUrl: 'http://localhost:5173',
        projectId: 'test-project',
        timeout: 30000
      })

      expect(customBridge.getTimeout()).toBe(30000)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON responses', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      }
      mockFetch.mockResolvedValue(mockResponse)

      const request: DatabaseRequest = {
        method: 'GET',
        path: '/rest/v1/users',
        headers: { 'apikey': 'test-key' }
      }

      const response = await bridge.executeRequest(request)

      expect(response.status).toBe(500)
      expect(response.error).toBe('Invalid JSON')
    })

    it('should handle timeout errors', async () => {
      const timeoutBridge = new WebVMDatabaseBridge({
        baseUrl: 'http://localhost:5173',
        projectId: 'test-project',
        timeout: 100
      })

      // Mock AbortController to simulate timeout
      const mockAbort = vi.fn()
      const mockAbortController = {
        signal: { addEventListener: vi.fn() },
        abort: mockAbort
      }
      
      vi.stubGlobal('AbortController', vi.fn(() => mockAbortController))
      
      // Simulate fetch being aborted
      const abortError = new Error('The operation was aborted.')
      abortError.name = 'AbortError'
      mockFetch.mockRejectedValue(abortError)

      const request: DatabaseRequest = {
        method: 'GET',
        path: '/rest/v1/users',
        headers: { 'apikey': 'test-key' }
      }

      const response = await timeoutBridge.executeRequest(request)

      expect(response.status).toBe(408)
      expect(response.error).toContain('timeout')
    })
  })

  describe('Request Transformation', () => {
    it('should transform Supabase client requests to HTTP format', () => {
      const supabaseRequest = {
        table: 'users',
        method: 'select',
        filters: [
          { column: 'age', operator: 'gte', value: 18 },
          { column: 'status', operator: 'eq', value: 'active' }
        ],
        select: ['id', 'name', 'email']
      }

      const httpRequest = bridge.transformSupabaseRequest(supabaseRequest)

      expect(httpRequest.method).toBe('GET')
      expect(httpRequest.path).toBe('/rest/v1/users?select=id,name,email&age=gte.18&status=eq.active')
    })

    it('should handle complex PostgREST queries', () => {
      const complexRequest = {
        table: 'posts',
        method: 'select',
        select: ['title', 'author(name)', 'tags(name)'],
        filters: [
          { column: 'published_at', operator: 'gte', value: '2023-01-01' },
          { column: 'category', operator: 'in', value: ['tech', 'science'] }
        ],
        order: [{ column: 'published_at', ascending: false }],
        limit: 10
      }

      const httpRequest = bridge.transformSupabaseRequest(complexRequest)

      expect(httpRequest.path).toContain('select=title,author(name),tags(name)')
      expect(httpRequest.path).toContain('published_at=gte.2023-01-01')
      expect(httpRequest.path).toContain('category=in.(tech,science)')
      expect(httpRequest.path).toContain('order=published_at.desc')
      expect(httpRequest.path).toContain('limit=10')
    })
  })
})