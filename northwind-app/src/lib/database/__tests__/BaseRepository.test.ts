import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BaseRepository } from '../BaseRepository'
import { DatabaseManager } from '../../../src/lib/database/connection'

// Mock DatabaseManager
vi.mock('../../../src/lib/database/connection', () => ({
  DatabaseManager: {
    getInstance: vi.fn(() => ({
      query: vi.fn(),
      transaction: vi.fn()
    }))
  }
}))

interface TestEntity {
  id: number
  name: string
  email?: string
  created_at?: Date
}

class TestRepository extends BaseRepository<TestEntity> {
  constructor() {
    super('test_table', 'id')
  }
}

describe('BaseRepository', () => {
  let repository: TestRepository
  let mockDbManager: any

  beforeEach(() => {
    mockDbManager = {
      query: vi.fn(),
      transaction: vi.fn()
    }
    
    vi.mocked(DatabaseManager.getInstance).mockReturnValue(mockDbManager)
    repository = new TestRepository()
  })

  describe('findById', () => {
    it('should find entity by ID', async () => {
      const mockEntity = { id: 1, name: 'Test Entity', email: 'test@example.com' }
      mockDbManager.query.mockResolvedValue({ rows: [mockEntity] })

      const result = await repository.findById(1)

      expect(mockDbManager.query).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE id = $1',
        [1]
      )
      expect(result).toEqual(mockEntity)
    })

    it('should return null when entity not found', async () => {
      mockDbManager.query.mockResolvedValue({ rows: [] })

      const result = await repository.findById(999)

      expect(result).toBeNull()
    })
  })

  describe('findAll', () => {
    it('should find all entities with default pagination', async () => {
      const mockEntities = [
        { id: 1, name: 'Entity 1' },
        { id: 2, name: 'Entity 2' }
      ]
      mockDbManager.query
        .mockResolvedValueOnce({ rows: mockEntities }) // data query
        .mockResolvedValueOnce({ rows: [{ total: '2' }] }) // count query

      const result = await repository.findAll()

      expect(result).toEqual({
        data: mockEntities,
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1
      })
    })

    it('should apply filters correctly', async () => {
      mockDbManager.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })

      await repository.findAll({
        filters: { name: 'Test', email: 'test@example.com' }
      })

      const [dataQuery] = mockDbManager.query.mock.calls[0]
      expect(dataQuery).toContain('WHERE name = $1 AND email = $2')
    })

    it('should apply search correctly', async () => {
      mockDbManager.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })

      await repository.findAll({
        search: {
          fields: ['name', 'email'],
          query: 'test'
        }
      })

      const [dataQuery] = mockDbManager.query.mock.calls[0]
      expect(dataQuery).toContain('(name::text ILIKE $1 OR email::text ILIKE $1)')
    })

    it('should apply sorting correctly', async () => {
      mockDbManager.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })

      await repository.findAll({
        sort: [
          { field: 'name', direction: 'ASC' },
          { field: 'created_at', direction: 'DESC' }
        ]
      })

      const [dataQuery] = mockDbManager.query.mock.calls[0]
      expect(dataQuery).toContain('ORDER BY name ASC, created_at DESC')
    })

    it('should apply pagination correctly', async () => {
      mockDbManager.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })

      await repository.findAll({
        pagination: { page: 2, limit: 10 }
      })

      const [dataQuery, params] = mockDbManager.query.mock.calls[0]
      expect(dataQuery).toContain('LIMIT $1 OFFSET $2')
      expect(params).toContain(10) // limit
      expect(params).toContain(10) // offset (page 2 - 1) * limit
    })

    it('should handle array filters with ANY operator', async () => {
      mockDbManager.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })

      await repository.findAll({
        filters: { categories: [1, 2, 3] }
      })

      const [dataQuery] = mockDbManager.query.mock.calls[0]
      expect(dataQuery).toContain('categories = ANY($1)')
    })

    it('should handle ILIKE filters for wildcard strings', async () => {
      mockDbManager.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })

      await repository.findAll({
        filters: { name: '%test%' }
      })

      const [dataQuery] = mockDbManager.query.mock.calls[0]
      expect(dataQuery).toContain('name ILIKE $1')
    })
  })

  describe('create', () => {
    it('should create new entity', async () => {
      const newEntity = { name: 'New Entity', email: 'new@example.com' }
      const createdEntity = { id: 1, ...newEntity }
      mockDbManager.query.mockResolvedValue({ rows: [createdEntity] })

      const result = await repository.create(newEntity)

      expect(mockDbManager.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_table'),
        expect.arrayContaining(['New Entity', 'new@example.com'])
      )
      expect(result).toEqual(createdEntity)
    })

    it('should filter out undefined values', async () => {
      const newEntity = { name: 'New Entity', email: undefined }
      mockDbManager.query.mockResolvedValue({ rows: [{ id: 1, name: 'New Entity' }] })

      await repository.create(newEntity)

      const [query, params] = mockDbManager.query.mock.calls[0]
      expect(query).toContain('(name)')
      expect(query).toContain('($1)')
      expect(params).toEqual(['New Entity'])
    })
  })

  describe('update', () => {
    it('should update existing entity', async () => {
      const updateData = { name: 'Updated Entity', email: 'updated@example.com' }
      const updatedEntity = { id: 1, ...updateData }
      mockDbManager.query.mockResolvedValue({ rows: [updatedEntity] })

      const result = await repository.update(1, updateData)

      expect(mockDbManager.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_table SET name = $1, email = $2 WHERE id = $3'),
        ['Updated Entity', 'updated@example.com', 1]
      )
      expect(result).toEqual(updatedEntity)
    })

    it('should return current entity when no fields to update', async () => {
      const mockEntity = { id: 1, name: 'Entity' }
      mockDbManager.query.mockResolvedValue({ rows: [mockEntity] })

      const result = await repository.update(1, {})

      // Should call findById instead of update
      expect(mockDbManager.query).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE id = $1',
        [1]
      )
      expect(result).toEqual(mockEntity)
    })

    it('should filter out undefined values', async () => {
      const updateData = { name: 'Updated', email: undefined }
      mockDbManager.query.mockResolvedValue({ rows: [{ id: 1, name: 'Updated' }] })

      await repository.update(1, updateData)

      const [query, params] = mockDbManager.query.mock.calls[0]
      expect(query).toContain('SET name = $1 WHERE id = $2')
      expect(params).toEqual(['Updated', 1])
    })
  })

  describe('delete', () => {
    it('should delete entity and return true when successful', async () => {
      mockDbManager.query.mockResolvedValue({ rowCount: 1 })

      const result = await repository.delete(1)

      expect(mockDbManager.query).toHaveBeenCalledWith(
        'DELETE FROM test_table WHERE id = $1',
        [1]
      )
      expect(result).toBe(true)
    })

    it('should return false when entity not found', async () => {
      mockDbManager.query.mockResolvedValue({ rowCount: 0 })

      const result = await repository.delete(999)

      expect(result).toBe(false)
    })
  })

  describe('count', () => {
    it('should count all entities without filters', async () => {
      mockDbManager.query.mockResolvedValue({ rows: [{ total: '42' }] })

      const result = await repository.count()

      expect(mockDbManager.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as total FROM test_table',
        []
      )
      expect(result).toBe(42)
    })

    it('should count entities with filters', async () => {
      mockDbManager.query.mockResolvedValue({ rows: [{ total: '5' }] })

      const result = await repository.count({ name: 'Test' })

      expect(mockDbManager.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as total FROM test_table WHERE name = $1',
        ['Test']
      )
      expect(result).toBe(5)
    })
  })

  describe('exists', () => {
    it('should return true when entity exists', async () => {
      mockDbManager.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })

      const result = await repository.exists(1)

      expect(mockDbManager.query).toHaveBeenCalledWith(
        'SELECT 1 FROM test_table WHERE id = $1 LIMIT 1',
        [1]
      )
      expect(result).toBe(true)
    })

    it('should return false when entity does not exist', async () => {
      mockDbManager.query.mockResolvedValue({ rows: [] })

      const result = await repository.exists(999)

      expect(result).toBe(false)
    })
  })

  describe('transaction', () => {
    it('should execute function in transaction', async () => {
      const transactionFn = vi.fn().mockResolvedValue('transaction result')
      mockDbManager.transaction.mockImplementation(fn => fn())

      const result = await repository['transaction'](transactionFn)

      expect(mockDbManager.transaction).toHaveBeenCalledWith(transactionFn)
      expect(result).toBe('transaction result')
    })
  })

  describe('buildWhereClause', () => {
    it('should build correct WHERE clause for filters', () => {
      const filters = {
        name: 'Test',
        email: 'test@example.com',
        age: 25,
        categories: [1, 2, 3],
        description: '%search%'
      }

      const result = repository['buildWhereClause'](filters)

      expect(result.clause).toBe(' WHERE name = $1 AND email = $2 AND age = $3 AND categories = ANY($4) AND description ILIKE $5')
      expect(result.params).toEqual(['Test', 'test@example.com', 25, [1, 2, 3], '%search%'])
      expect(result.paramIndex).toBe(6)
    })

    it('should handle empty filters', () => {
      const result = repository['buildWhereClause']({})

      expect(result.clause).toBe('')
      expect(result.params).toEqual([])
      expect(result.paramIndex).toBe(1)
    })

    it('should ignore null, undefined, and empty string values', () => {
      const filters = {
        name: 'Test',
        email: null,
        description: undefined,
        notes: ''
      }

      const result = repository['buildWhereClause'](filters)

      expect(result.clause).toBe(' WHERE name = $1')
      expect(result.params).toEqual(['Test'])
      expect(result.paramIndex).toBe(2)
    })
  })
})