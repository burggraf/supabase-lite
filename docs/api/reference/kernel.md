# Kernel Reference

## Overview

The **Unified Kernel** is the central request processing engine that orchestrates all API operations through a composable middleware pipeline. It replaces the previous dual-bridge architecture with a single, predictable execution path that achieves **97.6% PostgREST compatibility**.

**File**: `src/api/kernel.ts`

## Core Architecture

### Request Flow
```
MSW Request → createApiHandler() → executeMiddlewarePipeline() → Executor → Response
```

### Key Components
1. **Request Conversion**: MSW Request → ApiRequest
2. **Context Initialization**: Setup ApiContext for request tracking
3. **Pipeline Execution**: 7-stage middleware pipeline
4. **Response Formatting**: ApiResponse → MSW HttpResponse
5. **Error Recovery**: Comprehensive error handling and fallback

## API Reference

### Main Functions

#### `createApiHandler(executor: ExecutorFunction)`

Creates a unified API handler with the standard middleware pipeline.

**Parameters:**
- `executor`: Function that handles the actual business logic after middleware processing

**Returns:**
- MSW handler function compatible with MSW rest handlers

**Example:**
```typescript
import { createApiHandler } from '../api/kernel'
import { restExecutor } from '../api/db/executor'

// Create REST API handler
const restHandler = createApiHandler(restExecutor)

// Use in MSW handlers
rest.get('/rest/v1/:table', restHandler)
rest.post('/rest/v1/:table', restHandler)
```

**Internal Process:**
1. **Request Conversion**: Transforms MSW Request to ApiRequest format
2. **Context Setup**: Initializes ApiContext with requestId and startTime
3. **Pipeline Execution**: Runs all 7 middleware functions in sequence
4. **Response Handling**: Converts ApiResponse to appropriate HttpResponse format
5. **Error Fallback**: Provides final error handling if middleware fails

#### `executeMiddlewarePipeline(request, context, executor)`

Executes the complete 7-stage middleware pipeline.

**Parameters:**
- `request: ApiRequest` - Internal request format
- `context: ApiContext` - Request context and tracking information
- `executor: ExecutorFunction` - Final executor to run after middleware

**Returns:**
- `Promise<ApiResponse>` - Processed response from executor

**Middleware Execution Order:**
1. **Error Handling** (`errorHandlingMiddleware`) - Catches and formats all errors
2. **Instrumentation** (`instrumentationMiddleware`) - Request tracking and performance
3. **CORS** (`corsMiddleware`) - Cross-origin header management
4. **Project Resolution** (`projectResolutionMiddleware`) - Multi-tenant database switching
5. **Authentication** (`authenticationMiddleware`) - JWT decoding and RLS context
6. **Request Parsing** (`requestParsingMiddleware`) - PostgREST query syntax parsing
7. **Response Formatting** (`responseFormattingMiddleware`) - Standardized response formatting

#### `createSimpleHandler(handler)`

Creates a simplified handler that bypasses some middleware for lightweight operations.

**Parameters:**
- `handler: (request, context) => Promise<ApiResponse> | ApiResponse` - Simple handler function

**Returns:**
- MSW handler function

**Use Cases:**
- Health checks
- Static content serving
- Debug endpoints
- Operations that don't need full PostgREST processing

**Example:**
```typescript
const healthCheck = createSimpleHandler(async (request, context) => {
  return {
    data: { status: 'healthy', timestamp: Date.now() },
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  }
})
```

### Response Format Handling

The kernel intelligently handles different response content types:

#### JSON Responses (Default)
```typescript
// Automatic JSON formatting for most responses
return HttpResponse.json(response.data, {
  status: response.status,
  headers: response.headers
})
```

#### CSV Responses
```typescript
// Special handling for CSV content-type
if (contentType.startsWith('text/csv')) {
  return new HttpResponse(response.data, {
    status: response.status,
    headers: response.headers
  })
}
```

This ensures CSV data is returned as raw text instead of being JSON-encoded, maintaining proper PostgREST compatibility.

### Request Body Processing

The kernel safely extracts request bodies based on content-type:

#### `getRequestBody(request: Request)`

**Supported Content Types:**
- `application/json` → Parsed as JSON object
- `application/x-www-form-urlencoded` → Converted to key-value object
- Other types → Returned as raw text

**Error Handling:**
- Invalid JSON gracefully falls back to null
- Malformed data logged for debugging
- Always returns a value (never throws)

**Example:**
```typescript
// JSON body
{ "name": "John", "age": 30 } → { name: "John", age: 30 }

// Form data
"name=John&age=30" → { name: "John", age: "30" }

// Raw text
"SELECT * FROM users" → "SELECT * FROM users"
```

## Type System Integration

### Core Interfaces

The kernel uses strongly typed interfaces throughout:

