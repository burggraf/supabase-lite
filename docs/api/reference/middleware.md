# Middleware Reference

## Overview

The unified kernel processes all API requests through a **7-stage middleware pipeline**. Each middleware function handles a specific concern and can perform pre-processing, post-processing, or both. This composable architecture provides clean separation of concerns and makes the system highly maintainable and extensible.

## Pipeline Execution Order

```
1. Error Handling     → Catches and formats all errors
2. Instrumentation   → Request tracking and performance monitoring
3. CORS              → Cross-origin header management
4. Project Resolution → Multi-tenant database switching
5. Authentication    → JWT decoding and RLS context setup
6. Request Parsing   → PostgREST query syntax processing
7. Response Formatting → Standardized response structure
```

Each middleware follows the standard pattern:
```typescript
type MiddlewareFunction = (
  request: ApiRequest,
  context: ApiContext,
  next: () => Promise<ApiResponse>
) => Promise<ApiResponse>
```

## Stage 1: Error Handling Middleware

**File**: `src/api/middleware/error-handling.ts`

### Purpose
Provides comprehensive error handling wrapper for the entire middleware pipeline. This middleware **must be first** in the pipeline to catch all downstream errors.

### Key Responsibilities
- **Catch All Errors**: Wraps the entire pipeline in try-catch
- **Error Standardization**: Converts any error to `ApiError` format
- **Logging**: Structured error logging with appropriate detail levels
- **Response Formatting**: PostgREST-compatible error responses
- **CORS Headers**: Ensures error responses include proper CORS headers
- **Security**: Filters sensitive error details in production mode

### Implementation Details

#### Error Conversion Process
```typescript
// Convert any error to standardized format
let apiError: ApiError
if (isApiError(error)) {
  apiError = error  // Already an ApiError
} else {
  apiError = ApiError.fromError(error, undefined, context.requestId)
}
```

#### Logging Strategy
```typescript
// Log level based on error severity
const errorLevel = apiError.statusCode >= 500 ? 'error' : 'warn'
logger[errorLevel](`Request failed after ${duration.toFixed(2)}ms`, {
  requestId: context.requestId,
  errorCode: apiError.errorCode,
  statusCode: apiError.statusCode,
  details: config.debugging.enableVerboseLogging ? apiError.details : undefined
})
```

#### Response Format Modes

**Development Mode** (detailed errors):
```json
{
  "code": "QUERY_ERROR",
  "message": "Invalid column name 'nonexistent'",
  "details": {
    "sql": "SELECT nonexistent FROM users",
    "hint": "Check column names in your select query"
  }
}
```

**Production Mode** (minimal errors):
```json
{
  "code": "QUERY_ERROR",
  "message": "Query execution failed"
}
```

### Configuration Integration

Controlled by `ApiConfig.request.enableDetailedErrors`:
- **`true`**: Full error details with debugging information
- **`false`**: Minimal error information for security

### Error Handling Features

#### CORS Support in Errors
Even error responses include proper CORS headers:
```typescript
if (corsConfig.allowedOrigins.includes('*') || corsConfig.allowedOrigins.includes(origin)) {
  responseHeaders['Access-Control-Allow-Origin'] = origin || '*'
}
```

#### Request ID Tracking
All error responses include the request ID for debugging:
```typescript
responseHeaders['X-Request-ID'] = context.requestId
```

### Best Practices
- **Never throw from error middleware** - Always return a response
- **Preserve error context** - Include request ID and timing information
- **Security-conscious** - Filter sensitive data in production
- **CORS-compliant** - Always include CORS headers for browser compatibility

---

## Stage 2: Instrumentation Middleware

**File**: `src/api/middleware/instrumentation.ts`

### Purpose
Provides comprehensive request tracking, performance monitoring, and debugging capabilities throughout the middleware pipeline.

### Key Responsibilities
- **Request ID Generation**: Unique identifier for each request
- **Performance Tracking**: End-to-end and per-stage timing
- **Request Tracing**: Detailed execution traces for debugging
- **Debug Tool Integration**: Browser debugging utilities
- **Logging**: Structured request/response logging

### Implementation Details

#### Request Trace Structure
```typescript
interface RequestTrace {
  requestId: string
  method: string
  url: string
  startTime: number
  stages: Array<{
    stage: string
    timestamp: number
    duration?: number
    data?: any
  }>
  completed: boolean
  error?: any
}
```

#### Stage Reporting
```typescript
// Each middleware can report its stage
context.reportStage = (stage: string, data?: any) => {
  addTraceStage(context.requestId!, stage, data)
}
```

