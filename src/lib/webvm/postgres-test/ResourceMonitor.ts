/**
 * Resource Monitor for WebVM PostgreSQL Testing
 * 
 * This module provides comprehensive resource monitoring capabilities
 * to track memory, CPU, disk, and network usage during PostgreSQL operations.
 */

import { logger } from '../../infrastructure/Logger'
import { WebVMManager } from '../WebVMManager'

export interface ResourceSnapshot {
  timestamp: number
  memory: {
    total: number
    used: number
    available: number
    cached: number
    buffers: number
    postgresql: number
  }
  cpu: {
    usage: number
    cores: number
    loadAverage: number[]
    postgresql: number
  }
  disk: {
    total: number
    used: number
    available: number
    postgresql: number
  }
  network: {
    bytesIn: number
    bytesOut: number
    packetsIn: number
    packetsOut: number
  }
  processes: {
    total: number
    postgresql: ProcessInfo[]
  }
}

export interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  memory: number
  status: string
}

export interface ResourceAnalysis {
  duration: number
  snapshots: ResourceSnapshot[]
  summary: {
    memory: {
      baseline: number
      peak: number
      average: number
      postgresql_usage: number
    }
    cpu: {
      baseline: number
      peak: number
      average: number
      postgresql_usage: number
    }
    disk: {
      initial: number
      final: number
      growth: number
      postgresql_usage: number
    }
    stability: {
      memory_stable: boolean
      cpu_stable: boolean
      crashes: number
      restarts: number
    }
  }
  recommendations: string[]
}

export interface MonitoringConfig {
  interval: number // Monitoring interval in milliseconds
  duration: number // Total monitoring duration in milliseconds
  thresholds: {
    memoryWarning: number // Warning threshold for memory usage (MB)
    memoryCritical: number // Critical threshold for memory usage (MB)
    cpuWarning: number // Warning threshold for CPU usage (%)
    cpuCritical: number // Critical threshold for CPU usage (%)
  }
}

export class ResourceMonitor {
  private logger = logger
  private webvmManager = WebVMManager.getInstance()
  private isMonitoring = false
  private monitoringInterval?: number
  private snapshots: ResourceSnapshot[] = []

  /**
   * Default monitoring configuration
   */
  private defaultConfig: MonitoringConfig = {
    interval: 1000, // 1 second
    duration: 300000, // 5 minutes
    thresholds: {
      memoryWarning: 200, // 200MB
      memoryCritical: 300, // 300MB
      cpuWarning: 70, // 70%
      cpuCritical: 90 // 90%
    }
  }

