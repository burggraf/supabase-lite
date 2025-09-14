# Unified Kernel Architecture Overview

## Introduction

The Supabase Lite API system is built on a **Unified Kernel Architecture** that provides comprehensive PostgREST compatibility through a composable middleware pipeline. This system completely replaced the previous dual-bridge architecture with a cleaner, more maintainable design that achieves **97.6% PostgREST compatibility**.

## High-Level Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Environment                      │
├─────────────────────────────────────────────────────────────┤
│  React App  │  External Apps  │  Test Suites  │  CLI Tools  │
├─────────────────────────────────────────────────────────────┤
│                    MSW HTTP Layer                           │
├─────────────────────────────────────────────────────────────┤
│                   Unified Kernel                            │
├─────────────────────────────────────────────────────────────┤
│              7-Stage Middleware Pipeline                    │
│  Error → Instrumentation → CORS → Project → Auth →          │
│           Request Parsing → Response Formatting             │
├─────────────────────────────────────────────────────────────┤
│      REST Executor  │  HEAD Executor  │  RPC Executor       │
├─────────────────────────────────────────────────────────────┤
│                   Query Engine                              │
│            (Unified PostgREST Processing)                   │
├─────────────────────────────────────────────────────────────┤
│       Database Manager  │  Auth System  │  Storage VFS      │
├─────────────────────────────────────────────────────────────┤
│                   PGlite (WebAssembly)                      │
│                   IndexedDB Persistence                     │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

1. **MSW Handlers** - Route matching and request capture
2. **Unified Kernel** - Central request processing engine
3. **Middleware Pipeline** - Composable 7-stage processing chain
4. **Executors** - Operation-specific request handlers
5. **Query Engine** - PostgREST-compatible SQL generation
6. **Database Layer** - PGlite with multi-tenant support

## Unified Kernel (`src/api/kernel.ts`)

The kernel is the heart of the system, providing:

### Request Processing Architecture

```typescript
export function createApiHandler(executor: ExecutorFunction) {
	return async (info: any) => {
		// Convert MSW Request → ApiRequest
		const apiRequest: ApiRequest = {
			url: new URL(request.url),
			method: request.method,
			headers: Object.fromEntries(request.headers.entries()),
			body: await getRequestBody(request),
			params: params || {},
		}

		// Execute middleware pipeline
		const response = await executeMiddlewarePipeline(apiRequest, context, executor)

		// Handle response formatting (JSON/CSV/text)
		return formatResponse(response)
	}
}
```

### Key Responsibilities

- **Request Normalization**: Convert MSW requests to internal format
- **Pipeline Orchestration**: Execute middleware in strict order
- **Response Formatting**: Handle JSON, CSV, and text responses properly
- **Error Handling**: Provide comprehensive error recovery
- **Type Safety**: Ensure type-safe request/response handling

### Response Format Handling

The kernel intelligently handles different response formats:

```typescript
// CSV response handling
if (contentType.startsWith('text/csv')) {
	return new HttpResponse(response.data, {
		status: response.status,
		headers: response.headers,
	})
} else {
	// JSON response handling
	return HttpResponse.json(response.data, {
		status: response.status,
		headers: response.headers,
	})
}
```

## Middleware Pipeline Architecture

The 7-stage middleware pipeline processes every request in strict order. Each middleware can:

- **Pre-process** the request before calling `next()`
- **Post-process** the response after `next()` returns
- **Short-circuit** the pipeline by returning early
- **Add context** information for downstream middleware

### Pipeline Execution Pattern

```typescript
const middlewareStack: MiddlewareFunction[] = [
	errorHandlingMiddleware, // Stage 1: Error handling wrapper
	instrumentationMiddleware, // Stage 2: Request tracking
	corsMiddleware, // Stage 3: CORS headers
	projectResolutionMiddleware, // Stage 4: Multi-tenant switching
	authenticationMiddleware, // Stage 5: JWT and RLS setup
	requestParsingMiddleware, // Stage 6: PostgREST parsing
	responseFormattingMiddleware, // Stage 7: Response formatting
]
```

### Stage 1: Error Handling Middleware

- **File**: `src/api/middleware/error-handling.ts`
- **Purpose**: Comprehensive error handling wrapper
- **Functionality**:
  - Catch all errors from downstream middleware/executors
  - Map PostgreSQL errors to HTTP status codes
  - Format errors using standardized `ApiError` system
  - Log errors with request context and performance data
  - Ensure consistent error response format

### Stage 2: Instrumentation Middleware

- **File**: `src/api/middleware/instrumentation.ts`
- **Purpose**: Request tracking and performance monitoring
- **Functionality**:
  - Generate unique request IDs for tracing
  - Track request lifecycle timing and performance metrics
  - Collect execution traces for each pipeline stage
  - Enable browser debugging tools (`window.mswDebug`)
  - Store request traces for debugging and analysis

### Stage 3: CORS Middleware

- **File**: `src/api/middleware/cors.ts`
- **Purpose**: Cross-origin request header management
- **Functionality**:
  - Set appropriate CORS headers for all responses
  - Handle preflight OPTIONS requests automatically
  - Manage allowed origins, methods, and headers
  - Support credential-enabled cross-origin requests

