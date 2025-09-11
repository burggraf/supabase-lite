# Common Issues and Solutions

## Overview

This document catalogs known issues in the MSW API system, their symptoms, root causes, and solutions. Issues are organized by category with specific debugging steps and code fixes.

## 🚨 Critical Issues

### 1. Bridge Selection Confusion

**Symptoms:**
- Features work in one environment but not another
- Inconsistent query parsing behavior
- Silent failures with complex queries

**Root Cause:**
- `USE_SIMPLIFIED_BRIDGE` flag creates runtime uncertainty
- Different bridges have different capabilities
- No clear indication which bridge handled a request

**Solution:**
```javascript
// Add bridge identification to all responses
console.log('🌉 Bridge used:', activeBridge.constructor.name)

// In response headers
response.headers.set('X-Bridge-Used', bridgeName)

// Feature detection before processing
if (hasComplexQuery && USE_SIMPLIFIED_BRIDGE) {
  console.warn('Complex query sent to simplified bridge:', query)
}
```

**Prevention:**
- Always check bridge capabilities before using features
- Add bridge identification to error messages
- Test with both bridges during development

### 2. Project Resolution Cache Corruption

**Symptoms:**
- Requests return data from wrong project
- Database switches don't persist
- Cache hit rate drops unexpectedly

**Root Cause:**
- Race conditions in cache updates
- Invalid cache invalidation logic
- Memory leaks in cache storage

**Solution:**
```javascript
// Fix race condition in project-resolver.ts
const resolveProject = async (url) => {
  const cacheKey = extractProjectId(url)
  
  // Use atomic cache operations
  if (projectCache.has(cacheKey)) {
    const cached = projectCache.get(cacheKey)
    if (!isExpired(cached)) {
      return cached.value
    }
  }
  
  // Prevent concurrent resolution
  if (resolutionInProgress.has(cacheKey)) {
    return await resolutionInProgress.get(cacheKey)
  }
  
  const resolutionPromise = actuallyResolveProject(url)
  resolutionInProgress.set(cacheKey, resolutionPromise)
  
  try {
    const result = await resolutionPromise
    projectCache.set(cacheKey, { value: result, timestamp: Date.now() })
    return result
  } finally {
    resolutionInProgress.delete(cacheKey)
  }
}
```

**Prevention:**
- Monitor cache hit rates
- Add cache invalidation logging
- Implement cache health checks

### 3. RLS Filter Bypass

**Symptoms:**
- Users see data they shouldn't have access to
- RLS policies not being enforced
- Authorization checks failing silently

**Root Cause:**
- User context not properly extracted from JWT
- RLS filters not applied consistently
- Database context switching loses user info

**Solution:**
```javascript
// Ensure user context propagation
const applyRLS = async (query, userContext) => {
  if (!userContext?.userId) {
    throw new Error('User context required for RLS')
  }
  
  // Validate user context structure
  const requiredFields = ['userId', 'role', 'claims']
  for (const field of requiredFields) {
    if (!userContext[field]) {
      console.warn(`Missing RLS context field: ${field}`)
    }
  }
  
  // Apply user context to query
  const rlsQuery = addUserContextToQuery(query, userContext)
  console.log('🔒 RLS applied:', { originalQuery: query, rlsQuery, userContext })
  
  return rlsQuery
}
```

**Prevention:**
- Always validate user context before database operations
- Add RLS enforcement tests
- Log RLS filter application

## 🐛 Bridge-Specific Issues

### Enhanced Bridge Issues

#### Complex Query Memory Leaks
**Symptoms:**
- Memory usage increases with complex queries
- Browser becomes unresponsive
- Performance degrades over time

**Root Cause:**
- Recursive parsing creates deep object graphs
- Query cache grows without bounds
- Event listeners not cleaned up

