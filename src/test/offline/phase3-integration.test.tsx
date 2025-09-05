import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
// import React from 'react'
import { EnhancedOfflineIndicator } from '@/components/ui/EnhancedOfflineIndicator'
import { OfflineErrorBoundary } from '@/components/ui/OfflineErrorBoundary'
import { SyncQueue } from '@/lib/offline/SyncQueue'
import { OfflineErrorHandler } from '@/lib/offline/OfflineErrorHandler'
import { StorageManager } from '@/lib/offline/StorageManager'

// Mock useOnlineStatus
const mockUseOnlineStatus = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: mockUseOnlineStatus
}))

// Mock storage APIs
const mockStorageEstimate = vi.hoisted(() => vi.fn())
const mockCachesKeys = vi.hoisted(() => vi.fn())
const mockCachesOpen = vi.hoisted(() => vi.fn())

global.navigator = {
  ...global.navigator,
  storage: {
    estimate: mockStorageEstimate,
    persist: vi.fn()
  } as unknown as typeof global.indexedDB
}

global.caches = {
  keys: mockCachesKeys,
  open: mockCachesOpen,
  delete: vi.fn()
} as unknown as typeof global.caches

// Test component that can throw errors
const ErrorThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Failed to fetch');
  }
  return <div>Component loaded successfully</div>;
};

