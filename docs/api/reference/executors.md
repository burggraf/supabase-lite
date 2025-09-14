# Executor Pattern Reference

## Overview

The **Executor Pattern** provides operation-specific request handlers that execute the actual business logic after the middleware pipeline completes. Each executor is responsible for a specific type of API operation and integrates with the appropriate backend services.

**File**: `src/api/db/executor.ts`

## Architecture

### Executor Interface
```typescript
type ExecutorFunction = (
  request: ApiRequest,
  context: ApiContext
) => Promise<ApiResponse>
```

### Three Core Executors
1. **REST Executor** (`restExecutor`) - Database CRUD operations
2. **HEAD Executor** (`headExecutor`) - Metadata requests
3. **RPC Executor** (`rpcExecutor`) - Stored procedure calls

### Integration Pattern
```
Middleware Pipeline → Executor → Backend Service → Response
```

## REST Executor

### Purpose
Handles all database CRUD (Create, Read, Update, Delete) operations with full PostgREST compatibility.

### Supported Operations
- **GET**: Select queries with filtering, ordering, pagination
- **POST**: Insert operations with UPSERT support
- **PATCH**: Update operations with filtering
- **DELETE**: Delete operations with filtering

### Implementation Details

#### Table Parameter Validation
```typescript
const table = request.params?.table
if (!table) {
  throw new ApiError(
    ApiErrorCode.MISSING_REQUIRED_PARAMETER,
    'Table parameter is required',
    { parameter: 'table' },
    'Check that the table name is included in the request URL',
    context.requestId
  )
}
```

#### QueryEngine Integration
```typescript
// Use the unified query engine for database operations
const response = await queryEngine.processRequest(request, context)
```

#### Response Processing
```typescript
// ResponseFormatter handles CSV formatting and content-type correctly
// Don't override its work - just pass through the response
return {
  data: response.data,
  status: response.status,
  headers: response.headers // Use ResponseFormatter's headers as-is
}
```

### PostgREST Compatibility Features

#### Query Operations
- **Filtering**: `?name=eq.John`, `?age=gt.18`, `?status=in.(active,pending)`
- **Ordering**: `?order=created_at.desc`, `?order=name.asc,age.desc`
- **Pagination**: `?limit=10&offset=20`, `Range: 0-9`
- **Selection**: `?select=id,name,email`, `?select=*,posts(*)`
- **Embedding**: `?select=id,name,posts(title,content)`

#### Insert Operations (POST)
- **Single Insert**: `{ "name": "John", "email": "john@example.com" }`
- **Bulk Insert**: `[{ "name": "John" }, { "name": "Jane" }]`
- **UPSERT**: `Prefer: resolution=merge-duplicates`
- **Return Options**: `Prefer: return=representation` or `return=minimal`

#### Update Operations (PATCH)
- **Filtered Updates**: `PATCH /users?id=eq.123`
- **Bulk Updates**: Update multiple rows matching filter
- **Return Data**: `Prefer: return=representation`

#### Delete Operations (DELETE)
- **Filtered Deletes**: `DELETE /users?id=eq.123`
- **Bulk Deletes**: Delete multiple rows matching filter
- **Return Data**: `Prefer: return=representation`

### QueryEngine Integration

#### Unified Query Processing
The REST executor leverages the **QueryEngine** (`src/api/db/QueryEngine.ts`) for:

1. **PostgREST Parsing**: Complete query syntax parsing
2. **SQL Generation**: Type-safe parameterized queries
3. **RLS Integration**: Automatic row-level security filters
4. **Response Formatting**: PostgREST-compatible response structure
5. **Performance Optimization**: Fast path detection for simple queries

#### Query Processing Flow
```
REST Executor → QueryEngine → SQL Builder → Database → Response Formatter → REST Executor
```

### Error Handling

#### Standardized Error Conversion
```typescript
catch (error: any) {
  logger.error('REST operation failed', {
    requestId: context.requestId,
    table: table,
    method: request.method,
    error: error.message || String(error)
  })

  // Convert to standardized API error for the error handling middleware
  throw ApiError.fromError(error, ApiErrorCode.QUERY_ERROR, context.requestId)
}
```