#### Performance Metrics Collection
```typescript
// Track request completion
logger.info(`⏱️ Request completed`, {
  requestId: context.requestId,
  duration: Math.round(duration * 100) / 100,
  status: response.status,
  dataSize: typeof response.data === 'string' ? response.data.length :
            response.data ? JSON.stringify(response.data).length : 0
})
```

### Configuration Integration

Controlled by `ApiConfig.debugging`:
- **`enableInstrumentation`**: Basic request/response logging
- **`enableVerboseLogging`**: Detailed debug information
- **`enablePerformanceTracking`**: Timing and metrics collection
- **`enableRequestTracing`**: Stage-by-stage execution traces

### Browser Debug Integration

Exposes debugging utilities via `window.apiDebug`:
```javascript
// Available in browser console
window.apiDebug.getRecentRequests()     // Last 20 requests
window.apiDebug.getRequestById(id)      // Specific request details
window.apiDebug.enableVerboseLogging()  // Toggle detailed logging
window.apiDebug.clearHistory()          // Clear trace history
```

### Trace Storage Management
- **Active Traces**: Stored in `Map<string, RequestTrace>` during execution
- **Completed Traces**: Circular buffer (last 100 completed requests)
- **Memory Management**: Automatic cleanup to prevent memory leaks

---

## Stage 3: CORS Middleware

**File**: `src/api/middleware/cors.ts`

### Purpose
Manages Cross-Origin Resource Sharing (CORS) headers for browser compatibility and security.

### Key Responsibilities
- **CORS Header Management**: Add appropriate headers to all responses
- **Cross-Origin Support**: Enable browser-based API access
- **Security Configuration**: Control which origins, methods, and headers are allowed
- **Preflight Handling**: Support for OPTIONS preflight requests

### Implementation Details

#### Standard CORS Headers
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': config.cors.allowedMethods.join(', '),
  'Access-Control-Allow-Headers': config.cors.allowedHeaders.join(', '),
  'Access-Control-Allow-Credentials': config.cors.credentials.toString(),
  'Access-Control-Max-Age': '86400' // 24 hours
}
```

#### Response Header Integration
```typescript
return {
  ...response,
  headers: {
    ...response.headers,
    ...corsHeaders  // CORS headers added to all responses
  }
}
```

### Configuration Integration

Controlled by `ApiConfig.cors`:
```typescript
cors: {
  allowedOrigins: ['*'],                    // Allowed origins
  allowedMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Prefer', 'Range'],
  credentials: true                         // Include cookies in requests
}
```

### Security Considerations
- **Production Security**: In production, replace `'*'` with specific allowed origins
- **Credential Handling**: `credentials: true` requires specific origin, not wildcard
- **Header Allowlist**: Only allow necessary headers to minimize attack surface

### Browser Compatibility
- **All Modern Browsers**: Full CORS support
- **Preflight Requests**: Automatic handling for complex requests
- **Cookie Support**: Enabled for authentication flows

---

## Stage 4: Project Resolution Middleware

**File**: `src/api/middleware/project-resolution.ts`

### Purpose
Handles multi-tenant database switching by extracting project identifiers from URLs and switching database contexts accordingly.

### Key Responsibilities
- **Project Identification**: Extract project ID from URL paths
- **Database Switching**: Switch to appropriate project database
- **URL Normalization**: Remove project identifiers for downstream handlers
- **Context Management**: Store project information in request context
- **Global Endpoint Handling**: Skip resolution for system endpoints

### Implementation Details

#### Global Endpoint Exclusions
```typescript
const GLOBAL_ENDPOINTS = [
  '/health',
  '/projects',
  '/admin/projects'
]
```

#### Project Resolution Process
```typescript
// Resolve and switch to the appropriate project database
const resolution = await resolveAndSwitchToProject(request.url)

