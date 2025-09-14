# Unified Kernel Request Tracing Guide

## Overview

This guide provides step-by-step instructions for tracing API requests through the **Unified Kernel Architecture**. The new system provides a much cleaner, single-path execution flow compared to the previous dual-bridge system, making debugging significantly more straightforward.

## Quick Tracing Checklist

1. **🔍 Identify the request** - URL pattern and HTTP method
2. **📍 Find the MSW handler** - Which handler matches the request
3. **🎯 Follow kernel execution** - Trace through the 7-stage middleware pipeline
4. **⚙️ Examine executor processing** - REST/HEAD/RPC operation handling
5. **🗄️ Trace database operations** - QueryEngine and SQL execution
6. **📤 Validate response formatting** - Final response structure and headers

## Step-by-Step Tracing Process

### Step 1: Identify the Request

**Browser DevTools Network Tab:**
```javascript
// Check request details in Network tab
// - General: Request URL, Method, Status Code
// - Request Headers: Authorization, Content-Type, Prefer, Range
// - Response Headers: Content-Range, Content-Type, X-Request-ID
```

**Console Request Monitoring:**
```javascript
// Enable MSW debugging to see all intercepted requests
localStorage.setItem('MSW_DEBUG', 'true')
// Reload page to see MSW request interception logs

// Or monitor with custom logging
const originalFetch = window.fetch
window.fetch = function(...args) {
  console.log('🚀 Outgoing request:', args[0])
  return originalFetch.apply(this, args)
}
```

### Step 2: Find the MSW Handler

**Handler matching priority** (from `src/mocks/handlers/index.ts`):
```javascript
export const handlers = [
  // Direct API routes
  ...restHandlers,           // /rest/v1/:table
  ...rpcHandlers,            // /rpc/v1/:functionName

  // Authentication
  ...authHandlers,           // /auth/v1/*

  // Project-scoped routes
  ...projectHandlers,        // /:projectId/* (catches all project routes)

  // System routes
  ...debugHandlers,          // /debug/*
  healthHandler,             // /health

  // Storage and functions
  ...storageHandlers,        // /storage/v1/*
  ...functionsHandlers,      // /functions/v1/*

  // Catch-all
  corsHandler                // OPTIONS and unmatched requests
]
```

**Handler Debugging:**
```javascript
// Add to any handler to verify it's being called
rest.get('/rest/v1/:table', createApiHandler(restExecutor))
// The createApiHandler wrapper includes automatic logging

// Check which handler matched
const traces = window.mswDebug.getRecentTraces()
const latestTrace = traces[0]
console.log('Handler matched:', latestTrace.url)
```

### Step 3: Follow Kernel Execution

**Unified Kernel Flow:**
```
MSW Handler → createApiHandler() → executeMiddlewarePipeline() → Executor → Response
```

#### Trace Kernel Entry Point
```javascript
// In src/api/kernel.ts - createApiHandler()
console.log('🎯 Kernel entry:', {
  method: apiRequest.method,
  url: apiRequest.url.pathname,
  requestId: context.requestId
})
```

#### Monitor Middleware Pipeline Execution
```javascript
// The pipeline executes exactly 7 stages in order:
const middlewareStack = [
  'errorHandlingMiddleware',        // Stage 1: Error wrapper
  'instrumentationMiddleware',      // Stage 2: Request tracking
  'corsMiddleware',                 // Stage 3: CORS headers
  'projectResolutionMiddleware',    // Stage 4: Multi-tenant switching
  'authenticationMiddleware',       // Stage 5: JWT and RLS
  'requestParsingMiddleware',       // Stage 6: PostgREST parsing
  'responseFormattingMiddleware'    // Stage 7: Response formatting
]

// View pipeline execution in browser console
window.mswDebug.getRecentTraces()[0].stages.forEach(stage => {
  console.log(`${stage.stage}: ${stage.duration?.toFixed(2)}ms`)
})
```

### Step 4: Middleware Stage Tracing

#### Stage 1: Error Handling Middleware
**Purpose**: Wraps entire pipeline in error handling
**Debugging**:
```javascript
// Check if errors are being caught properly
const trace = window.mswDebug.getRecentTraces()[0]
if (trace.error) {
  console.log('❌ Error caught by middleware:', trace.error)
}
```