#### Common Error Scenarios
- **Table Not Found**: Invalid table name in URL
- **Column Not Found**: Invalid column in select or filter
- **Constraint Violation**: Database constraint errors
- **Permission Denied**: RLS policy violations
- **Invalid Query**: Malformed PostgREST syntax

### Performance Characteristics

#### Optimization Features
- **Fast Path**: Simple queries bypass complex parsing
- **Connection Pooling**: Efficient database connection reuse
- **Query Caching**: Repeated queries benefit from caching
- **Prepared Statements**: Parameterized query optimization

#### Metrics
- **Average Response Time**: 5-50ms for simple queries
- **Complex Query Time**: 20-200ms for joins and aggregations
- **Bulk Operations**: Optimized for batch processing

---

## HEAD Executor

### Purpose
Handles HEAD requests that return the same headers as GET requests but without response body data.

### Key Features
- **Metadata Only**: Returns headers without response body
- **Same Processing**: Uses identical logic as GET requests
- **Content-Range**: Includes pagination headers for counting
- **Performance Optimized**: Skips data serialization

### Implementation Details

#### Parameter Validation
```typescript
const table = request.params?.table
if (!table) {
  throw new ApiError(
    ApiErrorCode.MISSING_REQUIRED_PARAMETER,
    'Table parameter is required',
    { parameter: 'table' },
    'Check that the table name is included in the request URL',
    context.requestId
  )
}
```

#### Processing Strategy
```typescript
try {
  // Use query engine for HEAD requests - process as GET but return no body
  const tempRequest = { ...request, method: 'GET' }
  const response = await queryEngine.processRequest(tempRequest, context)

  return {
    data: null, // HEAD requests have no body
    status: response.status,
    headers: response.headers
  }
}
```

### Use Cases

#### Metadata Queries
- **Row Counting**: `HEAD /users` with `Prefer: count=exact`
- **Table Existence**: Check if table exists and is accessible
- **Permission Checking**: Verify read permissions without data transfer
- **Content-Range**: Get pagination metadata without data

#### Performance Benefits
- **Bandwidth Savings**: No response body transfer
- **Faster Processing**: Skip data serialization
- **Client Optimization**: Pre-flight checks before full requests

### HTTP Headers Returned

#### Standard Headers
- **`Content-Range`**: Row count and pagination info
- **`Content-Type`**: Expected response content type
- **`Access-Control-*`**: CORS headers for browser compatibility

#### Example Response
```
HTTP/1.1 200 OK
Content-Range: 0-99/1000
Content-Type: application/json
Access-Control-Allow-Origin: *
```

---

## RPC Executor

### Purpose
Handles Remote Procedure Call (RPC) operations for stored procedures and database functions.

### Supported Methods
- **POST**: Function calls with body parameters
- **GET**: Function calls with query parameters

### Implementation Details

#### Function Name Validation
```typescript
const functionName = request.params?.functionName
if (!functionName) {
  throw new ApiError(
    ApiErrorCode.MISSING_REQUIRED_PARAMETER,
    'Function name parameter is required',
    { parameter: 'functionName' },
    'Check that the function name is included in the request URL',
    context.requestId
  )
}
```

#### Parameter Handling

**POST Requests** (body parameters):
```typescript
let body: any = request.body
// Use request body directly for POST
```

**GET Requests** (query parameters):
```typescript
if (request.method === 'GET') {
  const queryParams: Record<string, any> = {}

  // Convert URLSearchParams to plain object
  for (const [key, value] of request.url.searchParams.entries()) {
    try {
      queryParams[key] = JSON.parse(value)  // Try parsing as JSON
    } catch {
      queryParams[key] = value              // Use as string if not JSON
    }
  }

  body = queryParams
}
```

#### APIRequestOrchestrator Integration

Currently integrates with the legacy APIRequestOrchestrator for function execution:

```typescript
// RPC operations still use orchestrator for now - will be migrated in future phase
// TODO: Integrate RPC functionality into QueryEngine
const { APIRequestOrchestrator } = await import('../../lib/api/core/APIRequestOrchestrator')
const apiOrchestrator = new APIRequestOrchestrator()

const response = await apiOrchestrator.handleRpc(
  functionName,
  body,
  request.headers,
  request.url
)
```

