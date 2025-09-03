/**
 * Performance Monitor for Optimization Tracking
 * Tracks performance metrics, cache effectiveness, and system resource usage
 */

interface PerformanceMetric {
  value: number
  unit: string
  timestamp: number
}

interface CacheStats {
  hits: number
  misses: number
  total: number
  hitRate: number
}

interface OptimizationRecord {
  name: string
  timestamp: number
  before: Record<string, number>
  after: Record<string, number>
  improvement: Record<string, number>
  improvementPercentage: Record<string, number>
}

interface PerformanceAlert {
  metric: string
  value: number
  threshold: number
  severity: 'warning' | 'critical'
  timestamp: number
}

interface PerformanceThreshold {
  value: number
  severity: 'warning' | 'critical'
}

interface SystemMetrics {
  connection: any
  deviceMemory?: number
  hardwareConcurrency?: number
}

interface MemoryMetrics {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  usagePercentage: number
}

interface PerformanceReport {
  period: {
    start: number
    end: number
  }
  metrics: Record<string, {
    average: number
    min: number
    max: number
    count: number
  }>
  cachePerformance: Record<string, CacheStats>
  systemMetrics: SystemMetrics
  alerts: PerformanceAlert[]
}

interface RealTimeMetrics {
  timestamp: number
  metrics: Record<string, number>
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Record<string, PerformanceMetric> = {}
  private metricHistory: Record<string, PerformanceMetric[]> = {}
  private cacheStats: Record<string, { hits: number; misses: number }> = {}
  private optimizations: OptimizationRecord[] = []
  private thresholds: Record<string, PerformanceThreshold> = {}
  private alerts: PerformanceAlert[] = []
  private activeTimings: Record<string, number> = {}
  private isMonitoringRealTime = false
  private performanceObserver?: PerformanceObserver

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  // Timing Operations
  startTiming(operation: string): void {
    const markName = `${operation}-start`
    performance.mark(markName)
    this.activeTimings[operation] = performance.now()
  }

  endTiming(operation: string): number {
    if (!(operation in this.activeTimings)) {
      return 0
    }

    const startTime = this.activeTimings[operation]
    const endTime = performance.now()
    const duration = endTime - startTime

    const startMark = `${operation}-start`
    const endMark = `${operation}-end`
    
    performance.mark(endMark)
    performance.measure(operation, startMark, endMark)

    this.recordMetric(`${operation}-duration`, duration, 'ms')
    delete this.activeTimings[operation]

    return duration
  }

  // Metric Recording
  recordMetric(name: string, value: number, unit: string = 'units'): void {
    const metric: PerformanceMetric = {
      value,
      unit,
      timestamp: Date.now()
    }

    this.metrics[name] = metric

    // Store in history
    if (!this.metricHistory[name]) {
      this.metricHistory[name] = []
    }
    this.metricHistory[name].push(metric)

    // Keep only last 100 entries per metric
    if (this.metricHistory[name].length > 100) {
      this.metricHistory[name] = this.metricHistory[name].slice(-100)
    }

    // Check thresholds
    this.checkThresholds(name, value)
  }

  getMetrics(): Record<string, PerformanceMetric> {
    return { ...this.metrics }
  }

  getMetricHistory(name: string): PerformanceMetric[] {
    return [...(this.metricHistory[name] || [])]
  }

  // System Performance
  getSystemMetrics(): SystemMetrics {
    const nav = navigator as any
    
    return {
      connection: nav.connection || null,
      deviceMemory: nav.deviceMemory,
      hardwareConcurrency: nav.hardwareConcurrency
    }
  }

  getMemoryMetrics(): MemoryMetrics | null {
    const perfMemory = (performance as any).memory
    if (!perfMemory) return null

    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = perfMemory
    
    return {
      usedJSHeapSize,
      totalJSHeapSize,
      jsHeapSizeLimit,
      usagePercentage: (usedJSHeapSize / totalJSHeapSize) * 100
    }
  }

