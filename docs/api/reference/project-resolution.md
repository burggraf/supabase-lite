# Project Resolution Logic Reference

## Overview

Project resolution is the mechanism that extracts project identifiers from request URLs and switches database connections to the appropriate project context. This system enables multi-tenant operation where each project has its own isolated database.

## Core Components

### Project Resolver
**Location**: `src/mocks/project-resolver.ts`

The project resolver handles URL-based project identification and database context switching with caching for performance optimization.

### Higher-Order Function Pattern
**Location**: `src/mocks/handlers/shared/project-resolution.ts`

The `withProjectResolution` HOF wraps handlers to automatically handle project switching.

## Project Resolution Flow

### 1. URL Pattern Matching

#### Supported URL Patterns
```typescript
// Project-scoped patterns
/:projectId/rest/v1/:table
/:projectId/auth/v1/signup
/:projectId/storage/v1/object/:bucket/:path
/:projectId/functions/v1/:functionName
/:projectId/debug/sql

// Direct patterns (no project scoping)
/rest/v1/:table
/auth/v1/signup
/health
```

#### Project ID Extraction
```typescript
const extractProjectId = (url: string): string | null => {
  const urlPath = new URL(url).pathname
  const segments = urlPath.split('/').filter(Boolean)
  
  // Check if first segment looks like a project ID
  const potentialProjectId = segments[0]
  
  // Validate project ID format (UUID or alphanumeric)
  if (isValidProjectId(potentialProjectId)) {
    return potentialProjectId
  }
  
  return null // No project ID found, use default
}

const isValidProjectId = (id: string): boolean => {
  // UUID pattern: 8-4-4-4-12 hexadecimal
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  
  // Alphanumeric project ID (legacy support)
  const alphanumericPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/
  
  return uuidPattern.test(id) || alphanumericPattern.test(id)
}
```

### 2. Cache Management

#### Cache Structure
```typescript
interface ProjectCacheEntry {
  projectId: string
  normalizedUrl: string
  databaseConnection: PGlite
  timestamp: number
  hitCount: number
}

interface ProjectCache {
  entries: Map<string, ProjectCacheEntry>
  metrics: {
    hits: number
    misses: number
    evictions: number
    totalRequests: number
    averageResolutionTime: number
  }
}
```

#### Cache Key Generation
```typescript
const generateCacheKey = (originalUrl: string): string => {
  const url = new URL(originalUrl)
  const projectId = extractProjectId(url.pathname)
  
  // Cache key includes both project ID and normalized path
  const normalizedPath = projectId 
    ? url.pathname.replace(`/${projectId}`, '')
    : url.pathname
    
  return `${projectId || 'default'}:${normalizedPath}`
}
```

#### TTL and Eviction
```typescript
const CACHE_TTL = 5000 // 5 seconds
const MAX_CACHE_SIZE = 1000

const isCacheEntryValid = (entry: ProjectCacheEntry): boolean => {
  return (Date.now() - entry.timestamp) < CACHE_TTL
}

const evictOldestEntries = (): void => {
  if (projectCache.size <= MAX_CACHE_SIZE) return
  
  const entries = [...projectCache.entries()]
  const sortedByAge = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
  
  // Remove oldest 25% of entries
  const toRemove = Math.floor(MAX_CACHE_SIZE * 0.25)
  for (let i = 0; i < toRemove; i++) {
    projectCache.delete(sortedByAge[i][0])
    cacheMetrics.evictions++
  }
}
```

### 3. Database Connection Switching

#### Connection Management
```typescript
const switchToProject = async (projectId: string): Promise<PGlite> => {
  try {
    // Check if connection already exists for project
    const existingConnection = connectionPool.get(projectId)
    if (existingConnection && existingConnection.isConnected()) {
      return existingConnection
    }
    
    // Create new connection for project
    const connection = await DatabaseManager.createProjectConnection(projectId)
    
    // Verify connection is working
    await connection.query('SELECT 1')
    
    // Store in connection pool
    connectionPool.set(projectId, connection)
    
    return connection
  } catch (error) {
    console.error(`Failed to switch to project ${projectId}:`, error)
    throw new ProjectResolutionError(`Database switch failed for project ${projectId}`)
  }
}
```

#### Connection Pool Management
```typescript
interface ConnectionPool {
  connections: Map<string, PGlite>
  maxConnections: number
  connectionTimeout: number
  cleanupInterval: number
}

const cleanupConnections = (): void => {
  for (const [projectId, connection] of connectionPool.entries()) {
    if (!connection.isConnected() || isConnectionIdle(connection)) {
      connection.close()
      connectionPool.delete(projectId)
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupConnections, 300000)
```

### 4. URL Normalization

#### Path Normalization Process
```typescript
const normalizeUrl = (originalUrl: string, projectId: string | null): string => {
  const url = new URL(originalUrl)
  
  if (projectId) {
    // Remove project ID from path
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments[0] === projectId) {
      segments.shift() // Remove project ID
    }
    url.pathname = '/' + segments.join('/')
  }
  
  return url.toString()
}
```

