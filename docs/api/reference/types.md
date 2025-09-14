# TypeScript Types Reference

## Overview

The unified kernel system is built with **comprehensive type safety** throughout. All interfaces are defined in `src/api/types.ts` and provide strong typing for requests, responses, middleware, executors, and query operations.

**File**: `src/api/types.ts`

## Core Request/Response Types

### ApiRequest Interface

Represents the internal request format used throughout the middleware pipeline and executors.

```typescript
export interface ApiRequest {
  url: URL                          // Parsed URL with searchParams access
  method: string                    // HTTP method (GET, POST, PATCH, DELETE, etc.)
  headers: Record<string, string>   // Request headers as key-value pairs
  body?: any                        // Parsed request body (JSON, form data, or raw)
  params?: Record<string, string>   // Route parameters extracted by MSW
}
```

#### Usage Examples

**GET Request with Query Parameters**:
```typescript
const request: ApiRequest = {
  url: new URL('http://localhost/rest/v1/users?select=id,name&limit=10'),
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: null,
  params: { table: 'users' }
}
```

**POST Request with JSON Body**:
```typescript
const request: ApiRequest = {
  url: new URL('http://localhost/rest/v1/users'),
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  },
  params: { table: 'users' }
}
```

#### Field Details

- **`url`**: Parsed URL object providing easy access to pathname, search parameters, and other URL components
- **`method`**: HTTP verb as string (case-sensitive)
- **`headers`**: Normalized header object (case-sensitive keys)
- **`body`**: Parsed request body based on Content-Type (null for GET/HEAD requests)
- **`params`**: Route parameters from MSW path matching (e.g., `:table` becomes `{ table: 'users' }`)

### ApiResponse Interface

Represents the standardized response format returned by executors and middleware.

```typescript
export interface ApiResponse {
  data: any                         // Response payload (any JSON-serializable type)
  status: number                    // HTTP status code
  headers: Record<string, string>   // Response headers as key-value pairs
}
```

#### Usage Examples

**Successful Data Response**:
```typescript
const response: ApiResponse = {
  data: [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ],
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    'Content-Range': '0-1/2',
    'Access-Control-Allow-Origin': '*'
  }
}
```

**CSV Response**:
```typescript
const response: ApiResponse = {
  data: 'id,name,email\n1,John Doe,john@example.com\n2,Jane Smith,jane@example.com',
  status: 200,
  headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="users.csv"'
  }
}
```

**Error Response**:
```typescript
const response: ApiResponse = {
  data: {
    code: 'TABLE_NOT_FOUND',
    message: 'The table "nonexistent" does not exist',
    hint: 'Check your table name and ensure it exists in the database'
  },
  status: 404,
  headers: {
    'Content-Type': 'application/json',
    'X-Request-ID': 'req_123456789'
  }
}
```

#### Field Details

- **`data`**: Response payload - can be object, array, string, or primitive types
- **`status`**: HTTP status code (200, 201, 400, 404, 500, etc.)
- **`headers`**: Response headers including Content-Type, CORS headers, and custom headers

### ApiContext Interface

Provides request context and metadata shared across the middleware pipeline.

```typescript
export interface ApiContext {
  requestId: string                 // Unique request identifier for tracing
  projectId?: string                // Multi-tenant project identifier
  projectName?: string              // Human-readable project name
  sessionContext?: SessionContext   // Authentication and user context
  startTime: number                 // Request start timestamp (performance.now())
  reportStage?: (stage: string, data?: any) => void  // Middleware reporting function
}
```

#### Usage Examples

**Basic Context**:
```typescript
const context: ApiContext = {
  requestId: 'req_1641234567890_abc123',
  startTime: performance.now()
}
```

**Multi-tenant Context with Authentication**:
```typescript
const context: ApiContext = {
  requestId: 'req_1641234567890_def456',
  projectId: 'proj_healthcare_app',
  projectName: 'Healthcare Application',
  sessionContext: {
    userId: 'user_123456789',
    role: 'authenticated',
    claims: {
      sub: 'user_123456789',
      email: 'user@example.com',
      role: 'authenticated'
    },
    jwt: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...'
  },
  startTime: performance.now(),
  reportStage: (stage, data) => {
    console.log(`Stage ${stage} completed`, data)
  }
}
```

#### Field Details

- **`requestId`**: Generated by instrumentation middleware for request tracing
- **`projectId`**: Set by project resolution middleware for database context switching
- **`projectName`**: Human-readable project identifier
- **`sessionContext`**: User authentication and authorization data
- **`startTime`**: High-resolution timestamp for performance monitoring
- **`reportStage`**: Function provided by instrumentation middleware for stage reporting