#### `ApiRequest`
```typescript
interface ApiRequest {
  url: URL                          // Parsed URL with searchParams
  method: string                    // HTTP method (GET, POST, etc.)
  headers: Record<string, string>   // Request headers as key-value pairs
  body?: any                        // Parsed request body
  params?: Record<string, string>   // Route parameters from MSW
}
```

#### `ApiResponse`
```typescript
interface ApiResponse {
  data: any                         // Response data (any JSON-serializable type)
  status: number                    // HTTP status code
  headers: Record<string, string>   // Response headers
}
```

#### `ApiContext`
```typescript
interface ApiContext {
  requestId: string                 // Unique request identifier
  projectId?: string                // Multi-tenant project ID
  projectName?: string              // Human-readable project name
  sessionContext?: SessionContext   // Authentication and user context
  startTime: number                 // Request start time for performance tracking
  reportStage?: (stage: string, data?: any) => void  // Middleware reporting function
}
```

## Configuration Integration

The kernel integrates with the centralized configuration system (`src/api/config.ts`):

### Configuration Access
```typescript
import { getApiConfig } from '../config'

const config = getApiConfig()
// Access CORS, debugging, query limits, etc.
```

### Configurable Behaviors
- **CORS Settings**: Allowed origins, methods, headers
- **Debugging Options**: Request tracing, verbose logging, performance tracking
- **Request Limits**: Max size, timeout values
- **Query Settings**: Default limits, counting behavior
- **Authentication**: JWT settings, token expiration

### Dynamic Configuration Updates
```typescript
import { updateApiConfig } from '../config'

// Enable verbose logging at runtime
updateApiConfig({
  debugging: { enableVerboseLogging: true }
})
```

## Debugging and Instrumentation

### Browser Debug Tools

The kernel exposes debugging utilities through `window.mswDebug`:

#### `enableKernelDebugging()`

Exposes kernel-specific debugging functions:

```javascript
// Available in browser console
window.mswDebug.kernelInfo()              // Kernel architecture info
window.mswDebug.enableKernelVerboseLogging()  // Enable detailed logging
```

#### Debug Information Structure
```javascript
kernelInfo() returns:
{
  middlewareCount: 7,
  middlewareStack: [
    'errorHandlingMiddleware',
    'instrumentationMiddleware',
    'corsMiddleware',
    'projectResolutionMiddleware',
    'authenticationMiddleware',
    'requestParsingMiddleware',
    'responseFormattingMiddleware'
  ],
  version: '1.0.0'
}
```

### Performance Monitoring

The kernel provides comprehensive performance tracking:

#### Request Timing
- **Start Time**: Captured in `context.startTime`
- **Per-Middleware Duration**: Tracked by instrumentation middleware
- **Total Request Duration**: End-to-end timing
- **Pipeline Stage Breakdown**: Individual middleware performance

#### Performance Data Access
```javascript
// Get performance metrics
window.mswDebug.getRecentTraces()
window.mswDebug.getBridgeStats()

// Enable performance tracking
window.mswDebug.enableVerboseLogging()
```

## Error Handling Architecture

### Multi-Layer Error Recovery

The kernel provides comprehensive error handling:

#### Layer 1: Middleware Error Handling
- **Primary**: `errorHandlingMiddleware` catches all middleware and executor errors
- **Standardization**: Converts all errors to `ApiError` format
- **Logging**: Comprehensive error logging with context

#### Layer 2: Kernel Error Fallback
- **Final Safety Net**: Catches any errors that bypass middleware
- **Minimal Response**: Returns basic error structure
- **Debugging**: Logs error details for investigation

#### Error Response Format
```typescript
// Fallback error response
{
  error: 'KERNEL_ERROR',
  message: 'An unexpected error occurred in the API kernel'
}
```

### Error Recovery Flow
```
Error Occurs → Error Middleware → ApiError → Formatted Response
     ↓ (if middleware fails)
Kernel Fallback → Basic Error Response
```

## Extension and Customization

### Custom Middleware Creation

The kernel supports custom middleware injection:

```typescript
import type { MiddlewareFunction } from '../types'

export const customMiddleware: MiddlewareFunction = async (request, context, next) => {
  // Pre-processing logic
  console.log(`Processing ${request.method} ${request.url.pathname}`)

  // Modify request if needed
  request.headers['X-Custom-Header'] = 'processed'

  // Call next middleware in pipeline
  const response = await next()

  // Post-processing logic
  response.headers['X-Processing-Time'] =
    (performance.now() - context.startTime).toString()

  return response
}
```

### Custom Handler Registration

```typescript
// Inject custom middleware into pipeline
const customPipeline = [
  errorHandlingMiddleware,
  instrumentationMiddleware,
  customMiddleware,        // ← Custom middleware
  corsMiddleware,
  // ... rest of pipeline
]
```