**Solution:**
```javascript
// Add memory management to enhanced bridge
class EnhancedSupabaseAPIBridge {
  constructor() {
    this.queryCache = new Map()
    this.maxCacheSize = 1000
  }
  
  parseComplexQuery(queryString) {
    // Check cache size and clean if needed
    if (this.queryCache.size > this.maxCacheSize) {
      const oldestEntries = [...this.queryCache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, this.maxCacheSize / 2)
      
      oldestEntries.forEach(([key]) => this.queryCache.delete(key))
    }
    
    // Parse with memory limits
    return parseWithLimits(queryString, { maxDepth: 10, maxNodes: 1000 })
  }
}
```

#### OR/AND Logic Edge Cases
**Symptoms:**
- Complex OR/AND queries return incorrect results
- Some filters ignored silently
- Boolean logic evaluation errors

**Root Cause:**
- Operator precedence issues
- Parentheses parsing problems
- URL encoding complications

**Solution:**
```javascript
// Fix OR/AND parsing in enhanced bridge
const parseLogicalOperators = (filterString) => {
  // Handle URL encoding issues
  const decoded = decodeURIComponent(filterString)
  
  // Parse with proper precedence
  const ast = parseLogicalExpression(decoded)
  
  // Validate AST structure
  if (!isValidLogicalAST(ast)) {
    throw new Error(`Invalid logical expression: ${filterString}`)
  }
  
  return ast
}
```

### Simplified Bridge Issues

#### Known Overlaps Operator Bug
**Symptoms:**
- Overlaps operator queries fail
- Debugging code present in production
- Inconsistent range operation results

**Root Cause:**
- Incomplete implementation of overlaps operator
- Test debugging code left in production

**Current Status:**
```javascript
// In simplified-bridge.ts - evidence of active debugging
console.log('Overlaps operator debug:', overlapResults)
```

**Solution:**
```javascript
// Fix overlaps operator implementation
const handleOverlapsOperator = (column, value, tableAlias = '') => {
  // Validate input ranges
  if (!isValidRange(value)) {
    throw new Error(`Invalid range for overlaps operator: ${value}`)
  }
  
  // Generate proper PostgreSQL overlaps query
  const sqlColumn = tableAlias ? `${tableAlias}.${column}` : column
  const rangeValue = formatRangeForSQL(value)
  
  return `${sqlColumn} && ${rangeValue}`
}

// Remove debug logging
// console.log('Overlaps operator debug:', overlapResults) // DELETE THIS
```

#### Limited Embedding Support
**Symptoms:**
- Multi-level embedding requests fail
- Nested relationship queries ignored
- Silent fallback to simple queries

**Root Cause:**
- Simplified bridge only supports single-level embedding
- No error when unsupported features requested

**Solution:**
```javascript
// Add feature detection and warnings
const detectUnsupportedFeatures = (query) => {
  const unsupported = []
  
  // Check for multi-level embedding
  if (query.select?.includes('(') && countNestingLevel(query.select) > 1) {
    unsupported.push('Multi-level embedding not supported in simplified bridge')
  }
  
  // Check for OR operators
  if (query.filters?.some(f => f.includes('or('))) {
    unsupported.push('OR operators not supported in simplified bridge')
  }
  
  if (unsupported.length > 0) {
    console.warn('⚠️ Unsupported features detected:', unsupported)
    console.warn('💡 Consider switching to enhanced bridge')
  }
  
  return unsupported
}
```

## 🔧 Handler-Specific Issues

### Request Routing Problems

#### Handler Order Dependencies
**Symptoms:**
- Requests handled by wrong handler
- Specific routes not matching
- Generic handlers catching specific requests

**Root Cause:**
- Handler order in `handlers/index.ts` affects matching
- More specific handlers must come before general ones

**Solution:**
```javascript
// Correct handler order in handlers/index.ts
export const handlers = [
  // Specific routes first
  ...authHandlers,          // /auth/v1/specific-endpoint
  ...debugHandlers,         // /debug/sql (specific)
  ...restHandlers,          // /rest/v1/:table (generic)
  ...projectHandlers,       // /:projectId/* (very generic)
  
  // Catch-all last
  corsAndCatchAllHandler    // Must be absolutely last
]
```

