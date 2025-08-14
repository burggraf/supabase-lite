import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../connection'

// Mock PGlite
const mockQuery = vi.fn()
const mockExec = vi.fn()
const mockClose = vi.fn()
const mockWaitReady = Promise.resolve()

vi.mock('@electric-sql/pglite', () => ({
  PGlite: vi.fn().mockImplementation(() => ({
    query: mockQuery,
    exec: mockExec,
    close: mockClose,
    waitReady: mockWaitReady,
  })),
}))

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager

  beforeEach(() => {
    // Reset the singleton instance
    ;(DatabaseManager as any).instance = null
    dbManager = DatabaseManager.getInstance()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await dbManager.close()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = DatabaseManager.getInstance()
      const instance2 = DatabaseManager.getInstance()
      
      expect(instance1).toBe(instance2)
    })
  })

  describe('Initialization', () => {
    it('should initialize database successfully', async () => {
      mockExec.mockResolvedValue(undefined)
      
      await dbManager.initialize()
      
      const { PGlite } = await import('@electric-sql/pglite')
      expect(PGlite).toHaveBeenCalledWith({
        dataDir: 'idb://supabase_lite_db',
      })
      expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('CREATE SCHEMA IF NOT EXISTS auth'))
      expect(dbManager.isConnected()).toBe(true)
    })

    it('should handle initialization errors', async () => {
      const error = new Error('Failed to initialize')
      const { PGlite } = await import('@electric-sql/pglite')
      ;(PGlite as any).mockImplementationOnce(() => {
        throw error
      })
      
      await expect(dbManager.initialize()).rejects.toThrow('Failed to initialize')
      expect(dbManager.isConnected()).toBe(false)
    })

    it('should not re-initialize if already initialized', async () => {
      mockExec.mockResolvedValue(undefined)
      
      await dbManager.initialize()
      const { PGlite } = await import('@electric-sql/pglite')
      const firstCallCount = (PGlite as any).mock.calls.length
      
      await dbManager.initialize()
      const secondCallCount = (PGlite as any).mock.calls.length
      
      expect(secondCallCount).toBe(firstCallCount)
    })

    it('should handle concurrent initialization attempts', async () => {
      mockExec.mockResolvedValue(undefined)
      
      const promise1 = dbManager.initialize()
      const promise2 = dbManager.initialize()
      
      await Promise.all([promise1, promise2])
      
      const { PGlite } = await import('@electric-sql/pglite')
      expect(PGlite).toHaveBeenCalledTimes(1)
    })
  })

  describe('Query Execution', () => {
    beforeEach(async () => {
      mockExec.mockResolvedValue(undefined)
      await dbManager.initialize()
    })

    it('should execute queries successfully', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'test' }],
        fields: [{ name: 'id' }, { name: 'name' }],
      }
      mockQuery.mockResolvedValue(mockResult)
      
      const result = await dbManager.query('SELECT * FROM users')
      
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users')
      expect(result).toEqual({
        rows: mockResult.rows,
        fields: mockResult.fields,
        rowCount: 1,
        command: 'SELECT',
        duration: expect.any(Number),
      })
    })

    it('should handle query errors', async () => {
      const error = new Error('Query failed')
      mockQuery.mockRejectedValue(error)
      
      await expect(dbManager.query('INVALID SQL')).rejects.toMatchObject({
        message: 'Query failed',
        duration: expect.any(Number),
      })
    })

    it('should throw error when querying uninitialized database', async () => {
      const uninitializedManager = new (DatabaseManager as any)()
      
      await expect(uninitializedManager.query('SELECT 1')).rejects.toThrow(
        'Database not initialized. Call initialize() first.'
      )
    })

    it('should calculate query duration', async () => {
      const mockResult = { rows: [], fields: [] }
      mockQuery.mockResolvedValue(mockResult)
      
      const result = await dbManager.query('SELECT 1')
      
      expect(result.duration).toBeGreaterThanOrEqual(0)
      expect(typeof result.duration).toBe('number')
    })
  })

  describe('Exec Method', () => {
    beforeEach(async () => {
      mockExec.mockResolvedValue(undefined)
      await dbManager.initialize()
    })

    it('should execute SQL statements', async () => {
      await dbManager.exec('CREATE TABLE test (id INTEGER)')
      
      expect(mockExec).toHaveBeenCalledWith('CREATE TABLE test (id INTEGER)')
    })

    it('should handle exec errors', async () => {
      const error = new Error('Exec failed')
      mockExec.mockRejectedValue(error)
      
      await expect(dbManager.exec('INVALID SQL')).rejects.toThrow('Exec failed')
    })

    it('should throw error when execing on uninitialized database', async () => {
      const uninitializedManager = new (DatabaseManager as any)()
      
      await expect(uninitializedManager.exec('CREATE TABLE test (id INTEGER)')).rejects.toThrow(
        'Database not initialized. Call initialize() first.'
      )
    })
  })

  describe('Connection Info', () => {
    it('should return null before initialization', () => {
      expect(dbManager.getConnectionInfo()).toBeNull()
    })

    it('should return connection info after initialization', async () => {
      mockExec.mockResolvedValue(undefined)
      await dbManager.initialize()
      
      const info = dbManager.getConnectionInfo()
      
      expect(info).toMatchObject({
        id: 'supabase_lite_db',
        name: 'Supabase Lite DB',
        createdAt: expect.any(Date),
        lastAccessed: expect.any(Date),
      })
    })

    it('should update lastAccessed when queries are executed', async () => {
      mockExec.mockResolvedValue(undefined)
      mockQuery.mockResolvedValue({ rows: [], fields: [] })
      
      await dbManager.initialize()
      const initialInfo = dbManager.getConnectionInfo()
      const initialTime = initialInfo?.lastAccessed
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))
      
      await dbManager.query('SELECT 1')
      const updatedInfo = dbManager.getConnectionInfo()
      
      expect(updatedInfo?.lastAccessed).not.toEqual(initialTime)
    })
  })

  describe('Database Size', () => {
    beforeEach(async () => {
      mockExec.mockResolvedValue(undefined)
      await dbManager.initialize()
    })

    it('should return formatted database size', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ size: 1024 }],
        fields: [{ name: 'size' }],
      })
      
      const size = await dbManager.getDatabaseSize()
      
      expect(size).toBe('1 KB')
    })

    it('should handle size query errors', async () => {
      mockQuery.mockRejectedValue(new Error('Size query failed'))
      
      const size = await dbManager.getDatabaseSize()
      
      expect(size).toBe('Unknown')
    })

    it('should return 0 B for uninitialized database', async () => {
      const uninitializedManager = new (DatabaseManager as any)()
      
      const size = await uninitializedManager.getDatabaseSize()
      
      expect(size).toBe('0 B')
    })
  })

  describe('Table List', () => {
    beforeEach(async () => {
      mockExec.mockResolvedValue(undefined)
      await dbManager.initialize()
    })

    it('should return table list', async () => {
      const mockTables = [
        { schema: 'public', name: 'users', rows: 10 },
        { schema: 'public', name: 'posts', rows: 5 },
      ]
      mockQuery.mockResolvedValue({
        rows: mockTables,
        fields: [{ name: 'schema' }, { name: 'name' }, { name: 'rows' }],
      })
      
      const tables = await dbManager.getTableList()
      
      expect(tables).toEqual(mockTables)
    })

    it('should handle table list query errors', async () => {
      mockQuery.mockRejectedValue(new Error('Table query failed'))
      
      const tables = await dbManager.getTableList()
      
      expect(tables).toEqual([])
    })

    it('should return empty array for uninitialized database', async () => {
      const uninitializedManager = new (DatabaseManager as any)()
      
      const tables = await uninitializedManager.getTableList()
      
      expect(tables).toEqual([])
    })
  })

  describe('Format Bytes', () => {
    beforeEach(async () => {
      mockExec.mockResolvedValue(undefined)
      await dbManager.initialize()
    })

    it('should format bytes correctly', async () => {
      // Access private method via type assertion
      const formatBytes = (dbManager as any).formatBytes
      
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(1024 * 1024)).toBe('1 MB')
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
      expect(formatBytes(1536)).toBe('1.5 KB')
    })
  })

  describe('Close Connection', () => {
    it('should close database connection', async () => {
      mockExec.mockResolvedValue(undefined)
      await dbManager.initialize()
      
      expect(dbManager.isConnected()).toBe(true)
      
      await dbManager.close()
      
      expect(mockClose).toHaveBeenCalled()
      expect(dbManager.isConnected()).toBe(false)
      expect(dbManager.getConnectionInfo()).toBeNull()
    })

    it('should handle close on uninitialized database', async () => {
      await dbManager.close()
      
      expect(mockClose).not.toHaveBeenCalled()
    })
  })
})