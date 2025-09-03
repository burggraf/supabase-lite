import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SyncQueue, type QueuedOperation } from '../SyncQueue'

// Mock localStorage
const mockLocalStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}))

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
})

describe('SyncQueue', () => {
  let syncQueue: SyncQueue

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
    syncQueue = SyncQueue.getInstance()
    // Reset singleton instance for clean tests
    ;(SyncQueue as any).instance = null
    syncQueue = SyncQueue.getInstance()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SyncQueue.getInstance()
      const instance2 = SyncQueue.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Queue Operations', () => {
    it('should add operation to queue when offline', () => {
      ;(navigator as any).onLine = false
      
      const operation: QueuedOperation = {
        id: 'test-1',
        type: 'database',
        method: 'POST',
        url: '/api/test',
        data: { name: 'test' },
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now(),
        retryCount: 0
      }

      syncQueue.enqueue(operation)
      
      const queuedOps = syncQueue.getQueuedOperations()
      expect(queuedOps).toHaveLength(1)
      expect(queuedOps[0]).toEqual(operation)
    })

    it('should not add operation to queue when online', async () => {
      ;(navigator as any).onLine = true
      
      const mockExecute = vi.fn().mockResolvedValue({ success: true })
      
      const operation: QueuedOperation = {
        id: 'test-1',
        type: 'database',
        method: 'POST',
        url: '/api/test',
        data: { name: 'test' },
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now(),
        retryCount: 0
      }

      await syncQueue.enqueue(operation, mockExecute)
      
      expect(mockExecute).toHaveBeenCalledWith(operation)
      expect(syncQueue.getQueuedOperations()).toHaveLength(0)
    })

    it('should remove operation from queue', () => {
      ;(navigator as any).onLine = false
      
      const operation: QueuedOperation = {
        id: 'test-1',
        type: 'database',
        method: 'POST',
        url: '/api/test',
        data: { name: 'test' },
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now(),
        retryCount: 0
      }

      syncQueue.enqueue(operation)
      expect(syncQueue.getQueuedOperations()).toHaveLength(1)
      
      syncQueue.dequeue('test-1')
      expect(syncQueue.getQueuedOperations()).toHaveLength(0)
    })

    it('should clear all operations from queue', () => {
      ;(navigator as any).onLine = false
      
      const operations = [
        {
          id: 'test-1',
          type: 'database',
          method: 'POST',
          url: '/api/test1',
          data: { name: 'test1' },
          headers: { 'Content-Type': 'application/json' },
          timestamp: Date.now(),
          retryCount: 0
        },
        {
          id: 'test-2',
          type: 'storage',
          method: 'PUT',
          url: '/api/test2',
          data: { name: 'test2' },
          headers: { 'Content-Type': 'application/json' },
          timestamp: Date.now(),
          retryCount: 0
        }
      ] as QueuedOperation[]

      operations.forEach(op => syncQueue.enqueue(op))
      expect(syncQueue.getQueuedOperations()).toHaveLength(2)
      
      syncQueue.clearQueue()
      expect(syncQueue.getQueuedOperations()).toHaveLength(0)
    })
  })

  describe('Background Sync Processing', () => {
    it('should process queued operations when coming online', async () => {
      // Start offline with queued operations
      ;(navigator as any).onLine = false
      
      const operations = [
        {
          id: 'test-1',
          type: 'database',
          method: 'POST',
          url: '/api/test1',
          data: { name: 'test1' },
          headers: { 'Content-Type': 'application/json' },
          timestamp: Date.now(),
          retryCount: 0
        },
        {
          id: 'test-2',
          type: 'storage',
          method: 'PUT', 
          url: '/api/test2',
          data: { name: 'test2' },
          headers: { 'Content-Type': 'application/json' },
          timestamp: Date.now(),
          retryCount: 0
        }
      ] as QueuedOperation[]

      operations.forEach(op => syncQueue.enqueue(op))
      expect(syncQueue.getQueuedOperations()).toHaveLength(2)

      // Mock successful execution
      const mockExecute = vi.fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })

      // Come back online and process queue
      ;(navigator as any).onLine = true
      await syncQueue.processQueue(mockExecute)

      expect(mockExecute).toHaveBeenCalledTimes(2)
      expect(mockExecute).toHaveBeenNthCalledWith(1, operations[0])
      expect(mockExecute).toHaveBeenNthCalledWith(2, operations[1])
      expect(syncQueue.getQueuedOperations()).toHaveLength(0)
    })

    it('should handle retry logic with exponential backoff', async () => {
      const operation: QueuedOperation = {
        id: 'test-1',
        type: 'database',
        method: 'POST',
        url: '/api/test',
        data: { name: 'test' },
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now(),
        retryCount: 0
      }

      // Mock failed execution
      const mockExecute = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await syncQueue.executeWithRetry(operation, mockExecute)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.retryCount).toBeGreaterThan(0)
    })

    it('should respect maximum retry attempts', async () => {
      const operation: QueuedOperation = {
        id: 'test-1',
        type: 'database',
        method: 'POST',
        url: '/api/test',
        data: { name: 'test' },
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now(),
        retryCount: 5 // Already at max retries
      }

      const mockExecute = vi.fn().mockRejectedValue(new Error('Network error'))

      const result = await syncQueue.executeWithRetry(operation, mockExecute)

      expect(result.success).toBe(false)
      expect(result.abandoned).toBe(true)
      expect(mockExecute).not.toHaveBeenCalled()
    })
  })

  describe('Persistence', () => {
    it('should persist queue to localStorage', () => {
      ;(navigator as any).onLine = false
      
      const operation: QueuedOperation = {
        id: 'test-1',
        type: 'database',
        method: 'POST',
        url: '/api/test',
        data: { name: 'test' },
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now(),
        retryCount: 0
      }

      syncQueue.enqueue(operation)

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'supabase-lite-sync-queue',
        JSON.stringify([operation])
      )
    })

    it('should load queue from localStorage on initialization', () => {
      const storedOperations = [
        {
          id: 'stored-1',
          type: 'database',
          method: 'POST',
          url: '/api/stored',
          data: { name: 'stored' },
          headers: { 'Content-Type': 'application/json' },
          timestamp: Date.now(),
          retryCount: 1
        }
      ]

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedOperations))

      // Create new instance to test loading
      ;(SyncQueue as any).instance = null
      const newSyncQueue = SyncQueue.getInstance()

      expect(newSyncQueue.getQueuedOperations()).toEqual(storedOperations)
    })

    it('should handle corrupted localStorage data gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json')

      // Should not throw error
      ;(SyncQueue as any).instance = null
      const newSyncQueue = SyncQueue.getInstance()

      expect(newSyncQueue.getQueuedOperations()).toEqual([])
    })
  })

  describe('Operation Deduplication', () => {
    it('should deduplicate operations with same ID', () => {
      ;(navigator as any).onLine = false
      
      const operation1: QueuedOperation = {
        id: 'test-1',
        type: 'database',
        method: 'POST',
        url: '/api/test',
        data: { name: 'test1' },
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now(),
        retryCount: 0
      }

      const operation2: QueuedOperation = {
        id: 'test-1', // Same ID
        type: 'database',
        method: 'POST',
        url: '/api/test',
        data: { name: 'test2' }, // Different data
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now() + 1000,
        retryCount: 0
      }

      syncQueue.enqueue(operation1)
      syncQueue.enqueue(operation2)

      const queuedOps = syncQueue.getQueuedOperations()
      expect(queuedOps).toHaveLength(1)
      expect(queuedOps[0].data).toEqual({ name: 'test2' }) // Should keep the newer one
    })
  })

  describe('Queue Statistics', () => {
    it('should provide queue statistics', () => {
      ;(navigator as any).onLine = false
      
      const operations = [
        {
          id: 'test-1',
          type: 'database',
          method: 'POST',
          url: '/api/test1',
          data: { name: 'test1' },
          headers: { 'Content-Type': 'application/json' },
          timestamp: Date.now(),
          retryCount: 0
        },
        {
          id: 'test-2',
          type: 'storage',
          method: 'PUT',
          url: '/api/test2',
          data: { name: 'test2' },
          headers: { 'Content-Type': 'application/json' },
          timestamp: Date.now(),
          retryCount: 2
        }
      ] as QueuedOperation[]

      operations.forEach(op => syncQueue.enqueue(op))

      const stats = syncQueue.getQueueStats()
      expect(stats.totalOperations).toBe(2)
      expect(stats.pendingOperations).toBe(2) // Both operations have retryCount < maxRetries (3)
      expect(stats.failedOperations).toBe(0)
      expect(stats.operationsByType.database).toBe(1)
      expect(stats.operationsByType.storage).toBe(1)
    })
  })
})