  // Cache Performance
  recordCacheHit(cacheType: string): void {
    if (!this.cacheStats[cacheType]) {
      this.cacheStats[cacheType] = { hits: 0, misses: 0 }
    }
    this.cacheStats[cacheType].hits++
  }

  recordCacheMiss(cacheType: string): void {
    if (!this.cacheStats[cacheType]) {
      this.cacheStats[cacheType] = { hits: 0, misses: 0 }
    }
    this.cacheStats[cacheType].misses++
  }

  getCacheHitRate(cacheType: string): number {
    const stats = this.cacheStats[cacheType]
    if (!stats) return 0

    const total = stats.hits + stats.misses
    return total === 0 ? 0 : stats.hits / total
  }

  getCachePerformanceSummary(): Record<string, CacheStats> {
    const summary: Record<string, CacheStats> = {}

    for (const [cacheType, stats] of Object.entries(this.cacheStats)) {
      const total = stats.hits + stats.misses
      summary[cacheType] = {
        hits: stats.hits,
        misses: stats.misses,
        total,
        hitRate: total === 0 ? 0 : stats.hits / total
      }
    }

    return summary
  }

  // Optimization Tracking
  recordOptimization(
    name: string,
    beforeMetrics: Record<string, number>,
    afterMetrics: Record<string, number>
  ): void {
    const improvement: Record<string, number> = {}
    const improvementPercentage: Record<string, number> = {}

    for (const [metric, afterValue] of Object.entries(afterMetrics)) {
      const beforeValue = beforeMetrics[metric]
      if (beforeValue !== undefined) {
        improvement[metric] = afterValue - beforeValue
        improvementPercentage[metric] = ((beforeValue - afterValue) / beforeValue) * 100
      }
    }

    this.optimizations.push({
      name,
      timestamp: Date.now(),
      before: beforeMetrics,
      after: afterMetrics,
      improvement,
      improvementPercentage
    })
  }

  getOptimizations(): OptimizationRecord[] {
    return [...this.optimizations]
  }

  getOptimizationEffectiveness(): {
    totalOptimizations: number
    averageImprovement: Record<string, number>
  } {
    if (this.optimizations.length === 0) {
      return { totalOptimizations: 0, averageImprovement: {} }
    }

    const totalImprovements: Record<string, number> = {}
    const counts: Record<string, number> = {}

    for (const optimization of this.optimizations) {
      for (const [metric, improvement] of Object.entries(optimization.improvement)) {
        if (!totalImprovements[metric]) {
          totalImprovements[metric] = 0
          counts[metric] = 0
        }
        totalImprovements[metric] += improvement
        counts[metric]++
      }
    }

    const averageImprovement: Record<string, number> = {}
    for (const [metric, total] of Object.entries(totalImprovements)) {
      averageImprovement[metric] = total / counts[metric]
    }

    return {
      totalOptimizations: this.optimizations.length,
      averageImprovement
    }
  }

  // Performance Alerts
  setPerformanceThreshold(
    metric: string,
    threshold: number,
    severity: 'warning' | 'critical' = 'warning'
  ): void {
    this.thresholds[metric] = { value: threshold, severity }
  }

  private checkThresholds(metric: string, value: number): void {
    const threshold = this.thresholds[metric]
    if (!threshold) return

    if (value > threshold.value) {
      this.alerts.push({
        metric,
        value,
        threshold: threshold.value,
        severity: threshold.severity,
        timestamp: Date.now()
      })
    }
  }

  getPerformanceAlerts(): PerformanceAlert[] {
    return [...this.alerts]
  }

  clearResolvedAlerts(): void {
    this.alerts = this.alerts.filter(alert => {
      const currentMetric = this.metrics[alert.metric]
      return currentMetric && currentMetric.value > alert.threshold
    })
  }

