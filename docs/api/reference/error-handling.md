# Error Handling Reference

## Overview

The unified kernel system uses a **standardized error handling architecture** built around the `ApiError` class. This provides consistent error formatting, automatic HTTP status code mapping, and comprehensive error categorization across all API operations.

**File**: `src/api/errors.ts`

## ApiError Class

### Core Architecture
```typescript
export class ApiError extends Error {
  public readonly statusCode: number      // HTTP status code
  public readonly errorCode: ApiErrorCode // Standardized error code
  public readonly details?: any           // Additional error context
  public readonly hint?: string           // User-friendly guidance
  public readonly requestId?: string      // Request tracing ID
}
```

### Constructor Signature
```typescript
constructor(
  errorCode: ApiErrorCode,
  message?: string,        // Human-readable error message
  details?: any,          // Additional context (objects, arrays, etc.)
  hint?: string,          // Helpful suggestion for fixing the error
  requestId?: string      // Request ID for tracing and debugging
)
```

### Usage Examples

#### Basic Error Creation
```typescript
throw new ApiError(
  ApiErrorCode.TABLE_NOT_FOUND,
  'The table "nonexistent" does not exist',
  { table: 'nonexistent' },
  'Check your table name and ensure it exists in the database',
  context.requestId
)
```

#### Validation Error
```typescript
throw new ApiError(
  ApiErrorCode.INVALID_PARAMETER_TYPE,
  'Parameter "limit" must be a number',
  { parameter: 'limit', receivedType: 'string', expectedType: 'number' },
  'Use ?limit=10 instead of ?limit=ten',
  context.requestId
)
```

#### Database Constraint Error
```typescript
throw new ApiError(
  ApiErrorCode.UNIQUE_VIOLATION,
  'Email address already exists',
  { constraint: 'users_email_key', column: 'email', value: 'user@example.com' },
  'Try using a different email address',
  context.requestId
)
```

## Error Code Categories

### Generic HTTP Errors
```typescript
enum ApiErrorCode {
  UNKNOWN = 'UNKNOWN',                           // 500
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR', // 500
  BAD_REQUEST = 'BAD_REQUEST',                   // 400
  UNAUTHORIZED = 'UNAUTHORIZED',                 // 401
  FORBIDDEN = 'FORBIDDEN',                       // 403
  NOT_FOUND = 'NOT_FOUND',                      // 404
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',     // 405
  CONFLICT = 'CONFLICT',                        // 409
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY', // 422
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS'       // 429
}
```

### Authentication Errors
```typescript
enum ApiErrorCode {
  INVALID_TOKEN = 'INVALID_TOKEN',               // 401
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',               // 401
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',   // 401
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',             // 423
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',     // 400
  MFA_REQUIRED = 'MFA_REQUIRED',                 // 400
  INVALID_MFA_CODE = 'INVALID_MFA_CODE'          // 400
}
```

### Database Errors
```typescript
enum ApiErrorCode {
  QUERY_ERROR = 'QUERY_ERROR',                   // 400
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION', // 409
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION', // 409
  UNIQUE_VIOLATION = 'UNIQUE_VIOLATION',         // 409
  TABLE_NOT_FOUND = 'TABLE_NOT_FOUND',           // 404
  COLUMN_NOT_FOUND = 'COLUMN_NOT_FOUND',         // 404
  PERMISSION_DENIED = 'PERMISSION_DENIED'        // 403
}
```

### Request Parsing Errors
```typescript
enum ApiErrorCode {
  INVALID_QUERY_SYNTAX = 'INVALID_QUERY_SYNTAX',     // 400
  INVALID_FILTER = 'INVALID_FILTER',                 // 400
  INVALID_ORDER_BY = 'INVALID_ORDER_BY',             // 400
  INVALID_LIMIT = 'INVALID_LIMIT',                   // 400
  MISSING_REQUIRED_PARAMETER = 'MISSING_REQUIRED_PARAMETER', // 400
  INVALID_PARAMETER_TYPE = 'INVALID_PARAMETER_TYPE'  // 400
}
```

### Storage Errors
```typescript
enum ApiErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',             // 404
  BUCKET_NOT_FOUND = 'BUCKET_NOT_FOUND',         // 404
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',             // 413
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',       // 415
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED' // 507
}
```

### Project Management Errors
```typescript
enum ApiErrorCode {
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',           // 404
  PROJECT_ACCESS_DENIED = 'PROJECT_ACCESS_DENIED'    // 403
}
```