## Authentication Types

### SessionContext Interface

Represents authenticated user context and session information.

```typescript
export interface SessionContext {
  userId?: string                   // User identifier from JWT subject
  role?: string                     // User role (anon, authenticated, admin, etc.)
  claims?: Record<string, any>      // Full JWT token claims
  jwt?: string                      // Original JWT token string
}
```

#### Usage Examples

**Authenticated User Session**:
```typescript
const session: SessionContext = {
  userId: 'user_123456789',
  role: 'authenticated',
  claims: {
    sub: 'user_123456789',
    email: 'user@example.com',
    role: 'authenticated',
    aud: 'authenticated',
    iss: 'supabase-lite',
    iat: 1641234567,
    exp: 1641238167
  },
  jwt: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...'
}
```

**Anonymous Session**:
```typescript
const session: SessionContext = {
  role: 'anon'
  // userId, claims, and jwt are undefined
}
```

**Admin Session with Custom Claims**:
```typescript
const session: SessionContext = {
  userId: 'admin_987654321',
  role: 'admin',
  claims: {
    sub: 'admin_987654321',
    email: 'admin@example.com',
    role: 'admin',
    permissions: ['users:read', 'users:write', 'projects:admin'],
    organization_id: 'org_company_xyz'
  },
  jwt: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...'
}
```

#### Field Details

- **`userId`**: Unique user identifier extracted from JWT `sub` or `user_id` claim
- **`role`**: User role for Row Level Security (`anon`, `authenticated`, custom roles)
- **`claims`**: Complete JWT payload for custom authorization logic
- **`jwt`**: Original token string for downstream services or token refresh

## Query Types

### ParsedQuery Interface

Represents parsed PostgREST query parameters and request metadata.

```typescript
export interface ParsedQuery {
  table?: string                    // Target table name
  select?: string[]                 // Selected columns
  filters?: QueryFilter[]           // WHERE clause filters
  order?: QueryOrder[]              // ORDER BY clauses
  limit?: number                    // LIMIT clause
  offset?: number                   // OFFSET clause
  count?: boolean                   // Include count in response
  preferReturn?: 'representation' | 'minimal'      // Return preference
  preferResolution?: 'merge-duplicates' | 'ignore-duplicates'  // UPSERT preference
  returnSingle?: boolean            // Return single object instead of array
  onConflict?: string              // ON CONFLICT clause for UPSERT
  schema?: string                   // Database schema name
  embed?: Record<string, any>       // Embedded/joined resources
  method?: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE' | 'RPC'  // HTTP method
}
```

#### Usage Examples

**Simple SELECT Query**:
```typescript
// URL: /rest/v1/users?select=id,name,email&limit=10&offset=20
const query: ParsedQuery = {
  table: 'users',
  select: ['id', 'name', 'email'],
  limit: 10,
  offset: 20,
  method: 'GET'
}
```

**Filtered Query with Ordering**:
```typescript
// URL: /rest/v1/users?select=*&age=gte.18&order=created_at.desc&limit=50
const query: ParsedQuery = {
  table: 'users',
  select: ['*'],
  filters: [
    { column: 'age', operator: 'gte', value: 18 }
  ],
  order: [
    { column: 'created_at', ascending: false }
  ],
  limit: 50,
  method: 'GET'
}
```

**UPSERT Operation**:
```typescript
// POST /rest/v1/users with Prefer: resolution=merge-duplicates
const query: ParsedQuery = {
  table: 'users',
  method: 'POST',
  preferReturn: 'representation',
  preferResolution: 'merge-duplicates',
  onConflict: 'email'
}
```

**Embedded Resource Query**:
```typescript
// URL: /rest/v1/users?select=*,posts(*,comments(*))
const query: ParsedQuery = {
  table: 'users',
  select: ['*'],
  embed: {
    posts: {
      select: ['*'],
      embed: {
        comments: {
          select: ['*']
        }
      }
    }
  },
  method: 'GET'
}
```

### QueryFilter Interface

Represents individual WHERE clause filters.

```typescript
export interface QueryFilter {
  column: string                    // Column name to filter on
  operator: string                  // Filter operator (eq, gt, lt, in, etc.)
  value: any                        // Filter value
  negated?: boolean                 // Whether filter is negated (NOT)
}
```

#### Usage Examples

**Equality Filter**:
```typescript
// ?name=eq.John
const filter: QueryFilter = {
  column: 'name',
  operator: 'eq',
  value: 'John'
}
```

**Range Filter**:
```typescript
// ?age=gte.18
const filter: QueryFilter = {
  column: 'age',
  operator: 'gte',
  value: 18
}
```

