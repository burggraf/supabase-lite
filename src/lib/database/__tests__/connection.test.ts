import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../connection'

// Get global mock from setup
declare global {
  var mockPGliteInstance: {
    query: any
    exec: any
    close: any
    waitReady: any
  }
}

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager

  beforeEach(() => {
    // Reset the singleton instance
    ;(DatabaseManager as any).instance = null
    dbManager = DatabaseManager.getInstance()
    
    // Reset global mocks
    vi.clearAllMocks()
    global.mockPGliteInstance.query.mockResolvedValue({ rows: [], affectedRows: 0 })
    global.mockPGliteInstance.exec.mockResolvedValue()
    global.mockPGliteInstance.close.mockResolvedValue()
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
      global.mockPGliteInstance.exec.mockResolvedValue(undefined)
      
      await dbManager.initialize()
      
      const { PGlite } = await import('@electric-sql/pglite')
      expect(PGlite).toHaveBeenCalledWith({
        dataDir: 'idb://supabase_lite_db',
        database: 'postgres',
      })
      expect(global.mockPGliteInstance.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE SCHEMA IF NOT EXISTS auth'))
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
      global.mockPGliteInstance.exec.mockResolvedValue(undefined)
      
      await dbManager.initialize()
      const { PGlite } = await import('@electric-sql/pglite')
      const firstCallCount = (PGlite as any).mock.calls.length
      
      await dbManager.initialize()
      const secondCallCount = (PGlite as any).mock.calls.length
      
      expect(secondCallCount).toBe(firstCallCount)
    })

    it('should handle concurrent initialization attempts', async () => {
      global.mockPGliteInstance.exec.mockResolvedValue(undefined)
      
      const promise1 = dbManager.initialize()
      const promise2 = dbManager.initialize()
      
      await Promise.all([promise1, promise2])
      
      const { PGlite } = await import('@electric-sql/pglite')
      expect(PGlite).toHaveBeenCalledTimes(1)
    })
  })

  describe('Query Execution', () => {
    beforeEach(async () => {
      global.mockPGliteInstance.exec.mockResolvedValue(undefined)
      await dbManager.initialize()
    })

    it('should execute queries successfully', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'test' }],
        fields: [{ name: 'id' }, { name: 'name' }],
      }
      global.mockPGliteInstance.query.mockResolvedValue(mockResult)
      
      const result = await dbManager.query('SELECT * FROM users')
      
      expect(global.mockPGliteInstance.query).toHaveBeenCalledWith('SELECT * FROM users')
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
      global.mockPGliteInstance.query.mockRejectedValue(error)
      
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
      global.mockPGliteInstance.query.mockResolvedValue(mockResult)
      
      const result = await dbManager.query('SELECT 1')
      
      expect(result.duration).toBeGreaterThanOrEqual(0)
      expect(typeof result.duration).toBe('number')
    })
  })

  describe('Exec Method', () => {
    beforeEach(async () => {
      global.mockPGliteInstance.exec.mockResolvedValue(undefined)
      await dbManager.initialize()
    })

    it('should execute SQL statements', async () => {
      await dbManager.exec('CREATE TABLE test (id INTEGER)')
      
      expect(global.mockPGliteInstance.exec).toHaveBeenCalledWith('CREATE TABLE test (id INTEGER)')
    })

    it('should handle exec errors', async () => {
      const error = new Error('Exec failed')
      global.mockPGliteInstance.exec.mockRejectedValue(error)
      
      await expect(dbManager.exec('INVALID SQL')).rejects.toThrow('Exec failed')
    })

    it('should throw error when execing on uninitialized database', async () => {
      const uninitializedManager = new (DatabaseManager as any)()
      
      await expect(uninitializedManager.exec('CREATE TABLE test (id INTEGER)')).rejects.toThrow(
        'Database not initialized. Call initialize() first.'
      )
    })
  })

  describe('Script Execution', () => {
    beforeEach(async () => {
      global.mockPGliteInstance.exec.mockResolvedValue(undefined)
      await dbManager.initialize()
    })

    it('should execute multi-statement scripts successfully', async () => {
      const mockResults = [
        {
          rows: [],
          fields: [],
        },
        {
          rows: [{ id: 1, name: 'test' }],
          fields: [{ name: 'id' }, { name: 'name' }],
        },
      ]
      global.mockPGliteInstance.exec.mockResolvedValue(mockResults)
      
      const script = 'CREATE TABLE test (id INTEGER, name TEXT); SELECT * FROM test;'
      const result = await dbManager.execScript(script)
      
      expect(global.mockPGliteInstance.exec).toHaveBeenCalledWith(script)
      expect(result).toEqual({
        results: [
          {
            rows: [],
            fields: [],
            rowCount: 0,
            command: 'CREATE',
            duration: expect.any(Number),
          },
          {
            rows: [{ id: 1, name: 'test' }],
            fields: [{ name: 'id' }, { name: 'name' }],
            rowCount: 1,
            command: 'SELECT',
            duration: expect.any(Number),
          },
        ],
        totalDuration: expect.any(Number),
        successCount: 2,
        errorCount: 0,
        errors: [],
      })
    })

    it('should handle script execution errors', async () => {
      const error = new Error('Script execution failed')
      global.mockPGliteInstance.exec.mockRejectedValue(error)
      
      const script = 'CREATE TABLE test (id INTEGER); INVALID STATEMENT;'
      
      await expect(dbManager.execScript(script)).rejects.toMatchObject({
        message: 'Script execution failed',
        duration: expect.any(Number),
      })
    })

    it('should throw error when executing script on uninitialized database', async () => {
      const uninitializedManager = new (DatabaseManager as any)()
      
      await expect(uninitializedManager.execScript('SELECT 1; SELECT 2;')).rejects.toThrow(
        'Database not initialized. Call initialize() first.'
      )
    })

    it('should calculate total duration for script execution', async () => {
      const mockResults = [
        { rows: [], fields: [] },
        { rows: [], fields: [] },
      ]
      global.mockPGliteInstance.exec.mockResolvedValue(mockResults)
      
      const result = await dbManager.execScript('SELECT 1; SELECT 2;')
      
      expect(result.totalDuration).toBeGreaterThanOrEqual(0)
      expect(typeof result.totalDuration).toBe('number')
    })

    it('should correctly parse commands from script statements', async () => {
      const mockResults = [
        { rows: [], fields: [] },
        { rows: [{ count: 1 }], fields: [{ name: 'count' }] },
        { rows: [], fields: [] },
      ]
      global.mockPGliteInstance.exec.mockResolvedValue(mockResults)
      
      const script = 'CREATE TABLE test (id INTEGER); SELECT COUNT(*) FROM test; DROP TABLE test;'
      const result = await dbManager.execScript(script)
      
      expect(result.results[0].command).toBe('CREATE')
      expect(result.results[1].command).toBe('SELECT')
      expect(result.results[2].command).toBe('DROP')
    })
  })

  describe('Connection Info', () => {
    it('should return null before initialization', () => {
      expect(dbManager.getConnectionInfo()).toBeNull()
    })

    it('should return connection info after initialization', async () => {
      global.mockPGliteInstance.exec.mockResolvedValue(undefined)
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
      global.mockPGliteInstance.exec.mockResolvedValue(undefined)
      global.mockPGliteInstance.query.mockResolvedValue({ rows: [], fields: [] })
      
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
      global.mockPGliteInstance.exec.mockResolvedValue(undefined)
      await dbManager.initialize()
    })

    it('should return formatted database size', async () => {
      global.mockPGliteInstance.query.mockResolvedValue({
        rows: [{ size: 1024 }],
        fields: [{ name: 'size' }],
      })
      
      const size = await dbManager.getDatabaseSize()
      
      expect(size).toBe('1 KB')
    })

    it('should handle size query errors', async () => {
      global.mockPGliteInstance.query.mockRejectedValue(new Error('Size query failed'))
      
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
      global.mockPGliteInstance.exec.mockResolvedValue(undefined)
      await dbManager.initialize()
    })

    it('should return table list', async () => {
      const mockTables = [
        { schema: 'public', name: 'users', rows: 10 },
        { schema: 'public', name: 'posts', rows: 5 },
      ]
      global.mockPGliteInstance.query.mockResolvedValue({
        rows: mockTables,
        fields: [{ name: 'schema' }, { name: 'name' }, { name: 'rows' }],
      })
      
      const tables = await dbManager.getTableList()
      
      expect(tables).toEqual(mockTables)
    })

    it('should handle table list query errors', async () => {
      global.mockPGliteInstance.query.mockRejectedValue(new Error('Table query failed'))
      
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
      global.mockPGliteInstance.exec.mockResolvedValue(undefined)
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
      global.mockPGliteInstance.exec.mockResolvedValue(undefined)
      await dbManager.initialize()
      
      expect(dbManager.isConnected()).toBe(true)
      
      await dbManager.close()
      
      expect(global.mockPGliteInstance.close).toHaveBeenCalled()
      expect(dbManager.isConnected()).toBe(false)
      expect(dbManager.getConnectionInfo()).toBeNull()
    })

    it('should handle close on uninitialized database', async () => {
      await dbManager.close()
      
      expect(global.mockPGliteInstance.close).not.toHaveBeenCalled()
    })
  })
})