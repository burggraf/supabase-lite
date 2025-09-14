# Unified API Kernel Documentation

## Overview

The Supabase Lite API system is built on a **Unified Kernel Architecture** that provides 97.6% PostgREST compatibility through a composable middleware pipeline. This system replaced the previous dual-bridge architecture with a cleaner, more maintainable design.

**Purpose**: Provide complete understanding of the unified kernel system for confident debugging, extension, and maintenance of Supabase-compatible API endpoints.

## Quick Navigation

### 🏗️ Architecture
- **[System Overview](./architecture/overview.md)** - Unified kernel design and middleware pipeline
- **[Request Flow](./architecture/request-flow.md)** - Visual diagrams of kernel processing
- **[Migration Guide](./architecture/migration-guide.md)** - Transitioning from bridge architecture

### 🔧 Core Systems
- **[Unified Kernel](./reference/kernel.md)** - Central request processing engine
- **[Middleware Pipeline](./reference/middleware.md)** - 7-stage composable middleware system
- **[Executors](./reference/executors.md)** - REST/HEAD/RPC operation handlers
- **[Error Handling](./reference/error-handling.md)** - Standardized ApiError system
- **[TypeScript Types](./reference/types.md)** - Interface specifications

### 🐛 Debugging & Development
- **[Instrumentation Guide](./debugging/instrumentation.md)** - Request tracing and performance monitoring
- **[Tracing Guide](./debugging/tracing-guide.md)** - Step-by-step kernel debugging
- **[Common Issues](./debugging/common-issues.md)** - Known problems and solutions
- **[Configuration](./reference/configuration.md)** - Config management and setup

## System Architecture Summary

### Unified Kernel System
The new architecture consists of a **single processing pipeline** that handles all API requests through composable middleware:

```
MSW Handler → Kernel → Middleware Pipeline → Executor → Response
```

### Key Components

#### 1. **Unified Kernel** (`src/api/kernel.ts`)
- Single entry point for all API requests
- Converts MSW requests to internal `ApiRequest` format
- Executes middleware pipeline in strict order
- Handles response formatting (JSON/CSV/text)
- Provides comprehensive error handling

#### 2. **Middleware Pipeline** (7 stages)
1. **Error Handling** - Catch and format all errors
2. **Instrumentation** - Request tracking and performance monitoring
3. **CORS** - Cross-origin header management
4. **Project Resolution** - Multi-tenant database switching
5. **Authentication** - JWT decoding and RLS context
6. **Request Parsing** - PostgREST query syntax processing
7. **Response Formatting** - Standardized response structure

#### 3. **Executor Pattern**
- **`restExecutor`** - Database CRUD operations (GET/POST/PATCH/DELETE)
- **`headExecutor`** - Metadata requests
- **`rpcExecutor`** - Stored procedure calls

#### 4. **Query Engine** (`src/api/db/QueryEngine.ts`)
- Unified query processing (replaces dual bridges)
- PostgREST syntax parsing and SQL generation
- RLS filtering integration
- Fast path optimization for simple queries

## Performance & Compatibility

### PostgREST Compatibility: **97.6%** (80/82 tests passing)
- ✅ Complete SELECT operations with filtering, ordering, pagination
- ✅ INSERT/UPDATE/DELETE operations with returning data
- ✅ UPSERT operations with conflict resolution
- ✅ Embedded resource queries and joins
- ✅ RPC (stored procedure) calls
- ✅ CSV response formatting
- ✅ Count operations with Content-Range headers
- ✅ Schema switching and multi-tenant support

### Key Improvements over Bridge System
- **Simplified Debugging**: Single execution path with request tracing
- **Better Performance**: Reduced code paths and optimized query processing
- **Type Safety**: Comprehensive TypeScript interfaces
- **Maintainability**: Composable middleware vs monolithic handlers
- **Error Handling**: Standardized error codes and PostgreSQL error mapping
- **Instrumentation**: Built-in performance monitoring and debugging tools

## Quick Start - Debugging an API Request

### 1. Browser Debug Tools
```javascript
// Available in browser console
window.mswDebug.status()              // Show system status
window.mswDebug.getBridgeStats()      // View performance stats
window.mswDebug.enableVerboseLogging() // Enable detailed logging
window.mswDebug.getRecentTraces()     // View request traces
```

### 2. Request Tracing Flow
```
[Client Request] → [MSW Handler] → [Kernel] →
[Error Middleware] → [Instrumentation] → [CORS] → [Project Resolution] →
[Authentication] → [Request Parsing] → [Response Formatting] →
[Executor] → [Query Engine] → [Database] → [Response]
```

### 3. Common Investigation Steps
1. **Check MSW Handler Match** - Verify URL pattern matching
2. **Trace Middleware Pipeline** - Follow request through all 7 stages
3. **Validate Executor Selection** - Confirm REST/HEAD/RPC routing
4. **Examine Query Generation** - Check PostgREST parsing and SQL output
5. **Verify Response Format** - Ensure proper JSON/CSV/text formatting

## Extension Guide

### Adding Custom Middleware
```typescript
import type { MiddlewareFunction } from '../types'

export const customMiddleware: MiddlewareFunction = async (request, context, next) => {
  // Pre-processing
  context.customData = 'example'

  // Call next middleware
  const response = await next()

  // Post-processing
  response.headers['X-Custom'] = 'value'
  return response
}
```

### Creating New Executors
```typescript
import type { ExecutorFunction } from '../types'

export const customExecutor: ExecutorFunction = async (request, context) => {
  return {
    data: { message: 'Custom response' },
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  }
}
```

## Migration from Bridge System

The old dual-bridge architecture has been completely replaced. Key changes:

- **Removed**: `enhanced-bridge.ts` and `simplified-bridge.ts`
- **Replaced with**: Unified kernel + middleware pipeline
- **New**: Standardized error handling with `ApiError`
- **New**: Comprehensive request tracing and debugging tools
- **New**: Type-safe interfaces for all API operations

See the [Migration Guide](./architecture/migration-guide.md) for detailed transition steps.

## Troubleshooting Quick Reference

### Request Not Matching Handler
- Check MSW handler URL patterns in `src/mocks/handlers/rest.ts`
- Verify project-scoped vs non-scoped routes

### Query Processing Errors
- Enable verbose logging: `window.mswDebug.enableVerboseLogging()`
- Check PostgREST syntax in request parsing middleware
- Verify SQL generation in Query Engine

### Authentication Issues
- Check JWT token in authentication middleware
- Verify RLS context in session management
- Confirm user permissions and row-level security

### Performance Issues
- Use `window.mswDebug.getBridgeStats()` for performance metrics
- Check request tracing for bottlenecks
- Review Query Engine fast path optimization

## Architecture Evolution

This unified kernel system represents a complete architectural transformation:

**Previous**: Dual bridge system with complex selection logic and 4,000+ lines of repetitive handler code

**Current**: Composable middleware pipeline with clean separation of concerns, comprehensive error handling, and extensive debugging capabilities

The result is a more maintainable, debuggable, and extensible API system with superior PostgREST compatibility.