### Executor Customization

Create custom executors for specialized operations:

```typescript
import type { ExecutorFunction } from '../types'

export const customExecutor: ExecutorFunction = async (request, context) => {
  // Custom business logic
  const result = await processCustomOperation(request, context)

  return {
    data: result,
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Custom-Executor': 'v1.0'
    }
  }
}

// Use with kernel
const customHandler = createApiHandler(customExecutor)
```

## Performance Characteristics

### Request Processing Performance

- **Single Execution Path**: No bridge selection overhead
- **Middleware Composition**: Efficient function call chain
- **Type Safety**: Compile-time optimization with TypeScript
- **Memory Management**: Minimal object allocation per request

### Optimization Features

#### Fast Path Detection
The kernel supports fast path optimization through the Query Engine:
- **Simple Query Detection**: Bypass complex parsing for basic operations
- **Cache-Friendly**: Consistent request patterns enable caching
- **Minimal Allocation**: Reuse objects where possible

#### Connection Pooling Integration
- **Database Connection Reuse**: Integration with DatabaseManager
- **Project-Scoped Connections**: Efficient multi-tenant support
- **Connection Lifecycle**: Automatic cleanup and optimization

### Benchmarking Tools

```javascript
// Performance analysis
const traces = window.mswDebug.getRecentTraces()
const avgDuration = traces.reduce((sum, trace) =>
  sum + (trace.endTime - trace.startTime), 0) / traces.length

console.log(`Average request duration: ${avgDuration.toFixed(2)}ms`)

// Middleware breakdown
traces[0].stages.forEach(stage => {
  console.log(`${stage.stage}: ${stage.duration}ms`)
})
```

## Production Considerations

### Security Features

#### Request Validation
- **Content-Type Validation**: Secure body parsing
- **Size Limits**: Configurable request size limits
- **Header Sanitization**: Safe header processing
- **URL Validation**: Protected against malformed URLs

#### Error Information Disclosure
- **Production Mode**: Limited error details in responses
- **Debug Mode**: Comprehensive error information for development
- **Request ID Tracking**: Safe error correlation without sensitive data

### Monitoring Integration

#### Health Checks
```typescript
// Built-in health check support
const healthHandler = createSimpleHandler(async () => ({
  data: {
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  },
  status: 200,
  headers: { 'Content-Type': 'application/json' }
}))
```

#### Metrics Collection
- **Request Rate**: Requests per second tracking
- **Error Rate**: Error percentage monitoring
- **Response Time**: Percentile-based performance metrics
- **Resource Usage**: Memory and CPU utilization

## Migration from Bridge System

### Key Differences

#### Before: Bridge Selection
```typescript
// OLD: Complex selection logic
const bridge = request.method === 'GET' && isSimpleQuery(request)
  ? simplifiedBridge
  : enhancedBridge

const response = await bridge.process(request)
```

#### After: Unified Processing
```typescript
// NEW: Single pipeline
const handler = createApiHandler(restExecutor)
const response = await handler(mswInfo)
```

### Compatibility Guarantees

- **100% External API Compatibility**: No changes to request/response formats
- **Improved PostgREST Support**: 97.6% compatibility vs previous results
- **Enhanced Error Handling**: Better error messages and debugging
- **Superior Performance**: Reduced complexity and optimized processing

## Troubleshooting

### Common Issues

#### Handler Not Matching
**Symptom**: Request not processed by kernel
**Solution**: Check MSW handler pattern registration

```typescript
// Ensure proper handler registration
rest.get('/rest/v1/:table', createApiHandler(restExecutor))
```

#### Middleware Errors
**Symptom**: Requests failing in pipeline
**Debugging**: Enable verbose logging

```javascript
window.mswDebug.enableVerboseLogging()
window.mswDebug.getRecentTraces()
```

#### Response Format Issues
**Symptom**: Incorrect content-type or response format
**Solution**: Check ResponseFormattingMiddleware and executor response

#### Performance Issues
**Symptom**: Slow request processing
**Debugging**: Analyze middleware timing

```javascript
const trace = window.mswDebug.getRecentTraces()[0]
console.table(trace.stages.map(s => ({
  stage: s.stage,
  duration: s.duration
})))
```

### Debug Checklist

1. ✅ **Handler Registration**: Verify MSW pattern matching
2. ✅ **Middleware Pipeline**: Check all 7 stages execute successfully
3. ✅ **Executor Selection**: Confirm correct executor for operation type
4. ✅ **Request Parsing**: Validate PostgREST syntax and parameters
5. ✅ **Response Formatting**: Ensure proper content-type and structure
6. ✅ **Error Handling**: Check ApiError propagation and formatting

The unified kernel provides a robust, maintainable, and highly compatible foundation for all API operations while maintaining excellent debugging and monitoring capabilities.