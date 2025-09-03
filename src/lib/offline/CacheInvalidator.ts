/**
 * CacheInvalidator - Build hash-based cache versioning and invalidation
 * Part of Phase 2: Development Workflow Support
 */

export class CacheInvalidator {
  private versionCheckInterval: number | null = null
  private versionChangeCallbacks: Array<(oldVersion: string, newVersion: string) => void> = []
  private readonly APP_CACHE_PREFIXES = ['supabase-lite-cache', 'monaco-editor-cache', 'vfs-cache']

  /**
   * Check app version and trigger invalidation if changed
   */
  async checkVersionAndInvalidate(newVersion: string): Promise<boolean> {
    const currentVersion = localStorage.getItem('app-cache-version')
    
    if (!currentVersion) {
      // First app launch - store version but don't invalidate
      localStorage.setItem('app-cache-version', newVersion)
      return false
    }

    if (currentVersion !== newVersion) {
      // Version changed - invalidate caches
      localStorage.setItem('app-cache-version', newVersion)
      
      // Notify callbacks
      this.versionChangeCallbacks.forEach(callback => {
        try {
          callback(currentVersion, newVersion)
        } catch (error) {
          console.error('Version change callback error:', error)
        }
      })
      
      return true
    }

    return false
  }

  /**
   * Generate build hash from Vite manifest or fallback to timestamp
   */
  async generateBuildHash(): Promise<string> {
    try {
      const response = await fetch('/.vite/manifest.json')
      if (response.ok) {
        const manifest = await response.json()
        
        // Create hash from manifest file entries
        const files = Object.keys(manifest).sort().join('|')
        const hash = await this.simpleHash(files)
        return hash.substring(0, 8) // Use first 8 characters
      }
    } catch (error) {
      console.warn('Could not load Vite manifest, using timestamp:', error)
    }

    // Fallback to timestamp
    return Date.now().toString()
  }

  /**
   * Clear all app-specific caches
   */
  async clearAppCaches(): Promise<string[]> {
    if (!('caches' in globalThis)) {
      return []
    }

    try {
      const cacheNames = await caches.keys()
      const appCaches = cacheNames.filter(cacheName => 
        this.APP_CACHE_PREFIXES.some(prefix => cacheName.startsWith(prefix))
      )

      const results = await Promise.all(
        appCaches.map(async cacheName => {
          const deleted = await caches.delete(cacheName)
          return deleted ? cacheName : null
        })
      )

      return results.filter(Boolean) as string[]
    } catch (error) {
      console.error('Failed to clear app caches:', error)
      return []
    }
  }

  /**
   * Clear caches matching a pattern
   */
  async clearCachesByPattern(pattern: string): Promise<string[]> {
    if (!('caches' in globalThis)) {
      return []
    }

    try {
      const cacheNames = await caches.keys()
      const matchingCaches = cacheNames.filter(cacheName => 
        cacheName.includes(pattern)
      )

      const results = await Promise.all(
        matchingCaches.map(async cacheName => {
          const deleted = await caches.delete(cacheName)
          return deleted ? cacheName : null
        })
      )

      return results.filter(Boolean) as string[]
    } catch (error) {
      console.error(`Failed to clear caches matching pattern ${pattern}:`, error)
      return []
    }
  }

