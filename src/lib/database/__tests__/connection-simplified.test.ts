import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../connection'

// Mock all external dependencies
vi.mock('../../infrastructure/ConfigManager', () => ({
  configManager: {
    getDatabaseConfig: () => ({
      dataDir: 'idb://test_db',
      connectionTimeout: 30000,
      maxConnections: 10,
      queryTimeout: 10000
    })
  }
}))

vi.mock('../../infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  logQuery: vi.fn(),
  logError: vi.fn(),
  logPerformance: vi.fn()
}))

vi.mock('../../infrastructure/ErrorHandler', () => ({
  createDatabaseError: (message: string) => new Error(message)
}))

vi.mock('../roleSimulator', () => ({
  roleSimulator: {
    simulateRole: vi.fn().mockResolvedValue(undefined),
    resetRole: vi.fn().mockResolvedValue(undefined)
  }
}))

describe('DatabaseManager (Simplified)', () => {
  let dbManager: DatabaseManager

  beforeEach(() => {
    DatabaseManager.resetInstance()
    dbManager = DatabaseManager.getInstance()
    vi.clearAllMocks()
  })

  afterEach(() => {
    DatabaseManager.resetInstance()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = DatabaseManager.getInstance()
      const instance2 = DatabaseManager.getInstance()
      
      expect(instance1).toBe(instance2)
    })

    it('should reset instance properly', () => {
      const instance1 = DatabaseManager.getInstance()
      DatabaseManager.resetInstance()
      const instance2 = DatabaseManager.getInstance()
      
      expect(instance1).not.toBe(instance2)
    })
  })

  describe('Connection State', () => {
    it('should start as not connected', () => {
      expect(dbManager.isConnected()).toBe(false)
    })

    it('should return null connection info before initialization', () => {
      expect(dbManager.getConnectionInfo()).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should throw error when querying uninitialized database', async () => {
      await expect(dbManager.query('SELECT 1')).rejects.toThrow()
    })

    it('should throw error when executing on uninitialized database', async () => {
      await expect(dbManager.exec('SELECT 1')).rejects.toThrow()
    })

    it('should throw error when executing script on uninitialized database', async () => {
      await expect(dbManager.execScript('SELECT 1')).rejects.toThrow()
    })
  })

  describe('Utility Methods', () => {
    it('should have public utility methods', () => {
      // Test that essential methods exist
      expect(typeof dbManager.getDatabaseSize).toBe('function')
      expect(typeof dbManager.getTableList).toBe('function')
      expect(typeof dbManager.getQueryMetrics).toBe('function')
    })
  })

  describe('Close Method', () => {
    it('should handle close on uninitialized database', async () => {
      // Should not throw error
      await expect(dbManager.close()).resolves.toBeUndefined()
    })
  })

  describe('Database Size', () => {
    it('should return 0 B for uninitialized database', async () => {
      const size = await dbManager.getDatabaseSize()
      expect(size).toBe('0 B')
    })
  })

  describe('Table List', () => {
    it('should return empty array for uninitialized database', async () => {
      const tables = await dbManager.getTableList()
      expect(tables).toEqual([])
    })
  })

  describe('Query Metrics', () => {
    it('should start with empty metrics', () => {
      const metrics = dbManager.getQueryMetrics()
      expect(metrics).toEqual([])
    })

    it('should have clearQueryMetrics method', () => {
      expect(typeof dbManager.clearQueryMetrics).toBe('function')
      // Should not throw
      dbManager.clearQueryMetrics()
    })
  })

  describe('Session Context', () => {
    it('should handle session context methods', () => {
      // These methods should exist
      expect(typeof dbManager.setSessionContext).toBe('function')
      expect(typeof dbManager.getCurrentSessionContext).toBe('function')
      expect(typeof dbManager.clearSessionContext).toBe('function')

      // Initial session context should be null
      expect(dbManager.getCurrentSessionContext()).toBeNull()
    })

    it('should handle session context for uninitialized database', async () => {
      const context = {
        role: 'authenticated' as const,
        userId: 'test-user-id',
        claims: { sub: 'test-user-id' }
      }

      // Setting context on uninitialized database should throw
      await expect(dbManager.setSessionContext(context)).rejects.toThrow()
      
      // Getting context should still work
      expect(dbManager.getCurrentSessionContext()).toBeNull()
      
      // Clearing context on uninitialized database should not throw
      await expect(dbManager.clearSessionContext()).resolves.toBeUndefined()
    })
  })
});