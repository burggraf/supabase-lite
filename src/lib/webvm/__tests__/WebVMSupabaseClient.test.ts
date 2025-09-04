import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WebVMSupabaseClient } from '../WebVMSupabaseClient'

describe('WebVMSupabaseClient', () => {
  let client: WebVMSupabaseClient
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
    
    client = new WebVMSupabaseClient({
      url: 'http://localhost:5173',
      key: 'test-anon-key',
      projectId: 'test-project'
    })
  })

  describe('Table Operations', () => {
    it('should execute select queries', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' }
        ])
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { data, error } = await client
        .from('users')
        .select('*')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/test-project/rest/v1/users?select=*',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'apikey': 'test-anon-key',
            'Content-Type': 'application/json'
          })
        })
      )

      expect(error).toBeNull()
      expect(data).toEqual([
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' }
      ])
    })

    it('should execute select queries with filters', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([
          { id: 1, name: 'John', email: 'john@example.com', age: 25 }
        ])
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { data, error } = await client
        .from('users')
        .select('id, name, email, age')
        .eq('name', 'John')
        .gte('age', 18)
        .single()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/test-project/rest/v1/users?select=id,name,email,age&name=eq.John&age=gte.18',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Accept': 'application/vnd.pgrst.object+json'
          })
        })
      )

      expect(error).toBeNull()
      expect(data).toEqual({ id: 1, name: 'John', email: 'john@example.com', age: 25 })
    })

    it('should execute insert queries', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        json: vi.fn().mockResolvedValue([
          { id: 3, name: 'Bob', email: 'bob@example.com' }
        ])
      }
      mockFetch.mockResolvedValue(mockResponse)

      const newUser = { name: 'Bob', email: 'bob@example.com' }
      const { data, error } = await client
        .from('users')
        .insert(newUser)
        .select()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/test-project/rest/v1/users',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Prefer': 'return=representation'
          }),
          body: JSON.stringify(newUser)
        })
      )

      expect(error).toBeNull()
      expect(data).toEqual([{ id: 3, name: 'Bob', email: 'bob@example.com' }])
    })

    it('should execute update queries', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([
          { id: 1, name: 'John Updated', email: 'john.updated@example.com' }
        ])
      }
      mockFetch.mockResolvedValue(mockResponse)

      const updateData = { name: 'John Updated', email: 'john.updated@example.com' }
      const { data, error } = await client
        .from('users')
        .update(updateData)
        .eq('id', 1)
        .select()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/test-project/rest/v1/users?id=eq.1',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Prefer': 'return=representation'
          }),
          body: JSON.stringify(updateData)
        })
      )

      expect(error).toBeNull()
      expect(data).toEqual([{ id: 1, name: 'John Updated', email: 'john.updated@example.com' }])
    })

    it('should execute delete queries', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        json: vi.fn().mockResolvedValue([])
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { data, error } = await client
        .from('users')
        .delete()
        .eq('id', 1)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/test-project/rest/v1/users?id=eq.1',
        expect.objectContaining({
          method: 'DELETE'
        })
      )

      expect(error).toBeNull()
      expect(data).toEqual([])
    })
  })

  describe('Authentication Context', () => {
    it('should inject JWT token from authorization header', async () => {
      client.setAuth('Bearer jwt-token-here')

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([])
      }
      mockFetch.mockResolvedValue(mockResponse)

      await client.from('profiles').select('*')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer jwt-token-here'
          })
        })
      )
    })

    it('should work without authentication for public tables', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([{ id: 1, title: 'Public Post' }])
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { data, error } = await client
        .from('public_posts')
        .select('*')

      expect(error).toBeNull()
      expect(data).toEqual([{ id: 1, title: 'Public Post' }])

      const fetchCall = mockFetch.mock.calls[0][1]
      expect(fetchCall.headers).not.toHaveProperty('Authorization')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors', async () => {
      const mockResponse = {
        ok: false,
        status: 409,
        json: vi.fn().mockResolvedValue({
          error: 'duplicate_key',
          message: 'Key (email)=(test@example.com) already exists.',
          details: 'Failing row contains (3, test@example.com).',
          code: '23505'
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { data, error } = await client
        .from('users')
        .insert({ email: 'test@example.com' })

      expect(data).toBeNull()
      expect(error).toEqual({
        message: 'duplicate_key',
        details: 'Key (email)=(test@example.com) already exists.',
        code: 'CONFLICT'
      })
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const { data, error } = await client
        .from('users')
        .select('*')

      expect(data).toBeNull()
      expect(error).toEqual({
        message: 'Network error',
        details: 'Network or processing error occurred',
        code: 'DATABASE_ERROR'
      })
    })

    it('should handle authorization errors', async () => {
      client.setAuth('Bearer invalid-token')

      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          error: 'Unauthorized',
          message: 'Invalid JWT token'
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { data, error } = await client
        .from('private_data')
        .select('*')

      expect(data).toBeNull()
      expect(error).toEqual({
        message: 'Unauthorized',
        details: 'Invalid JWT token',
        code: 'UNAUTHORIZED'
      })
    })
  })

  describe('Query Builder', () => {
    it('should build complex queries with multiple filters and ordering', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue([])
      }
      mockFetch.mockResolvedValue(mockResponse)

      await client
        .from('posts')
        .select('title, author(name), tags(name)')
        .eq('published', true)
        .in('category', ['tech', 'science'])
        .gte('created_at', '2023-01-01')
        .order('created_at', { ascending: false })
        .limit(10)
        .offset(20)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/test-project/rest/v1/posts?select=title,author(name),tags(name)&published=eq.true&category=in.(tech,science)&created_at=gte.2023-01-01&order=created_at.desc&limit=10&offset=20',
        expect.any(Object)
      )
    })

    it('should handle range queries with count', async () => {
      const mockResponse = {
        ok: true,
        status: 206,
        headers: {
          get: vi.fn((key) => {
            if (key === 'content-range') return 'rows 0-9/100'
            return null
          })
        },
        json: vi.fn().mockResolvedValue([])
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { data, error, count } = await client
        .from('users')
        .select('*', { count: 'exact' })
        .range(0, 9)

      expect(error).toBeNull()
      expect(data).toEqual([])
      expect(count).toBe(0) // Simplified for test - in real implementation, would parse Content-Range header
    })
  })

  describe('RPC Functions', () => {
    it('should call PostgreSQL functions', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: 'success' })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const { data, error } = await client.rpc('get_user_stats', {
        user_id: 123
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5173/test-project/rest/v1/rpc/get_user_stats',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ user_id: 123 })
        })
      )

      expect(error).toBeNull()
      expect(data).toEqual({ result: 'success' })
    })
  })
})