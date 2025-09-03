import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UpdateManager } from '../UpdateManager'

// Mock IndexedDB
const mockIndexedDB = vi.hoisted(() => ({
  open: vi.fn(),
  deleteDatabase: vi.fn()
}))

// Mock ServiceWorkerRegistration
const mockServiceWorkerRegistration: any = vi.hoisted(() => ({
  update: vi.fn(),
  unregister: vi.fn(),
  waiting: null,
  installing: null,
  active: {
    postMessage: vi.fn(),
    scriptURL: 'http://localhost:5173/service-worker.js'
  }
}))

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
})

Object.defineProperty(global, 'navigator', {
  value: {
    serviceWorker: {
      register: vi.fn(),
      ready: Promise.resolve(mockServiceWorkerRegistration),
      getRegistration: vi.fn(() => Promise.resolve(mockServiceWorkerRegistration)),
      addEventListener: vi.fn(),
      controller: mockServiceWorkerRegistration.active
    }
  },
  writable: true
})

describe('UpdateManager', () => {
  let updateManager: UpdateManager
  let mockIDBDatabase: any
  let mockIDBTransaction: any
  let mockIDBStore: any
  let mockIDBRequest: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup IndexedDB mocks
    mockIDBRequest = {
      onsuccess: null,
      onerror: null,
      result: null
    }

    mockIDBStore = {
      get: vi.fn(() => mockIDBRequest),
      put: vi.fn(() => mockIDBRequest),
      delete: vi.fn(() => mockIDBRequest),
      clear: vi.fn(() => mockIDBRequest)
    }

    mockIDBTransaction = {
      objectStore: vi.fn(() => mockIDBStore),
      oncomplete: null,
      onerror: null
    }

    mockIDBDatabase = {
      transaction: vi.fn(() => mockIDBTransaction),
      createObjectStore: vi.fn(),
      close: vi.fn()
    }

    mockIndexedDB.open.mockImplementation(() => {
      const request = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: mockIDBDatabase
      }
      // Immediately resolve for testing
      Promise.resolve().then(() => {
        if (request.onsuccess) (request.onsuccess as any)({ target: { result: mockIDBDatabase } })
      })
      return request
    })

    updateManager = UpdateManager.getInstance()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = UpdateManager.getInstance()
      const instance2 = UpdateManager.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Update Detection', () => {
    it('should detect available updates from service worker', async () => {
      mockServiceWorkerRegistration.waiting = {
        scriptURL: 'http://localhost:5173/service-worker.js?v=2'
      }
      mockServiceWorkerRegistration.installing = null

      const hasUpdate = await updateManager.checkForUpdates()
      
      expect(hasUpdate).toBe(true)
      expect(mockServiceWorkerRegistration.update).toHaveBeenCalled()
    })

    it('should return false when no updates available', async () => {
      mockServiceWorkerRegistration.waiting = null
      mockServiceWorkerRegistration.installing = null

      const hasUpdate = await updateManager.checkForUpdates()
      
      expect(hasUpdate).toBe(false)
    })

    it('should handle service worker update errors gracefully', async () => {
      mockServiceWorkerRegistration.update.mockRejectedValue(new Error('Update failed'))

      const hasUpdate = await updateManager.checkForUpdates()
      
      expect(hasUpdate).toBe(false)
    })
  })

  describe('Update Application', () => {
    it('should apply updates with data preservation', async () => {
      mockServiceWorkerRegistration.waiting = {
        scriptURL: 'http://localhost:5173/service-worker.js?v=2',
        postMessage: vi.fn()
      }

      // Mock successful IDB operations
      mockIDBStore.put.mockImplementation(() => {
        const req = { onsuccess: null, onerror: null }
        Promise.resolve().then(() => {
          if (req.onsuccess) (req.onsuccess as any)({ target: req })
        })
        return req
      })

      const result = await updateManager.applyUpdate()
      
      expect(result.success).toBe(true)
      expect(mockServiceWorkerRegistration.waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    })

    it('should backup critical data before update', async () => {
      mockServiceWorkerRegistration.waiting = {
        scriptURL: 'http://localhost:5173/service-worker.js?v=2',
        postMessage: vi.fn()
      }

      // Mock successful IDB operations
      mockIDBStore.put.mockImplementation(() => {
        const req = { onsuccess: null, onerror: null }
        Promise.resolve().then(() => {
          if (req.onsuccess) (req.onsuccess as any)({ target: req })
        })
        return req
      })

      await updateManager.applyUpdate()

      expect(mockIDBStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pre-update-backup',
          timestamp: expect.any(Number),
          data: expect.any(Object)
        })
      )
    })

    it('should handle update failures gracefully', async () => {
      mockServiceWorkerRegistration.waiting = null

      const result = await updateManager.applyUpdate()
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('No update available')
    })
  })

  describe('Rollback Functionality', () => {
    it('should rollback to previous version when issues detected', async () => {
      // Mock backup data exists
      mockIDBRequest.result = {
        id: 'pre-update-backup',
        timestamp: Date.now() - 60000, // 1 minute ago
        data: { projectData: 'backup-data' }
      }

      setTimeout(() => {
        if (mockIDBRequest.onsuccess) mockIDBRequest.onsuccess({ target: mockIDBRequest })
      }, 0)

      const result = await updateManager.rollbackUpdate()
      
      expect(result.success).toBe(true)
      expect(mockIDBStore.put).toHaveBeenCalled() // Restore data
    })

    it('should handle rollback when no backup exists', async () => {
      mockIDBRequest.result = null
      setTimeout(() => {
        if (mockIDBRequest.onsuccess) mockIDBRequest.onsuccess({ target: mockIDBRequest })
      }, 0)

      const result = await updateManager.rollbackUpdate()
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('No backup available')
    })

    it('should validate backup integrity before rollback', async () => {
      // Mock corrupted backup
      mockIDBRequest.result = {
        id: 'pre-update-backup',
        timestamp: Date.now() - 60000,
        data: null // Invalid data
      }

      setTimeout(() => {
        if (mockIDBRequest.onsuccess) mockIDBRequest.onsuccess({ target: mockIDBRequest })
      }, 0)

      const result = await updateManager.rollbackUpdate()
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid backup data')
    })
  })

  describe('Update Timing Control', () => {
    it('should defer update until user chooses timing', async () => {
      const updatePromise = updateManager.deferUpdate()
      
      expect(updateManager.hasPendingUpdate()).toBe(true)
      
      // User decides to apply later
      updateManager.scheduleUpdate(Date.now() + 300000) // 5 minutes later
      
      const result = await updatePromise
      expect(result.deferred).toBe(true)
    })

    it('should apply update immediately when requested', async () => {
      mockServiceWorkerRegistration.waiting = {
        scriptURL: 'http://localhost:5173/service-worker.js?v=2',
        postMessage: vi.fn()
      }

      const result = await updateManager.applyUpdateNow()
      
      expect(result.success).toBe(true)
      expect(updateManager.hasPendingUpdate()).toBe(false)
    })

    it('should handle scheduled updates', async () => {
      vi.useFakeTimers()
      try {
        const scheduleTime = Date.now() + 1000 // 1 second from now
        mockServiceWorkerRegistration.waiting = {
          scriptURL: 'http://localhost:5173/service-worker.js?v=2',
          postMessage: vi.fn()
        }

        updateManager.scheduleUpdate(scheduleTime)
        
        // Fast forward time
        vi.advanceTimersByTime(1500)
        await vi.runAllTimersAsync()

        expect(mockServiceWorkerRegistration.waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('Data Preservation', () => {
    it('should identify and preserve critical application data', async () => {
      const criticalData = {
        projects: [{ id: 1, name: 'Test Project' }],
        queries: [{ id: 1, sql: 'SELECT 1' }],
        settings: { theme: 'dark' }
      }

      // Mock localStorage data
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: vi.fn((key) => {
            if (key === 'projects') return JSON.stringify(criticalData.projects)
            if (key === 'queryHistory') return JSON.stringify(criticalData.queries)
            if (key === 'userSettings') return JSON.stringify(criticalData.settings)
            return null
          }),
          setItem: vi.fn(),
          removeItem: vi.fn()
        },
        writable: true
      })

      await updateManager.preserveCriticalData()

      expect(mockIDBStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'critical-data-backup',
          timestamp: expect.any(Number),
          data: expect.objectContaining({
            projects: criticalData.projects,
            settings: criticalData.settings
          })
        })
      )
    })

    it('should restore critical data after update', async () => {
      const backupData = {
        projects: [{ id: 1, name: 'Test Project' }],
        settings: { theme: 'dark' }
      }

      mockIDBRequest.result = {
        id: 'critical-data-backup',
        timestamp: Date.now() - 30000,
        data: backupData
      }

      setTimeout(() => {
        if (mockIDBRequest.onsuccess) mockIDBRequest.onsuccess({ target: mockIDBRequest })
      }, 0)

      const result = await updateManager.restoreCriticalData()

      expect(result.success).toBe(true)
      expect(global.localStorage.setItem).toHaveBeenCalledWith('projects', JSON.stringify(backupData.projects))
      expect(global.localStorage.setItem).toHaveBeenCalledWith('userSettings', JSON.stringify(backupData.settings))
    })
  })

  describe('Update Status Monitoring', () => {
    it('should provide update status information', () => {
      const status = updateManager.getUpdateStatus()
      
      expect(status).toHaveProperty('hasUpdate')
      expect(status).toHaveProperty('isUpdating')
      expect(status).toHaveProperty('lastChecked')
      expect(status).toHaveProperty('pendingUpdate')
    })

    it('should track update history', async () => {
      mockServiceWorkerRegistration.waiting = {
        scriptURL: 'http://localhost:5173/service-worker.js?v=2',
        postMessage: vi.fn()
      }

      await updateManager.applyUpdate()

      const history = updateManager.getUpdateHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toHaveProperty('timestamp')
      expect(history[0]).toHaveProperty('version')
      expect(history[0]).toHaveProperty('success')
    })
  })

  describe('Error Recovery', () => {
    it('should handle IndexedDB errors gracefully', async () => {
      mockIndexedDB.open.mockImplementation(() => {
        const request = {
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null
        }
        setTimeout(() => {
          if (request.onerror) (request.onerror as any)(new Error('IndexedDB error'))
        }, 0)
        return request
      })

      const result = await updateManager.preserveCriticalData()
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to access storage')
    })

    it('should provide fallback mechanisms when update fails', async () => {
      mockServiceWorkerRegistration.waiting = {
        scriptURL: 'http://localhost:5173/service-worker.js?v=2',
        postMessage: vi.fn(() => { throw new Error('Message failed') })
      }

      const result = await updateManager.applyUpdate()
      
      expect(result.success).toBe(false)
      expect(result.fallbackAvailable).toBe(true)
    })
  })
})