### Stage 4: Project Resolution Middleware

- **File**: `src/api/middleware/project-resolution.ts`
- **Purpose**: Multi-tenant database context switching
- **Functionality**:
  - Extract project ID from URL paths or headers
  - Switch database context for multi-tenancy support
  - Cache project information for performance optimization
  - Handle both project-scoped and global API requests

### Stage 5: Authentication Middleware

- **File**: `src/api/middleware/authentication.ts`
- **Purpose**: JWT decoding and Row Level Security setup
- **Functionality**:
  - Decode and validate JWT tokens from Authorization headers
  - Extract user ID, role, and custom claims
  - Set up Row Level Security (RLS) context for database queries
  - Handle both anonymous and authenticated request contexts

### Stage 6: Request Parsing Middleware

- **File**: `src/api/middleware/request-parsing.ts`
- **Purpose**: PostgREST query syntax processing
- **Functionality**:
  - Parse query parameters (select, filters, order, limit, offset)
  - Handle embedded resource queries with table relationships
  - Process PostgREST-specific headers (Prefer, Range, Accept)
  - Validate query syntax and parameter formats
  - Build internal `ParsedQuery` representation

### Stage 7: Response Formatting Middleware

- **File**: `src/api/middleware/response-formatting.ts`
- **Purpose**: Standardized PostgREST-compatible response formatting
- **Functionality**:
  - Format responses according to PostgREST conventions
  - Handle Content-Range headers for pagination
  - Process CSV format requests with proper content-type
  - Apply response transformations and data selection
  - Ensure consistent response structure across all operations

## Executor Pattern Architecture

Executors provide clean separation of concerns for different operation types:

### REST Executor (`restExecutor`)

- **File**: `src/api/db/executor.ts`
- **Operations**: GET, POST, PATCH, DELETE
- **Functionality**:
  - Table-based CRUD operations with full PostgREST compatibility
  - Bulk insert/update/delete operations
  - Response data selection with `.select()` parameters
  - UPSERT operations with conflict resolution strategies
  - Integration with unified Query Engine for SQL generation

### HEAD Executor (`headExecutor`)

- **File**: `src/api/db/executor.ts`
- **Operations**: HEAD requests
- **Functionality**:
  - Metadata requests that return headers without response body
  - Same processing as GET requests but with empty data
  - Count operations for Content-Range header calculation
  - Performance optimization by skipping data serialization

### RPC Executor (`rpcExecutor`)

- **File**: `src/api/db/executor.ts`
- **Operations**: POST/GET to `/rpc/:functionName`
- **Functionality**:
  - Stored procedure calls with parameter binding
  - Support for both GET (query params) and POST (body params)
  - Return value processing for both scalar and table functions
  - Integration with existing APIRequestOrchestrator for function execution

## Query Engine Architecture (`src/api/db/QueryEngine.ts`)

The unified query engine replaces the previous dual-bridge system with a single, optimized processing engine:

### Core Architecture

```typescript
export class QueryEngine {
	private dbManager: DatabaseManager
	private sqlBuilder: SQLBuilder
	private rlsFilteringService: RLSFilteringService

	async processRequest(request: ApiRequest, context: ApiContext): Promise<FormattedResponse>
	private canUseFastPath(request: ApiRequest): boolean
	private parseFastPath(request: ApiRequest): ParsedQuery
}
```

### Key Capabilities

- **PostgREST Syntax Parsing**: Complete filter, order, select, embed parsing
- **SQL Generation**: Type-safe parameterized query building with SQLBuilder
- **RLS Integration**: Automatic row-level security filter application
- **Performance Optimization**: Fast path detection for simple queries
- **Count Queries**: Separate count execution for Content-Range headers
- **UPSERT Support**: Conflict resolution with `merge-duplicates` preference

### Query Processing Flow

1. **Request Analysis**: Determine if fast path or full parsing needed
2. **Query Parsing**: Convert PostgREST syntax to internal `ParsedQuery` format
3. **RLS Application**: Apply user context filters if authentication present
4. **SQL Generation**: Build parameterized SQL with proper escaping
5. **Execution**: Run query against PGlite with session context
6. **Count Handling**: Execute separate count query if requested
7. **Response Formatting**: Use ResponseFormatter for PostgREST-compatible output

## Type System Architecture (`src/api/types.ts`)

Comprehensive TypeScript interfaces ensure type safety throughout the system:

### Core Request/Response Types

```typescript
export interface ApiRequest {
	url: URL
	method: string
	headers: Record<string, string>
	body?: any
	params?: Record<string, string>
}

export interface ApiResponse {
	data: any
	status: number
	headers: Record<string, string>
}

export interface ApiContext {
	requestId: string
	projectId?: string
	projectName?: string
	sessionContext?: SessionContext
	startTime: number
	reportStage?: (stage: string, data?: any) => void
}
```

### Middleware and Executor Types