  // Performance Reports
  generatePerformanceReport(startTime?: number): PerformanceReport {
    const start = startTime || Date.now() - (60 * 60 * 1000) // Default: last hour
    const end = Date.now()

    const metricsInPeriod = this.getMetricsInPeriod(start, end)
    const metricsSummary: Record<string, { average: number; min: number; max: number; count: number }> = {}

    for (const [name, values] of Object.entries(metricsInPeriod)) {
      if (values.length === 0) continue

      const nums = values.map(v => v.value)
      metricsSummary[name] = {
        average: nums.reduce((a, b) => a + b, 0) / nums.length,
        min: Math.min(...nums),
        max: Math.max(...nums),
        count: nums.length
      }
    }

    return {
      period: { start, end },
      metrics: metricsSummary,
      cachePerformance: this.getCachePerformanceSummary(),
      systemMetrics: this.getSystemMetrics(),
      alerts: this.alerts.filter(alert => alert.timestamp >= start)
    }
  }

  private getMetricsInPeriod(start: number, end: number): Record<string, PerformanceMetric[]> {
    const result: Record<string, PerformanceMetric[]> = {}

    for (const [name, history] of Object.entries(this.metricHistory)) {
      result[name] = history.filter(metric => 
        metric.timestamp >= start && metric.timestamp <= end
      )
    }

    return result
  }

  exportPerformanceData(): string {
    const exportData = {
      timestamp: Date.now(),
      exportedAt: new Date().toISOString(),
      metrics: this.metrics,
      metricHistory: this.metricHistory,
      cacheStats: this.getCachePerformanceSummary(),
      optimizations: this.optimizations,
      systemInfo: this.getSystemMetrics(),
      alerts: this.alerts
    }

    return JSON.stringify(exportData, null, 2)
  }

  // Data Cleanup
  cleanupOldData(maxAge: number): number {
    const cutoff = Date.now() - maxAge
    let cleanedCount = 0

    // Clean metrics
    for (const [name, metric] of Object.entries(this.metrics)) {
      if (metric.timestamp < cutoff) {
        delete this.metrics[name]
        cleanedCount++
      }
    }

    // Clean history
    for (const [name, history] of Object.entries(this.metricHistory)) {
      const originalLength = history.length
      this.metricHistory[name] = history.filter(metric => metric.timestamp >= cutoff)
      cleanedCount += originalLength - this.metricHistory[name].length
    }

    // Clean alerts
    const originalAlerts = this.alerts.length
    this.alerts = this.alerts.filter(alert => alert.timestamp >= cutoff)
    cleanedCount += originalAlerts - this.alerts.length

    // Clean optimizations
    const originalOptimizations = this.optimizations.length
    this.optimizations = this.optimizations.filter(opt => opt.timestamp >= cutoff)
    cleanedCount += originalOptimizations - this.optimizations.length

    return cleanedCount
  }

  // Performance Observer Integration
  enablePerformanceObserver(entryTypes: string[]): void {
    if (typeof PerformanceObserver === 'undefined') {
      return // Not supported
    }

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric(
            `observer-${entry.name}`,
            entry.duration || entry.startTime,
            'ms'
          )
        }
      })

      this.performanceObserver.observe({ entryTypes })
    } catch (error) {
      console.warn('Failed to enable Performance Observer:', error)
    }
  }

  // Real-time Monitoring
  startRealTimeMonitoring(): void {
    this.isMonitoringRealTime = true
  }

  stopRealTimeMonitoring(): void {
    this.isMonitoringRealTime = false
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
    }
  }

  isRealTimeMonitoring(): boolean {
    return this.isMonitoringRealTime
  }

  getRealTimeMetrics(): RealTimeMetrics {
    const currentMetrics: Record<string, number> = {}
    
    for (const [name, metric] of Object.entries(this.metrics)) {
      currentMetrics[name] = metric.value
    }

    return {
      timestamp: Date.now(),
      metrics: currentMetrics
    }
  }
}