  /**
   * Remove cache entries older than specified age
   */
  async clearEntriesOlderThan(cacheName: string, maxAgeHours: number): Promise<number> {
    if (!('caches' in globalThis)) {
      return 0
    }

    try {
      const cache = await caches.open(cacheName)
      const keys = await cache.keys()
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000)
      
      let deletedCount = 0

      for (const request of keys) {
        const response = await cache.match(request)
        if (response) {
          const timestamp = response.headers.get('cache-timestamp') || 
                           response.headers.get('date')
          
          if (timestamp) {
            const entryTime = new Date(timestamp).getTime()
            if (entryTime < cutoffTime) {
              const deleted = await cache.delete(request)
              if (deleted) deletedCount++
            }
          }
        }
      }

      return deletedCount
    } catch (error) {
      console.error(`Failed to clear old entries from ${cacheName}:`, error)
      return 0
    }
  }

  /**
   * Remove cache entries matching URL pattern
   */
  async clearEntriesByPattern(cacheName: string, urlPattern: RegExp): Promise<number> {
    if (!('caches' in globalThis)) {
      return 0
    }

    try {
      const cache = await caches.open(cacheName)
      const keys = await cache.keys()
      
      let deletedCount = 0

      for (const request of keys) {
        if (urlPattern.test(request.url)) {
          const deleted = await cache.delete(request)
          if (deleted) deletedCount++
        }
      }

      return deletedCount
    } catch (error) {
      console.error(`Failed to clear entries by pattern from ${cacheName}:`, error)
      return 0
    }
  }

  /**
   * Get cache size in bytes (async method for consistency)
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
   * Enforce cache size limit using LRU eviction
   */
  async enforceCacheSizeLimit(cacheName: string, maxSizeMB: number): Promise<number> {
    if (!('caches' in globalThis)) {
      return 0
    }

    try {
      const currentSize = await this.getCacheSize(cacheName)
      const maxSizeBytes = maxSizeMB * 1024 * 1024

      if (currentSize <= maxSizeBytes) {
        return 0 // No eviction needed
      }

      const cache = await caches.open(cacheName)
      const keys = await cache.keys()
      
      // Get entries with last accessed time (fallback to creation time)
      const entries = await Promise.all(
        keys.map(async request => {
          const response = await cache.match(request)
          const lastAccessed = response?.headers.get('last-accessed') || 
                              response?.headers.get('date') || 
                              '0'
          return {
            request,
            lastAccessed: parseInt(lastAccessed, 10)
          }
        })
      )

      // Sort by last accessed (oldest first)
      entries.sort((a, b) => a.lastAccessed - b.lastAccessed)

      let evictedCount = 0
      let currentSizeAfterEviction = currentSize

      // Evict oldest entries until under size limit
      for (const entry of entries) {
        if (currentSizeAfterEviction <= maxSizeBytes) break

        const response = await cache.match(entry.request)
        if (response) {
          const buffer = await response.clone().arrayBuffer()
          const deleted = await cache.delete(entry.request)
          if (deleted) {
            evictedCount++
            currentSizeAfterEviction -= buffer.byteLength
          }
        }
      }

      return evictedCount
    } catch (error) {
      console.error(`Failed to enforce cache size limit for ${cacheName}:`, error)
      return 0
    }
  }

  /**
   * Register callback for version changes
   */
  onVersionChange(callback: (oldVersion: string, newVersion: string) => void): void {
    this.versionChangeCallbacks.push(callback)
  }

  /**
   * Start automatic version checking
   */
  startAutoVersionCheck(intervalMs: number = 60000): void {
    if (this.versionCheckInterval) {
      clearInterval(this.versionCheckInterval)
    }

    this.versionCheckInterval = window.setInterval(async () => {
      try {
        const newVersion = await this.generateBuildHash()
        await this.checkVersionAndInvalidate(newVersion)
      } catch (error) {
        console.error('Auto version check failed:', error)
      }
    }, intervalMs)
  }

  /**
   * Stop automatic version checking
   */
  stopAutoVersionCheck(): void {
    if (this.versionCheckInterval) {
      clearInterval(this.versionCheckInterval)
      this.versionCheckInterval = null
    }
  }

  /**
   * Simple hash function for build hash generation
   */
  private async simpleHash(input: string): Promise<string> {
    if ('crypto' in globalThis && globalThis.crypto.subtle) {
      const encoder = new TextEncoder()
      const data = encoder.encode(input)
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    }

    // Fallback simple hash for environments without crypto.subtle
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }
}

// Export singleton instance
export const cacheInvalidator = new CacheInvalidator()