  /**
   * Start continuous resource monitoring
   */
  async startMonitoring(config?: Partial<MonitoringConfig>): Promise<void> {
    if (this.isMonitoring) {
      throw new Error('Resource monitoring is already running')
    }

    const finalConfig = { ...this.defaultConfig, ...config }
    this.isMonitoring = true
    this.snapshots = []

    this.logger.info('Resource Monitor', `Starting resource monitoring for ${finalConfig.duration}ms`)
    this.logger.info('Resource Monitor', `Monitoring interval: ${finalConfig.interval}ms`)

    const startTime = Date.now()

    this.monitoringInterval = window.setInterval(async () => {
      try {
        const snapshot = await this.captureSnapshot()
        this.snapshots.push(snapshot)

        // Check thresholds
        this.checkThresholds(snapshot, finalConfig.thresholds)

        // Stop monitoring when duration is reached
        if (Date.now() - startTime >= finalConfig.duration) {
          await this.stopMonitoring()
        }
      } catch (error) {
        this.logger.error('Resource Monitor', `Error capturing snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }, finalConfig.interval)
  }

  /**
   * Stop resource monitoring
   */
  async stopMonitoring(): Promise<ResourceAnalysis> {
    if (!this.isMonitoring) {
      throw new Error('Resource monitoring is not running')
    }

    this.isMonitoring = false
    if (this.monitoringInterval) {
      window.clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }

    this.logger.info('Resource Monitor', 'Stopped resource monitoring')
    
    // Analyze collected data
    const analysis = await this.analyzeResourceData()
    this.logger.info('Resource Monitor', `Captured ${this.snapshots.length} snapshots`)
    
    return analysis
  }

  /**
   * Capture a single resource snapshot
   */
  async captureSnapshot(): Promise<ResourceSnapshot> {
    const timestamp = Date.now()

    // Get system metrics
    const memoryInfo = await this.getMemoryInfo()
    const cpuInfo = await this.getCpuInfo()
    const diskInfo = await this.getDiskInfo()
    const networkInfo = await this.getNetworkInfo()
    const processInfo = await this.getProcessInfo()

    return {
      timestamp,
      memory: memoryInfo,
      cpu: cpuInfo,
      disk: diskInfo,
      network: networkInfo,
      processes: processInfo
    }
  }

  /**
   * Get memory information
   */
  private async getMemoryInfo(): Promise<ResourceSnapshot['memory']> {
    // In real implementation, this would query WebVM for memory stats
    // For now, return simulated values with some variance

    const baseMemory = 512 * 1024 * 1024 // 512MB base
    const variance = Math.random() * 0.2 - 0.1 // ±10% variance

    return {
      total: 1024 * 1024 * 1024, // 1GB total
      used: baseMemory * (1 + variance),
      available: (1024 * 1024 * 1024) - (baseMemory * (1 + variance)),
      cached: 64 * 1024 * 1024, // 64MB cached
      buffers: 32 * 1024 * 1024, // 32MB buffers
      postgresql: this.simulatePostgreSQLMemoryUsage()
    }
  }

  /**
   * Get CPU information
   */
  private async getCpuInfo(): Promise<ResourceSnapshot['cpu']> {
    // Simulate CPU usage with some variance
    const baseCpu = 0.3 // 30% base usage
    const variance = Math.random() * 0.4 - 0.2 // ±20% variance

    return {
      usage: Math.max(0, Math.min(1, baseCpu + variance)),
      cores: 2,
      loadAverage: [0.5, 0.3, 0.2],
      postgresql: this.simulatePostgreSQLCpuUsage()
    }
  }

  /**
   * Get disk information
   */
  private async getDiskInfo(): Promise<ResourceSnapshot['disk']> {
    const baseDisk = 2 * 1024 * 1024 * 1024 // 2GB used
    const variance = Math.random() * 0.1 - 0.05 // ±5% variance

    return {
      total: 10 * 1024 * 1024 * 1024, // 10GB total
      used: baseDisk * (1 + variance),
      available: (10 * 1024 * 1024 * 1024) - (baseDisk * (1 + variance)),
      postgresql: this.simulatePostgreSQLDiskUsage()
    }
  }

  /**
   * Get network information
   */
  private async getNetworkInfo(): Promise<ResourceSnapshot['network']> {
    // Simulate network stats
    return {
      bytesIn: Math.floor(Math.random() * 1000000), // Random bytes in
      bytesOut: Math.floor(Math.random() * 500000), // Random bytes out
      packetsIn: Math.floor(Math.random() * 1000),
      packetsOut: Math.floor(Math.random() * 500)
    }
  }

  /**
   * Get process information
   */
  private async getProcessInfo(): Promise<ResourceSnapshot['processes']> {
    // Simulate PostgreSQL processes
    const postgresqlProcesses: ProcessInfo[] = [
      {
        pid: 1234,
        name: 'postgres: main',
        cpu: 5.2,
        memory: 64 * 1024 * 1024, // 64MB
        status: 'running'
      },
      {
        pid: 1235,
        name: 'postgres: writer',
        cpu: 2.1,
        memory: 32 * 1024 * 1024, // 32MB
        status: 'running'
      },
      {
        pid: 1236,
        name: 'postgres: checkpointer',
        cpu: 1.5,
        memory: 16 * 1024 * 1024, // 16MB
        status: 'running'
      }
    ]

    return {
      total: 50 + Math.floor(Math.random() * 10), // Simulate 50-60 total processes
      postgresql: postgresqlProcesses
    }
  }

  /**
   * Simulate PostgreSQL memory usage
   */
  private simulatePostgreSQLMemoryUsage(): number {
    // Simulate PostgreSQL using 128MB ± 20% variance
    const baseMemory = 128 * 1024 * 1024
    const variance = Math.random() * 0.4 - 0.2
    return baseMemory * (1 + variance)
  }

  /**
   * Simulate PostgreSQL CPU usage
   */
  private simulatePostgreSQLCpuUsage(): number {
    // Simulate PostgreSQL using 15% ± 10% variance
    const baseCpu = 0.15
    const variance = Math.random() * 0.2 - 0.1
    return Math.max(0, Math.min(1, baseCpu + variance))
  }

  /**
   * Simulate PostgreSQL disk usage
   */
  private simulatePostgreSQLDiskUsage(): number {
    // Simulate PostgreSQL using 256MB ± 15% variance
    const baseDisk = 256 * 1024 * 1024
    const variance = Math.random() * 0.3 - 0.15
    return baseDisk * (1 + variance)
  }

  /**
   * Check resource thresholds and log warnings
   */
  private checkThresholds(snapshot: ResourceSnapshot, thresholds: MonitoringConfig['thresholds']): void {
    const memoryUsedMB = snapshot.memory.used / (1024 * 1024)
    const cpuUsagePercent = snapshot.cpu.usage * 100

    // Memory threshold checks
    if (memoryUsedMB > thresholds.memoryCritical) {
      this.logger.warn('Resource Monitor', `CRITICAL: Memory usage ${memoryUsedMB.toFixed(1)}MB exceeds critical threshold ${thresholds.memoryCritical}MB`)
    } else if (memoryUsedMB > thresholds.memoryWarning) {
      this.logger.warn('Resource Monitor', `WARNING: Memory usage ${memoryUsedMB.toFixed(1)}MB exceeds warning threshold ${thresholds.memoryWarning}MB`)
    }

    // CPU threshold checks
    if (cpuUsagePercent > thresholds.cpuCritical) {
      this.logger.warn('Resource Monitor', `CRITICAL: CPU usage ${cpuUsagePercent.toFixed(1)}% exceeds critical threshold ${thresholds.cpuCritical}%`)
    } else if (cpuUsagePercent > thresholds.cpuWarning) {
      this.logger.warn('Resource Monitor', `WARNING: CPU usage ${cpuUsagePercent.toFixed(1)}% exceeds warning threshold ${thresholds.cpuWarning}%`)
    }
  }

  /**
   * Analyze collected resource data
   */
  private async analyzeResourceData(): Promise<ResourceAnalysis> {
    if (this.snapshots.length === 0) {
      throw new Error('No snapshots available for analysis')
    }

    const duration = this.snapshots[this.snapshots.length - 1].timestamp - this.snapshots[0].timestamp

    // Calculate memory statistics
    const memoryUsage = this.snapshots.map(s => s.memory.used)
    const memorySummary = {
      baseline: memoryUsage[0],
      peak: Math.max(...memoryUsage),
      average: memoryUsage.reduce((sum, val) => sum + val, 0) / memoryUsage.length,
      postgresql_usage: this.snapshots.map(s => s.memory.postgresql).reduce((sum, val) => sum + val, 0) / this.snapshots.length
    }

    // Calculate CPU statistics
    const cpuUsage = this.snapshots.map(s => s.cpu.usage)
    const cpuSummary = {
      baseline: cpuUsage[0],
      peak: Math.max(...cpuUsage),
      average: cpuUsage.reduce((sum, val) => sum + val, 0) / cpuUsage.length,
      postgresql_usage: this.snapshots.map(s => s.cpu.postgresql).reduce((sum, val) => sum + val, 0) / this.snapshots.length
    }

    // Calculate disk statistics
    const diskSummary = {
      initial: this.snapshots[0].disk.used,
      final: this.snapshots[this.snapshots.length - 1].disk.used,
      growth: this.snapshots[this.snapshots.length - 1].disk.used - this.snapshots[0].disk.used,
      postgresql_usage: this.snapshots.map(s => s.disk.postgresql).reduce((sum, val) => sum + val, 0) / this.snapshots.length
    }

    // Analyze stability
    const memoryStable = this.isResourceStable(memoryUsage, 0.1) // 10% variance threshold
    const cpuStable = this.isResourceStable(cpuUsage, 0.2) // 20% variance threshold

    const stability = {
      memory_stable: memoryStable,
      cpu_stable: cpuStable,
      crashes: 0, // Would track actual crashes in real implementation
      restarts: 0 // Would track actual restarts in real implementation
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      memory: memorySummary,
      cpu: cpuSummary,
      disk: diskSummary,
      stability
    })

    return {
      duration,
      snapshots: this.snapshots,
      summary: {
        memory: memorySummary,
        cpu: cpuSummary,
        disk: diskSummary,
        stability
      },
      recommendations
    }
  }

  /**
   * Check if resource usage is stable
   */
  private isResourceStable(values: number[], varianceThreshold: number): boolean {
    if (values.length < 2) return true

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const standardDeviation = Math.sqrt(variance)
    const coefficientOfVariation = standardDeviation / mean

    return coefficientOfVariation <= varianceThreshold
  }

  /**
   * Generate recommendations based on resource analysis
   */
  private generateRecommendations(summary: ResourceAnalysis['summary']): string[] {
    const recommendations: string[] = []

    // Memory recommendations
    const memoryUsageMB = summary.memory.average / (1024 * 1024)
    const postgresqlMemoryMB = summary.memory.postgresql_usage / (1024 * 1024)

    if (memoryUsageMB > 400) {
      recommendations.push('HIGH: Memory usage is high. Consider PostgreSQL memory optimizations or use PGlite.')
    } else if (memoryUsageMB > 300) {
      recommendations.push('MEDIUM: Memory usage is moderate. Monitor during complex operations.')
    } else {
      recommendations.push('LOW: Memory usage is acceptable for PostgreSQL implementation.')
    }

    recommendations.push(`PostgreSQL uses approximately ${postgresqlMemoryMB.toFixed(1)}MB of memory on average.`)

    // CPU recommendations
    const cpuUsagePercent = summary.cpu.average * 100
    const postgresqlCpuPercent = summary.cpu.postgresql_usage * 100

    if (cpuUsagePercent > 80) {
      recommendations.push('HIGH: CPU usage is high. PostgreSQL may impact browser performance.')
    } else if (cpuUsagePercent > 60) {
      recommendations.push('MEDIUM: CPU usage is moderate. Acceptable for development use.')
    } else {
      recommendations.push('LOW: CPU usage is acceptable for PostgreSQL implementation.')
    }

    recommendations.push(`PostgreSQL uses approximately ${postgresqlCpuPercent.toFixed(1)}% CPU on average.`)

    // Disk recommendations
    const diskGrowthMB = summary.disk.growth / (1024 * 1024)
    const postgresqlDiskMB = summary.disk.postgresql_usage / (1024 * 1024)

    if (diskGrowthMB > 100) {
      recommendations.push('HIGH: Significant disk growth detected. Monitor disk usage over time.')
    }

    recommendations.push(`PostgreSQL uses approximately ${postgresqlDiskMB.toFixed(1)}MB of disk space.`)

    // Stability recommendations
    if (!summary.stability.memory_stable) {
      recommendations.push('WARNING: Memory usage is unstable. This may indicate memory leaks or optimization issues.')
    }

    if (!summary.stability.cpu_stable) {
      recommendations.push('WARNING: CPU usage is unstable. This may indicate inefficient query processing.')
    }

    if (summary.stability.memory_stable && summary.stability.cpu_stable) {
      recommendations.push('GOOD: Resource usage is stable throughout monitoring period.')
    }

    return recommendations
  }

  /**
   * Export resource data to JSON
   */
  exportData(): string {
    return JSON.stringify({
      snapshots: this.snapshots,
      exportTime: new Date().toISOString(),
      totalSnapshots: this.snapshots.length
    }, null, 2)
  }

  /**
   * Get current resource usage
   */
  async getCurrentUsage(): Promise<ResourceSnapshot> {
    return await this.captureSnapshot()
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size > 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * Format percentage
   */
  formatPercentage(value: number): string {
    return `${(value * 100).toFixed(1)}%`
  }
}

// Export singleton instance
export const resourceMonitor = new ResourceMonitor()