describe('Phase 3 Integration Tests', () => {
  let syncQueue: SyncQueue
  let errorHandler: OfflineErrorHandler
  let storageManager: StorageManager

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset singletons
    ;(SyncQueue as unknown as { instance: unknown }).instance = null
    ;(OfflineErrorHandler as unknown as { instance: unknown }).instance = null
    ;(StorageManager as unknown as { instance: unknown }).instance = null
    
    syncQueue = SyncQueue.getInstance()
    errorHandler = OfflineErrorHandler.getInstance()
    storageManager = StorageManager.getInstance()

    // Default online status mock
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      connectionType: 'wifi',
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false,
      toggleOfflineMode: vi.fn()
    })

    // Default storage mocks
    mockStorageEstimate.mockResolvedValue({
      quota: 100 * 1024 * 1024,
      usage: 10 * 1024 * 1024,
      usageDetails: {
        indexedDB: 8 * 1024 * 1024,
        caches: 2 * 1024 * 1024
      }
    })

    mockCachesKeys.mockResolvedValue(['cache1', 'cache2'])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Offline Status + Error Handling Integration', () => {
    it('should show offline indicator when error boundary catches network error', async () => {
      // Setup offline state
      mockUseOnlineStatus.mockReturnValue({
        isOnline: false,
        connectionType: null,
        effectiveType: null,
        downlink: null,
        rtt: null,
        saveData: false,
        toggleOfflineMode: vi.fn()
      })

      render(
        <div>
          <EnhancedOfflineIndicator />
          <OfflineErrorBoundary>
            <ErrorThrowingComponent shouldThrow />
          </OfflineErrorBoundary>
        </div>
      )

      // Should show offline indicator
      expect(screen.getByText('Offline')).toBeInTheDocument()
      
      // Should show offline-aware error boundary
      expect(screen.getByText('Connection Issue')).toBeInTheDocument()
      expect(screen.getByText(/offline/i)).toBeInTheDocument()
    })

    it('should provide contextual error messages based on connection quality', () => {
      // Setup poor connection
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'cellular',
        effectiveType: '2g',
        downlink: 0.5,
        rtt: 2000,
        saveData: true,
        toggleOfflineMode: vi.fn()
      })

      render(
        <div>
          <EnhancedOfflineIndicator />
          <OfflineErrorBoundary>
            <ErrorThrowingComponent shouldThrow />
          </OfflineErrorBoundary>
        </div>
      )

      // Should show connection quality warning
      expect(screen.getByText('Slow Connection')).toBeInTheDocument()
      
      // Should show connection-aware error message
      expect(screen.getByText('Connection Issue')).toBeInTheDocument()
    })
  })

  describe('Sync Queue + Error Handling Integration', () => {
    it('should queue operations when offline and process them when coming online', async () => {
      // Start offline
      mockUseOnlineStatus.mockReturnValue({
        isOnline: false,
        connectionType: null,
        effectiveType: null,
        downlink: null,
        rtt: null,
        saveData: false,
        toggleOfflineMode: vi.fn()
      })

      // Mock failing operation
      vi.fn().mockRejectedValue(new Error('Network error'))
      
      // Enrich error to make it offline-related
      const context = {
        operation: 'api_call',
        component: 'TestComponent',
        userAction: 'Load data'
      }
      
      const enrichedError = errorHandler.enrichError(new Error('Network error'), context)
      expect(enrichedError.isOffline).toBe(true)

      // Queue operation
      await syncQueue.enqueue({
        id: 'test-operation',
        type: 'database',
        method: 'POST',
        url: '/api/test',
        data: { test: true },
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now(),
        retryCount: 0
      })

      expect(syncQueue.getQueuedOperations()).toHaveLength(1)

      // Come back online
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
        toggleOfflineMode: vi.fn()
      })

      // Process queue
      const successOperation = vi.fn().mockResolvedValue({ success: true })
      await syncQueue.processQueue(successOperation)

      expect(successOperation).toHaveBeenCalled()
      expect(syncQueue.getQueuedOperations()).toHaveLength(0)
    })

    it('should handle queue processing errors gracefully', async () => {
      const operation = {
        id: 'test-operation',
        type: 'database' as const,
        method: 'POST' as const,
        url: '/api/test',
        data: { test: true },
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now(),
        retryCount: 0
      }

      await syncQueue.enqueue(operation)

      // Mock operation that fails with offline error
      const failingOperation = vi.fn().mockRejectedValue(new Error('Connection refused'))
      
      // Process queue - should handle error gracefully
      await syncQueue.processQueue(failingOperation)

      // Should still have operation in queue after failure
      const queuedOps = syncQueue.getQueuedOperations()
      expect(queuedOps).toHaveLength(1)
    })
  })

  describe('Storage Management + Error Recovery Integration', () => {
    it('should trigger cleanup when storage quota is approaching limit', async () => {
      // Mock storage quota near limit
      mockStorageEstimate.mockResolvedValue({
        quota: 100 * 1024 * 1024,  // 100MB
        usage: 85 * 1024 * 1024,   // 85MB (85%)
        usageDetails: {
          indexedDB: 70 * 1024 * 1024,
          caches: 15 * 1024 * 1024
        }
      })

      const onWarning = vi.fn()
      storageManager.onStorageWarning(onWarning)

      await storageManager.checkStorageStatus()

      expect(onWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          isApproachingLimit: true,
          usagePercentage: 85
        })
      )
    })

    it('should integrate storage warnings with error handling', async () => {
      // Mock storage quota exceeded
      mockStorageEstimate.mockResolvedValue({
        quota: 100 * 1024 * 1024,  // 100MB
        usage: 95 * 1024 * 1024    // 95MB (95%)
      })

      const quotaInfo = await storageManager.getQuotaInfo()
      expect(quotaInfo.isExceeded).toBe(true)

      // This should trigger enhanced error messages for storage-related errors
      const storageError = new Error('QuotaExceededError')
      const context = {
        operation: 'storage_write',
        component: 'FileUploader',
        userAction: 'Upload file'
      }

      const enrichedError = errorHandler.enrichError(storageError, context)
      
      // Should provide helpful suggestions for storage issues
      expect(enrichedError.suggestedActions.length).toBeGreaterThan(0)
    })
  })

  describe('Full Offline Workflow Integration', () => {
    it('should handle complete offline-to-online workflow', async () => {
      let isOnline = false
      
      // Start offline
      mockUseOnlineStatus.mockImplementation(() => ({
        isOnline,
        connectionType: isOnline ? 'wifi' : null,
        effectiveType: isOnline ? '4g' : null,
        downlink: isOnline ? 10 : null,
        rtt: isOnline ? 50 : null,
        saveData: false,
        toggleOfflineMode: vi.fn()
      }))

      // 1. Show offline status
      const { rerender } = render(<EnhancedOfflineIndicator />)
      expect(screen.getByText('Offline')).toBeInTheDocument()

      // 2. Queue operations while offline
      await syncQueue.enqueue({
        id: 'offline-op-1',
        type: 'database',
        method: 'POST',
        url: '/api/data',
        data: { offline: true },
        headers: { 'Content-Type': 'application/json' },
        timestamp: Date.now(),
        retryCount: 0
      })

      expect(syncQueue.getQueuedOperations()).toHaveLength(1)

      // 3. Handle errors gracefully
      const offlineError = new Error('Failed to fetch')
      const context = {
        operation: 'data_sync',
        component: 'DataManager',
        userAction: 'Sync data'
      }

      const enrichedError = errorHandler.enrichError(offlineError, context)
      expect(enrichedError.isOffline).toBe(true)
      expect(enrichedError.suggestedActions).toContain('Try again when your connection is restored')

      // 4. Come back online
      isOnline = true
      rerender(<EnhancedOfflineIndicator />)
      
      await waitFor(() => {
        expect(screen.getByText('Online')).toBeInTheDocument()
      })

      // 5. Process queued operations
      const mockExecute = vi.fn().mockResolvedValue({ success: true })
      await syncQueue.processQueue(mockExecute)

      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'offline-op-1',
          data: { offline: true }
        })
      )

      expect(syncQueue.getQueuedOperations()).toHaveLength(0)
    })

    it('should integrate all Phase 3 components in error recovery scenario', async () => {
      // Setup scenario: poor connection, approaching storage limit
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'cellular',
        effectiveType: '2g',
        downlink: 0.3,
        rtt: 3000,
        saveData: true,
        toggleOfflineMode: vi.fn()
      })

      mockStorageEstimate.mockResolvedValue({
        quota: 50 * 1024 * 1024,   // 50MB
        usage: 42 * 1024 * 1024,   // 42MB (84%)
        usageDetails: {
          indexedDB: 35 * 1024 * 1024,
          caches: 7 * 1024 * 1024
        }
      })

      // 1. Check connection quality
      render(<EnhancedOfflineIndicator />)
      expect(screen.getByText('Slow Connection')).toBeInTheDocument()

      // 2. Check storage status
      const onStorageWarning = vi.fn()
      storageManager.onStorageWarning(onStorageWarning)
      await storageManager.checkStorageStatus()
      
      expect(onStorageWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          isApproachingLimit: true
        })
      )

      // 3. Handle network error with context
      const networkError = new Error('Request timeout')
      const context = {
        operation: 'large_file_upload',
        component: 'FileManager',
        userAction: 'Upload large file'
      }

      const enrichedError = errorHandler.enrichError(networkError, context)
      
      expect(enrichedError.isOffline).toBe(true)
      expect(enrichedError.userFriendlyMessage).toContain('file')
      expect(enrichedError.userFriendlyMessage).toContain('connection')

      // 4. Show error boundary with context
      render(
        <OfflineErrorBoundary>
          <ErrorThrowingComponent shouldThrow />
        </OfflineErrorBoundary>
      )

      expect(screen.getByText('Connection Issue')).toBeInTheDocument()
      expect(screen.getByText('What you can do:')).toBeInTheDocument()

      // 5. Queue operation for retry
      await syncQueue.enqueue({
        id: 'retry-operation',
        type: 'storage',
        method: 'PUT',
        url: '/api/upload',
        data: { file: 'large-file.zip' },
        headers: { 'Content-Type': 'application/octet-stream' },
        timestamp: Date.now(),
        retryCount: 0
      })

      const stats = syncQueue.getQueueStats()
      expect(stats.totalOperations).toBe(1)
      expect(stats.operationsByType.storage).toBe(1)
    })
  })

  describe('Component Integration with Real Scenarios', () => {
    it('should handle error boundary with enhanced offline indicator', () => {
      // Setup offline state
      mockUseOnlineStatus.mockReturnValue({
        isOnline: false,
        connectionType: null,
        effectiveType: null,
        downlink: null,
        rtt: null,
        saveData: false,
        toggleOfflineMode: vi.fn()
      })

      render(
        <OfflineErrorBoundary enableAutoRetry>
          <EnhancedOfflineIndicator />
          <ErrorThrowingComponent shouldThrow />
        </OfflineErrorBoundary>
      )

      // Should show both offline status and error recovery
      expect(screen.getByText('Connection Issue')).toBeInTheDocument()
      expect(screen.getByText(/offline/i)).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })

    it('should provide comprehensive offline feedback', () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: false,
        connectionType: null,
        effectiveType: null,
        downlink: null,
        rtt: null,
        saveData: false,
        toggleOfflineMode: vi.fn()
      })

      render(
        <div>
          <EnhancedOfflineIndicator compact={false} showDetails showOfflineToggle />
        </div>
      )

      expect(screen.getByText('Connection Status')).toBeInTheDocument()
      expect(screen.getByText('Offline')).toBeInTheDocument()
      expect(screen.getByText('Simulate Offline')).toBeInTheDocument()
    })
  })
})