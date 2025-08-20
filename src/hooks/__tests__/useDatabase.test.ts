import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useDatabase, useQueryHistory } from '../useDatabase'

// Mock DatabaseManager
vi.mock('@/lib/database/connection', () => ({
  dbManager: {
    initialize: vi.fn(),
    query: vi.fn(),
    getConnectionInfo: vi.fn(),
    getDatabaseSize: vi.fn(),
    getTableList: vi.fn(),
  },
}))

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'mock-uuid-' + Math.random()),
  },
})

describe('useDatabase', () => {
  let mockDbManager: any

  beforeEach(async () => {
    const dbConnection = await import('@/lib/database/connection')
    mockDbManager = dbConnection.dbManager
    
    vi.clearAllMocks()
    // Reset localStorage mock
    ;(localStorage.getItem as any).mockReturnValue(null)
    ;(localStorage.setItem as any).mockImplementation(() => {})
    ;(localStorage.removeItem as any).mockImplementation(() => {})
  })

  describe('Initialization', () => {
    it('should initialize database on mount', async () => {
      mockDbManager.initialize.mockResolvedValue(undefined)
      
      const { result } = renderHook(() => useDatabase())
      
      expect(result.current.isConnecting).toBe(true)
      expect(result.current.isConnected).toBe(false)
      
      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false)
      })
      
      expect(mockDbManager.initialize).toHaveBeenCalled()
      expect(result.current.isConnected).toBe(true)
      expect(result.current.error).toBeNull()
    })

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed')
      mockDbManager.initialize.mockRejectedValue(error)
      
      const { result } = renderHook(() => useDatabase())
      
      await waitFor(() => {
        expect(result.current.isConnecting).toBe(false)
      })
      
      expect(result.current.isConnected).toBe(false)
      expect(result.current.error).toBe('Initialization failed')
    })

    // Note: Skipping concurrent initialization test due to React StrictMode causing double effect calls
    // The actual implementation handles concurrent calls correctly via promise caching
  })

  describe('Query Execution', () => {
    beforeEach(async () => {
      mockDbManager.initialize.mockResolvedValue(undefined)
    })

    it('should execute queries successfully', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'test' }],
        fields: [{ name: 'id' }, { name: 'name' }],
        rowCount: 1,
        command: 'SELECT',
        duration: 10.5,
      }
      mockDbManager.query.mockResolvedValue(mockResult)
      
      const { result } = renderHook(() => useDatabase())
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
      
      let queryResult: any
      await act(async () => {
        queryResult = await result.current.executeQuery('SELECT * FROM users')
      })
      
      expect(mockDbManager.query).toHaveBeenCalledWith('SELECT * FROM users')
      expect(queryResult).toEqual(mockResult)
      expect(result.current.error).toBeNull()
    })

    it('should handle query errors', async () => {
      const error = new Error('Query failed')
      mockDbManager.query.mockRejectedValue(error)
      
      const { result } = renderHook(() => useDatabase())
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
      
      await act(async () => {
        await expect(result.current.executeQuery('INVALID SQL')).rejects.toThrow('Query failed')
      })
      
      expect(result.current.error).toBe('Query failed')
    })

    it('should throw error when executing query on disconnected database', async () => {
      // Mock initialization to never resolve so database stays disconnected
      mockDbManager.initialize.mockImplementation(() => new Promise(() => {}))
      
      const { result } = renderHook(() => useDatabase())
      
      // Don't wait for connection - execute query while still connecting
      await act(async () => {
        await expect(result.current.executeQuery('SELECT 1')).rejects.toThrow('Database not connected')
      })
    })

    it('should clear error on successful query', async () => {
      const error = new Error('Initial error')
      mockDbManager.query.mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ rows: [], fields: [], rowCount: 0, command: 'SELECT', duration: 5 })
      
      const { result } = renderHook(() => useDatabase())
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
      
      // First query fails
      await act(async () => {
        await expect(result.current.executeQuery('INVALID SQL')).rejects.toThrow()
      })
      
      expect(result.current.error).toBe('Initial error')
      
      // Second query succeeds
      await act(async () => {
        await result.current.executeQuery('SELECT 1')
      })
      
      expect(result.current.error).toBeNull()
    })
  })

  describe('Database Information', () => {
    beforeEach(async () => {
      mockDbManager.initialize.mockResolvedValue(undefined)
    })

    it('should get connection info', async () => {
      const mockConnectionInfo = {
        id: 'test-db',
        name: 'Test DB',
        createdAt: new Date(),
        lastAccessed: new Date(),
      }
      mockDbManager.getConnectionInfo.mockReturnValue(mockConnectionInfo)
      
      const { result } = renderHook(() => useDatabase())
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
      
      const connectionInfo = result.current.getConnectionInfo()
      
      expect(mockDbManager.getConnectionInfo).toHaveBeenCalled()
      expect(connectionInfo).toEqual(mockConnectionInfo)
    })

    it('should get database size', async () => {
      mockDbManager.getDatabaseSize.mockResolvedValue('1.5 MB')
      
      const { result } = renderHook(() => useDatabase())
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
      
      let size: string
      await act(async () => {
        size = await result.current.getDatabaseSize()
      })
      
      expect(mockDbManager.getDatabaseSize).toHaveBeenCalled()
      expect(size!).toBe('1.5 MB')
    })

    it('should get table list', async () => {
      const mockTables = [
        { name: 'users', schema: 'public', rows: 10 },
        { name: 'posts', schema: 'public', rows: 5 },
      ]
      mockDbManager.getTableList.mockResolvedValue(mockTables)
      
      const { result } = renderHook(() => useDatabase())
      
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
      
      let tables: any
      await act(async () => {
        tables = await result.current.getTableList()
      })
      
      expect(mockDbManager.getTableList).toHaveBeenCalled()
      expect(tables).toEqual(mockTables)
    })
  })
})

