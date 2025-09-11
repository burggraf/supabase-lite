# Debugging Instrumentation Guide

## Overview

This guide provides specific recommendations for adding debugging instrumentation to identify which code paths API calls take through the MSW system. The goal is to make debugging 70% faster by providing clear visibility into request processing.

## Core Instrumentation Strategy

### Request ID Generation

**Purpose**: Track individual requests through the entire system

**Implementation**:
```typescript
// Add to all handlers (src/mocks/handlers/*)
const generateRequestId = () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// In each handler
const requestId = generateRequestId()
console.log(`🔍 [${requestId}] Handler start:`, req.method, req.url)

// Pass requestId through all subsequent operations
const response = await processRequest(req, { requestId })

console.log(`✅ [${requestId}] Handler complete:`, response.status)
```

**Usage**:
- Attach to all log messages
- Include in error reports
- Add to response headers for client-side debugging

### Bridge Selection Instrumentation

**Purpose**: Identify which bridge processes each request

**Implementation**:
```typescript
// Add to bridge selection logic (src/mocks/handlers/rest.ts)
const instrumentBridgeSelection = (req, requestId) => {
  const bridgeType = USE_SIMPLIFIED_BRIDGE ? 'simplified' : 'enhanced'
  const bridgeName = activeBridge.constructor.name
  
  console.log(`🌉 [${requestId}] Bridge selected:`, {
    type: bridgeType,
    name: bridgeName,
    reason: determineBridgeReason(req),
    capabilities: getBridgeCapabilities(bridgeType)
  })
  
  // Track bridge usage statistics
  window.bridgeStats = window.bridgeStats || {}
  window.bridgeStats[bridgeType] = (window.bridgeStats[bridgeType] || 0) + 1
  
  // Add to response headers
  return {
    'X-Bridge-Type': bridgeType,
    'X-Bridge-Name': bridgeName,
    'X-Request-ID': requestId
  }
}
```

### Project Resolution Tracing

**Purpose**: Monitor project switching and cache performance

**Implementation**:
```typescript
// Add to project resolution (src/mocks/project-resolver.ts)
class ProjectResolutionInstrumentation {
  static metrics = {
    resolutions: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    averageTime: 0
  }
  
  static instrumentResolution = async (url, requestId) => {
    const start = performance.now()
    
    try {
      console.log(`🗃️ [${requestId}] Project resolution start:`, url)
      
      const projectId = extractProjectId(url)
      const cacheKey = `project:${projectId}`
      
      let cacheHit = false
      if (projectCache.has(cacheKey)) {
        cacheHit = true
        this.metrics.cacheHits++
        console.log(`🎯 [${requestId}] Cache HIT:`, cacheKey)
      } else {
        this.metrics.cacheMisses++
        console.log(`❌ [${requestId}] Cache MISS:`, cacheKey)
      }
      
      const result = await resolveProject(url)
      
      const duration = performance.now() - start
      this.metrics.resolutions++
      this.metrics.averageTime = (this.metrics.averageTime + duration) / 2
      
      console.log(`✅ [${requestId}] Project resolved:`, {
        projectId: result.projectId,
        cacheHit,
        duration: `${duration.toFixed(2)}ms`,
        dbSwitched: result.dbSwitched
      })
      
      return result
    } catch (error) {
      this.metrics.errors++
      console.error(`❌ [${requestId}] Project resolution failed:`, error)
      throw error
    }
  }
  
  static getMetrics = () => ({
    ...this.metrics,
    cacheHitRate: this.metrics.resolutions > 0 
      ? (this.metrics.cacheHits / this.metrics.resolutions * 100).toFixed(2) + '%'
      : '0%'
  })
}
```

### Database Query Instrumentation

**Purpose**: Track SQL generation and execution