### Function Call Examples

#### POST with JSON Parameters
```bash
POST /rpc/v1/calculate_total
Content-Type: application/json

{
  "user_id": 123,
  "include_tax": true,
  "currency": "USD"
}
```

#### GET with Query Parameters
```bash
GET /rpc/v1/get_user_stats?user_id=123&include_details=true
```

### Return Value Processing

#### JSON Response Format
```typescript
return {
  data: response.data,
  status: response.status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    ...response.headers
  }
}
```

#### Function Result Types
- **Scalar Values**: Single values (number, string, boolean)
- **JSON Objects**: Complex structured data
- **Table Functions**: Array of rows (like SELECT results)
- **Void Functions**: No return value (status 204)

### PostgreSQL Function Integration

#### Function Definition Example
```sql
-- Table function returning multiple rows
CREATE OR REPLACE FUNCTION get_active_users(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(id INTEGER, email TEXT, created_at TIMESTAMP)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.created_at
  FROM auth.users u
  WHERE u.deleted_at IS NULL
  ORDER BY u.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Scalar function returning single value
CREATE OR REPLACE FUNCTION calculate_user_score(user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  score INTEGER;
BEGIN
  SELECT COUNT(*) * 10 INTO score
  FROM user_actions
  WHERE user_id = $1;

  RETURN score;
END;
$$;
```

### Future Migration Plans

The RPC executor is planned for migration to the unified QueryEngine:

#### Current Architecture
```
RPC Executor → APIRequestOrchestrator → Database
```

#### Planned Architecture
```
RPC Executor → QueryEngine → Database
```

#### Benefits of Migration
- **Unified Processing**: Same optimization and caching as REST operations
- **Better Error Handling**: Consistent error formatting
- **RLS Integration**: Proper Row Level Security for functions
- **Performance**: Query optimization and connection pooling

---

## Executor Registration and Routing

### MSW Handler Integration

Executors are registered with MSW handlers through the kernel:

```typescript
import { createApiHandler } from '../api/kernel'
import { restExecutor, headExecutor, rpcExecutor } from '../api/db/executor'

// REST operations
rest.get('/rest/v1/:table', createApiHandler(restExecutor))
rest.post('/rest/v1/:table', createApiHandler(restExecutor))
rest.patch('/rest/v1/:table', createApiHandler(restExecutor))
rest.delete('/rest/v1/:table', createApiHandler(restExecutor))

// HEAD operations
rest.head('/rest/v1/:table', createApiHandler(headExecutor))

// RPC operations
rest.post('/rpc/v1/:functionName', createApiHandler(rpcExecutor))
rest.get('/rpc/v1/:functionName', createApiHandler(rpcExecutor))
```

### Route Pattern Matching

#### REST API Routes
- **`/rest/v1/:table`** → REST Executor
- **Table Parameter**: Extracted from URL path
- **Method-Based Processing**: Different logic for GET/POST/PATCH/DELETE

#### RPC Routes
- **`/rpc/v1/:functionName`** → RPC Executor
- **Function Parameter**: Extracted from URL path
- **Method-Agnostic**: Same executor handles GET and POST

#### Global Routes
- **`/health`** → Simple health check handler
- **`/admin/*`** → Admin-specific handlers
- **`/debug/*`** → Development debugging endpoints

### Error Handling Integration

All executors integrate with the error handling middleware:

```typescript
// Executors throw ApiError instances
throw new ApiError(
  ApiErrorCode.MISSING_REQUIRED_PARAMETER,
  'Table parameter is required',
  { parameter: 'table' },
  'Check that the table name is included in the request URL',
  context.requestId
)

// Error handling middleware catches and formats
catch (error: any) {
  // Convert to standardized error response
  return formatErrorResponse(error)
}
```

## Performance Optimization

### Connection Management

#### Database Connection Pooling
- **Singleton Pattern**: Single QueryEngine instance
- **Connection Reuse**: Efficient connection management
- **Project Isolation**: Proper database context switching