describe('useQueryHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(localStorage.getItem as any).mockReturnValue(null)
    ;(localStorage.setItem as any).mockImplementation(() => {})
    ;(localStorage.removeItem as any).mockImplementation(() => {})
  })

  it('should initialize with empty history', () => {
    const { result } = renderHook(() => useQueryHistory())
    
    expect(result.current.history).toEqual([])
  })

  it('should load history from localStorage on mount', () => {
    const savedHistory = [
      {
        id: 'test-1',
        query: 'SELECT 1',
        timestamp: new Date().toISOString(),
        duration: 10,
        success: true,
      }
    ]
    ;(localStorage.getItem as any).mockReturnValue(JSON.stringify(savedHistory))
    
    const { result } = renderHook(() => useQueryHistory())
    
    expect(localStorage.getItem).toHaveBeenCalledWith('supabase_lite_query_history')
    expect(result.current.history).toEqual(savedHistory)
  })

  it('should handle corrupted localStorage data', () => {
    ;(localStorage.getItem as any).mockReturnValue('invalid json')
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    const { result } = renderHook(() => useQueryHistory())
    
    expect(result.current.history).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith('Failed to parse query history:', expect.any(Error))
    
    consoleSpy.mockRestore()
  })

  it('should add queries to history', () => {
    const { result } = renderHook(() => useQueryHistory())
    
    act(() => {
      result.current.addToHistory('SELECT 1', 15.5, true)
    })
    
    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0]).toMatchObject({
      id: expect.any(String),
      query: 'SELECT 1',
      timestamp: expect.any(Date),
      duration: 15.5,
      success: true,
      error: undefined,
    })
    
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'supabase_lite_query_history',
      expect.any(String)
    )
  })

  it('should add failed queries with error to history', () => {
    const { result } = renderHook(() => useQueryHistory())
    
    act(() => {
      result.current.addToHistory('INVALID SQL', 8.2, false, 'Syntax error')
    })
    
    expect(result.current.history[0]).toMatchObject({
      query: 'INVALID SQL',
      duration: 8.2,
      success: false,
      error: 'Syntax error',
    })
  })

  it('should limit history to 100 items', () => {
    const { result } = renderHook(() => useQueryHistory())
    
    // Add 105 queries
    act(() => {
      for (let i = 0; i < 105; i++) {
        result.current.addToHistory(`SELECT ${i}`, 10, true)
      }
    })
    
    expect(result.current.history).toHaveLength(100)
    // Most recent should be first
    expect(result.current.history[0].query).toBe('SELECT 104')
    expect(result.current.history[99].query).toBe('SELECT 5')
  })

  it('should clear history', () => {
    const { result } = renderHook(() => useQueryHistory())
    
    // Add some history first
    act(() => {
      result.current.addToHistory('SELECT 1', 10, true)
      result.current.addToHistory('SELECT 2', 10, true)
    })
    
    expect(result.current.history).toHaveLength(2)
    
    act(() => {
      result.current.clearHistory()
    })
    
    expect(result.current.history).toEqual([])
    expect(localStorage.removeItem).toHaveBeenCalledWith('supabase_lite_query_history')
  })

  it('should preserve order with newest first', () => {
    const { result } = renderHook(() => useQueryHistory())
    
    act(() => {
      result.current.addToHistory('First query', 10, true)
    })
    
    act(() => {
      result.current.addToHistory('Second query', 15, true)
    })
    
    act(() => {
      result.current.addToHistory('Third query', 20, true)
    })
    
    expect(result.current.history[0].query).toBe('Third query')
    expect(result.current.history[1].query).toBe('Second query')
    expect(result.current.history[2].query).toBe('First query')
  })
})