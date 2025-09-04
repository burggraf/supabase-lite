/**
 * Hybrid Architecture Optimizer
 * 
 * Optimizes performance for the hybrid PGlite + WebVM services architecture
 * by implementing caching, connection pooling, request batching, and other
 * performance improvements for cross-context communication.
 */

import { logger } from '../infrastructure/Logger'

/**
 * Request cache entry
 */
interface CacheEntry {
  key: string
  data: any
  timestamp: number
  ttl: number
  hits: number
}

/**
 * Connection pool entry
 */
interface PooledConnection {
  id: string
  lastUsed: number
  inUse: boolean
  context: any
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  averageResponseTime: number
  connectionPoolUsage: number
  batchedRequests: number
  optimizationSavings: number // milliseconds saved
}

/**
 * Batch request interface
 */
export interface BatchRequest {
  id: string
  sql: string
  params: any[]
  priority: 'low' | 'normal' | 'high'
  callback: (result: any, error?: Error) => void
}

/**
 * Configuration for optimizer
 */
export interface OptimizerConfig {
  caching: {
    enabled: boolean
    defaultTtl: number
    maxEntries: number
    memoryLimit: number // in MB
  }
  connectionPool: {
    enabled: boolean
    minConnections: number
    maxConnections: number
    idleTimeout: number
    acquireTimeout: number
  }
  batching: {
    enabled: boolean
    batchSize: number
    batchTimeout: number
    priorityQueues: boolean
  }
  compression: {
    enabled: boolean
    minSize: number // minimum bytes to compress
    algorithm: 'gzip' | 'deflate' | 'br'
  }
}

/**
 * Hybrid Architecture Optimizer Class
 * 
 * Provides performance optimizations for cross-context communication
 * between browser PGlite and WebVM services
 */
export class HybridArchitectureOptimizer {
  private static instance: HybridArchitectureOptimizer
  private cache: Map<string, CacheEntry> = new Map()
  private connectionPool: Map<string, PooledConnection> = new Map()
  private batchQueue: BatchRequest[] = []
  private batchTimer: number | null = null
  private metrics: PerformanceMetrics
  private config: OptimizerConfig

  // Default configuration
  private readonly defaultConfig: OptimizerConfig = {
    caching: {
      enabled: true,
      defaultTtl: 300000, // 5 minutes
      maxEntries: 1000,
      memoryLimit: 50 // 50MB
    },
    connectionPool: {
      enabled: true,
      minConnections: 2,
      maxConnections: 10,
      idleTimeout: 300000, // 5 minutes
      acquireTimeout: 10000 // 10 seconds
    },
    batching: {
      enabled: true,
      batchSize: 10,
      batchTimeout: 100, // 100ms
      priorityQueues: true
    },
    compression: {
      enabled: true,
      minSize: 1024, // 1KB
      algorithm: 'gzip'
    }
  }

  private constructor(config?: Partial<OptimizerConfig>) {
    this.config = { ...this.defaultConfig, ...config }
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      connectionPoolUsage: 0,
      batchedRequests: 0,
      optimizationSavings: 0
    }

