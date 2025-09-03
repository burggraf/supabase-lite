/**
 * CacheDebugger - Developer tools for cache inspection and management
 * Part of Phase 2: Development Workflow Support
 */

export interface CacheStatus {
  totalCaches: number
  totalSize: string
  caches: CacheInfo[]
}

export interface CacheInfo {
  name: string
  size: string
  entries: number
}

export interface CacheInspectData {
  name: string
  entries: CacheEntry[]
}

export interface CacheEntry {
  url: string
  size: string
  timestamp: string
}

export interface PerformanceMetrics {
  cacheHitRate: number
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  averageResponseTime: number
  networkSavings: string
}

export class CacheDebugger {
  private static instance: CacheDebugger | null = null
  private performanceData: Map<string, { hits: number; misses: number; responseTime: number }> = new Map()

  static getInstance(): CacheDebugger {
    if (!CacheDebugger.instance) {
      CacheDebugger.instance = new CacheDebugger()
    }
    return CacheDebugger.instance
  }

  /**
   * Get current status of all caches
   */
  async getCacheStatus(): Promise<CacheStatus> {
    if (!('caches' in globalThis)) {
      return { totalCaches: 0, totalSize: '0 B', caches: [] }
    }

    try {
      const cacheNames = await caches.keys()
      const cacheInfos: CacheInfo[] = []
      let totalSizeBytes = 0

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName)
        const keys = await cache.keys()
        const entries = keys.length
        
        // Calculate approximate cache size
        let cacheSize = 0
        for (const request of keys.slice(0, 10)) { // Sample first 10 entries
          const response = await cache.match(request)
          if (response) {
            const cloned = response.clone()
            const buffer = await cloned.arrayBuffer()
            cacheSize += buffer.byteLength
          }
        }
        
        // Estimate total size based on sample
        const estimatedSize = entries > 0 ? (cacheSize / Math.min(10, entries)) * entries : 0
        totalSizeBytes += estimatedSize

        cacheInfos.push({
          name: cacheName,
          size: this.formatBytes(estimatedSize),
          entries
        })
      }