#### Query Parameter Preservation
```typescript
// Ensure all query parameters are preserved during normalization
const preserveQueryParams = (originalUrl: string, normalizedPath: string): string => {
  const original = new URL(originalUrl)
  const normalized = new URL(normalizedPath, original.origin)
  
  // Copy all query parameters
  original.searchParams.forEach((value, key) => {
    normalized.searchParams.set(key, value)
  })
  
  return normalized.toString()
}
```

## withProjectResolution Higher-Order Function

### Implementation
```typescript
export const withProjectResolution = <T extends Record<string, any>>(
  handler: (req: RestRequest, info: T & { db: PGlite; projectId: string }) => Promise<HttpResponse>
) => {
  return async (req: RestRequest, info: T): Promise<HttpResponse> => {
    const startTime = performance.now()
    const requestId = generateRequestId()
    
    try {
      // Extract project ID from URL
      const projectId = extractProjectId(req.url) || 'default'
      const cacheKey = generateCacheKey(req.url)
      
      console.log(`🗃️ [${requestId}] Project resolution start:`, {
        url: req.url,
        projectId,
        cacheKey
      })
      
      // Check cache first
      let cacheHit = false
      let resolvedContext = projectCache.get(cacheKey)
      
      if (resolvedContext && isCacheEntryValid(resolvedContext)) {
        cacheHit = true
        cacheMetrics.hits++
        resolvedContext.hitCount++
        
        console.log(`🎯 [${requestId}] Cache HIT:`, cacheKey)
      } else {
        // Cache miss - perform resolution
        cacheMetrics.misses++
        console.log(`❌ [${requestId}] Cache MISS:`, cacheKey)
        
        // Switch database connection
        const db = await switchToProject(projectId)
        
        // Normalize URL
        const normalizedUrl = normalizeUrl(req.url, projectId)
        
        // Create cache entry
        resolvedContext = {
          projectId,
          normalizedUrl,
          databaseConnection: db,
          timestamp: Date.now(),
          hitCount: 1
        }
        
        // Store in cache
        projectCache.set(cacheKey, resolvedContext)
        
        // Manage cache size
        evictOldestEntries()
      }
      
      // Update request with normalized URL
      const normalizedRequest = new Request(resolvedContext.normalizedUrl, {
        method: req.method,
        headers: req.headers,
        body: req.body
      })
      
      // Execute handler with project context
      const response = await handler(normalizedRequest, {
        ...info,
        db: resolvedContext.databaseConnection,
        projectId: resolvedContext.projectId
      })
      
      // Add project context to response headers
      response.headers.set('X-Project-ID', resolvedContext.projectId)
      response.headers.set('X-Cache-Hit', cacheHit.toString())
      
      const duration = performance.now() - startTime
      console.log(`✅ [${requestId}] Project resolution complete:`, {
        projectId: resolvedContext.projectId,
        cacheHit,
        duration: `${duration.toFixed(2)}ms`
      })
      
      // Update metrics
      cacheMetrics.totalRequests++
      cacheMetrics.averageResolutionTime = 
        (cacheMetrics.averageResolutionTime + duration) / 2
      
      return response
      
    } catch (error) {
      const duration = performance.now() - startTime
      console.error(`❌ [${requestId}] Project resolution failed:`, {
        error: error.message,
        duration: `${duration.toFixed(2)}ms`
      })
      
      // Return error response
      return new Response(JSON.stringify({
        error: 'Project resolution failed',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}
```

### Usage Pattern
```typescript
// Apply to any handler that needs project resolution
const getUsersHandler = withProjectResolution(async (req, { db, projectId }) => {
  // Handler now has access to:
  // - req: normalized request (project ID removed from URL)
  // - db: database connection for the specific project
  // - projectId: the resolved project identifier
  
  const users = await db.query('SELECT * FROM users LIMIT 10')
  return new Response(JSON.stringify(users.rows))
})
```

## Performance Characteristics

### Cache Performance Metrics
```typescript
interface CacheMetrics {
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  evictions: number
  averageResolutionTime: number
  hitRate: number  // calculated as hits / totalRequests
}

const getCacheMetrics = (): CacheMetrics => {
  const hitRate = cacheMetrics.totalRequests > 0
    ? (cacheMetrics.hits / cacheMetrics.totalRequests) * 100
    : 0
    
  return {
    ...cacheMetrics,
    hitRate: parseFloat(hitRate.toFixed(2))
  }
}
```

### Performance Benchmarks
- **Cache Hit**: ~0.5-1ms (cache lookup + validation)
- **Cache Miss**: ~10-50ms (database switch + URL normalization)
- **Database Switch**: ~5-20ms (connection creation/validation)
- **URL Normalization**: ~0.1-0.5ms (string operations)
- **Memory Usage**: ~1-5MB (cache storage + connections)