```typescript
export type MiddlewareFunction = (
	request: ApiRequest,
	context: ApiContext,
	next: () => Promise<ApiResponse>
) => Promise<ApiResponse>

export type ExecutorFunction = (request: ApiRequest, context: ApiContext) => Promise<ApiResponse>
```

### PostgREST Query Types

```typescript
export interface ParsedQuery {
	table?: string
	select?: string[]
	filters?: QueryFilter[]
	order?: QueryOrder[]
	limit?: number
	offset?: number
	count?: boolean
	preferReturn?: 'representation' | 'minimal'
	preferResolution?: 'merge-duplicates' | 'ignore-duplicates'
	returnSingle?: boolean
	csvFormat?: boolean
	schema?: string
}
```

## Error Handling Architecture (`src/api/errors.ts`)

Standardized error system with comprehensive error categorization:

### ApiError Class Architecture

```typescript
export class ApiError extends Error {
	constructor(
		public code: ApiErrorCode,
		message: string,
		public details?: any,
		public hint?: string,
		public requestId?: string
	) {
		super(message)
		this.name = 'ApiError'
	}

	static fromError(
		error: unknown,
		fallbackCode: ApiErrorCode = ApiErrorCode.UNKNOWN,
		requestId?: string
	): ApiError
}
```

### Error Code Categories

- **Generic**: UNKNOWN, BAD_REQUEST, NOT_FOUND, CONFLICT, etc.
- **Authentication**: INVALID_TOKEN, TOKEN_EXPIRED, MFA_REQUIRED, etc.
- **Database**: CONNECTION_ERROR, QUERY_ERROR, TRANSACTION_ERROR, etc.
- **PostgREST**: INVALID_RANGE, INVALID_FILTER, MISSING_TABLE, etc.
- **API**: MISSING_REQUIRED_PARAMETER, INVALID_REQUEST_FORMAT, etc.

### PostgreSQL Error Mapping

The system automatically maps PostgreSQL error codes to appropriate HTTP status codes and ApiError instances, providing consistent error responses across all operations.

## Performance Characteristics

### Benchmarks and Metrics

- **97.6% PostgREST Compatibility**: 80 out of 82 tests passing
- **Single Execution Path**: Eliminates bridge selection overhead
- **Request Tracing**: Enables precise performance bottleneck identification
- **Fast Path Optimization**: Optimized processing for simple queries
- **Connection Pooling**: Efficient database connection reuse

### Monitoring and Instrumentation

- **Request Timing**: End-to-end request performance tracking
- **Pipeline Stage Tracking**: Per-middleware execution timing
- **Database Query Analysis**: SQL execution performance monitoring
- **Memory Usage Tracking**: Garbage collection and memory optimization
- **Browser Debug Tools**: `window.mswDebug` for runtime inspection

## Configuration Management (`src/api/config.ts`)

Centralized configuration system for runtime behavior control:

### Configuration Features

- **Environment-based Settings**: Different configs for development/production
- **Type-safe Access**: Comprehensive TypeScript interfaces for all config
- **Runtime Validation**: Ensure configuration consistency at startup
- **Performance Tuning**: Adjustable parameters for optimization

## Extension and Customization

### Adding Custom Middleware

```typescript
import type { MiddlewareFunction } from '../types'

export const customMiddleware: MiddlewareFunction = async (request, context, next) => {
	// Pre-processing logic
	const startTime = performance.now()

	// Call next middleware in pipeline
	const response = await next()

	// Post-processing logic
	const duration = performance.now() - startTime
	response.headers['X-Processing-Time'] = duration.toString()

	return response
}
```

### Creating Custom Executors

```typescript
import type { ExecutorFunction } from '../types'

export const customExecutor: ExecutorFunction = async (request, context) => {
	// Custom processing logic
	const result = await processCustomOperation(request, context)

	return {
		data: result,
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	}
}
```

## Migration from Bridge System

### Architectural Changes

- **Removed**: Dual bridge architecture (`enhanced-bridge.ts`, `simplified-bridge.ts`)
- **Replaced**: Single unified kernel with composable middleware pipeline
- **Added**: Comprehensive error handling with standardized `ApiError` system
- **Enhanced**: Request tracing and debugging capabilities
- **Improved**: Type safety with comprehensive TypeScript interfaces

### Benefits of New Architecture

- **Simplified Debugging**: Single execution path vs multiple bridge selection logic
- **Better Performance**: Reduced overhead and optimized request processing
- **Enhanced Maintainability**: Composable middleware vs monolithic handler functions
- **Superior Type Safety**: Comprehensive interfaces for all API operations
- **Better Error Handling**: Standardized error codes and PostgreSQL error mapping
- **Advanced Instrumentation**: Built-in performance monitoring and debugging tools

### Compatibility Improvements

The unified kernel architecture achieved **97.6% PostgREST compatibility** compared to the previous bridge system, with improvements in:

- CSV response format handling
- Count operations with Content-Range headers
- UPSERT operations with conflict resolution
- Complex query parsing and SQL generation
- Error handling and response formatting

This unified kernel architecture provides a robust, maintainable, and extensible foundation for Supabase-compatible API operations with superior debugging, monitoring, and development experience capabilities.