      return {
        totalCaches: cacheNames.length,
        totalSize: this.formatBytes(totalSizeBytes),
        caches: cacheInfos
      }
    } catch (error) {
      console.error('Failed to get cache status:', error)
      throw new Error('Failed to access cache status')
    }
  }

  /**
   * Clear all application caches
   */
  async clearAllCaches(): Promise<boolean> {
    if (!('caches' in globalThis)) {
      return false
    }

    try {
      const cacheNames = await caches.keys()
      const deletions = cacheNames.map(cacheName => caches.delete(cacheName))
      const results = await Promise.all(deletions)
      
      // Reset performance data
      this.performanceData.clear()
      
      return results.every(result => result)
    } catch (error) {
      console.error('Failed to clear all caches:', error)
      return false
    }
  }

  /**
   * Clear specific cache by name
   */
  async clearCache(cacheName: string): Promise<boolean> {
    if (!('caches' in globalThis)) {
      return false
    }

    try {
      const result = await caches.delete(cacheName)
      
      // Remove from performance data
      this.performanceData.delete(cacheName)
      
      return result
    } catch (error) {
      console.error(`Failed to clear cache ${cacheName}:`, error)
      return false
    }
  }

  /**
   * Get detailed cache size (more accurate but slower)
   */
  async getCacheSize(cacheName: string): Promise<number> {
    if (!('caches' in globalThis)) {
      return 0
    }

    try {
      const cache = await caches.open(cacheName)
      const keys = await cache.keys()
      let totalSize = 0

      for (const request of keys) {
        const response = await cache.match(request)
        if (response) {
          const cloned = response.clone()
          const buffer = await cloned.arrayBuffer()
          totalSize += buffer.byteLength
        }
      }

      return totalSize
    } catch (error) {
      console.error(`Failed to get cache size for ${cacheName}:`, error)
      return 0
    }
  }

  /**
   * Inspect cache contents in detail
   */
  async inspectCache(cacheName: string): Promise<CacheInspectData> {
    if (!('caches' in globalThis)) {
      return { name: cacheName, entries: [] }
    }

    try {
      const cache = await caches.open(cacheName)
      const keys = await cache.keys()
      const entries: CacheEntry[] = []

      for (const request of keys) {
        const response = await cache.match(request)
        if (response) {
          const cloned = response.clone()
          const buffer = await cloned.arrayBuffer()
          const timestamp = response.headers.get('cache-timestamp') || 
                          response.headers.get('date') || 
                          new Date().toISOString()

          entries.push({
            url: request.url,
            size: this.formatBytes(buffer.byteLength),
            timestamp
          })
        }
      }

      return {
        name: cacheName,
        entries: entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      }
    } catch (error) {
      console.error(`Failed to inspect cache ${cacheName}:`, error)
      return { name: cacheName, entries: [] }
    }
  }

  /**
   * Record cache hit for performance tracking
   */
  recordCacheHit(cacheName: string, responseTime: number): void {
    const data = this.performanceData.get(cacheName) || { hits: 0, misses: 0, responseTime: 0 }
    data.hits++
    data.responseTime = (data.responseTime + responseTime) / 2 // Running average
    this.performanceData.set(cacheName, data)
  }

  /**
   * Record cache miss for performance tracking
   */
  recordCacheMiss(cacheName: string, responseTime: number): void {
    const data = this.performanceData.get(cacheName) || { hits: 0, misses: 0, responseTime: 0 }
    data.misses++
    data.responseTime = (data.responseTime + responseTime) / 2 // Running average
    this.performanceData.set(cacheName, data)
  }

  /**
   * Get performance metrics for all caches
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    let totalHits = 0
    let totalMisses = 0
    let totalResponseTime = 0
    let cacheCount = 0

    this.performanceData.forEach(data => {
      totalHits += data.hits
      totalMisses += data.misses
      totalResponseTime += data.responseTime
      cacheCount++
    })

    const totalRequests = totalHits + totalMisses
    const cacheHitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0
    const averageResponseTime = cacheCount > 0 ? totalResponseTime / cacheCount : 0

    // Estimate network savings based on cache hits and average response size
    const estimatedSavingsBytes = totalHits * 50 * 1024 // Assume 50KB average response
    const networkSavings = this.formatBytes(estimatedSavingsBytes)

    return {
      cacheHitRate: Math.round(cacheHitRate * 100) / 100, // Round to 2 decimal places
      totalRequests,
      cacheHits: totalHits,
      cacheMisses: totalMisses,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      networkSavings
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  /**
   * Check if cache API is available
   */
  static isCacheAPIAvailable(): boolean {
    return 'caches' in globalThis
  }

  /**
   * Check if running in development mode
   */
  isDevelopmentMode(): boolean {
    // Check Vite environment variables
    try {
      if (import.meta?.env?.DEV === true || import.meta?.env?.NODE_ENV === 'development') {
        return true
      }
    } catch (e) {
      // import.meta may not be available in all contexts
    }
    
    // Fallback for environments where import.meta is not available
    if (typeof window !== 'undefined') {
      return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    }
    
    return false
  }

  /**
   * Create a development cache with sample content for testing
   */
  async createDevelopmentCache(cacheName: string = 'dev-sample-cache'): Promise<boolean> {
    if (!('caches' in globalThis)) {
      return false
    }

    try {
      const cache = await caches.open(cacheName)
      
      // Add sample static assets that would normally be cached by SW
      // Use current origin to avoid hardcoded ports
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174'
      const sampleAssets = [
        {
          url: `${currentOrigin}/assets/sample.js`,
          content: 'console.log("Sample JavaScript asset");',
          type: 'application/javascript'
        },
        {
          url: `${currentOrigin}/assets/sample.css`, 
          content: 'body { margin: 0; padding: 0; }',
          type: 'text/css'
        },
        {
          url: `${currentOrigin}/assets/index.js`,
          content: 'import React from "react"; // Main app bundle',
          type: 'application/javascript'
        }
      ]

      for (const asset of sampleAssets) {
        const response = new Response(asset.content, {
          headers: {
            'content-type': asset.type,
            'cache-timestamp': new Date().toISOString()
          }
        })
        await cache.put(asset.url, response)
      }

      console.log(`✅ Created development cache '${cacheName}' with ${sampleAssets.length} sample entries`)
      return true

    } catch (error) {
      console.error(`Failed to create development cache ${cacheName}:`, error)
      return false
    }
  }

  /**
   * Clear all development-specific caches
   */
  async clearDevelopmentCaches(): Promise<boolean> {
    if (!('caches' in globalThis)) {
      return false
    }

    try {
      const cacheNames = await caches.keys()
      const devCachePattern = /^dev-/i
      const devCaches = cacheNames.filter(name => devCachePattern.test(name))
      
      if (devCaches.length === 0) {
        return true // No dev caches to clear
      }

      const deletions = devCaches.map(cacheName => caches.delete(cacheName))
      const results = await Promise.all(deletions)
      
      console.log(`✅ Cleared ${devCaches.length} development caches`)
      return results.every(result => result)

    } catch (error) {
      console.error('Failed to clear development caches:', error)
      return false
    }
  }

  /**
   * Initialize development mode - create sample caches if needed
   */
  async initializeDevelopmentMode(): Promise<void> {
    if (!this.isDevelopmentMode() || !('caches' in globalThis)) {
      return
    }

    try {
      const cacheNames = await caches.keys()
      const hasDevCaches = cacheNames.some(name => name.startsWith('dev-'))
      
      if (!hasDevCaches) {
        console.log('🔧 Development mode detected - creating sample caches for Cache Manager')
        await this.createDevelopmentCache('dev-sample-cache')
        
        // Also create a realistic Monaco Editor cache
        await this.createDevelopmentCache('dev-monaco-cache')
        const monacoCache = await caches.open('dev-monaco-cache')
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174'
        const monacoResponse = new Response('/* Monaco Editor CSS */', {
          headers: {
            'content-type': 'text/css',
            'cache-timestamp': new Date().toISOString()
          }
        })
        await monacoCache.put(`${currentOrigin}/assets/monaco-editor.css`, monacoResponse)
      }
    } catch (error) {
      console.warn('Failed to initialize development mode caches:', error)
    }
  }
}

// Export singleton instance with different name to avoid conflict
export const cacheDebugger = CacheDebugger.getInstance()