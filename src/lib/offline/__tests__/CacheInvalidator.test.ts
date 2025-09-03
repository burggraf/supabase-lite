import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CacheInvalidator } from '../CacheInvalidator'

// Mock the cache API
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn()
}

global.caches = {
  open: vi.fn().mockResolvedValue(mockCache),
  delete: vi.fn(),
  has: vi.fn(),
  keys: vi.fn(),
  match: vi.fn()
}

// Mock localStorage for version storage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  },
  writable: true
})

describe('CacheInvalidator', () => {
  let cacheInvalidator: CacheInvalidator

  beforeEach(() => {
    vi.clearAllMocks()
    cacheInvalidator = new CacheInvalidator()
  })

  describe('Version Management', () => {
    it('should detect new app version and trigger cache invalidation', async () => {
      // Mock old version in localStorage
      vi.mocked(localStorage.getItem).mockReturnValue('v1.0.0-abc123')
      
      const newVersion = 'v1.0.1-def456'
      const shouldInvalidate = await cacheInvalidator.checkVersionAndInvalidate(newVersion)

      expect(shouldInvalidate).toBe(true)
      expect(localStorage.setItem).toHaveBeenCalledWith('app-cache-version', newVersion)
    })

    it('should not invalidate cache for same version', async () => {
      const currentVersion = 'v1.0.0-abc123'
      vi.mocked(localStorage.getItem).mockReturnValue(currentVersion)

      const shouldInvalidate = await cacheInvalidator.checkVersionAndInvalidate(currentVersion)

      expect(shouldInvalidate).toBe(false)
    })

    it('should handle first app launch with no stored version', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)
      
      const initialVersion = 'v1.0.0-abc123'
      const shouldInvalidate = await cacheInvalidator.checkVersionAndInvalidate(initialVersion)

      expect(shouldInvalidate).toBe(false) // No invalidation on first launch
      expect(localStorage.setItem).toHaveBeenCalledWith('app-cache-version', initialVersion)
    })

    it('should generate build hash from manifest', async () => {
      const mockManifest = {
        'assets/app-abc123.js': { file: 'assets/app-abc123.js', src: 'src/main.tsx' },
        'assets/app-def456.css': { file: 'assets/app-def456.css', src: 'src/main.css' }
      }

      // Mock fetch for manifest.json
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockManifest)
      })

      const buildHash = await cacheInvalidator.generateBuildHash()

      expect(buildHash).toMatch(/^[a-f0-9]{8}$/) // Should be 8 character hex hash
      expect(fetch).toHaveBeenCalledWith('/.vite/manifest.json')
    })

    it('should fallback to timestamp when manifest is not available', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })

      const buildHash = await cacheInvalidator.generateBuildHash()

      expect(buildHash).toMatch(/^\d+$/) // Should be timestamp string
    })
  })

  describe('Selective Cache Clearing', () => {
    it('should clear only app-specific caches', async () => {
      const cacheNames = [
        'supabase-lite-cache-v1',
        'monaco-editor-cache-v1',
        'vfs-cache-v1',
        'third-party-cache',
        'system-cache'
      ]

      vi.mocked(caches.keys).mockResolvedValue(cacheNames)
      vi.mocked(caches.delete).mockResolvedValue(true)

      const clearedCaches = await cacheInvalidator.clearAppCaches()

      expect(clearedCaches).toEqual([
        'supabase-lite-cache-v1',
        'monaco-editor-cache-v1',
        'vfs-cache-v1'
      ])
      
      expect(caches.delete).toHaveBeenCalledTimes(3)
      expect(caches.delete).not.toHaveBeenCalledWith('third-party-cache')
      expect(caches.delete).not.toHaveBeenCalledWith('system-cache')
    })

    it('should clear specific cache by pattern', async () => {
      const cacheNames = [
        'supabase-lite-cache-v1',
        'supabase-lite-cache-v2',
        'monaco-editor-cache-v1',
        'other-cache'
      ]

      vi.mocked(caches.keys).mockResolvedValue(cacheNames)
      vi.mocked(caches.delete).mockResolvedValue(true)

      const clearedCaches = await cacheInvalidator.clearCachesByPattern('supabase-lite-cache')

      expect(clearedCaches).toEqual([
        'supabase-lite-cache-v1',
        'supabase-lite-cache-v2'
      ])
      
      expect(caches.delete).toHaveBeenCalledWith('supabase-lite-cache-v1')
      expect(caches.delete).toHaveBeenCalledWith('supabase-lite-cache-v2')
      expect(caches.delete).not.toHaveBeenCalledWith('monaco-editor-cache-v1')
    })

    it('should handle cache deletion errors gracefully', async () => {
      const cacheNames = ['failing-cache', 'working-cache']
      
      vi.mocked(caches.keys).mockResolvedValue(cacheNames)
      vi.mocked(caches.delete)
        .mockResolvedValueOnce(false) // First cache fails
        .mockResolvedValueOnce(true)  // Second cache succeeds

      const clearedCaches = await cacheInvalidator.clearCachesByPattern('cache')

      expect(clearedCaches).toEqual(['working-cache']) // Only successful deletions
    })
  })

  describe('Cache Entry Management', () => {
    it('should remove entries older than specified age', async () => {
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      const recentTimestamp = Date.now() - (1 * 60 * 60 * 1000) // 1 hour ago

      const mockEntries = [
        new Request('http://localhost:5173/old-asset.js'),
        new Request('http://localhost:5173/recent-asset.js')
      ]

      const mockOldResponse = new Response('old content', {
        headers: { 'cache-timestamp': oldTimestamp.toString() }
      })
      const mockRecentResponse = new Response('recent content', {
        headers: { 'cache-timestamp': recentTimestamp.toString() }
      })

      mockCache.keys.mockResolvedValue(mockEntries)
      mockCache.match
        .mockResolvedValueOnce(mockOldResponse)
        .mockResolvedValueOnce(mockRecentResponse)
      mockCache.delete.mockResolvedValue(true)

      const maxAgeHours = 24
      const deletedCount = await cacheInvalidator.clearEntriesOlderThan('test-cache', maxAgeHours)

      expect(deletedCount).toBe(1)
      expect(mockCache.delete).toHaveBeenCalledWith(mockEntries[0])
      expect(mockCache.delete).not.toHaveBeenCalledWith(mockEntries[1])
    })

    it('should remove entries by URL pattern', async () => {
      const mockEntries = [
        new Request('http://localhost:5173/assets/old-chunk-123.js'),
        new Request('http://localhost:5173/assets/app-456.js'),
        new Request('http://localhost:5173/static/image.png')
      ]

      mockCache.keys.mockResolvedValue(mockEntries)
      mockCache.delete.mockResolvedValue(true)

      const deletedCount = await cacheInvalidator.clearEntriesByPattern('test-cache', /chunk-\d+\.js$/)

      expect(deletedCount).toBe(1)
      expect(mockCache.delete).toHaveBeenCalledWith(mockEntries[0])
      expect(mockCache.delete).not.toHaveBeenCalledWith(mockEntries[1])
      expect(mockCache.delete).not.toHaveBeenCalledWith(mockEntries[2])
    })

    it('should handle cache size limits with LRU eviction', async () => {
      const mockEntries = [
        { request: new Request('http://localhost:5173/file1.js'), lastAccessed: 1000 },
        { request: new Request('http://localhost:5173/file2.js'), lastAccessed: 3000 },
        { request: new Request('http://localhost:5173/file3.js'), lastAccessed: 2000 }
      ]

      // Mock cache size calculation
      vi.spyOn(cacheInvalidator, 'getCacheSize').mockResolvedValue(100 * 1024 * 1024) // 100MB

      mockCache.keys.mockResolvedValue(mockEntries.map(e => e.request))
      
      // Mock responses with last-accessed headers
      mockEntries.forEach((entry, index) => {
        const response = new Response(`content ${index}`, {
          headers: { 'last-accessed': entry.lastAccessed.toString() }
        })
        mockCache.match.mockResolvedValueOnce(response)
      })

      mockCache.delete.mockResolvedValue(true)

      const maxSizeMB = 50 // Force eviction
      const evictedCount = await cacheInvalidator.enforceCacheSizeLimit('test-cache', maxSizeMB)

      // Should evict least recently used (file1.js with lastAccessed: 1000)
      expect(evictedCount).toBeGreaterThan(0)
      expect(mockCache.delete).toHaveBeenCalledWith(mockEntries[0].request)
    })
  })

  describe('Automatic Invalidation', () => {
    it('should set up automatic version checking', () => {
      const mockCallback = vi.fn()
      
      cacheInvalidator.onVersionChange(mockCallback)
      
      // Simulate version check interval
      vi.useFakeTimers()
      
      cacheInvalidator.startAutoVersionCheck(5000) // 5 second interval
      
      vi.advanceTimersByTime(5000)
      
      // Should have called version check
      expect(mockCallback).toHaveBeenCalled()
      
      vi.useRealTimers()
    })

    it('should stop automatic version checking', () => {
      vi.useFakeTimers()
      
      cacheInvalidator.startAutoVersionCheck(1000)
      cacheInvalidator.stopAutoVersionCheck()
      
      const mockCallback = vi.fn()
      cacheInvalidator.onVersionChange(mockCallback)
      
      vi.advanceTimersByTime(5000)
      
      expect(mockCallback).not.toHaveBeenCalled()
      
      vi.useRealTimers()
    })
  })
})