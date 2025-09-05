import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PerformanceMonitor } from '../PerformanceMonitor'

// Mock performance APIs
const mockPerformance = vi.hoisted(() => ({
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByType: vi.fn(() => []),
  getEntriesByName: vi.fn(),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn()
}))

// Mock navigator APIs
const mockNavigator = vi.hoisted(() => ({
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false
  },
  deviceMemory: 8,
  hardwareConcurrency: 8
}))

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
})

Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true
})

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor

  beforeEach(() => {
    vi.clearAllMocks()
    performanceMonitor = PerformanceMonitor.getInstance()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PerformanceMonitor.getInstance()
      const instance2 = PerformanceMonitor.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Metric Collection', () => {
    it('should start timing operations', () => {
      performanceMonitor.startTiming('database-query')
      
      expect(mockPerformance.mark).toHaveBeenCalledWith('database-query-start')
    })

    it('should end timing operations and calculate duration', () => {
      mockPerformance.getEntriesByName.mockReturnValue([
        { startTime: 1000, duration: 250 } as any
      ])

      performanceMonitor.startTiming('database-query')
      const duration = performanceMonitor.endTiming('database-query')
      
      expect(mockPerformance.mark).toHaveBeenCalledWith('database-query-end')
      expect(mockPerformance.measure).toHaveBeenCalledWith(
        'database-query',
        'database-query-start',
        'database-query-end'
      )
      expect(duration).toBeGreaterThan(0)
    })

    it('should handle timing operations that were never started', () => {
      const duration = performanceMonitor.endTiming('never-started')
      
      expect(duration).toBe(0)
    })

    it('should record custom metrics', () => {
      performanceMonitor.recordMetric('cache-hit-rate', 0.85, 'percentage')
      
      const metrics = performanceMonitor.getMetrics()
      expect(metrics).toHaveProperty('cache-hit-rate')
      expect(metrics['cache-hit-rate']).toEqual({
        value: 0.85,
        unit: 'percentage',
        timestamp: expect.any(Number)
      })
    })

    it('should track multiple measurements of the same metric', () => {
      performanceMonitor.recordMetric('response-time', 150, 'ms')
      performanceMonitor.recordMetric('response-time', 200, 'ms')
      performanceMonitor.recordMetric('response-time', 120, 'ms')
      
      const history = performanceMonitor.getMetricHistory('response-time')
      expect(history).toHaveLength(3)
      expect(history.map(m => m.value)).toEqual([150, 200, 120])
    })
  })

  describe('System Performance Monitoring', () => {
    it('should collect system performance data', () => {
      const systemMetrics = performanceMonitor.getSystemMetrics()
      
      expect(systemMetrics).toHaveProperty('connection')
      expect(systemMetrics.connection).toEqual({
        effectiveType: '4g',
        downlink: 10,
        rtt: 100,
        saveData: false
      })
      expect(systemMetrics).toHaveProperty('deviceMemory', 8)
      expect(systemMetrics).toHaveProperty('hardwareConcurrency', 8)
    })

    it('should handle missing system APIs gracefully', () => {
      // Mock missing APIs
      Object.defineProperty(global, 'navigator', {
        value: { connection: null },
        writable: true
      })

      const systemMetrics = performanceMonitor.getSystemMetrics()
      
      expect(systemMetrics.connection).toBe(null)
      expect(systemMetrics.deviceMemory).toBeUndefined()
    })

    it('should track memory usage when available', () => {
      // Mock memory API
      Object.defineProperty(global.performance, 'memory', {
        value: {
          usedJSHeapSize: 10000000,
          totalJSHeapSize: 20000000,
          jsHeapSizeLimit: 100000000
        },
        writable: true
      })

      const memoryMetrics = performanceMonitor.getMemoryMetrics()
      
      expect(memoryMetrics).toEqual({
        usedJSHeapSize: 10000000,
        totalJSHeapSize: 20000000,
        jsHeapSizeLimit: 100000000,
        usagePercentage: 50 // 10MB / 20MB * 100
      })
    })
  })

  describe('Cache Performance Tracking', () => {
    it('should track cache hit rates', () => {
      performanceMonitor.recordCacheHit('database-queries')
      performanceMonitor.recordCacheHit('database-queries')
      performanceMonitor.recordCacheMiss('database-queries')
      
      const hitRate = performanceMonitor.getCacheHitRate('database-queries')
      expect(hitRate).toBeCloseTo(0.67, 2) // 2/3 = 0.67
    })

    it('should track cache performance for different cache types', () => {
      performanceMonitor.recordCacheHit('service-worker')
      performanceMonitor.recordCacheMiss('service-worker')
      performanceMonitor.recordCacheHit('indexeddb')
      
      const swHitRate = performanceMonitor.getCacheHitRate('service-worker')
      const idbHitRate = performanceMonitor.getCacheHitRate('indexeddb')
      
      expect(swHitRate).toBe(0.5)
      expect(idbHitRate).toBe(1.0)
    })

    it('should return 0 hit rate for unknown cache types', () => {
      const hitRate = performanceMonitor.getCacheHitRate('unknown-cache')
      expect(hitRate).toBe(0)
    })

    it('should provide cache performance summary', () => {
      performanceMonitor.recordCacheHit('test-cache')
      performanceMonitor.recordCacheMiss('test-cache')
      
      const summary = performanceMonitor.getCachePerformanceSummary()
      expect(summary).toHaveProperty('test-cache')
      expect(summary['test-cache']).toEqual({
        hits: 1,
        misses: 1,
        total: 2,
        hitRate: 0.5
      })
    })
  })

  describe('Performance Optimization Tracking', () => {
    it('should track optimization impact', () => {
      const beforeMetrics = { responseTime: 500 }
      const afterMetrics = { responseTime: 300 }
      
      performanceMonitor.recordOptimization(
        'lazy-loading-implementation',
        beforeMetrics,
        afterMetrics
      )
      
      const optimizations = performanceMonitor.getOptimizations()
      expect(optimizations).toHaveLength(1)
      expect(optimizations[0]).toMatchObject({
        name: 'lazy-loading-implementation',
        improvement: {
          responseTime: -200 // 300 - 500 = -200 (improvement)
        }
      })
    })

    it('should calculate percentage improvements', () => {
      const beforeMetrics = { loadTime: 1000, cacheSize: 100 }
      const afterMetrics = { loadTime: 800, cacheSize: 80 }
      
      performanceMonitor.recordOptimization(
        'cache-optimization',
        beforeMetrics,
        afterMetrics
      )
      
      const optimizations = performanceMonitor.getOptimizations()
      const optimization = optimizations[0]
      
      expect(optimization.improvementPercentage).toEqual({
        loadTime: 20, // (1000 - 800) / 1000 * 100 = 20%
        cacheSize: 20 // (100 - 80) / 100 * 100 = 20%
      })
    })

    it('should track optimization effectiveness over time', () => {
      performanceMonitor.recordOptimization('opt1', { time: 100 }, { time: 90 })
      performanceMonitor.recordOptimization('opt2', { time: 200 }, { time: 150 })
      
      const effectiveness = performanceMonitor.getOptimizationEffectiveness()
      expect(effectiveness.totalOptimizations).toBe(2)
      expect(effectiveness.averageImprovement.time).toBe(-35) // (-10 + -50) / 2
    })
  })

  describe('Performance Alerts', () => {
    it('should generate alerts for performance thresholds', () => {
      performanceMonitor.setPerformanceThreshold('response-time', 500) // 500ms threshold
      
      // This should trigger an alert
      performanceMonitor.recordMetric('response-time', 750, 'ms')
      
      const alerts = performanceMonitor.getPerformanceAlerts()
      expect(alerts).toHaveLength(1)
      expect(alerts[0]).toMatchObject({
        metric: 'response-time',
        value: 750,
        threshold: 500,
        severity: 'warning'
      })
    })

    it('should generate critical alerts for severe performance issues', () => {
      performanceMonitor.setPerformanceThreshold('memory-usage', 80, 'critical') // 80% critical threshold
      
      performanceMonitor.recordMetric('memory-usage', 95, 'percentage')
      
      const alerts = performanceMonitor.getPerformanceAlerts()
      expect(alerts[0].severity).toBe('critical')
    })

    it('should clear resolved alerts', () => {
      performanceMonitor.setPerformanceThreshold('response-time', 500)
      performanceMonitor.recordMetric('response-time', 750, 'ms') // Triggers alert
      
      expect(performanceMonitor.getPerformanceAlerts()).toHaveLength(1)
      
      performanceMonitor.recordMetric('response-time', 300, 'ms') // Below threshold
      performanceMonitor.clearResolvedAlerts()
      
      expect(performanceMonitor.getPerformanceAlerts()).toHaveLength(0)
    })
  })

  describe('Performance Reports', () => {
    it('should generate performance summary report', () => {
      performanceMonitor.recordMetric('load-time', 1000, 'ms')
      performanceMonitor.recordMetric('load-time', 1200, 'ms')
      performanceMonitor.recordCacheHit('assets')
      performanceMonitor.recordCacheMiss('assets')
      
      const report = performanceMonitor.generatePerformanceReport()
      
      expect(report).toHaveProperty('period')
      expect(report).toHaveProperty('metrics')
      expect(report).toHaveProperty('cachePerformance')
      expect(report).toHaveProperty('systemMetrics')
      expect(report).toHaveProperty('alerts')
      expect(report.metrics['load-time']).toEqual({
        average: 1100,
        min: 1000,
        max: 1200,
        count: 2
      })
    })

    it('should generate performance report for specific time period', () => {
      const oneHourAgo = Date.now() - (60 * 60 * 1000)
      
      const report = performanceMonitor.generatePerformanceReport(oneHourAgo)
      
      expect(report.period.start).toBe(oneHourAgo)
      expect(report.period.end).toBeCloseTo(Date.now(), -3) // Within 1000ms
    })

    it('should export performance data as JSON', () => {
      performanceMonitor.recordMetric('test-metric', 123, 'units')
      
      const exportData = performanceMonitor.exportPerformanceData()
      
      expect(typeof exportData).toBe('string')
      const parsed = JSON.parse(exportData)
      expect(parsed).toHaveProperty('metrics')
      expect(parsed).toHaveProperty('cacheStats')
      expect(parsed).toHaveProperty('systemInfo')
      expect(parsed).toHaveProperty('exportedAt')
    })
  })

  describe('Performance Data Cleanup', () => {
    it('should clean up old performance data', () => {
      // Record old metric
      const oldTimestamp = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days ago
      performanceMonitor.recordMetric('old-metric', 100, 'ms')
      
      // Manually set old timestamp
      const metrics = performanceMonitor.getMetrics()
      if (metrics['old-metric']) {
        metrics['old-metric'].timestamp = oldTimestamp
      }
      
      // Clean up data older than 5 days
      const cleanedCount = performanceMonitor.cleanupOldData(5 * 24 * 60 * 60 * 1000)
      
      expect(cleanedCount).toBeGreaterThan(0)
    })

    it('should preserve recent performance data during cleanup', () => {
      performanceMonitor.recordMetric('recent-metric', 200, 'ms')
      
      const beforeCleanup = Object.keys(performanceMonitor.getMetrics()).length
      performanceMonitor.cleanupOldData(1000) // 1 second retention
      const afterCleanup = Object.keys(performanceMonitor.getMetrics()).length
      
      expect(afterCleanup).toBe(beforeCleanup) // Recent data preserved
    })
  })

  describe('Integration with Performance Observer', () => {
    it('should use Performance Observer when available', () => {
      const mockObserver = vi.fn()
      Object.defineProperty(global, 'PerformanceObserver', {
        value: mockObserver,
        writable: true
      })

      performanceMonitor.enablePerformanceObserver(['measure', 'navigation'])
      
      expect(mockObserver).toHaveBeenCalled()
    })

    it('should handle Performance Observer not being available', () => {
      Object.defineProperty(global, 'PerformanceObserver', {
        value: undefined,
        writable: true
      })

      expect(() => {
        performanceMonitor.enablePerformanceObserver(['measure'])
      }).not.toThrow()
    })
  })

  describe('Real-time Performance Monitoring', () => {
    it('should provide real-time performance metrics', () => {
      performanceMonitor.startRealTimeMonitoring()
      
      // Record some metrics
      performanceMonitor.recordMetric('cpu-usage', 45, 'percentage')
      performanceMonitor.recordMetric('memory-usage', 60, 'percentage')
      
      const realtimeMetrics = performanceMonitor.getRealTimeMetrics()
      expect(realtimeMetrics).toHaveProperty('timestamp')
      expect(realtimeMetrics).toHaveProperty('metrics')
      expect(realtimeMetrics.metrics).toHaveProperty('cpu-usage', 45)
      expect(realtimeMetrics.metrics).toHaveProperty('memory-usage', 60)
    })

    it('should stop real-time monitoring', () => {
      performanceMonitor.startRealTimeMonitoring()
      const isMonitoring1 = performanceMonitor.isRealTimeMonitoring()
      
      performanceMonitor.stopRealTimeMonitoring()
      const isMonitoring2 = performanceMonitor.isRealTimeMonitoring()
      
      expect(isMonitoring1).toBe(true)
      expect(isMonitoring2).toBe(false)
    })
  })
})