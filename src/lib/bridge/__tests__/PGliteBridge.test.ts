/**
 * PGlite Bridge Integration Test
 * 
 * Tests the core functionality of the PGlite HTTP Bridge for hybrid architecture
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PGliteBridge } from '../PGliteBridge'

// Mock DatabaseManager
vi.mock('../../database/connection', () => ({
  DatabaseManager: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      query: vi.fn(),
      setSessionContext: vi.fn()
    }))
  }
}))

describe('PGliteBridge', () => {
  let bridge: PGliteBridge
  
  beforeEach(() => {
    bridge = PGliteBridge.getInstance()
  })

  describe('PostgREST Query Conversion', () => {
    it('should convert simple PostgREST query to SQL', () => {
      const query = {
        table: 'users',
        select: ['id', 'name'],
        where: { active: true },
        limit: 10
      }

      const { sql, params } = bridge.postgrestToSQL(query)

      expect(sql).toContain('SELECT id, name')
      expect(sql).toContain('FROM users')
      expect(sql).toContain('WHERE active = $1')
      expect(sql).toContain('LIMIT 10')
      expect(params).toEqual([true])
    })

    it('should handle complex PostgREST queries', () => {
      const query = {
        table: 'posts',
        schema: 'public',
        select: ['*'],
        where: { 
          user_id: 123,
          status: 'published'
        },
        order: [
          { column: 'created_at', ascending: false },
          { column: 'title', ascending: true }
        ],
        limit: 20,
        offset: 40
      }

      const { sql, params } = bridge.postgrestToSQL(query)

      expect(sql).toContain('SELECT *')
      expect(sql).toContain('FROM public.posts')
      expect(sql).toContain('WHERE user_id = $1 AND status = $2')
      expect(sql).toContain('ORDER BY created_at DESC, title ASC')
      expect(sql).toContain('LIMIT 20')
      expect(sql).toContain('OFFSET 40')
      expect(params).toEqual([123, 'published'])
    })

    it('should handle IN clause for array values', () => {
      const query = {
        table: 'products',
        where: {
          category_id: [1, 2, 3, 4]
        }
      }

      const { sql, params } = bridge.postgrestToSQL(query)

      expect(sql).toContain('WHERE category_id IN ($1, $2, $3, $4)')
      expect(params).toEqual([1, 2, 3, 4])
    })

    it('should handle NULL values correctly', () => {
      const query = {
        table: 'users',
        where: {
          deleted_at: null
        }
      }

      const { sql } = bridge.postgrestToSQL(query)

      expect(sql).toContain('WHERE deleted_at IS NULL')
    })
  })

  describe('HTTP Request Handling', () => {
    it('should handle GET request with query parameters', async () => {
      const response = await bridge.handleHTTPRequest(
        'GET',
        '/users?select=id,name&limit=5&order=name.asc',
        { 'Content-Type': 'application/json' }
      )

      expect(response.status).toBe(200)
      const contentType = response.headers.get('Content-Type')
      expect(contentType).toBe('application/json')
    })

    it('should handle errors gracefully', async () => {
      // Test with invalid path
      const response = await bridge.handleHTTPRequest(
        'GET',
        '/',
        { 'Content-Type': 'application/json' }
      )

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data).toHaveProperty('error')
    })
  })

  describe('Schema Metadata', () => {
    it('should provide schema metadata interface', async () => {
      // This test verifies the interface exists and basic functionality
      expect(bridge.getSchemaMetadata).toBeDefined()
      expect(typeof bridge.getSchemaMetadata).toBe('function')
    })
  })

  describe('Bridge Request Handling', () => {
    it('should handle bridge requests with proper response format', async () => {
      const request = {
        id: 'test-001',
        sql: 'SELECT 1 as test_value',
        params: []
      }

      const response = await bridge.handleRequest(request)

      expect(response).toHaveProperty('id', 'test-001')
      expect(response).toHaveProperty('success')
      expect(response).toHaveProperty('executionTime')
      expect(typeof response.executionTime).toBe('number')
    })

    it('should handle requests with session context', async () => {
      const request = {
        id: 'test-002',
        sql: 'SELECT current_user',
        params: [],
        sessionContext: {
          role: 'authenticated' as const,
          userId: 'user-123',
          claims: { email: 'test@example.com' }
        }
      }

      const response = await bridge.handleRequest(request)

      expect(response.id).toBe('test-002')
      expect(response).toHaveProperty('success')
    })
  })
})