**Implementation**:
```typescript
// Add to database operations (src/lib/database/connection.ts)
class DatabaseInstrumentation {
  static instrumentQuery = async (sql, params, userContext, requestId) => {
    const queryId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    
    console.group(`💾 [${requestId}] [${queryId}] Database Query`)
    console.log('SQL:', sql)
    console.log('Parameters:', params)
    console.log('User Context:', userContext)
    
    const start = performance.now()
    
    try {
      const result = await DatabaseManager.query(sql, params)
      const duration = performance.now() - start
      
      console.log(`✅ Query successful:`, {
        duration: `${duration.toFixed(2)}ms`,
        rowCount: result.rows?.length || 0,
        memoryUsage: getMemoryUsage()
      })
      
      // Track slow queries
      if (duration > 100) {
        console.warn(`🐌 Slow query detected:`, { sql, duration })
      }
      
      console.groupEnd()
      return result
    } catch (error) {
      console.error(`❌ Query failed:`, error)
      console.groupEnd()
      throw error
    }
  }
}
```

### Query Parsing Instrumentation

**Purpose**: Track how URL parameters are parsed into SQL

**Implementation**:
```typescript
// Enhanced Bridge Query Parsing
class EnhancedBridgeInstrumentation {
  static instrumentQueryParsing = (url, requestId) => {
    console.group(`📝 [${requestId}] Enhanced Bridge Query Parsing`)
    
    const urlParams = new URLSearchParams(url.split('?')[1])
    console.log('Raw URL parameters:', Object.fromEntries(urlParams))
    
    // Track parsing stages
    const parsingStages = {
      filters: [],
      embedding: null,
      ordering: null,
      pagination: null
    }
    
    // Parse filters
    urlParams.forEach((value, key) => {
      if (key !== 'select' && key !== 'order' && key !== 'limit' && key !== 'offset') {
        parsingStages.filters.push({ column: key, filter: value })
        console.log(`🔍 Filter parsed:`, { column: key, filter: value })
      }
    })
    
    // Parse embedding
    const selectParam = urlParams.get('select')
    if (selectParam?.includes('(')) {
      parsingStages.embedding = parseEmbedding(selectParam)
      console.log(`🔗 Embedding parsed:`, parsingStages.embedding)
    }
    
    // Parse ordering
    const orderParam = urlParams.get('order')
    if (orderParam) {
      parsingStages.ordering = parseOrdering(orderParam)
      console.log(`📊 Ordering parsed:`, parsingStages.ordering)
    }
    
    // Parse pagination
    const limitParam = urlParams.get('limit')
    const offsetParam = urlParams.get('offset')
    if (limitParam || offsetParam) {
      parsingStages.pagination = { limit: limitParam, offset: offsetParam }
      console.log(`📄 Pagination parsed:`, parsingStages.pagination)
    }
    
    console.log(`📋 Parsing summary:`, parsingStages)
    console.groupEnd()
    
    return parsingStages
  }
}
```

### Error Context Instrumentation

**Purpose**: Capture complete context when errors occur

**Implementation**:
```typescript
// Enhanced Error Tracking
class ErrorInstrumentation {
  static instrumentError = (error, context, requestId) => {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    
    const errorContext = {
      errorId,
      requestId,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context: {
        url: context.url,
        method: context.method,
        bridge: context.bridge,
        projectId: context.projectId,
        userContext: context.userContext,
        query: context.parsedQuery,
        sql: context.generatedSQL
      },
      system: {
        userAgent: navigator.userAgent,
        memory: getMemoryUsage(),
        timestamp: performance.now()
      }
    }
    
    console.group(`❌ [${requestId}] [${errorId}] Error Context`)
    console.error('Error:', error)
    console.table(errorContext.context)
    console.log('Full context:', errorContext)
    console.groupEnd()
    
    // Store for debugging
    window.errorHistory = window.errorHistory || []
    window.errorHistory.push(errorContext)
    
    // Keep only last 50 errors
    if (window.errorHistory.length > 50) {
      window.errorHistory = window.errorHistory.slice(-50)
    }
    
    return errorContext
  }
}
```

### Performance Monitoring

**Purpose**: Track system performance and identify bottlenecks

