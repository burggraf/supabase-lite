import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StorageManager, type QuotaInfo, type StorageStats } from '../StorageManager'

// Mock navigator.storage
const mockStorageEstimate = vi.hoisted(() => vi.fn())
const mockPersist = vi.hoisted(() => vi.fn())
global.navigator = {
  ...global.navigator,
  storage: {
    estimate: mockStorageEstimate,
    persist: mockPersist
  } as any
}

// Mock caches API
const mockCachesKeys = vi.hoisted(() => vi.fn())
const mockCachesOpen = vi.hoisted(() => vi.fn())
global.caches = {
  keys: mockCachesKeys,
  open: mockCachesOpen,
  delete: vi.fn()
} as any

// Mock IndexedDB
const mockIDBDatabases = vi.hoisted(() => vi.fn())
global.indexedDB = {
  ...global.indexedDB,
  databases: mockIDBDatabases
} as any

describe('StorageManager', () => {
  let storageManager: StorageManager

  beforeEach(() => {
    vi.clearAllMocks()
    storageManager = StorageManager.getInstance()
    // Reset singleton for clean tests
    ;(StorageManager as any).instance = null
    storageManager = StorageManager.getInstance()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = StorageManager.getInstance()
      const instance2 = StorageManager.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Quota Monitoring', () => {
    it('should get storage quota information', async () => {
      mockStorageEstimate.mockResolvedValue({
        quota: 100 * 1024 * 1024 * 1024, // 100GB
        usage: 10 * 1024 * 1024 * 1024,  // 10GB
        usageDetails: {
          indexedDB: 8 * 1024 * 1024 * 1024,  // 8GB
          caches: 2 * 1024 * 1024 * 1024      // 2GB
        }
      })

      const quotaInfo = await storageManager.getQuotaInfo()

      expect(quotaInfo.totalQuota).toBe(100 * 1024 * 1024 * 1024)
      expect(quotaInfo.usedSpace).toBe(10 * 1024 * 1024 * 1024)
      expect(quotaInfo.availableSpace).toBe(90 * 1024 * 1024 * 1024)
      expect(quotaInfo.usagePercentage).toBe(10)
      expect(quotaInfo.usageDetails.indexedDB).toBe(8 * 1024 * 1024 * 1024)
      expect(quotaInfo.usageDetails.caches).toBe(2 * 1024 * 1024 * 1024)
    })

    it('should handle storage estimate errors gracefully', async () => {
      mockStorageEstimate.mockRejectedValue(new Error('Storage API not supported'))

      const quotaInfo = await storageManager.getQuotaInfo()

      expect(quotaInfo.totalQuota).toBe(0)
      expect(quotaInfo.usedSpace).toBe(0)
      expect(quotaInfo.availableSpace).toBe(0)
      expect(quotaInfo.usagePercentage).toBe(0)
    })

    it('should detect when quota is approaching limit', async () => {
      mockStorageEstimate.mockResolvedValue({
        quota: 100 * 1024 * 1024,  // 100MB
        usage: 85 * 1024 * 1024    // 85MB (85%)
      })

      const quotaInfo = await storageManager.getQuotaInfo()

      expect(quotaInfo.isApproachingLimit).toBe(true)
      expect(quotaInfo.usagePercentage).toBe(85)
    })

    it('should detect when quota is exceeded', async () => {
      mockStorageEstimate.mockResolvedValue({
        quota: 100 * 1024 * 1024,  // 100MB
        usage: 95 * 1024 * 1024    // 95MB (95%)
      })

      const quotaInfo = await storageManager.getQuotaInfo()

      expect(quotaInfo.isExceeded).toBe(true)
      expect(quotaInfo.usagePercentage).toBe(95)
    })
  })

  describe('Storage Statistics', () => {
    it('should calculate storage statistics', async () => {
      // Mock IndexedDB databases
      mockIDBDatabases.mockResolvedValue([
        { name: 'supabase-lite-project1', version: 1 },
        { name: 'supabase-lite-project2', version: 1 }
      ])

      // Mock cache keys
      mockCachesKeys.mockResolvedValue([
        'supabase-lite-cache-v1',
        'dev-sample-cache'
      ])

      // Mock cache storage usage
      const mockCache = {
        keys: vi.fn().mockResolvedValue([
          new Request('http://localhost:5173/asset1.js'),
          new Request('http://localhost:5173/asset2.css')
        ])
      }
      mockCachesOpen.mockResolvedValue(mockCache)

      // Mock storage estimate
      mockStorageEstimate.mockResolvedValue({
        quota: 1000 * 1024 * 1024, // 1GB
        usage: 100 * 1024 * 1024,  // 100MB
        usageDetails: {
          indexedDB: 80 * 1024 * 1024,  // 80MB
          caches: 20 * 1024 * 1024      // 20MB
        }
      })

      const stats = await storageManager.getStorageStats()

      expect(stats.databases.count).toBe(2)
      expect(stats.caches.count).toBe(2)
      expect(stats.totalUsage).toBe(100 * 1024 * 1024)
      expect(stats.breakdown.indexedDB).toBe(80 * 1024 * 1024)
      expect(stats.breakdown.caches).toBe(20 * 1024 * 1024)
    })

    it('should handle missing storage APIs gracefully', async () => {
      mockIDBDatabases.mockRejectedValue(new Error('Not supported'))
      mockCachesKeys.mockRejectedValue(new Error('Not supported'))
      mockStorageEstimate.mockRejectedValue(new Error('Not supported'))

      const stats = await storageManager.getStorageStats()

      expect(stats.databases.count).toBe(0)
      expect(stats.caches.count).toBe(0)
      expect(stats.totalUsage).toBe(0)
    })
  })

  describe('Cleanup Operations', () => {
    it('should clear old caches', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true)
      global.caches.delete = mockDelete

      mockCachesKeys.mockResolvedValue([
        'supabase-lite-cache-v1',
        'old-cache-v1',
        'dev-sample-cache'
      ])

      const result = await storageManager.clearOldCaches(['old-cache-v1'])

      expect(mockDelete).toHaveBeenCalledWith('old-cache-v1')
      expect(result.clearedCount).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle cache deletion errors', async () => {
      const mockDelete = vi.fn()
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Access denied'))
      global.caches.delete = mockDelete

      const result = await storageManager.clearOldCaches(['cache1', 'cache2'])

      expect(result.clearedCount).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('cache2')
    })

    it('should perform comprehensive cleanup', async () => {
      mockStorageEstimate
        .mockResolvedValueOnce({ usage: 100 * 1024 * 1024 }) // Before cleanup
        .mockResolvedValueOnce({ usage: 60 * 1024 * 1024 })  // After cleanup

      mockCachesKeys.mockResolvedValue(['old-cache', 'current-cache'])
      const mockDelete = vi.fn().mockResolvedValue(true)
      global.caches.delete = mockDelete

      const result = await storageManager.performCleanup({
        clearOldCaches: true,
        maxCacheAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })

      expect(result.success).toBe(true)
      expect(result.spaceReclaimed).toBe(40 * 1024 * 1024)
      expect(result.actions).toContain('Cleared old caches')
    })
  })

  describe('Storage Persistence', () => {
    it('should request persistent storage', async () => {
      mockPersist.mockResolvedValue(true)

      const result = await storageManager.requestPersistentStorage()

      expect(mockPersist).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should handle persistence request failure', async () => {
      mockPersist.mockResolvedValue(false)

      const result = await storageManager.requestPersistentStorage()

      expect(result).toBe(false)
    })

    it('should handle missing persistence API', async () => {
      const originalStorage = global.navigator.storage
      global.navigator.storage = undefined as any

      const result = await storageManager.requestPersistentStorage()

      expect(result).toBe(false)
      
      global.navigator.storage = originalStorage
    })
  })

  describe('Warning System', () => {
    it('should trigger warning callback when approaching limit', async () => {
      const onWarning = vi.fn()
      storageManager.onStorageWarning(onWarning)

      mockStorageEstimate.mockResolvedValue({
        quota: 100 * 1024 * 1024,  // 100MB
        usage: 85 * 1024 * 1024    // 85MB (85%)
      })

      await storageManager.checkStorageStatus()

      expect(onWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          isApproachingLimit: true,
          usagePercentage: 85
        })
      )
    })

    it('should not trigger warning when storage usage is normal', async () => {
      const onWarning = vi.fn()
      storageManager.onStorageWarning(onWarning)

      mockStorageEstimate.mockResolvedValue({
        quota: 100 * 1024 * 1024,  // 100MB
        usage: 30 * 1024 * 1024    // 30MB (30%)
      })

      await storageManager.checkStorageStatus()

      expect(onWarning).not.toHaveBeenCalled()
    })

    it('should allow multiple warning callbacks', async () => {
      const onWarning1 = vi.fn()
      const onWarning2 = vi.fn()
      
      storageManager.onStorageWarning(onWarning1)
      storageManager.onStorageWarning(onWarning2)

      mockStorageEstimate.mockResolvedValue({
        quota: 100 * 1024 * 1024,  // 100MB
        usage: 90 * 1024 * 1024    // 90MB (90%)
      })

      await storageManager.checkStorageStatus()

      expect(onWarning1).toHaveBeenCalled()
      expect(onWarning2).toHaveBeenCalled()
    })
  })

  describe('Auto Cleanup', () => {
    it('should start auto cleanup monitoring', async () => {
      const checkSpy = vi.spyOn(storageManager, 'checkStorageStatus').mockResolvedValue()
      
      await storageManager.startAutoCleanup({ intervalMinutes: 1 })
      
      // The initial check should have been called
      expect(checkSpy).toHaveBeenCalled()
      
      storageManager.stopAutoCleanup() // Clean up
    })

    it('should stop auto cleanup monitoring', async () => {
      await storageManager.startAutoCleanup({ intervalMinutes: 1 })
      
      // Should not throw error when stopping
      expect(() => storageManager.stopAutoCleanup()).not.toThrow()
    })
  })
})