### Edge Function Errors
```typescript
enum ApiErrorCode {
  FUNCTION_NOT_FOUND = 'FUNCTION_NOT_FOUND',     // 404
  FUNCTION_TIMEOUT = 'FUNCTION_TIMEOUT',         // 408
  FUNCTION_ERROR = 'FUNCTION_ERROR'              // 500
}
```

## HTTP Status Code Mapping

The system automatically maps error codes to appropriate HTTP status codes:

```typescript
export const ERROR_STATUS_MAP: Record<ApiErrorCode, number> = {
  // Client errors (4xx)
  [ApiErrorCode.BAD_REQUEST]: 400,
  [ApiErrorCode.UNAUTHORIZED]: 401,
  [ApiErrorCode.FORBIDDEN]: 403,
  [ApiErrorCode.NOT_FOUND]: 404,
  [ApiErrorCode.METHOD_NOT_ALLOWED]: 405,
  [ApiErrorCode.CONFLICT]: 409,
  [ApiErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ApiErrorCode.TOO_MANY_REQUESTS]: 429,

  // Server errors (5xx)
  [ApiErrorCode.UNKNOWN]: 500,
  [ApiErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ApiErrorCode.FUNCTION_ERROR]: 500,

  // Custom status codes
  [ApiErrorCode.ACCOUNT_LOCKED]: 423,          // Locked
  [ApiErrorCode.FILE_TOO_LARGE]: 413,          // Payload Too Large
  [ApiErrorCode.INVALID_FILE_TYPE]: 415,       // Unsupported Media Type
  [ApiErrorCode.STORAGE_QUOTA_EXCEEDED]: 507,  // Insufficient Storage
  [ApiErrorCode.FUNCTION_TIMEOUT]: 408         // Request Timeout
}
```

## Response Formats

### Standard JSON Format
```typescript
// ApiError.toJSON() output
{
  "error": {
    "code": "TABLE_NOT_FOUND",
    "message": "The table \"users\" does not exist",
    "details": { "table": "users" },
    "hint": "Check your table name and ensure it exists in the database"
  },
  "status": 404,
  "requestId": "req_1234567890_abcdef"
}
```

### PostgREST-Compatible Format
```typescript
// ApiError.toPostgRESTFormat() output
{
  "code": "TABLE_NOT_FOUND",
  "details": { "table": "users" },
  "hint": "Check your table name and ensure it exists in the database",
  "message": "The table \"users\" does not exist"
}
```

### Error Middleware Response Format

#### Development Mode (Detailed Errors)
```json
{
  "code": "UNIQUE_VIOLATION",
  "message": "duplicate key value violates unique constraint \"users_email_key\"",
  "details": {
    "constraint": "users_email_key",
    "column": "email",
    "value": "user@example.com",
    "sql": "INSERT INTO users (email) VALUES ($1)",
    "parameters": ["user@example.com"]
  },
  "hint": "Try using a different email address"
}
```

#### Production Mode (Minimal Errors)
```json
{
  "code": "UNIQUE_VIOLATION",
  "message": "Email address already exists"
}
```

## Error Creation Patterns

### Static Factory Methods

#### Validation Errors
```typescript
// ApiError.validation() - for parameter validation
const error = ApiError.validation(
  'Parameter "limit" must be between 1 and 1000',
  'limit',
  context.requestId
)
```

#### Database Errors
```typescript
// ApiError.database() - for database operations
const error = ApiError.database(
  'Query execution failed',
  originalDatabaseError,
  context.requestId
)
```

#### Authentication Errors
```typescript
// ApiError.auth() - for authentication issues
const error = ApiError.auth(
  ApiErrorCode.TOKEN_EXPIRED,
  'JWT token has expired',
  context.requestId
)
```

#### Not Found Errors
```typescript
// ApiError.notFound() - for missing resources
const error = ApiError.notFound('User', context.requestId)
// Results in: "User not found"
```

#### Forbidden Errors
```typescript
// ApiError.forbidden() - for permission issues
const error = ApiError.forbidden(
  'Insufficient permissions to access this resource',
  context.requestId
)
```

### Generic Error Conversion

#### FromError Static Method
```typescript
// Converts any error to ApiError
const apiError = ApiError.fromError(
  originalError,
  ApiErrorCode.QUERY_ERROR,  // fallback error code
  context.requestId
)
```