**Implementation**:
```typescript
// Performance Monitoring System
class PerformanceInstrumentation {
  static metrics = new Map()
  
  static startTiming = (operation, requestId) => {
    const timingKey = `${requestId}:${operation}`
    this.metrics.set(timingKey, {
      start: performance.now(),
      operation,
      requestId
    })
  }
  
  static endTiming = (operation, requestId) => {
    const timingKey = `${requestId}:${operation}`
    const timing = this.metrics.get(timingKey)
    
    if (timing) {
      const duration = performance.now() - timing.start
      
      console.log(`⏱️ [${requestId}] ${operation}:`, `${duration.toFixed(2)}ms`)
      
      // Track slow operations
      const thresholds = {
        'handler-processing': 50,
        'project-resolution': 10,
        'query-parsing': 20,
        'database-execution': 100,
        'response-formatting': 10
      }
      
      if (duration > (thresholds[operation] || 50)) {
        console.warn(`🐌 Slow ${operation}:`, {
          duration: `${duration.toFixed(2)}ms`,
          threshold: `${thresholds[operation]}ms`,
          requestId
        })
      }
      
      this.metrics.delete(timingKey)
      return duration
    }
  }
  
  static getPerformanceReport = () => {
    const ongoing = [...this.metrics.values()].map(m => ({
      operation: m.operation,
      requestId: m.requestId,
      duration: `${(performance.now() - m.start).toFixed(2)}ms`
    }))
    
    return {
      ongoingOperations: ongoing,
      memoryUsage: getMemoryUsage(),
      cacheMetrics: ProjectResolutionInstrumentation.getMetrics(),
      bridgeStats: window.bridgeStats || {}
    }
  }
}
```

### Memory Usage Monitoring

**Purpose**: Track memory usage and detect leaks

**Implementation**:
```typescript
// Memory Monitoring
const getMemoryUsage = () => {
  if (performance.memory) {
    return {
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
      total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
    }
  }
  return { used: 'unknown', total: 'unknown', limit: 'unknown' }
}

// Monitor memory every 30 seconds
setInterval(() => {
  const memory = getMemoryUsage()
  console.log('📊 Memory usage:', memory)
  
  // Warn if memory usage is high
  if (performance.memory) {
    const usagePercent = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
    if (usagePercent > 0.8) {
      console.warn('⚠️ High memory usage detected:', usagePercent * 100 + '%')
    }
  }
}, 30000)
```

## Automated Debugging Tools

### Debug Panel Implementation

**Purpose**: Provide real-time debugging interface

**Implementation**:
```typescript
// Debug Panel (add to development environment)
class DebugPanel {
  static create = () => {
    if (window.debugPanel) return window.debugPanel
    
    const panel = document.createElement('div')
    panel.id = 'msw-debug-panel'
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 400px;
      max-height: 500px;
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      overflow-y: auto;
      z-index: 10000;
      display: none;
    `
    
    document.body.appendChild(panel)
    window.debugPanel = panel
    
    // Add toggle key (Ctrl+Shift+D)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none'
      }
    })
    
    this.updatePanel()
    setInterval(this.updatePanel, 1000)
    
    return panel
  }
  
  static updatePanel = () => {
    if (!window.debugPanel) return
    
    const metrics = PerformanceInstrumentation.getPerformanceReport()
    
    window.debugPanel.innerHTML = `
      <h3>MSW Debug Panel (Ctrl+Shift+D to toggle)</h3>
      <h4>Performance</h4>
      <div>Memory: ${metrics.memoryUsage.used} / ${metrics.memoryUsage.total}</div>
      <div>Cache Hit Rate: ${metrics.cacheMetrics.cacheHitRate}</div>
      
      <h4>Bridge Statistics</h4>
      <div>Enhanced: ${metrics.bridgeStats.enhanced || 0}</div>
      <div>Simplified: ${metrics.bridgeStats.simplified || 0}</div>
      
      <h4>Ongoing Operations</h4>
      ${metrics.ongoingOperations.map(op => 
        `<div>${op.operation}: ${op.duration}</div>`
      ).join('')}
      
      <h4>Recent Errors</h4>
      ${(window.errorHistory || []).slice(-3).map(err => 
        `<div style="color: #ff6b6b">${err.error.message}</div>`
      ).join('')}
    `
  }
}