#### URL Pattern Conflicts
**Symptoms:**
- Same URL handled differently in different contexts
- Project-scoped vs. direct routes confusion

**Root Cause:**
- Overlapping URL patterns
- Project ID extraction ambiguity

**Solution:**
```javascript
// Make URL patterns more specific
const patterns = {
  // Direct routes - no project
  direct: '/rest/v1/:table',
  
  // Project routes - explicit project UUID pattern
  project: '/:projectId(\\w{8}-\\w{4}-\\w{4}-\\w{4}-\\w{12})/rest/v1/:table',
  
  // Fallback for non-UUID first segments
  legacy: '/:notProjectId/rest/v1/:table'
}
```

### CORS Configuration Issues

#### Inconsistent CORS Headers
**Symptoms:**
- CORS errors in browser console
- Requests blocked by browser
- Inconsistent preflight responses

**Root Cause:**
- Not all handlers include CORS headers
- Preflight OPTIONS requests not handled properly

**Solution:**
```javascript
// Ensure all responses include CORS headers
const addCORSHeaders = (response) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, DELETE, PUT, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Type, X-Function-Name',
    'Access-Control-Max-Age': '86400'
  }
  
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
}

// Apply to all handlers
const responseWithCORS = addCORSHeaders(new Response(json))
```

## 🔍 Database Issues

### Connection Management Problems

#### Project Database Switching Failures
**Symptoms:**
- Queries return data from wrong project
- Database connection errors
- Project isolation failures

**Root Cause:**
- Database connections not properly switched
- Connection pooling issues
- Transaction isolation problems

**Solution:**
```javascript
// Improve database switching reliability
const switchToProject = async (projectId) => {
  try {
    // Ensure clean connection state
    await currentConnection?.close()
    
    // Create new connection with proper isolation
    const connection = await DatabaseManager.createConnection(projectId)
    
    // Verify connection is for correct project
    const result = await connection.query('SELECT current_database()')
    if (result.rows[0].current_database !== projectId) {
      throw new Error(`Database switch failed: expected ${projectId}, got ${result.rows[0].current_database}`)
    }
    
    currentConnection = connection
    return connection
  } catch (error) {
    console.error('❌ Database switch failed:', error)
    throw error
  }
}
```

#### Query Parameter Injection
**Symptoms:**
- SQL injection vulnerabilities
- Query execution errors
- Unexpected database behavior

**Root Cause:**
- Direct string concatenation in SQL generation
- Unescaped user input

**Solution:**
```javascript
// Use parameterized queries
const generateSafeSQL = (table, filters, userInput) => {
  const params = []
  const conditions = []
  
  filters.forEach((filter, index) => {
    // Use parameterized placeholders
    conditions.push(`${filter.column} ${filter.operator} $${index + 1}`)
    params.push(filter.value)
  })
  
  const sql = `SELECT * FROM ${escapeIdentifier(table)} WHERE ${conditions.join(' AND ')}`
  
  return { sql, params }
}
```

## 🚀 Performance Issues

### Query Performance Problems

#### Slow Complex Queries
**Symptoms:**
- Long response times for embedded queries
- Browser freezing during query processing
- Memory usage spikes

**Root Cause:**
- Inefficient SQL generation
- N+1 query problems
- Large result set processing

**Solution:**
```javascript
// Optimize embedded query generation
const generateOptimizedEmbeddedQuery = (mainTable, embedConfig) => {
  // Use JOINs instead of separate queries
  const joins = embedConfig.map(embed => 
    `LEFT JOIN ${embed.table} ON ${mainTable}.${embed.foreignKey} = ${embed.table}.${embed.primaryKey}`
  ).join(' ')
  
  // Select specific columns to reduce data transfer
  const columns = [
    `${mainTable}.*`,
    ...embedConfig.map(embed => 
      embed.columns.map(col => `${embed.table}.${col} AS ${embed.table}_${col}`)
    ).flat()
  ].join(', ')
  
  return `SELECT ${columns} FROM ${mainTable} ${joins}`
}
```