**IN Filter**:
```typescript
// ?status=in.(active,pending,approved)
const filter: QueryFilter = {
  column: 'status',
  operator: 'in',
  value: ['active', 'pending', 'approved']
}
```

**Negated Filter**:
```typescript
// ?email=not.eq.null
const filter: QueryFilter = {
  column: 'email',
  operator: 'eq',
  value: null,
  negated: true
}
```

### QueryOrder Interface

Represents ORDER BY clause specifications.

```typescript
export interface QueryOrder {
  column: string                    // Column name to order by
  ascending: boolean                // Sort direction (true = ASC, false = DESC)
}
```

#### Usage Examples

**Single Column Ordering**:
```typescript
// ?order=created_at.desc
const order: QueryOrder = {
  column: 'created_at',
  ascending: false
}
```

**Multiple Column Ordering**:
```typescript
// ?order=name.asc,created_at.desc
const orders: QueryOrder[] = [
  { column: 'name', ascending: true },
  { column: 'created_at', ascending: false }
]
```

## Function Types

### MiddlewareFunction Type

Defines the signature for middleware functions in the pipeline.

```typescript
export type MiddlewareFunction = (
  request: ApiRequest,              // Incoming request
  context: ApiContext,              // Shared request context
  next: () => Promise<ApiResponse>  // Next middleware/executor in chain
) => Promise<ApiResponse>
```

#### Usage Examples

**Basic Middleware**:
```typescript
const loggingMiddleware: MiddlewareFunction = async (request, context, next) => {
  console.log(`${request.method} ${request.url.pathname}`)

  const response = await next()

  console.log(`Response: ${response.status}`)
  return response
}
```

**Pre/Post Processing Middleware**:
```typescript
const performanceMiddleware: MiddlewareFunction = async (request, context, next) => {
  // Pre-processing
  const startTime = performance.now()
  context.reportStage?.('performance-middleware-start', { startTime })

  // Call next middleware
  const response = await next()

  // Post-processing
  const duration = performance.now() - startTime
  response.headers['X-Processing-Time'] = duration.toString()
  context.reportStage?.('performance-middleware-end', { duration })

  return response
}
```

**Conditional Middleware**:
```typescript
const authRequiredMiddleware: MiddlewareFunction = async (request, context, next) => {
  // Skip authentication for public endpoints
  if (request.url.pathname.startsWith('/public/')) {
    return await next()
  }

  // Require authentication for protected endpoints
  if (!context.sessionContext?.userId) {
    return {
      data: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    }
  }

  return await next()
}
```

### ExecutorFunction Type

Defines the signature for executor functions that handle business logic.

```typescript
export type ExecutorFunction = (
  request: ApiRequest,              // Processed request
  context: ApiContext               // Request context with middleware data
) => Promise<ApiResponse>
```

#### Usage Examples

**REST Executor**:
```typescript
const restExecutor: ExecutorFunction = async (request, context) => {
  const table = request.params?.table
  if (!table) {
    throw new ApiError(ApiErrorCode.MISSING_REQUIRED_PARAMETER, 'Table required')
  }

  const queryEngine = new QueryEngine()
  const response = await queryEngine.processRequest(request, context)

  return {
    data: response.data,
    status: response.status,
    headers: response.headers
  }
}
```

**Custom Business Logic Executor**:
```typescript
const analyticsExecutor: ExecutorFunction = async (request, context) => {
  const userId = context.sessionContext?.userId
  if (!userId) {
    throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User authentication required')
  }

  const analytics = await generateUserAnalytics(userId)

  return {
    data: analytics,
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=300' // Cache for 5 minutes
    }
  }
}
```

**File Upload Executor**:
```typescript
const uploadExecutor: ExecutorFunction = async (request, context) => {
  if (!request.body || !request.body.file) {
    throw new ApiError(ApiErrorCode.BAD_REQUEST, 'File data required')
  }

  const fileService = new FileService()
  const uploadResult = await fileService.uploadFile(request.body.file, context)

  return {
    data: {
      id: uploadResult.fileId,
      url: uploadResult.publicUrl,
      size: uploadResult.size
    },
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'Location': uploadResult.publicUrl
    }
  }
}
```

## Type Guards and Utilities

### Type Safety Helpers

```typescript
// Type guard for ApiError
export function isApiError(error: any): error is ApiError {
  return error instanceof ApiError
}

// Usage
if (isApiError(error)) {
  // TypeScript knows error is ApiError
  console.log(error.statusCode)
  console.log(error.errorCode)
}
```

### Request Type Checking

```typescript
// Check if request has specific parameter
function hasTableParam(request: ApiRequest): request is ApiRequest & { params: { table: string } } {
  return request.params?.table != null
}

// Usage
if (hasTableParam(request)) {
  // TypeScript knows request.params.table exists and is string
  const tableName = request.params.table
}
```