if (!resolution.success) {
  throw {
    statusCode: 404,
    errorCode: 'PROJECT_NOT_FOUND',
    message: resolution.error || 'Project not found'
  }
}
```

#### Context Enhancement
```typescript
// Store project information in context
context.projectId = resolution.projectId
context.projectName = resolution.projectName
```

#### URL Normalization
```typescript
// Normalize the URL to remove project identifier
const normalizedUrl = normalizeApiPath(request.url)
request.url = normalizedUrl  // Update request with normalized URL
```

### Multi-Tenant Architecture Support

#### URL Patterns Supported
- **Project-scoped**: `/projects/{projectId}/rest/v1/table`
- **Domain-based**: `{project}.supabase.co/rest/v1/table`
- **Subdomain**: `{project}.localhost:5173/rest/v1/table`

#### Database Context Switching
- **Connection Pooling**: Efficient switching between project databases
- **Context Isolation**: Each project has isolated database context
- **Performance Optimization**: Cached project resolutions

### Performance Monitoring
```typescript
const resolutionTime = performance.now() - startTime
logger.debug(`Project resolved in ${resolutionTime.toFixed(2)}ms`, {
  projectId: context.projectId,
  originalPath: originalUrl.pathname,
  normalizedPath: normalizedUrl.pathname
})
```

---

## Stage 5: Authentication Middleware

**File**: `src/api/middleware/authentication.ts`

### Purpose
Handles JWT token verification, user authentication, and Row Level Security (RLS) context establishment.

### Key Responsibilities
- **JWT Token Extraction**: From Authorization and apikey headers
- **Token Verification**: Validate JWT signature and expiration
- **User Context Setup**: Extract user ID, role, and claims
- **RLS Context**: Establish session context for database queries
- **Anonymous Handling**: Graceful fallback for unauthenticated requests

### Implementation Details

#### Token Extraction Logic
```typescript
// Support both Bearer tokens and apikey headers
let token: string | undefined

if (authHeader && authHeader.startsWith('Bearer ')) {
  token = authHeader.substring(7)
} else if (apikeyHeader) {
  token = apikeyHeader  // Direct apikey usage
}
```

#### JWT Verification Process
```typescript
const jwtService = JWTService.getInstance()
await jwtService.initialize()

// Verify and decode the JWT token
const payload = await jwtService.verifyToken(token)
```

#### Session Context Establishment
```typescript
// Authenticated user context
context.sessionContext = {
  userId: payload.sub || payload.user_id,
  role: payload.role || 'authenticated',
  claims: payload,              // Full JWT claims
  jwt: token                    // Original token for downstream use
}
```

#### Anonymous Context Handling
```typescript
// No token or invalid token - anonymous access
context.sessionContext = {
  role: 'anon'
}
```

### JWT Service Integration

#### Token Verification
- **Algorithm**: HS256 with configurable secret
- **Expiration**: Automatic expiration checking
- **Claims Validation**: Required claims verification

#### Error Handling Strategy
- **Invalid Token**: Falls back to anonymous access (non-blocking)
- **Expired Token**: Graceful degradation to anonymous
- **Missing Token**: Anonymous access by default

### RLS Integration

#### User Context for Database Queries
The established session context is used by the Query Engine for Row Level Security:
```sql
-- Automatic user context injection
SET LOCAL auth.user_id = '${userId}';
SET LOCAL auth.role = '${role}';
```

#### Role-Based Access
- **`anon`**: Anonymous public access
- **`authenticated`**: Authenticated user access
- **Custom Roles**: Support for custom role-based access

---

## Stage 6: Request Parsing Middleware

**File**: `src/api/middleware/request-parsing.ts`

### Purpose
Parses PostgREST query syntax and converts URL parameters into structured query format for database operations.

### Key Responsibilities
- **PostgREST Syntax Parsing**: Complete query parameter parsing
- **Query Validation**: Ensure valid query structure
- **Request Enhancement**: Add parsed query to request object
- **Error Handling**: Graceful fallback for parsing failures
- **REST API Detection**: Only parse relevant requests

### Implementation Details

#### Request Type Detection
```typescript
const pathSegments = request.url.pathname.split('/').filter(s => s)
const isRestApiRequest = pathSegments.includes('rest') || pathSegments.includes('v1')

if (isRestApiRequest && request.params?.table) {
  // Perform parsing for REST API requests
}
```

#### QueryParser Integration
```typescript
// Use the existing QueryParser for full PostgREST compatibility
const parsedQuery = QueryParser.parseQuery(request.url, request.headers)