## PostgreSQL Error Mapping

The system automatically maps PostgreSQL error codes to appropriate ApiError instances:

### Constraint Violations
```typescript
// PostgreSQL Code → ApiError Code
'23505' → UNIQUE_VIOLATION           // unique_violation
'23503' → FOREIGN_KEY_VIOLATION      // foreign_key_violation
'23514' → CONSTRAINT_VIOLATION       // check_violation
'23502' → CONSTRAINT_VIOLATION       // not_null_violation
```

### Schema Errors
```typescript
// PostgreSQL Code → ApiError Code
'42P01' → TABLE_NOT_FOUND           // undefined_table
'42703' → COLUMN_NOT_FOUND          // undefined_column
'42501' → PERMISSION_DENIED         // insufficient_privilege
```

### Example PostgreSQL Error Conversion
```typescript
// Original PostgreSQL error
const pgError = {
  code: '23505',
  message: 'duplicate key value violates unique constraint "users_email_key"',
  detail: 'Key (email)=(user@example.com) already exists.',
  constraint: 'users_email_key'
}

// Automatically converts to:
const apiError = new ApiError(
  ApiErrorCode.UNIQUE_VIOLATION,      // Mapped from '23505'
  pgError.message,                    // Original message
  pgError,                            // Full error details
  undefined,                          // No hint provided
  context.requestId                   // Request tracking ID
)
```

## Error Handling in Middleware Pipeline

### Error Handling Middleware (Stage 1)

The error handling middleware catches all errors from the pipeline:

```typescript
export const errorHandlingMiddleware: MiddlewareFunction = async (
  request: ApiRequest,
  context: ApiContext,
  next: () => Promise<ApiResponse>
): Promise<ApiResponse> => {

  try {
    return await next()  // Execute pipeline
  } catch (error: any) {
    // Convert any error to standardized format
    let apiError: ApiError
    if (isApiError(error)) {
      apiError = error
    } else {
      apiError = ApiError.fromError(error, undefined, context.requestId)
    }

    // Log and format the error response
    return formatErrorResponse(apiError, request, context)
  }
}
```

### Error Logging Strategy
```typescript
// Log level based on error severity
const errorLevel = apiError.statusCode >= 500 ? 'error' : 'warn'
logger[errorLevel](`Request failed after ${duration.toFixed(2)}ms`, {
  requestId: context.requestId,
  errorCode: apiError.errorCode,
  statusCode: apiError.statusCode,
  message: apiError.message,
  details: config.debugging.enableVerboseLogging ? apiError.details : undefined
})
```

### Error Response Headers
```typescript
const responseHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'X-Request-ID': context.requestId,
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Credentials': 'true'
}
```

## Common Error Patterns

### Executor Error Handling

#### REST Executor Example
```typescript
export async function restExecutor(
  request: ApiRequest,
  context: ApiContext
): Promise<ApiResponse> {

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

  try {
    const response = await queryEngine.processRequest(request, context)
    return response
  } catch (error: any) {
    // Convert to standardized API error for the error handling middleware
    throw ApiError.fromError(error, ApiErrorCode.QUERY_ERROR, context.requestId)
  }
}
```

#### RPC Executor Example
```typescript
export async function rpcExecutor(
  request: ApiRequest,
  context: ApiContext
): Promise<ApiResponse> {

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

  try {
    const response = await orchestrator.handleRpc(functionName, body, headers, url)
    return response
  } catch (error: any) {
    throw ApiError.fromError(error, ApiErrorCode.FUNCTION_ERROR, context.requestId)
  }
}
```

### Middleware Error Handling

#### Project Resolution Example
```typescript
export const projectResolutionMiddleware: MiddlewareFunction = async (
  request, context, next
) => {
  const resolution = await resolveAndSwitchToProject(request.url)

  if (!resolution.success) {
    throw new ApiError(
      ApiErrorCode.PROJECT_NOT_FOUND,
      resolution.error || 'Project not found',
      { url: request.url.pathname, projectId: resolution.attemptedProjectId },
      'Check the project ID in your URL',
      context.requestId
    )
  }

  // Continue with successful resolution
  return next()
}
```

#### Authentication Example
```typescript
export const authenticationMiddleware: MiddlewareFunction = async (
  request, context, next
) => {
  const token = extractToken(request.headers)

  if (token) {
    try {
      const payload = await jwtService.verifyToken(token)
      context.sessionContext = createSessionContext(payload)
    } catch (error) {
      // Don't throw - continue with anonymous access
      context.sessionContext = { role: 'anon' }
      logger.debug('JWT verification failed, proceeding as anonymous', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return next()
}
```