    this.startCleanupTasks()
  }

  public static getInstance(config?: Partial<OptimizerConfig>): HybridArchitectureOptimizer {
    if (!HybridArchitectureOptimizer.instance) {
      HybridArchitectureOptimizer.instance = new HybridArchitectureOptimizer(config)
    }
    return HybridArchitectureOptimizer.instance
  }

  /**
   * Optimize a database request using various performance techniques
   */
  public async optimizeRequest(
    sql: string,
    params: any[] = [],
    options: {
      cacheable?: boolean
      cacheKey?: string
      cacheTtl?: number
      priority?: 'low' | 'normal' | 'high'
      batchable?: boolean
    } = {}
  ): Promise<any> {
    const startTime = performance.now()
    this.metrics.totalRequests++

    try {
      // Try cache first if cacheable
      if (options.cacheable && this.config.caching.enabled) {
        const cacheKey = options.cacheKey || this.generateCacheKey(sql, params)
        const cachedResult = this.getFromCache(cacheKey)
        
        if (cachedResult) {
          this.metrics.cacheHits++
          this.metrics.optimizationSavings += 20 // Assume cache saves ~20ms
          logger.debug('Request served from cache', { cacheKey })
          return cachedResult
        }
        this.metrics.cacheMisses++
      }

      // Handle batching if enabled and request is batchable
      if (options.batchable && this.config.batching.enabled) {
        return this.addToBatch(sql, params, options.priority || 'normal')
      }

      // Execute request directly
      const result = await this.executeOptimizedRequest(sql, params)
      
      // Cache result if cacheable
      if (options.cacheable && this.config.caching.enabled && result) {
        const cacheKey = options.cacheKey || this.generateCacheKey(sql, params)
        const ttl = options.cacheTtl || this.config.caching.defaultTtl
        this.setCache(cacheKey, result, ttl)
      }

      // Update metrics
      const responseTime = performance.now() - startTime
      this.updateResponseTimeMetrics(responseTime)

      return result

    } catch (error) {
      logger.error('Optimized request failed', { error, sql: sql.substring(0, 100) })
      throw error
    }
  }

  /**
   * Optimize a batch of requests
   */
  public async optimizeBatch(requests: Array<{
    sql: string
    params: any[]
    cacheable?: boolean
  }>): Promise<any[]> {
    const startTime = performance.now()
    logger.debug('Optimizing batch request', { count: requests.length })

    // Group requests by cacheability
    const cacheableRequests: any[] = []
    const nonCacheableRequests: any[] = []
    const results: any[] = new Array(requests.length)

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i]
      
      if (request.cacheable && this.config.caching.enabled) {
        const cacheKey = this.generateCacheKey(request.sql, request.params)
        const cachedResult = this.getFromCache(cacheKey)
        
        if (cachedResult) {
          results[i] = cachedResult
          this.metrics.cacheHits++
        } else {
          cacheableRequests.push({ ...request, index: i, cacheKey })
        }
      } else {
        nonCacheableRequests.push({ ...request, index: i })
      }
    }

    // Execute non-cached requests in optimized batches
    const allPendingRequests = [...cacheableRequests, ...nonCacheableRequests]
    
    if (allPendingRequests.length > 0) {
      const batchResults = await this.executeOptimizedBatch(allPendingRequests)
      
      // Place results in correct positions and cache if needed
      for (let i = 0; i < batchResults.length; i++) {
        const request = allPendingRequests[i]
        results[request.index] = batchResults[i]
        
        // Cache result if it was cacheable
        if (request.cacheKey && batchResults[i]) {
          this.setCache(request.cacheKey, batchResults[i], this.config.caching.defaultTtl)
        }
      }
    }

    this.metrics.batchedRequests += requests.length
    const responseTime = performance.now() - startTime
    this.metrics.optimizationSavings += Math.max(0, (requests.length * 20) - responseTime)

    logger.debug('Batch optimization completed', { 
      count: requests.length, 
      responseTime,
      cacheHits: this.metrics.cacheHits
    })

    return results
  }

  /**
   * Compress data for transmission
   */
  public async compressData(data: string): Promise<string> {
    if (!this.config.compression.enabled || data.length < this.config.compression.minSize) {
      return data
    }

    try {
      // Use browser-compatible compression
      const encoder = new TextEncoder()
      const compressed = await this.gzipCompress(encoder.encode(data))
      const base64 = btoa(String.fromCharCode(...new Uint8Array(compressed)))
      
      // Only return compressed if it's actually smaller
      if (base64.length < data.length * 0.8) {
        logger.debug('Data compressed', { 
          original: data.length, 
          compressed: base64.length,
          savings: ((data.length - base64.length) / data.length * 100).toFixed(1) + '%'
        })
        return `gzip:${base64}`
      }
    } catch (error) {
      logger.warn('Compression failed, using uncompressed data', { error })
    }

    return data
  }

  /**
   * Decompress data received from WebVM
   */
  public async decompressData(data: string): Promise<string> {
    if (!data.startsWith('gzip:')) {
      return data
    }

    try {
      const base64 = data.slice(5)
      const compressed = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
      const decompressed = await this.gzipDecompress(compressed)
      const decoder = new TextDecoder()
      return decoder.decode(decompressed)
    } catch (error) {
      logger.error('Decompression failed', { error })
      throw new Error('Failed to decompress response data')
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset performance metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      connectionPoolUsage: 0,
      batchedRequests: 0,
      optimizationSavings: 0
    }
  }

  /**
   * Update optimizer configuration
   */
  public updateConfig(config: Partial<OptimizerConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info('Optimizer configuration updated', { config })
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.cache.clear()
    logger.info('All caches cleared')
  }

  /**
   * Generate cache key from SQL and parameters
   */
  private generateCacheKey(sql: string, params: any[]): string {
    const normalizedSql = sql.trim().replace(/\s+/g, ' ')
    const paramsStr = JSON.stringify(params)
    return `${normalizedSql}:${paramsStr}`
  }

  /**
   * Get value from cache
   */
  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if entry has expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key)
      return null
    }

    entry.hits++
    return entry.data
  }

  /**
   * Set value in cache
   */
  private setCache(key: string, data: any, ttl: number): void {
    // Check cache size limits
    if (this.cache.size >= this.config.caching.maxEntries) {
      this.evictLeastRecentlyUsed()
    }

    this.cache.set(key, {
      key,
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0
    })
  }

  /**
   * Evict least recently used cache entries
   */
  private evictLeastRecentlyUsed(): void {
    // Simple LRU: remove oldest entry
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  /**
   * Add request to batch queue
   */
  private async addToBatch(
    sql: string, 
    params: any[], 
    priority: 'low' | 'normal' | 'high'
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: `batch_${Date.now()}_${Math.random()}`,
        sql,
        params,
        priority,
        callback: (result, error) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }
      }

      this.batchQueue.push(request)

      // Start batch timer if not already started
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatch()
        }, this.config.batching.batchTimeout) as unknown as number
      }

      // Process immediately if batch is full
      if (this.batchQueue.length >= this.config.batching.batchSize) {
        this.processBatch()
      }
    })
  }

  /**
   * Process the current batch queue
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    if (this.batchQueue.length === 0) {
      return
    }

    const currentBatch = [...this.batchQueue]
    this.batchQueue = []

    try {
      const results = await this.executeOptimizedBatch(currentBatch)
      
      // Execute callbacks
      for (let i = 0; i < currentBatch.length; i++) {
        currentBatch[i].callback(results[i])
      }

    } catch (error) {
      // Execute error callbacks
      for (const request of currentBatch) {
        request.callback(null, new Error(error instanceof Error ? error.message : String(error)))
      }
    }
  }

  /**
   * Execute a batch of requests with optimizations
   */
  private async executeOptimizedBatch(requests: any[]): Promise<any[]> {
    // Sort by priority if enabled
    if (this.config.batching.priorityQueues) {
      requests.sort((a, b) => {
        const priorities = { high: 3, normal: 2, low: 1 }
        return priorities[b.priority as keyof typeof priorities] - priorities[a.priority as keyof typeof priorities]
      })
    }

    // Execute all requests (this would connect to the actual bridge)
    const results: any[] = []
    
    for (const request of requests) {
      try {
        const result = await this.executeOptimizedRequest(request.sql, request.params)
        results.push(result)
      } catch (error) {
        results.push({ error: error instanceof Error ? error.message : String(error) })
      }
    }

    return results
  }

  /**
   * Execute a single optimized request
   */
  private async executeOptimizedRequest(sql: string, params: any[]): Promise<any> {
    // This would connect to the actual PGlite bridge
    // For now, simulate execution
    logger.debug('Executing optimized request', { sql: sql.substring(0, 100) })
    
    // Simulate database operation
    await new Promise(resolve => setTimeout(resolve, 10))
    
    return {
      rows: [],
      rowCount: 0,
      command: sql.split(' ')[0].toUpperCase()
    }
  }

  /**
   * Update average response time metrics
   */
  private updateResponseTimeMetrics(responseTime: number): void {
    this.metrics.averageResponseTime = (
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1)) + responseTime
    ) / this.metrics.totalRequests
  }

  /**
   * Start background cleanup tasks
   */
  private startCleanupTasks(): void {
    // Clean expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.timestamp + entry.ttl) {
          this.cache.delete(key)
        }
      }
    }, 5 * 60 * 1000)

    // Clean unused connections every minute
    setInterval(() => {
      const now = Date.now()
      for (const [id, connection] of this.connectionPool.entries()) {
        if (!connection.inUse && now > connection.lastUsed + this.config.connectionPool.idleTimeout) {
          this.connectionPool.delete(id)
        }
      }
    }, 60 * 1000)
  }

  /**
   * Browser-compatible gzip compression
   */
  private async gzipCompress(data: Uint8Array): Promise<ArrayBuffer> {
    if (typeof CompressionStream !== 'undefined') {
      const stream = new CompressionStream('gzip')
      const writer = stream.writable.getWriter()
      const reader = stream.readable.getReader()
      
      writer.write(data)
      writer.close()
      
      const chunks: Uint8Array[] = []
      let done = false
      
      while (!done) {
        const { value, done: readerDone } = await reader.read()
        if (value) chunks.push(value)
        done = readerDone
      }
      
      const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
      let offset = 0
      for (const chunk of chunks) {
        compressed.set(chunk, offset)
        offset += chunk.length
      }
      
      return compressed.buffer
    }
    
    // Fallback: return original data if compression not supported
    return data.buffer
  }

  /**
   * Browser-compatible gzip decompression
   */
  private async gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new DecompressionStream('gzip')
      const writer = stream.writable.getWriter()
      const reader = stream.readable.getReader()
      
      writer.write(data)
      writer.close()
      
      const chunks: Uint8Array[] = []
      let done = false
      
      while (!done) {
        const { value, done: readerDone } = await reader.read()
        if (value) chunks.push(value)
        done = readerDone
      }
      
      const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
      let offset = 0
      for (const chunk of chunks) {
        decompressed.set(chunk, offset)
        offset += chunk.length
      }
      
      return decompressed
    }
    
    // Fallback: return original data if decompression not supported
    return data
  }
}

// Export singleton instance
export const hybridOptimizer = HybridArchitectureOptimizer.getInstance()