// Add parsed query to the request for downstream handlers
(request as any).parsedQuery = {
  ...parsedQuery,
  table: request.params.table,
  method: request.method as any
}
```

#### Parse Error Handling
```typescript
try {
  // Attempt full parsing
  const parsedQuery = QueryParser.parseQuery(request.url, request.headers)
} catch (error) {
  logger.error('Failed to parse request', {
    requestId: context.requestId,
    error: error instanceof Error ? error.message : String(error)
  })

  // Continue with basic request info if parsing fails
  (request as any).parsedQuery = {
    table: request.params?.table,
    method: request.method as any
  }
}
```

### PostgREST Query Syntax Support

#### Supported Query Parameters
- **`select`**: Column selection (`?select=id,name,email`)
- **Filters**: Various filter operators (`?name=eq.John`, `?age=gt.18`)
- **Ordering**: Sort specifications (`?order=created_at.desc`)
- **Pagination**: Limit and offset (`?limit=10&offset=20`)
- **Embedding**: Related resource queries (`?select=*,posts(*)`)
- **Counting**: Row counting (`Prefer: count=exact`)

#### Supported Headers
- **`Prefer`**: Request preferences (`return=representation`, `count=exact`)
- **`Range`**: Pagination ranges (`Range: 0-9`)
- **`Accept`**: Response format (`Accept: text/csv`)

### Performance Considerations
- **Parsing Caching**: Cached parsing results for repeated queries
- **Fast Path**: Skip parsing for simple requests when possible
- **Error Recovery**: Continue processing even if parsing fails

---

## Stage 7: Response Formatting Middleware

**File**: `src/api/middleware/response-formatting.ts`

### Purpose
Ensures consistent response formatting according to PostgREST conventions and API standards.

### Key Responsibilities
- **Response Standardization**: Consistent response structure
- **Content-Type Management**: Proper content-type headers
- **PostgREST Compatibility**: Format responses according to PostgREST standards
- **Pass-Through Processing**: Minimal overhead for already-formatted responses

### Implementation Details

#### Current Implementation
```typescript
export const responseFormattingMiddleware: MiddlewareFunction = async (
  request: ApiRequest,
  context: ApiContext,
  next: () => Promise<ApiResponse>
): Promise<ApiResponse> => {

  const response = await next()

  // The QueryEngine already handles response formatting for REST API requests
  // This middleware is primarily for non-REST endpoints that need standardization
  logger.debug('Response formatting middleware - passing through', {
    requestId: context.requestId,
    path: request.url.pathname,
    status: response.status,
    dataType: Array.isArray(response.data) ? 'array' : typeof response.data
  })

  // Return the response as-is since QueryEngine handles REST API formatting
  return response
}
```

### Architecture Integration

#### QueryEngine Integration
The current implementation leverages the fact that the **QueryEngine** (`src/api/db/QueryEngine.ts`) already handles comprehensive response formatting for REST API requests, including:
- **PostgREST Format Compliance**: Standard response structures
- **Content-Range Headers**: Pagination metadata
- **CSV Format Support**: Proper CSV response formatting
- **Single Resource Handling**: Proper single vs array responses

#### Non-REST Endpoint Support
This middleware provides a hook for future enhancement of non-REST endpoints:
- **Health checks**: JSON formatting for system endpoints
- **Custom endpoints**: Standardized response structure
- **Admin endpoints**: Consistent formatting across admin APIs

### Extension Points

#### Custom Response Formatting
```typescript
// Example extension for custom formatting
if (request.url.pathname.startsWith('/admin/')) {
  return {
    ...response,
    headers: {
      ...response.headers,
      'X-Admin-Response': 'true',
      'Content-Type': 'application/json'
    }
  }
}
```

#### CSV Format Enhancement
```typescript
// Future CSV handling for non-QueryEngine responses
if (request.headers['accept'] === 'text/csv') {
  return formatAsCSV(response)
}
```

### Performance Characteristics
- **Minimal Overhead**: Pass-through processing for most requests
- **Lazy Evaluation**: Only process when formatting is needed
- **Memory Efficient**: No unnecessary object copying

---

## Middleware Pipeline Integration

### Pipeline Composition

The middleware pipeline is composed in the kernel:
```typescript
const middlewareStack: MiddlewareFunction[] = [
  errorHandlingMiddleware,        // Stage 1: Error handling wrapper
  instrumentationMiddleware,      // Stage 2: Request tracking
  corsMiddleware,                // Stage 3: CORS headers
  projectResolutionMiddleware,    // Stage 4: Multi-tenant switching
  authenticationMiddleware,       // Stage 5: JWT and RLS
  requestParsingMiddleware,       // Stage 6: PostgREST parsing
  responseFormattingMiddleware    // Stage 7: Response formatting
]
```

### Execution Flow

#### Request Processing (Outbound)
```
Request → Error → Instrumentation → CORS → Project → Auth → Parsing → Formatting → Executor
```

#### Response Processing (Inbound)
```
Executor → Formatting → Parsing → Auth → Project → CORS → Instrumentation → Error → Response
```

### Context Sharing

Each middleware can add to the shared `ApiContext`:
```typescript
// Project Resolution adds project info
context.projectId = resolution.projectId
context.projectName = resolution.projectName

