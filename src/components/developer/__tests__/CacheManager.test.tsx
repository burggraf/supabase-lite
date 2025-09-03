import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CacheManager } from '../CacheManager'

// Mock the cache debugger with hoisted functions
const mockCacheDebugger = vi.hoisted(() => ({
  getCacheStatus: vi.fn(),
  clearAllCaches: vi.fn(),
  clearCache: vi.fn(),
  getCacheSize: vi.fn(),
  inspectCache: vi.fn()
}))

vi.mock('../../../lib/offline/CacheDebugger', () => ({
  cacheDebugger: mockCacheDebugger
}))

describe('CacheManager Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Cache Status Display', () => {
    it('should display current cache status', async () => {
      const mockCacheStatus = {
        totalCaches: 3,
        totalSize: '15.2 MB',
        caches: [
          { name: 'supabase-lite-cache-v1', size: '12.1 MB', entries: 45 },
          { name: 'monaco-editor-cache', size: '2.8 MB', entries: 12 },
          { name: 'vfs-cache', size: '0.3 MB', entries: 8 }
        ]
      }

      mockCacheDebugger.getCacheStatus.mockResolvedValue(mockCacheStatus)

      await act(async () => {
        render(<CacheManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Cache Status')).toBeInTheDocument()
        expect(screen.getByText('Total Caches: 3')).toBeInTheDocument()
        expect(screen.getByText('Total Size: 15.2 MB')).toBeInTheDocument()
        expect(screen.getByText('supabase-lite-cache-v1')).toBeInTheDocument()
        expect(screen.getByText('12.1 MB (45 entries)')).toBeInTheDocument()
      })
    })

    it('should handle cache status loading state', () => {
      mockCacheDebugger.getCacheStatus.mockImplementation(() => new Promise(() => {}))

      render(<CacheManager />)

      expect(screen.getByText('Loading cache status...')).toBeInTheDocument()
    })

    it('should handle cache status errors', async () => {
      mockCacheDebugger.getCacheStatus.mockRejectedValue(new Error('Cache access failed'))

      await act(async () => {
        render(<CacheManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Error loading cache status')).toBeInTheDocument()
      })
    })
  })

  describe('Cache Management Actions', () => {
    it('should clear all caches when clear button is clicked', async () => {
      mockCacheDebugger.clearAllCaches.mockResolvedValue(true)
      mockCacheDebugger.getCacheStatus
        .mockResolvedValueOnce({
          totalCaches: 1,
          totalSize: '5 MB',
          caches: [{ name: 'test-cache', size: '5 MB', entries: 10 }]
        })
        .mockResolvedValueOnce({
          totalCaches: 0,
          totalSize: '0 B',
          caches: []
        })

      await act(async () => {
        render(<CacheManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Total Caches: 1')).toBeInTheDocument()
      })

      const clearButton = screen.getByRole('button', { name: /clear all caches/i })
      
      await act(async () => {
        fireEvent.click(clearButton)
      })

      // Confirm in dialog
      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      
      await act(async () => {
        fireEvent.click(confirmButton)
      })

      await waitFor(() => {
        expect(mockCacheDebugger.clearAllCaches).toHaveBeenCalled()
        expect(screen.getByText('Total Caches: 0')).toBeInTheDocument()
      })
    })

    it('should show confirmation dialog before clearing caches', async () => {
      mockCacheDebugger.getCacheStatus.mockResolvedValue({
        totalCaches: 1,
        totalSize: '5 MB',
        caches: [{ name: 'test-cache', size: '5 MB', entries: 10 }]
      })

      await act(async () => {
        render(<CacheManager />)
      })

      await waitFor(() => {
        expect(screen.getByText('Total Caches: 1')).toBeInTheDocument()
      })

      const clearButton = screen.getByRole('button', { name: /clear all caches/i })
      
      await act(async () => {
        fireEvent.click(clearButton)
      })

      expect(screen.getByText('Clear All Caches?')).toBeInTheDocument()
      expect(screen.getByText(/This will remove all cached resources/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should refresh cache status when refresh button is clicked', async () => {
      mockCacheDebugger.getCacheStatus.mockResolvedValue({
        totalCaches: 2,
        totalSize: '8.5 MB',
        caches: []
      })

      await act(async () => {
        render(<CacheManager />)
      })

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      
      await act(async () => {
        fireEvent.click(refreshButton)
      })

      await waitFor(() => {
        expect(mockCacheDebugger.getCacheStatus).toHaveBeenCalledTimes(2) // Initial load + refresh
      })
    })
  })

  describe('Individual Cache Management', () => {
    it('should allow clearing individual caches', async () => {
      const mockCacheStatus = {
        totalCaches: 2,
        totalSize: '10 MB',
        caches: [
          { name: 'cache1', size: '5 MB', entries: 20 },
          { name: 'cache2', size: '5 MB', entries: 15 }
        ]
      }

      mockCacheDebugger.getCacheStatus.mockResolvedValue(mockCacheStatus)
      mockCacheDebugger.clearCache.mockResolvedValue(true)

      await act(async () => {
        render(<CacheManager />)
      })

      await waitFor(() => {
        const clearCacheButton = screen.getAllByRole('button', { name: /clear cache/i })[0]
        fireEvent.click(clearCacheButton)
      })

      expect(mockCacheDebugger.clearCache).toHaveBeenCalledWith('cache1')
    })

    it('should show cache inspection details when inspect button is clicked', async () => {
      const mockCacheStatus = {
        totalCaches: 1,
        totalSize: '5 MB',
        caches: [{ name: 'test-cache', size: '5 MB', entries: 10 }]
      }

      const mockInspectData = {
        name: 'test-cache',
        entries: [
          { url: 'http://localhost:5173/assets/app.js', size: '1.2 MB', timestamp: '2024-01-01T10:00:00Z' },
          { url: 'http://localhost:5173/assets/app.css', size: '0.5 MB', timestamp: '2024-01-01T10:00:00Z' }
        ]
      }

      mockCacheDebugger.getCacheStatus.mockResolvedValue(mockCacheStatus)
      mockCacheDebugger.inspectCache.mockResolvedValue(mockInspectData)

      await act(async () => {
        render(<CacheManager />)
      })

      await waitFor(async () => {
        const inspectButton = screen.getByRole('button', { name: /inspect/i })
        
        await act(async () => {
          fireEvent.click(inspectButton)
        })

        await waitFor(() => {
          expect(screen.getByText('Cache: test-cache')).toBeInTheDocument()
          expect(screen.getByText('app.js')).toBeInTheDocument()
          expect(screen.getByText('1.2 MB')).toBeInTheDocument()
        })
      })
    })
  })


})