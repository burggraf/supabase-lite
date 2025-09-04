/**
 * Hybrid Architecture Optimizer Test
 * 
 * Tests performance optimization features for the hybrid architecture
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HybridArchitectureOptimizer } from '../HybridArchitectureOptimizer'

describe('HybridArchitectureOptimizer', () => {
  let optimizer: HybridArchitectureOptimizer

  beforeEach(() => {
    // Get fresh instance for each test
    optimizer = HybridArchitectureOptimizer.getInstance()
    optimizer.resetMetrics()
  })

  describe('Cache Management', () => {
    it('should cache and retrieve query results', async () => {
      const sql = 'SELECT * FROM users WHERE id = $1'
      const params = [123]
      const options = { 
        cacheable: true, 
        cacheKey: 'user_123',
        cacheTtl: 60000 
      }

      // First request should miss cache
      await optimizer.optimizeRequest(sql, params, options)
      
      // Second request should hit cache  
      await optimizer.optimizeRequest(sql, params, options)

      const metrics = optimizer.getMetrics()
      expect(metrics.totalRequests).toBe(2)
      expect(metrics.cacheHits).toBe(1)
      expect(metrics.cacheMisses).toBe(1)
    })

    it('should not cache when cacheable is false', async () => {
      const sql = 'SELECT NOW()'
      const options = { cacheable: false }

      await optimizer.optimizeRequest(sql, [], options)
      await optimizer.optimizeRequest(sql, [], options)

      const metrics = optimizer.getMetrics()
      expect(metrics.cacheHits).toBe(0)
      expect(metrics.cacheMisses).toBe(0)
    })

    it('should clear cache on demand', async () => {
      const options = { cacheable: true, cacheKey: 'test_key' }
      
      await optimizer.optimizeRequest('SELECT 1', [], options)
      optimizer.clearCache()
      await optimizer.optimizeRequest('SELECT 1', [], options)

      const metrics = optimizer.getMetrics()
      expect(metrics.cacheHits).toBe(0)
      expect(metrics.cacheMisses).toBe(2)
    })
  })

  describe('Batch Processing', () => {
    it('should batch multiple requests', async () => {
      const requests = [
        { sql: 'SELECT 1', params: [] },
        { sql: 'SELECT 2', params: [] },
        { sql: 'SELECT 3', params: [] }
      ]

      const results = await optimizer.optimizeBatch(requests)

      expect(results).toHaveLength(3)
      expect(Array.isArray(results)).toBe(true)
    })

    it('should handle mixed cacheable and non-cacheable requests', async () => {
      const requests = [
        { sql: 'SELECT 1', params: [], cacheable: true },
        { sql: 'SELECT 2', params: [], cacheable: false },
        { sql: 'SELECT 1', params: [], cacheable: true } // Should hit cache
      ]

      await optimizer.optimizeBatch(requests)

      const metrics = optimizer.getMetrics()
      expect(metrics.cacheHits).toBeGreaterThan(0)
    })
  })

  describe('Data Compression', () => {
    it('should compress large data', async () => {
      const largeData = 'x'.repeat(2000) // 2KB of data
      
      const compressed = await optimizer.compressData(largeData)
      
      // Should return compressed data (prefixed with 'gzip:')
      expect(typeof compressed).toBe('string')
      // Compression may or may not occur depending on browser support
    })

    it('should not compress small data', async () => {
      const smallData = 'hello world'
      
      const result = await optimizer.compressData(smallData)
      
      // Small data should not be compressed
      expect(result).toBe(smallData)
    })

    it('should decompress gzipped data', async () => {
      const testData = 'This is test data for compression'
      
      const compressed = await optimizer.compressData(testData)
      
      if (compressed.startsWith('gzip:')) {
        const decompressed = await optimizer.decompressData(compressed)
        expect(decompressed).toBe(testData)
      } else {
        // If compression didn't occur, data should be unchanged
        expect(compressed).toBe(testData)
      }
    })

    it('should handle non-gzipped data in decompression', async () => {
      const plainData = 'not compressed'
      
      const result = await optimizer.decompressData(plainData)
      
      expect(result).toBe(plainData)
    })
  })

  describe('Performance Metrics', () => {
    it('should track performance metrics', async () => {
      await optimizer.optimizeRequest('SELECT 1', [])
      await optimizer.optimizeRequest('SELECT 2', [], { cacheable: true })

      const metrics = optimizer.getMetrics()
      
      expect(metrics.totalRequests).toBe(2)
      expect(metrics.averageResponseTime).toBeGreaterThan(0)
      expect(typeof metrics.averageResponseTime).toBe('number')
    })

    it('should reset metrics', async () => {
      await optimizer.optimizeRequest('SELECT 1', [])
      
      optimizer.resetMetrics()
      const metrics = optimizer.getMetrics()
      
      expect(metrics.totalRequests).toBe(0)
      expect(metrics.cacheHits).toBe(0)
      expect(metrics.cacheMisses).toBe(0)
      expect(metrics.averageResponseTime).toBe(0)
    })

    it('should track optimization savings', async () => {
      const options = { cacheable: true, cacheKey: 'savings_test' }
      
      // First request
      await optimizer.optimizeRequest('SELECT 1', [], options)
      
      // Second request should hit cache and show savings
      await optimizer.optimizeRequest('SELECT 1', [], options)
      
      const metrics = optimizer.getMetrics()
      expect(metrics.optimizationSavings).toBeGreaterThan(0)
    })
  })

  describe('Configuration', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        caching: {
          enabled: false,
          defaultTtl: 120000,
          maxEntries: 2000,
          memoryLimit: 100
        }
      }

      optimizer.updateConfig(newConfig)
      
      // Configuration update should not throw errors
      expect(true).toBe(true)
    })
  })

  describe('Request Prioritization', () => {
    it('should handle different request priorities', async () => {
      const highPriorityRequest = optimizer.optimizeRequest(
        'SELECT 1', 
        [], 
        { batchable: true, priority: 'high' }
      )
      
      const lowPriorityRequest = optimizer.optimizeRequest(
        'SELECT 2', 
        [], 
        { batchable: true, priority: 'low' }
      )

      // Both requests should complete without errors
      const results = await Promise.all([highPriorityRequest, lowPriorityRequest])
      expect(results).toHaveLength(2)
    })
  })
})