// Authentication adds session context
context.sessionContext = { userId, role, claims, jwt }

// Instrumentation adds reporting functions
context.reportStage = (stage: string, data?: any) => { ... }
```

### Error Propagation

Errors can be thrown at any stage and will be caught by the Error Handling middleware:
```typescript
// Any middleware can throw
throw new ApiError(ApiErrorCode.PROJECT_NOT_FOUND, 'Project not found')

// Error handling middleware catches and formats
catch (error: any) {
  return standardizedErrorResponse(error)
}
```

## Extension and Customization

### Adding Custom Middleware

#### Template for Custom Middleware
```typescript
import type { MiddlewareFunction, ApiRequest, ApiContext, ApiResponse } from '../types'

export const customMiddleware: MiddlewareFunction = async (
  request: ApiRequest,
  context: ApiContext,
  next: () => Promise<ApiResponse>
): Promise<ApiResponse> => {

  // Pre-processing logic
  const startTime = performance.now()

  // Modify request if needed
  request.headers['X-Custom-Header'] = 'processed'

  // Report to instrumentation if needed
  context.reportStage?.('custom-middleware', { customData: 'value' })

  try {
    // Call next middleware in chain
    const response = await next()

    // Post-processing logic
    const duration = performance.now() - startTime
    response.headers['X-Processing-Time'] = duration.toString()

    return response

  } catch (error) {
    // Handle or re-throw errors
    throw error
  }
}
```

#### Integration with Pipeline
```typescript
// Add to middleware stack in kernel.ts
const middlewareStack: MiddlewareFunction[] = [
  errorHandlingMiddleware,
  instrumentationMiddleware,
  customMiddleware,        // ← Insert custom middleware
  corsMiddleware,
  // ... rest of pipeline
]
```

### Conditional Middleware

#### Route-Specific Processing
```typescript
export const conditionalMiddleware: MiddlewareFunction = async (request, context, next) => {
  if (request.url.pathname.startsWith('/special/')) {
    // Special processing for certain routes
    return await specialProcessing(request, context, next)
  }

  // Normal processing
  return await next()
}
```

#### Feature Flags
```typescript
export const featureFlagMiddleware: MiddlewareFunction = async (request, context, next) => {
  const config = getApiConfig()

  if (config.features.enableNewFeature) {
    // New feature logic
    context.newFeatureEnabled = true
  }

  return await next()
}
```

## Performance Considerations

### Middleware Overhead

#### Per-Request Cost
- **Error Handling**: ~0.1ms (try-catch wrapper)
- **Instrumentation**: ~0.2ms (ID generation, timing)
- **CORS**: ~0.05ms (header addition)
- **Project Resolution**: ~1-5ms (database switching)
- **Authentication**: ~0.5-2ms (JWT verification)
- **Request Parsing**: ~0.5-3ms (PostgREST parsing)
- **Response Formatting**: ~0.05ms (pass-through)

#### Total Pipeline Overhead
- **Simple Request**: ~2-5ms overhead
- **Complex Request**: ~5-15ms overhead
- **Authentication**: +0.5-2ms for JWT verification
- **Project Switching**: +1-5ms for database context switching

### Optimization Strategies

#### Caching
- **JWT Verification**: Cache decoded tokens
- **Project Resolution**: Cache project lookups
- **Query Parsing**: Cache parsed query structures

#### Fast Paths
- **Skip Middleware**: Conditional processing based on request type
- **Early Returns**: Return early when full processing not needed
- **Minimal Processing**: Lightweight processing for simple requests

#### Memory Management
- **Object Reuse**: Minimize object allocation
- **Context Cleanup**: Clean up context after request completion
- **Trace Management**: Limit trace storage size

## Debugging and Monitoring

### Request Tracing

Each middleware can report its execution:
```typescript
context.reportStage?.('middleware-name', {
  processingTime: duration,
  dataModified: modified,
  customMetrics: metrics
})
```

### Performance Monitoring

Track middleware performance:
```javascript
// Browser console debugging
const trace = window.mswDebug.getRecentTraces()[0]
trace.stages.forEach(stage => {
  console.log(`${stage.stage}: ${stage.duration}ms`)
})
```

### Error Debugging

Enable verbose logging for detailed error information:
```javascript
window.mswDebug.enableVerboseLogging()
// All middleware will now log detailed information
```

The middleware pipeline provides a robust, extensible foundation for API request processing with comprehensive error handling, monitoring, and debugging capabilities while maintaining high performance and PostgREST compatibility.