### Target Performance Goals
- **Cache Hit Rate**: >80% in steady state
- **Resolution Time**: <10ms average (including cache misses)
- **Memory Usage**: <10MB for cache and connections
- **Cache Size**: <1000 entries maximum

## Error Handling

### Error Types
```typescript
class ProjectResolutionError extends Error {
  constructor(
    message: string,
    public projectId: string,
    public originalUrl: string,
    public phase: 'extraction' | 'validation' | 'db-switch' | 'normalization'
  ) {
    super(message)
    this.name = 'ProjectResolutionError'
  }
}

class CacheCorruptionError extends Error {
  constructor(cacheKey: string, reason: string) {
    super(`Cache corruption detected for key ${cacheKey}: ${reason}`)
    this.name = 'CacheCorruptionError'
  }
}
```

### Error Recovery Strategies
```typescript
const handleResolutionError = async (error: Error, originalUrl: string): Promise<Response> => {
  if (error instanceof ProjectResolutionError) {
    // Log detailed error context
    console.error('Project resolution failed:', {
      projectId: error.projectId,
      url: error.originalUrl,
      phase: error.phase,
      message: error.message
    })
    
    // Attempt fallback to default project
    if (error.phase === 'db-switch' && error.projectId !== 'default') {
      console.log('Attempting fallback to default project...')
      return await resolveWithFallback(originalUrl, 'default')
    }
  }
  
  // Return error response
  return new Response(JSON.stringify({
    error: 'Project resolution failed',
    message: error.message,
    code: 'PROJECT_RESOLUTION_ERROR'
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  })
}
```

## Debugging Project Resolution

### Debug Logging
```typescript
const enableProjectResolutionDebugging = (): void => {
  localStorage.setItem('PROJECT_RESOLUTION_DEBUG', 'true')
  
  // Override console methods to include project context
  const originalLog = console.log
  console.log = (...args) => {
    const projectContext = getCurrentProjectContext()
    originalLog('[PROJECT_DEBUG]', projectContext, ...args)
  }
}
```

### Debug Utilities
```typescript
window.projectDebug = {
  // Get current cache status
  getCacheStatus: () => ({
    size: projectCache.size,
    metrics: getCacheMetrics(),
    entries: [...projectCache.keys()]
  }),
  
  // Clear project cache
  clearCache: () => {
    projectCache.clear()
    console.log('Project cache cleared')
  },
  
  // Force cache eviction
  forceEviction: () => {
    evictOldestEntries()
    console.log('Cache eviction forced')
  },
  
  // Get connection pool status
  getConnectionStatus: () => ({
    activeConnections: connectionPool.size,
    connections: [...connectionPool.keys()]
  }),
  
  // Test project resolution
  testResolution: async (url: string) => {
    const projectId = extractProjectId(url)
    const normalized = normalizeUrl(url, projectId)
    
    console.table({
      originalUrl: url,
      extractedProjectId: projectId,
      normalizedUrl: normalized,
      cacheKey: generateCacheKey(url)
    })
  }
}
```

### Common Issues and Solutions

#### Issue: Cache Corruption
**Symptoms**: Inconsistent project data, wrong database responses
**Debug**: Check cache entries for invalid timestamps or connections
**Solution**: Clear cache and implement cache validation

```typescript
const validateCacheEntry = (entry: ProjectCacheEntry): boolean => {
  return (
    entry.projectId &&
    entry.normalizedUrl &&
    entry.databaseConnection &&
    entry.timestamp > 0 &&
    entry.hitCount >= 0
  )
}
```

#### Issue: Race Conditions
**Symptoms**: Multiple database switches for same project
**Debug**: Monitor concurrent resolution attempts
**Solution**: Implement resolution locking

```typescript
const resolutionLocks = new Set<string>()

const resolveWithLock = async (projectId: string): Promise<PGlite> => {
  if (resolutionLocks.has(projectId)) {
    // Wait for existing resolution to complete
    while (resolutionLocks.has(projectId)) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    return connectionPool.get(projectId)
  }
  
  resolutionLocks.add(projectId)
  try {
    const db = await switchToProject(projectId)
    return db
  } finally {
    resolutionLocks.delete(projectId)
  }
}
```

#### Issue: Memory Leaks
**Symptoms**: Increasing memory usage over time
**Debug**: Monitor cache size and connection pool growth
**Solution**: Implement proper cleanup and limits

```typescript
const memoryMonitor = {
  checkMemoryUsage: () => {
    const usage = performance.memory
    if (usage && usage.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB
      console.warn('High memory usage detected, cleaning up...')
      projectCache.clear()
      cleanupConnections()
    }
  }
}

// Monitor every 30 seconds
setInterval(memoryMonitor.checkMemoryUsage, 30000)
```

This comprehensive project resolution reference provides complete understanding of how multi-tenant project isolation works in the MSW system, enabling developers to debug issues and optimize performance effectively.