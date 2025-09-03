/**
 * Tests for CacheDebugger development mode functionality
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { cacheDebugger, CacheStatus } from '../CacheDebugger'

describe('CacheDebugger - Development Mode', () => {
  // Mock the Cache API
  const mockCache = {
    keys: vi.fn(),
    match: vi.fn(),
    delete: vi.fn(),
    add: vi.fn(),
    addAll: vi.fn(),
    put: vi.fn(),
    matchAll: vi.fn()
  }

  const mockCaches = {
    keys: vi.fn(),
    open: vi.fn().mockResolvedValue(mockCache),
    delete: vi.fn(),
    has: vi.fn(),
    match: vi.fn()
  }

  beforeEach(() => {
    // Mock global caches API
    ;(globalThis as any).caches = mockCaches
    
    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up global caches mock
    delete (globalThis as any).caches
  })

  describe('getCacheStatus', () => {
    it('should return empty status when no caches exist in development', async () => {
      // Arrange
      mockCaches.keys.mockResolvedValue([])

      // Act
      const result = await cacheDebugger.getCacheStatus()

      // Assert
      const expected: CacheStatus = {
        totalCaches: 0,
        totalSize: '0 B',
        caches: []
      }
      expect(result).toEqual(expected)
    })

    it('should create and populate sample cache for development testing', async () => {
      // Arrange
      const sampleCacheName = 'dev-sample-cache'
      
      // Act
      await cacheDebugger.createDevelopmentCache(sampleCacheName)
      
      // Assert - verify cache was created with sample content
      expect(mockCaches.open).toHaveBeenCalledWith(sampleCacheName)
      expect(mockCache.put).toHaveBeenCalled()
    })

    it('should detect development caches and show realistic data', async () => {
      // Arrange
      const devCacheName = 'dev-sample-cache'
      mockCaches.keys.mockResolvedValue([devCacheName])
      
      // Mock cache with sample content
      const mockRequest = new Request('http://localhost:5174/assets/sample.js')
      mockCache.keys.mockResolvedValue([mockRequest])
      
      const mockResponse = new Response('console.log("sample")', {
        headers: { 'content-type': 'application/javascript' }
      })
      mockCache.match.mockResolvedValue(mockResponse)

      // Act
      const result = await cacheDebugger.getCacheStatus()

      // Assert
      expect(result.totalCaches).toBe(1)
      expect(result.caches).toHaveLength(1)
      expect(result.caches[0].name).toBe(devCacheName)
      expect(result.caches[0].entries).toBe(1)
      expect(result.totalSize).not.toBe('0 B')
    })
  })

  describe('isDevelopmentMode', () => {
    it('should detect development mode correctly', () => {
      // Act
      const isDev = cacheDebugger.isDevelopmentMode()

      // Assert
      expect(isDev).toBe(true) // Since we're running in test mode
    })

    it('should enable development features when in dev mode', async () => {
      // Arrange
      const isDevMode = cacheDebugger.isDevelopmentMode()
      
      // Act & Assert
      if (isDevMode) {
        expect(cacheDebugger.createDevelopmentCache).toBeDefined()
        expect(cacheDebugger.clearDevelopmentCaches).toBeDefined()
      }
    })
  })

  describe('development cache management', () => {
    it('should clear all development caches', async () => {
      // Arrange
      const devCaches = ['dev-cache-1', 'dev-cache-2']
      mockCaches.keys.mockResolvedValue(devCaches)
      mockCaches.delete.mockResolvedValue(true)

      // Act
      const result = await cacheDebugger.clearDevelopmentCaches()

      // Assert
      expect(result).toBe(true)
      expect(mockCaches.delete).toHaveBeenCalledTimes(2)
      expect(mockCaches.delete).toHaveBeenCalledWith('dev-cache-1')
      expect(mockCaches.delete).toHaveBeenCalledWith('dev-cache-2')
    })
  })
})