## Type Guards and Utilities

### Type Guard Function
```typescript
// Check if an error is an ApiError
export function isApiError(error: any): error is ApiError {
  return error instanceof ApiError
}

// Usage
if (isApiError(error)) {
  console.log(error.errorCode)  // TypeScript knows this exists
  console.log(error.statusCode)
  console.log(error.details)
}
```

### Error Information Extraction
```typescript
// Extract standardized error info from any error type
export function getErrorInfo(error: any, requestId?: string): {
  statusCode: number
  errorCode: string
  message: string
  details?: any
  hint?: string
}

// Usage
const errorInfo = getErrorInfo(unknownError, context.requestId)
console.log(`${errorInfo.statusCode}: ${errorInfo.message}`)
```

## Error Response Examples

### Successful Error Handling Flow
```typescript
// 1. Executor throws error
throw new ApiError(
  ApiErrorCode.UNIQUE_VIOLATION,
  'Email address already exists',
  { constraint: 'users_email_key', value: 'test@example.com' },
  'Try using a different email address',
  'req_123456789'
)

// 2. Error middleware catches and formats
// HTTP Response:
// Status: 409 Conflict
// Headers: Content-Type: application/json, X-Request-ID: req_123456789
{
  "code": "UNIQUE_VIOLATION",
  "message": "Email address already exists",
  "details": {
    "constraint": "users_email_key",
    "value": "test@example.com"
  },
  "hint": "Try using a different email address"
}
```

### PostgreSQL Error Conversion Example
```typescript
// 1. PostgreSQL throws constraint violation
// Original error: { code: '23505', message: 'duplicate key...', detail: 'Key (email)=...' }

// 2. ApiError.fromError() automatically converts
const apiError = ApiError.fromError(pgError, ApiErrorCode.QUERY_ERROR, requestId)

// 3. Results in properly formatted error
{
  "code": "UNIQUE_VIOLATION",        // Mapped from PostgreSQL code '23505'
  "message": "duplicate key value violates unique constraint \"users_email_key\"",
  "details": { /* full PostgreSQL error */ },
  "hint": undefined
}
```

## Debugging and Monitoring

### Request ID Integration
Every error includes the request ID for tracing:
```typescript
const error = new ApiError(
  ApiErrorCode.QUERY_ERROR,
  'Database query failed',
  { sql: 'SELECT * FROM users', params: [] },
  'Check your database connection',
  context.requestId  // ← Enables request tracing
)
```

### Error Logging
Errors are logged with appropriate detail based on configuration:
```typescript
// Error logs include:
{
  requestId: 'req_123456789',
  method: 'GET',
  url: '/rest/v1/users',
  errorCode: 'TABLE_NOT_FOUND',
  statusCode: 404,
  message: 'The table "users" does not exist',
  details: { table: 'users' },         // Only in verbose mode
  stack: 'Error: ...\n  at ...',       // Only in verbose mode
  duration: 45.67                       // Request processing time
}
```

### Browser Debug Integration
```javascript
// Check recent errors in browser console
window.mswDebug.getRecentTraces()
  .filter(trace => trace.error)
  .forEach(trace => {
    console.log(`Request ${trace.requestId} failed:`, trace.error)
  })

// Enable verbose error logging
window.mswDebug.enableVerboseLogging()
```

## Best Practices

### Error Creation
1. **Always include request ID** for tracing
2. **Use appropriate error codes** from the enum
3. **Provide helpful hints** for user guidance
4. **Include relevant details** for debugging
5. **Use clear, user-friendly messages**

### Error Handling
1. **Catch at executor level** and convert to ApiError
2. **Let middleware handle formatting** and logging
3. **Don't expose sensitive information** in error messages
4. **Use appropriate HTTP status codes** (automatic mapping)
5. **Log errors with sufficient context** for debugging

### Security Considerations
1. **Filter sensitive data** from error details in production
2. **Use generic messages** for internal errors
3. **Avoid exposing database schema** information
4. **Sanitize user input** in error messages
5. **Log security-related errors** appropriately

The standardized error handling system provides comprehensive error management with consistent formatting, automatic status code mapping, and extensive debugging capabilities while maintaining security and user experience.