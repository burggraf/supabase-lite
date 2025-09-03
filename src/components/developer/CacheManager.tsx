/**
 * CacheManager - Developer tools UI for cache management
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Trash2, RefreshCw, Search, AlertCircle, CheckCircle } from 'lucide-react'
import { cacheDebugger } from '../../lib/offline/CacheDebugger'
import type { CacheStatus, CacheInspectData } from '../../lib/offline/CacheDebugger'

interface CacheManagerProps {
  autoRefresh?: boolean
}

export const CacheManager: React.FC<CacheManagerProps> = ({ 
  autoRefresh = false 
}) => {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [inspectedCache, setInspectedCache] = useState<CacheInspectData | null>(null)
  const [showInspectionDialog, setShowInspectionDialog] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadCacheStatus = useCallback(async (showLoadingState = false) => {
    try {
      setError(null)
      if (showLoadingState) {
        setLoading(true)
      }
      const status = await cacheDebugger.getCacheStatus()
      setCacheStatus(status)
      setLastUpdated(new Date())

    } catch (err) {
      setError('Error loading cache status')
      console.error('Cache status error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

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


  return (
    <div className="space-y-4">
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