#### Query Optimization
- **Prepared Statements**: Parameterized query optimization
- **Query Plan Caching**: PostgreSQL query plan reuse
- **Index Usage**: Proper index utilization for filters

### Caching Strategies

#### Query Result Caching
```typescript
// Future enhancement: Result caching for read operations
if (request.method === 'GET' && canCache(request)) {
  const cachedResult = await getFromCache(cacheKey)
  if (cachedResult) {
    return cachedResult
  }
}
```

#### Prepared Statement Caching
- **SQL Template Caching**: Reuse SQL generation for similar queries
- **Parameter Binding**: Efficient parameter handling
- **Connection-Level Caching**: PostgreSQL connection benefits

### Performance Monitoring

#### Metrics Collection
```typescript
logger.debug('Executing REST operation', {
  requestId: context.requestId,
  method: request.method,
  table: table,
  projectId: context.projectId
})
```

#### Performance Tracking
- **Request Duration**: End-to-end timing
- **Database Query Time**: SQL execution timing
- **Response Size**: Data transfer metrics
- **Error Rate**: Success/failure statistics

## Extension and Customization

### Custom Executor Creation

#### Template for Custom Executors
```typescript
import type { ExecutorFunction, ApiRequest, ApiContext, ApiResponse } from '../types'

export const customExecutor: ExecutorFunction = async (
  request: ApiRequest,
  context: ApiContext
): Promise<ApiResponse> => {

  // Validate required parameters
  const requiredParam = request.params?.customParam
  if (!requiredParam) {
    throw new ApiError(
      ApiErrorCode.MISSING_REQUIRED_PARAMETER,
      'Custom parameter is required',
      { parameter: 'customParam' },
      'Check request URL parameters',
      context.requestId
    )
  }

  try {
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

  } catch (error: any) {
    // Error handling
    throw ApiError.fromError(error, ApiErrorCode.CUSTOM_ERROR, context.requestId)
  }
}
```

#### Registration with Kernel
```typescript
// Register custom executor with MSW handlers
rest.post('/custom/v1/:customParam', createApiHandler(customExecutor))
```

### Executor Middleware

#### Pre/Post-Processing
```typescript
export const enhancedExecutor: ExecutorFunction = async (request, context) => {
  // Pre-processing
  const startTime = performance.now()

  // Call base executor
  const response = await restExecutor(request, context)

  // Post-processing
  const duration = performance.now() - startTime
  response.headers['X-Processing-Time'] = duration.toString()

  return response
}
```

#### Conditional Logic
```typescript
export const smartExecutor: ExecutorFunction = async (request, context) => {
  // Route to different executors based on conditions
  if (request.url.pathname.includes('/functions/')) {
    return await rpcExecutor(request, context)
  } else if (request.method === 'HEAD') {
    return await headExecutor(request, context)
  } else {
    return await restExecutor(request, context)
  }
}
```

## Testing and Development

### Executor Testing

#### Unit Test Template
```typescript
describe('restExecutor', () => {
  it('should handle GET requests with table parameter', async () => {
    const request: ApiRequest = {
      url: new URL('http://localhost/rest/v1/users'),
      method: 'GET',
      headers: {},
      params: { table: 'users' }
    }

    const context: ApiContext = {
      requestId: 'test-123',
      startTime: performance.now()
    }

    const response = await restExecutor(request, context)

    expect(response.status).toBe(200)
    expect(response.data).toBeDefined()
  })
})
```

#### Integration Testing
- **End-to-End Tests**: Full pipeline testing
- **Database Integration**: Real database operations
- **Error Scenarios**: Error handling verification
- **Performance Tests**: Response time validation

### Development Tools

#### Debug Endpoints
```typescript
// Debug executor for development
export const debugExecutor: ExecutorFunction = async (request, context) => {
  return {
    data: {
      request: {
        method: request.method,
        url: request.url.toString(),
        headers: request.headers,
        body: request.body,
        params: request.params
      },
      context: {
        requestId: context.requestId,
        projectId: context.projectId,
        sessionContext: context.sessionContext
      }
    },
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  }
}
```

The executor pattern provides a clean, extensible architecture for handling different types of API operations while maintaining consistency in error handling, performance monitoring, and PostgREST compatibility.