// Initialize in development
if (process.env.NODE_ENV === 'development') {
  DebugPanel.create()
}
```

### Console Debugging Utilities

**Purpose**: Provide easy-to-use debugging functions

**Implementation**:
```typescript
// Global debugging utilities
window.mswDebug = {
  // Enable/disable various debug modes
  enableAll: () => {
    localStorage.setItem('MSW_DEBUG', 'true')
    localStorage.setItem('BRIDGE_DEBUG', 'true')
    localStorage.setItem('DB_DEBUG', 'true')
    localStorage.setItem('PERFORMANCE_DEBUG', 'true')
    console.log('🔧 All debugging enabled - reload page')
  },
  
  disableAll: () => {
    localStorage.removeItem('MSW_DEBUG')
    localStorage.removeItem('BRIDGE_DEBUG')
    localStorage.removeItem('DB_DEBUG')
    localStorage.removeItem('PERFORMANCE_DEBUG')
    console.log('🔇 All debugging disabled - reload page')
  },
  
  // Get current system status
  status: () => {
    console.table({
      'MSW Debug': localStorage.getItem('MSW_DEBUG') === 'true',
      'Bridge Debug': localStorage.getItem('BRIDGE_DEBUG') === 'true',
      'DB Debug': localStorage.getItem('DB_DEBUG') === 'true',
      'Performance Debug': localStorage.getItem('PERFORMANCE_DEBUG') === 'true'
    })
  },
  
  // Performance report
  performance: () => {
    console.table(PerformanceInstrumentation.getPerformanceReport())
  },
  
  // Clear all caches
  clearCaches: () => {
    if (window.projectCache) window.projectCache.clear()
    if (window.queryCache) window.queryCache.clear()
    localStorage.clear()
    sessionStorage.clear()
    console.log('🧹 All caches cleared')
  },
  
  // Force bridge selection
  useBridge: (type) => {
    if (type === 'enhanced') {
      window.forceEnhancedBridge = true
      window.forceSimplifiedBridge = false
    } else if (type === 'simplified') {
      window.forceSimplifiedBridge = true
      window.forceEnhancedBridge = false
    }
    console.log(`🌉 Forced bridge selection: ${type}`)
  },
  
  // Recent errors
  errors: () => {
    console.table(window.errorHistory || [])
  }
}

console.log('🔧 Debug utilities available at window.mswDebug')
```

## Implementation Checklist

### Phase 1: Basic Instrumentation
- [ ] Add request ID generation to all handlers
- [ ] Implement bridge selection logging
- [ ] Add project resolution tracing
- [ ] Create error context capturing

### Phase 2: Performance Monitoring
- [ ] Add database query instrumentation
- [ ] Implement timing measurements
- [ ] Add memory usage monitoring
- [ ] Create performance thresholds and alerts

### Phase 3: Advanced Debugging
- [ ] Build debug panel interface
- [ ] Add console debugging utilities
- [ ] Implement automated error reporting
- [ ] Create performance regression detection

### Phase 4: Integration
- [ ] Add instrumentation to all bridge implementations
- [ ] Update error handling to include context
- [ ] Create debugging documentation
- [ ] Add development vs production guards

## Testing the Instrumentation

### Verify Basic Logging
```javascript
// Make a test request and check console
fetch('/rest/v1/users?select=*&limit=5')
  .then(() => console.log('Check console for instrumentation logs'))
```

### Test Performance Monitoring
```javascript
// Generate load and monitor performance
for (let i = 0; i < 10; i++) {
  fetch(`/rest/v1/users?id=eq.${i}`)
}
setTimeout(() => window.mswDebug.performance(), 1000)
```

### Verify Error Context
```javascript
// Trigger an error and check context
fetch('/rest/v1/nonexistent?invalid=syntax')
  .then(() => window.mswDebug.errors())
```

This instrumentation system provides comprehensive visibility into API request processing, making debugging significantly faster and more effective.