#### Stage 2: Instrumentation Middleware
**Purpose**: Request ID generation and performance tracking
**Debugging**:
```javascript
// Verify request ID assignment
const context = trace.stages.find(s => s.stage === 'instrumentation')
console.log('🔍 Request ID:', context.data.requestId)
console.log('📊 Tracing enabled:', context.data.tracingEnabled)
```

#### Stage 3: CORS Middleware
**Purpose**: Cross-origin header management
**Debugging**:
```javascript
// Check CORS headers are being added
const corsStage = trace.stages.find(s => s.stage === 'cors')
console.log('🌐 CORS applied:', corsStage.data)

// Verify in response headers
const response = await fetch('/rest/v1/users')
console.log('CORS headers:', {
  origin: response.headers.get('Access-Control-Allow-Origin'),
  methods: response.headers.get('Access-Control-Allow-Methods')
})
```

#### Stage 4: Project Resolution Middleware
**Purpose**: Multi-tenant database switching
**Debugging**:
```javascript
// Monitor project resolution
const projectStage = trace.stages.find(s => s.stage === 'project-resolution')
console.log('🗃️ Project resolution:', {
  projectId: projectStage.data.projectId,
  dbSwitched: projectStage.data.dbSwitched,
  cacheHit: projectStage.data.cacheHit
})

// Check project cache performance
console.log('Cache stats:', window.mswDebug.getProjectCacheStats())
```

#### Stage 5: Authentication Middleware
**Purpose**: JWT verification and RLS context
**Debugging**:
```javascript
// Check authentication processing
const authStage = trace.stages.find(s => s.stage === 'authentication')
console.log('🔐 Authentication:', {
  userId: authStage.data.userId,
  role: authStage.data.role,
  tokenValid: authStage.data.tokenValid
})

// Verify JWT token processing
if (authStage.data.tokenValid) {
  console.log('✅ JWT valid, user authenticated')
} else {
  console.log('❌ JWT invalid or missing, proceeding as anonymous')
}
```

#### Stage 6: Request Parsing Middleware
**Purpose**: PostgREST query syntax parsing
**Debugging**:
```javascript
// Monitor query parsing
const parsingStage = trace.stages.find(s => s.stage === 'request-parsing')
console.log('📝 Request parsing:', {
  table: parsingStage.data.table,
  hasFilters: parsingStage.data.hasFilters,
  hasEmbeds: parsingStage.data.hasEmbeds,
  complexity: parsingStage.data.queryComplexity
})

// Check parsed query structure
console.log('Parsed query:', request.parsedQuery)
```

#### Stage 7: Response Formatting Middleware
**Purpose**: Standardize response structure
**Debugging**:
```javascript
// Check response formatting
const formattingStage = trace.stages.find(s => s.stage === 'response-formatting')
console.log('📤 Response formatting:', {
  contentType: formattingStage.data.contentType,
  responseSize: formattingStage.data.responseSize,
  formatted: formattingStage.data.formatted
})
```

### Step 5: Executor Processing

**Executor Selection Logic:**
```javascript
// Based on request pattern and method
const executorMapping = {
  '/rest/v1/:table': {
    'GET': 'restExecutor',
    'POST': 'restExecutor',
    'PATCH': 'restExecutor',
    'DELETE': 'restExecutor',
    'HEAD': 'headExecutor'
  },
  '/rpc/v1/:functionName': {
    'POST': 'rpcExecutor',
    'GET': 'rpcExecutor'
  }
}

// Check which executor was used
console.log('⚙️ Executor used:', trace.executor)
```

#### REST Executor Tracing
```javascript
// For database CRUD operations
const restTrace = trace.stages.find(s => s.stage === 'rest-executor')
console.log('🗄️ REST operation:', {
  table: restTrace.data.table,
  method: restTrace.data.method,
  queryEngineUsed: true
})
```

#### RPC Executor Tracing
```javascript
// For stored procedure calls
const rpcTrace = trace.stages.find(s => s.stage === 'rpc-executor')
console.log('🔧 RPC operation:', {
  functionName: rpcTrace.data.functionName,
  parameters: rpcTrace.data.parameters
})
```

#### HEAD Executor Tracing
```javascript
// For metadata-only requests
const headTrace = trace.stages.find(s => s.stage === 'head-executor')
console.log('📋 HEAD operation:', {
  table: headTrace.data.table,
  metadataOnly: true,
  sameAsGet: headTrace.data.processedAsGet
})
```

### Step 6: QueryEngine and Database Operations

