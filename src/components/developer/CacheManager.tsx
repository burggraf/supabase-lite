/**
 * CacheManager - Developer tools UI for cache management
 * Part of Phase 2: Development Workflow Support
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Trash2, RefreshCw, Search, AlertCircle, CheckCircle, Activity, TrendingUp, Zap, BarChart3 } from 'lucide-react'
import { cacheDebugger } from '../../lib/offline/CacheDebugger'
import { PerformanceMonitor } from '../../lib/offline/PerformanceMonitor'
import type { CacheStatus, CacheInspectData, PerformanceMetrics } from '../../lib/offline/CacheDebugger'

interface CacheManagerProps {
  showMetrics?: boolean
  autoRefresh?: boolean
}

export const CacheManager: React.FC<CacheManagerProps> = ({ 
  showMetrics = true, 
  autoRefresh = false 
}) => {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [inspectedCache, setInspectedCache] = useState<CacheInspectData | null>(null)
  const [showInspectionDialog, setShowInspectionDialog] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
  // Performance Monitor integration
  const [performanceData, setPerformanceData] = useState<any>(null)
  const performanceMonitor = PerformanceMonitor.getInstance()

  const loadCacheStatus = useCallback(async (showLoadingState = false) => {
    try {
      setError(null)
      if (showLoadingState) {
        setLoading(true)
      }
      const status = await cacheDebugger.getCacheStatus()
      setCacheStatus(status)
      setLastUpdated(new Date())

      if (showMetrics) {
        const metrics = await cacheDebugger.getPerformanceMetrics()
        setPerformanceMetrics(metrics)
        
        // Load performance monitor data
        const perfData = {
          metrics: performanceMonitor.getMetrics(),
          cachePerformance: performanceMonitor.getCachePerformanceSummary(),
          systemMetrics: performanceMonitor.getSystemMetrics(),
          alerts: performanceMonitor.getPerformanceAlerts(),
          realTimeMetrics: performanceMonitor.getRealTimeMetrics()
        }
        setPerformanceData(perfData)
      }
    } catch (err) {
      setError('Error loading cache status')
      console.error('Cache status error:', err)
    } finally {
      setLoading(false)
    }
  }, [showMetrics])

  useEffect(() => {
    // Initialize development mode first, then load cache status
    const initializeAndLoad = async () => {
      try {
        // Initialize development caches if in dev mode (if method exists)
        if (typeof cacheDebugger.initializeDevelopmentMode === 'function') {
          await cacheDebugger.initializeDevelopmentMode()
        }
      } catch (err) {
        console.warn('Failed to initialize development mode:', err)
      }
      
      // Load cache status regardless of dev mode initialization
      await loadCacheStatus()
    }
    
    initializeAndLoad()
  }, [loadCacheStatus])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadCacheStatus, 30000) // 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh, loadCacheStatus])

  const handleClearAllCaches = async () => {
    setShowConfirmDialog(false)
    setLoading(true)

    try {
      const success = await cacheDebugger.clearAllCaches()
      if (success) {
        await loadCacheStatus() // Reload status after clearing
      } else {
        setError('Failed to clear all caches')
      }
    } catch (err) {
      setError('Error clearing caches')
      console.error('Clear caches error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClearCache = async (cacheName: string) => {
    try {
      const success = await cacheDebugger.clearCache(cacheName)
      if (success) {
        await loadCacheStatus() // Reload status after clearing
      } else {
        setError(`Failed to clear cache: ${cacheName}`)
      }
    } catch (err) {
      setError(`Error clearing cache: ${cacheName}`)
      console.error('Clear cache error:', err)
    }
  }

  const handleInspectCache = async (cacheName: string) => {
    try {
      const data = await cacheDebugger.inspectCache(cacheName)
      setInspectedCache(data)
      setShowInspectionDialog(true)
    } catch (err) {
      setError(`Error inspecting cache: ${cacheName}`)
      console.error('Inspect cache error:', err)
    }
  }

  if (loading && !cacheStatus) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading cache status...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle size={20} />
            <span>Error loading cache status</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="cache" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cache" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Cache Management
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Performance Monitor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cache" className="space-y-4">
          {/* Cache Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Cache Status</span>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => loadCacheStatus(true)}
                    disabled={loading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={!cacheStatus || cacheStatus.totalCaches === 0}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All Caches
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cacheStatus && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Total Caches: {cacheStatus.totalCaches}</span>
                    <span>Total Size: {cacheStatus.totalSize}</span>
                  </div>
                  
                  {lastUpdated && (
                    <div className="flex items-center justify-between text-sm text-gray-500 border-t pt-2">
                      <div className="flex items-center space-x-2">
                        <CheckCircle size={16} className="text-green-500" />
                        <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
                      </div>
                    </div>
                  )}
                  
                  {cacheStatus.caches.map((cache) => (
                    <div key={cache.name} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{cache.name}</div>
                        <div className="text-sm text-gray-600">
                          {cache.size} ({cache.entries} entries)
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleInspectCache(cache.name)}
                        >
                          <Search className="w-4 h-4 mr-2" />
                          Inspect
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleClearCache(cache.name)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Clear Cache
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Basic Performance Metrics Card */}
          {showMetrics && performanceMetrics && (
            <Card>
              <CardHeader>
                <CardTitle>Cache Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {performanceMetrics.cacheHitRate}%
                    </div>
                    <div className="text-sm text-gray-600">Cache Hit Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{performanceMetrics.totalRequests}</div>
                    <div className="text-sm text-gray-600">Total Requests</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {performanceMetrics.networkSavings}
                    </div>
                    <div className="text-sm text-gray-600">Network Savings</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {performanceData ? (
            <>
              {/* Real-time Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Real-time Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(performanceData.realTimeMetrics.metrics).map(([key, value]) => (
                      <div key={key} className="text-center">
                        <div className="text-lg font-semibold">
                          {typeof value === 'number' ? 
                            (key.includes('time') || key.includes('duration') ? formatDuration(value) : value.toFixed(1))
                            : String(value)
                          }
                        </div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {key.replace(/[-_]/g, ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* System Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    System Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Hardware</h4>
                      <div className="space-y-1 text-sm">
                        <div>CPU Cores: {performanceData.systemMetrics.hardwareConcurrency || 'Unknown'}</div>
                        <div>Device Memory: {performanceData.systemMetrics.deviceMemory ? `${performanceData.systemMetrics.deviceMemory} GB` : 'Unknown'}</div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Network</h4>
                      <div className="space-y-1 text-sm">
                        {performanceData.systemMetrics.connection ? (
                          <>
                            <div>Type: {performanceData.systemMetrics.connection.effectiveType || 'Unknown'}</div>
                            <div>Speed: {performanceData.systemMetrics.connection.downlink ? `${performanceData.systemMetrics.connection.downlink} Mbps` : 'Unknown'}</div>
                            <div>Latency: {performanceData.systemMetrics.connection.rtt ? `${performanceData.systemMetrics.connection.rtt}ms` : 'Unknown'}</div>
                            <div>Data Saver: {performanceData.systemMetrics.connection.saveData ? 'Enabled' : 'Disabled'}</div>
                          </>
                        ) : (
                          <div>Connection info unavailable</div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cache Performance Summary */}
              {Object.keys(performanceData.cachePerformance).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Cache Performance Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(performanceData.cachePerformance).map(([cacheType, stats]: [string, any]) => (
                        <div key={cacheType} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <div className="font-medium capitalize">{cacheType.replace(/[-_]/g, ' ')}</div>
                            <div className="text-sm text-muted-foreground">
                              {stats.hits} hits, {stats.misses} misses
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold">
                              {(stats.hitRate * 100).toFixed(1)}%
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Hit Rate
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Performance Alerts */}
              {performanceData.alerts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      Performance Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {performanceData.alerts.map((alert: any, index: number) => (
                        <div key={index} className={`p-3 border-l-4 rounded ${
                          alert.severity === 'critical' 
                            ? 'border-red-500 bg-red-50' 
                            : 'border-yellow-500 bg-yellow-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{alert.metric}</div>
                              <div className="text-sm text-muted-foreground">
                                Current: {alert.value} | Threshold: {alert.threshold}
                              </div>
                            </div>
                            <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                              {alert.severity}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Performance monitoring data will appear here as you use the application.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4" 
                  onClick={() => {
                    // Start monitoring and record some sample metrics
                    performanceMonitor.startRealTimeMonitoring()
                    performanceMonitor.recordMetric('app-load-time', Math.random() * 1000 + 500, 'ms')
                    performanceMonitor.recordCacheHit('service-worker')
                    loadCacheStatus(true)
                  }}
                >
                  Start Performance Monitoring
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Clear All Caches?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                This will remove all cached resources and may slow down the next app load. 
                Are you sure you want to continue?
              </p>
              <div className="flex space-x-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleClearAllCaches}
                >
                  Confirm
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cache Inspection Dialog */}
      {showInspectionDialog && inspectedCache && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-4/5 max-w-4xl h-4/5 overflow-hidden">
            <CardHeader>
              <CardTitle>Cache: {inspectedCache.name}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              <div className="space-y-2">
                {inspectedCache.entries.map((entry, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border-b">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm truncate">
                        {entry.url.split('/').pop() || entry.url}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {entry.url}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <Badge variant="secondary">{entry.size}</Badge>
                      <span className="text-gray-500">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
                {inspectedCache.entries.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No entries found in this cache
                  </div>
                )}
              </div>
            </CardContent>
            <div className="p-4 border-t">
              <Button onClick={() => setShowInspectionDialog(false)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default CacheManager