### Response Type Validation

```typescript
// Validate response structure
function isValidApiResponse(response: any): response is ApiResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'data' in response &&
    'status' in response &&
    typeof response.status === 'number' &&
    'headers' in response &&
    typeof response.headers === 'object'
  )
}
```

## Usage Patterns

### Request Processing Pipeline

```typescript
// Complete request processing flow with types
async function processApiRequest(
  mswRequest: Request,
  params: Record<string, string>
): Promise<Response> {

  // 1. Convert to ApiRequest
  const apiRequest: ApiRequest = {
    url: new URL(mswRequest.url),
    method: mswRequest.method,
    headers: Object.fromEntries(mswRequest.headers.entries()),
    body: await parseRequestBody(mswRequest),
    params: params
  }

  // 2. Initialize context
  const context: ApiContext = {
    requestId: generateRequestId(),
    startTime: performance.now()
  }

  // 3. Execute middleware pipeline
  const executor: ExecutorFunction = selectExecutor(apiRequest)
  const response: ApiResponse = await executeMiddlewarePipeline(
    apiRequest,
    context,
    executor
  )

  // 4. Convert to HTTP Response
  return new Response(JSON.stringify(response.data), {
    status: response.status,
    headers: response.headers
  })
}
```

### Custom Middleware Creation

```typescript
// Template for creating type-safe middleware
export function createCustomMiddleware(
  options: CustomMiddlewareOptions
): MiddlewareFunction {

  return async (request: ApiRequest, context: ApiContext, next) => {
    // Type-safe option access
    if (options.enableLogging) {
      console.log(`Processing ${request.method} ${request.url.pathname}`)
    }

    // Modify context with type safety
    const enhancedContext: ApiContext = {
      ...context,
      customData: options.customValue
    }

    // Call next with enhanced context
    const response = await next()

    // Type-safe response modification
    if (options.addHeaders) {
      response.headers = {
        ...response.headers,
        ...options.addHeaders
      }
    }

    return response
  }
}

interface CustomMiddlewareOptions {
  enableLogging?: boolean
  customValue?: any
  addHeaders?: Record<string, string>
}
```

### Error Handling with Types

```typescript
// Type-safe error handling pattern
async function safeExecutorWrapper(
  executor: ExecutorFunction
): Promise<ExecutorFunction> {

  return async (request: ApiRequest, context: ApiContext): Promise<ApiResponse> => {
    try {
      const response = await executor(request, context)

      // Validate response structure
      if (!isValidApiResponse(response)) {
        throw new ApiError(
          ApiErrorCode.INTERNAL_SERVER_ERROR,
          'Invalid response format from executor'
        )
      }

      return response

    } catch (error) {
      // Type-safe error conversion
      if (isApiError(error)) {
        throw error
      }

      throw ApiError.fromError(error, ApiErrorCode.UNKNOWN, context.requestId)
    }
  }
}
```

## Best Practices

### Type Safety Guidelines

1. **Always use interfaces** instead of `any` types
2. **Provide type guards** for runtime type checking
3. **Use discriminated unions** for different request/response types
4. **Implement proper error types** with ApiError
5. **Validate runtime data** matches TypeScript types

### Interface Extension

```typescript
// Extend base interfaces for custom functionality
interface CustomApiRequest extends ApiRequest {
  customField?: string
  metadata?: Record<string, any>
}

interface CustomApiContext extends ApiContext {
  customContext?: CustomContextData
  featureFlags?: string[]
}

// Use extended types in custom middleware
const customMiddleware: MiddlewareFunction = async (
  request: CustomApiRequest,
  context: CustomApiContext,
  next
) => {
  // Access custom fields with type safety
  if (request.customField) {
    context.customContext = processCustomField(request.customField)
  }

  return await next()
}
```

### Generic Type Utilities

```typescript
// Generic response type for specific data shapes
interface TypedApiResponse<T> extends ApiResponse {
  data: T
}

// Usage with specific data types
type UserResponse = TypedApiResponse<User[]>
type ProductResponse = TypedApiResponse<Product>
type ErrorResponse = TypedApiResponse<{ code: string; message: string }>

// Type-safe executor creation
function createTypedExecutor<TData>(
  handler: (request: ApiRequest, context: ApiContext) => Promise<TData>
): ExecutorFunction {

  return async (request, context): Promise<TypedApiResponse<TData>> => {
    const data = await handler(request, context)

    return {
      data,
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  }
}
```

The comprehensive type system ensures type safety throughout the unified kernel architecture while providing flexibility for customization and extension.