**QueryEngine Processing Flow:**
```
REST Executor → QueryEngine → SQL Builder → Database → Response Formatter
```

#### Query Engine Tracing
```javascript
// Monitor QueryEngine operations
console.log('💾 QueryEngine processing:', {
  table: parsedQuery.table,
  method: parsedQuery.method,
  fastPathUsed: queryEngine.canUseFastPath(request),
  rlsApplied: context.sessionContext?.userId ? true : false
})
```

#### SQL Generation Monitoring
```javascript
// Enable SQL logging in development
localStorage.setItem('DB_DEBUG', 'true')

// Check generated SQL
console.log('📝 Generated SQL:', {
  sql: generatedSQL,
  parameters: sqlParameters,
  executionTime: `${executionTime.toFixed(2)}ms`
})
```

#### Database Query Execution
```javascript
// Monitor database operations
const dbTrace = trace.stages.find(s => s.stage === 'database-execution')
console.log('🗄️ Database query:', {
  sql: dbTrace.data.sql,
  parameters: dbTrace.data.parameters,
  rowCount: dbTrace.data.rowCount,
  duration: `${dbTrace.duration}ms`
})
```

### Step 7: Response Formatting and Return

#### Response Structure Validation
```javascript
// Check final response structure
console.log('📤 Final response:', {
  status: response.status,
  contentType: response.headers['Content-Type'],
  hasContentRange: !!response.headers['Content-Range'],
  dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
  dataSize: JSON.stringify(response.data).length
})
```

#### PostgREST Compatibility Check
```javascript
// Verify PostgREST-compatible response
const isPostgRESTCompatible = {
  hasCorrectContentType: response.headers['Content-Type'] === 'application/json',
  hasContentRange: !!response.headers['Content-Range'],
  hasRequestId: !!response.headers['X-Request-ID'],
  correctDataStructure: Array.isArray(response.data) || typeof response.data === 'object'
}

console.log('✅ PostgREST compatibility:', isPostgRESTCompatible)
```

## Browser Debug Console Commands

### Real-Time Request Monitoring

```javascript
// Get live system status
window.mswDebug.status()

// Monitor recent requests
window.mswDebug.getRecentTraces().slice(0, 5).forEach(trace => {
  console.log(`${trace.requestId}: ${trace.method} ${trace.url} (${trace.stages.length} stages)`)
})

// Enable detailed logging
window.mswDebug.enableVerboseLogging()

// Watch specific request pattern
window.mswDebug.getRequestsByUrl('/rest/v1/users').forEach(trace => {
  console.log('User API call:', trace)
})
```

### Performance Analysis

```javascript
// Analyze request performance
const traces = window.mswDebug.getRecentTraces()
const performanceStats = {
  averageRequestTime: traces.reduce((sum, t) => sum + t.totalDuration, 0) / traces.length,
  slowestRequest: traces.reduce((slow, t) => t.totalDuration > slow.totalDuration ? t : slow),
  fastestRequest: traces.reduce((fast, t) => t.totalDuration < fast.totalDuration ? t : fast)
}

console.table(performanceStats)
```

### Error Analysis

```javascript
// Find failed requests
const failedRequests = window.mswDebug.getRecentTraces().filter(t => t.error)
console.log('Failed requests:', failedRequests)

// Analyze error patterns
const errorPatterns = failedRequests.reduce((patterns, trace) => {
  const errorType = trace.error.code || trace.error.name
  patterns[errorType] = (patterns[errorType] || 0) + 1
  return patterns
}, {})

console.table(errorPatterns)
```

## Common Debugging Scenarios

### Scenario 1: Request Not Being Processed

**Symptoms**: Request appears to be ignored or gets no response
**Debug Steps**:
1. Check if MSW is intercepting: `localStorage.getItem('MSW_DEBUG')`
2. Verify handler pattern matches: Look at URL pattern in handlers
3. Check handler order: Ensure specific handlers come before generic ones
4. Verify CORS: Check for OPTIONS preflight handling

```javascript
// Debug handler matching
console.log('Request URL:', request.url)
console.log('Handler patterns:', handlers.map(h => h.info.path))
```

### Scenario 2: Authentication Issues

**Symptoms**: User appears not authenticated or gets wrong permissions
**Debug Steps**:
1. Check JWT token in request headers
2. Verify token decoding in authentication middleware
3. Check RLS context setup
4. Verify user permissions and session context