#### Cache Performance Issues
**Symptoms:**
- Cache hit rates below 80%
- Memory usage growing continuously
- Cache invalidation not working

**Root Cause:**
- Cache key collisions
- TTL not properly enforced
- Cache size limits not implemented

**Solution:**
```javascript
// Implement proper cache management
class CacheManager {
  constructor(maxSize = 1000, ttl = 300000) { // 5 minute TTL
    this.cache = new Map()
    this.maxSize = maxSize
    this.ttl = ttl
    this.accessTimes = new Map()
  }
  
  set(key, value) {
    // Implement LRU eviction
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }
    
    this.cache.set(key, { value, timestamp: Date.now() })
    this.accessTimes.set(key, Date.now())
  }
  
  get(key) {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      this.accessTimes.delete(key)
      return null
    }
    
    // Update access time for LRU
    this.accessTimes.set(key, Date.now())
    return entry.value
  }
  
  evictOldest() {
    const oldest = [...this.accessTimes.entries()]
      .sort((a, b) => a[1] - b[1])[0]
    
    if (oldest) {
      this.cache.delete(oldest[0])
      this.accessTimes.delete(oldest[0])
    }
  }
}
```

## 🧪 Testing and Development Issues

### Test Environment Problems

#### MSW Not Starting in Tests
**Symptoms:**
- Tests make real network requests
- MSW handlers not intercepting requests
- Inconsistent test results

**Root Cause:**
- MSW server not properly initialized in test setup
- Handler registration timing issues

**Solution:**
```javascript
// In test setup (vitest.config.ts or test/setup.ts)
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from '../src/mocks/server'

beforeAll(() => {
  // Start MSW server before tests
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  // Reset handlers between tests
  server.resetHandlers()
})

afterAll(() => {
  // Clean up after tests
  server.close()
})
```

#### Handler Conflicts in Tests
**Symptoms:**
- Tests interfere with each other
- Handler state persists between tests
- Flaky test results

**Root Cause:**
- Shared handler state
- Global variables not reset

**Solution:**
```javascript
// Reset all state between tests
afterEach(() => {
  // Reset MSW handlers
  server.resetHandlers()
  
  // Reset global state
  projectCache.clear()
  bridgeStats = { enhanced: 0, simplified: 0 }
  
  // Clear browser storage
  localStorage.clear()
  sessionStorage.clear()
})
```

## 🔥 Emergency Debugging

### When Everything is Broken

1. **Check MSW is running**: `localStorage.getItem('MSW_DEBUG')`
2. **Verify handler order**: Look at `handlers/index.ts`
3. **Test with debug endpoint**: `POST /debug/sql` with simple query
4. **Check project resolution**: Monitor project cache behavior
5. **Validate bridge selection**: Add bridge logging
6. **Test database directly**: Use browser DevTools to query PGlite

### Quick Fixes for Common Problems

```javascript
// Quick fix: Force enhanced bridge
window.forceEnhancedBridge = true
const activeBridge = window.forceEnhancedBridge || !USE_SIMPLIFIED_BRIDGE ? enhancedBridge : simplifiedBridge

// Quick fix: Clear all caches
window.clearAllCaches = () => {
  projectCache.clear()
  queryCache.clear()
  localStorage.clear()
  console.log('All caches cleared')
}

// Quick fix: Enable verbose logging
window.enableVerboseLogging = () => {
  localStorage.setItem('MSW_DEBUG', 'true')
  localStorage.setItem('BRIDGE_DEBUG', 'true')
  localStorage.setItem('DB_DEBUG', 'true')
  console.log('Verbose logging enabled - reload page')
}
```

This comprehensive guide should help identify and resolve the most common issues in the MSW API system, significantly reducing debugging time and improving system reliability.