```javascript
// Debug authentication flow
const authStage = trace.stages.find(s => s.stage === 'authentication')
console.log('Auth debug:', {
  headerPresent: !!request.headers.authorization,
  tokenDecoded: authStage.data.tokenValid,
  userContext: authStage.data.userId,
  role: authStage.data.role
})
```

### Scenario 3: Query Processing Errors

**Symptoms**: PostgREST queries fail or return unexpected results
**Debug Steps**:
1. Check query parsing in request parsing middleware
2. Verify SQL generation by QueryEngine
3. Test generated SQL directly with debug endpoint
4. Check RLS filter application

```javascript
// Debug query processing
const parsingStage = trace.stages.find(s => s.stage === 'request-parsing')
console.log('Query processing debug:', {
  originalUrl: request.url.toString(),
  parsedQuery: request.parsedQuery,
  parsingSuccess: !parsingStage.error
})
```

### Scenario 4: Performance Issues

**Symptoms**: Requests are slow or timing out
**Debug Steps**:
1. Check per-stage timing in request trace
2. Identify bottleneck middleware stages
3. Monitor database query execution time
4. Check memory usage and garbage collection

```javascript
// Analyze performance bottlenecks
const trace = window.mswDebug.getRecentTraces()[0]
const stageTimings = trace.stages.map(stage => ({
  stage: stage.stage,
  duration: stage.duration
})).sort((a, b) => b.duration - a.duration)

console.table(stageTimings)
```

## Advanced Tracing Techniques

### Custom Request Tracking

```javascript
// Create custom request tracker
class RequestTracker {
  constructor() {
    this.requests = new Map()
  }

  trackRequest(requestId) {
    this.requests.set(requestId, {
      startTime: Date.now(),
      stages: []
    })
  }

  addStage(requestId, stageName, data) {
    const request = this.requests.get(requestId)
    if (request) {
      request.stages.push({
        stage: stageName,
        timestamp: Date.now(),
        data
      })
    }
  }

  getRequestFlow(requestId) {
    return this.requests.get(requestId)
  }
}

window.customTracker = new RequestTracker()
```

### Conditional Debugging

```javascript
// Only trace specific conditions
const shouldTrace = (request) => {
  return request.url.pathname.includes('/users') ||
         request.method === 'POST' ||
         request.headers['authorization']
}

// Apply conditional tracing
if (shouldTrace(request)) {
  console.group(`🔍 Tracing request: ${request.url}`)
  // ... detailed tracing
  console.groupEnd()
}
```

### Performance Regression Detection

```javascript
// Detect performance regressions
class PerformanceMonitor {
  constructor() {
    this.baselines = new Map()
  }

  recordBaseline(operation, duration) {
    this.baselines.set(operation, duration)
  }

  checkRegression(operation, currentDuration) {
    const baseline = this.baselines.get(operation)
    if (baseline && currentDuration > baseline * 1.5) {
      console.warn(`⚠️ Performance regression detected in ${operation}:`, {
        baseline: `${baseline.toFixed(2)}ms`,
        current: `${currentDuration.toFixed(2)}ms`,
        regression: `${((currentDuration / baseline - 1) * 100).toFixed(1)}%`
      })
    }
  }
}

window.perfMonitor = new PerformanceMonitor()
```

## Troubleshooting Quick Reference

### Request Tracing Not Working
```javascript
// Check if tracing is enabled
console.log('Tracing enabled:', window.mswDebug.getConfig().debugging.enableRequestTracing)

// Enable tracing if disabled
window.mswDebug.getConfig().debugging.enableRequestTracing = true
```

### Missing Request Stages
```javascript
// Verify middleware pipeline is complete
const trace = window.mswDebug.getRecentTraces()[0]
const expectedStages = ['error-handling', 'instrumentation', 'cors', 'project-resolution', 'authentication', 'request-parsing', 'response-formatting']
const missingStages = expectedStages.filter(stage => !trace.stages.find(s => s.stage === stage))
if (missingStages.length > 0) {
  console.warn('Missing middleware stages:', missingStages)
}
```

### Memory Leaks in Tracing
```javascript
// Check trace history size
const traces = window.mswDebug.getRecentTraces()
if (traces.length > 100) {
  console.warn('Trace history too large, consider clearing:', traces.length)
  window.mswDebug.clearHistory()
}
```

The unified kernel architecture provides a much cleaner and more predictable request tracing experience compared to the previous bridge system, making debugging significantly faster and more effective.