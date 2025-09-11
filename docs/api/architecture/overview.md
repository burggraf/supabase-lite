# MSW API Architecture Overview

## System Design Philosophy

The MSW API system provides a complete Supabase-compatible API layer that runs entirely in the browser using Mock Service Worker (MSW). The design prioritizes **browser-only operation**, **PostgREST compatibility**, and **multi-project support** while maintaining performance and maintainability.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Environment                      │
├─────────────────────────────────────────────────────────────┤
│  React App  │  External Apps  │  Test Suites  │  CLI Tools  │
├─────────────────────────────────────────────────────────────┤
│                    MSW HTTP Layer                           │
├─────────────────────────────────────────────────────────────┤
│  Project Resolution  │  CORS Handling  │  Request Routing   │
├─────────────────────────────────────────────────────────────┤
│  Enhanced Bridge  │  Simplified Bridge  │  Auth Bridge      │
├─────────────────────────────────────────────────────────────┤
│       Database Manager  │  Auth System  │  Storage VFS      │
├─────────────────────────────────────────────────────────────┤
│                   PGlite (WebAssembly)                      │
│                   IndexedDB Persistence                     │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. MSW Request Handling Layer

#### **Handler Organization** (`src/mocks/handlers/`)
- **Modular structure**: Separate handlers for REST, Auth, Storage, Functions, App Hosting
- **Handler priority**: Specific routes processed before general catch-all patterns
- **CORS integration**: Universal CORS headers on all responses

#### **Request Routing Patterns**
```typescript
// Base route patterns
/rest/v1/:table                    // Direct REST API
/auth/v1/signup                    // Authentication endpoints
/storage/v1/object/:bucket/*       // Storage operations

// Project-scoped patterns
/:projectId/rest/v1/:table         // Multi-tenant REST API
/:projectId/auth/v1/signup         // Project-specific auth
/:projectId/storage/v1/object/:bucket/*  // Project storage
```

### 2. Project Resolution System

#### **Project Switching Architecture** (`src/mocks/project-resolver.ts`)
- **URL-based resolution**: Extract project ID from request path
- **Database connection switching**: Automatic PGlite database changes
- **Caching layer**: 5-second TTL for project resolution results
- **Performance tracking**: Cache hit rates and resolution times

#### **Higher-Order Function Pattern**
```typescript
export const withProjectResolution = <T extends Record<string, any>>(
  handler: (req: RestRequest, info: T & { db: PGlite }) => Promise<HttpResponse>
) => async (req: RestRequest, info: T): Promise<HttpResponse> => {
  // Project extraction and database switching logic
  const { projectId, normalizedUrl } = await resolveProject(req.url)
  const db = await DatabaseManager.switchToProject(projectId)
  return handler({ ...req, url: normalizedUrl }, { ...info, db })
}
```

### 3. Bridge Architecture

#### **Three-Tier Bridge System**

##### **Enhanced Bridge** (`enhanced-bridge.ts`)
- **Full PostgREST compatibility**: Complete query syntax support
- **Advanced features**: OR/AND operators, table-prefixed filters, multi-level embedding
- **Complex parsing**: Sophisticated URL parameter processing
- **Performance optimization**: Query plan caching and SQL generation optimization

##### **Simplified Bridge** (`simplified-bridge.ts`)
- **Optimized subset**: Focused on 80% use cases for better performance
- **Reduced complexity**: Limited operators and single-level embedding
- **Faster processing**: Streamlined query parsing and execution
- **Debug logging**: Extensive debugging for overlaps operator issues

##### **Legacy Bridge** (`supabase-bridge.ts`)
- **Basic compatibility**: Simple CRUD operations
- **Deprecated**: Maintained for backwards compatibility only

#### **Bridge Selection Strategy**
```typescript
const activeBridge = USE_SIMPLIFIED_BRIDGE ? simplifiedBridge : enhancedBridge
```

### 4. Database Integration Layer

#### **DatabaseManager Singleton** (`src/lib/database/connection.ts`)
- **PGlite integration**: WebAssembly PostgreSQL with IndexedDB persistence
- **Connection pooling**: Multiple project databases with efficient switching
- **Schema management**: Auto-initialization of Supabase schemas
- **Query caching**: Built-in cache with TTL and LRU eviction
- **Performance metrics**: Query execution tracking and analytics

#### **Schema Management**
```typescript
// Auto-initialized schemas
auth.*          // Authentication tables (users, sessions, etc.)
storage.*       // Storage buckets and objects  
public.*        // User-defined tables
realtime.*      // Subscription management
```

### 5. Authentication System

#### **Multi-Component Auth Architecture**
- **AuthBridge**: Main authentication service coordination
- **AuthManager**: User management and database operations
- **JWTService**: Token generation and validation with HS256
- **SessionManager**: Session lifecycle and token refresh
- **MFAService**: Multi-factor authentication support
- **RLSEnforcer**: Row Level Security implementation

#### **RLS Implementation Strategy**
```typescript
// User context injection
const userContext = {
  userId: jwt.sub,
  role: jwt.role,
  claims: jwt.app_metadata
}

// Automatic RLS application
const rls = new RLSFilteringService(userContext)
const filteredResults = await rls.applyFilters(queryResults, table)
```

### 6. Storage and VFS System

#### **Virtual File System** (`src/lib/vfs/`)
- **VFSManager**: File storage and management with IndexedDB
- **SignedUrlManager**: Secure file access with time-limited URLs
- **SyncManager**: Local folder synchronization via File System Access API
- **FolderUploadService**: Static app deployment and hosting

## Design Patterns

### 1. **Singleton Pattern**
Used for stateful managers that need global coordination:
- `DatabaseManager`: Single PGlite instance with connection pooling
- `ProjectManager`: Multi-project state management
- `AuthBridge`: Authentication service coordination

### 2. **Bridge Pattern**
Abstracts different API implementation strategies:
- Allows switching between Enhanced/Simplified bridges
- Enables future bridge implementations without client changes
- Provides consistent interface despite different internal logic

### 3. **Higher-Order Function (HOF) Pattern**
Used for cross-cutting concerns:
- `withProjectResolution()`: Adds project switching to any handler
- Composition-based approach for adding authentication, CORS, logging
- Functional programming patterns for request middleware

### 4. **Factory Pattern**
Consistent handler creation across domains:
- Each handler module exports factory functions
- Standardized error handling and response formatting
- Enables testing with mock dependencies

## Performance Considerations

### 1. **Query Optimization**
- **SQL query caching**: Avoid re-parsing identical queries
- **Connection pooling**: Reuse database connections across requests
- **Lazy loading**: Only load bridge implementations when needed

### 2. **Memory Management**
- **LRU caching**: Automatic eviction of old cache entries
- **Debounced operations**: Batch similar operations to reduce overhead
- **Garbage collection**: Proper cleanup of database connections and caches

### 3. **Network Optimization**
- **CORS preflight caching**: 24-hour cache for OPTIONS requests
- **Response compression**: Gzip compression for large JSON responses
- **Chunked responses**: Streaming for large dataset queries

## Scalability Patterns

### 1. **Multi-Tenant Architecture**
- **Project isolation**: Separate databases per project
- **Resource sharing**: Shared MSW handlers and bridge logic
- **Horizontal scaling**: Add new projects without affecting existing ones

### 2. **Modular Handler Design**
- **Domain separation**: REST, Auth, Storage, Functions in separate modules
- **Independent deployment**: Handlers can be updated independently
- **Feature flags**: Enable/disable functionality without code changes

### 3. **Caching Strategy**
- **Multi-level caching**: Project resolution, query results, schema information
- **Cache invalidation**: TTL-based and manual invalidation strategies
- **Cache warming**: Preload frequently accessed data

## Technology Stack

### Core Technologies
- **MSW (Mock Service Worker)**: HTTP request interception and mocking
- **PGlite**: WebAssembly PostgreSQL for browser-based database
- **TypeScript**: Type-safe development and API contracts
- **IndexedDB**: Persistent storage for database files and caches

### Integration Libraries
- **bcrypt**: Password hashing for authentication
- **jsonwebtoken**: JWT token generation and validation
- **zod**: Runtime type validation for API requests
- **date-fns**: Date manipulation for session management

## Security Architecture

### 1. **Browser Security Model**
- **Same-origin policy**: MSW operates within browser security constraints
- **No server-side secrets**: All authentication uses client-side JWT validation
- **CORS protection**: Proper CORS headers for cross-origin requests

### 2. **Authentication Security**
- **JWT-based authentication**: Stateless token validation
- **Password hashing**: bcrypt with configurable salt rounds
- **Session management**: Secure token refresh and expiration handling
- **MFA support**: TOTP-based multi-factor authentication

### 3. **Database Security**
- **RLS enforcement**: Row Level Security applied at application level
- **SQL injection protection**: Parameterized queries and input validation
- **Access control**: User context propagation through all database operations

## Future Architecture Considerations

### 1. **Realtime Subscriptions**
- **BroadcastChannel API**: Cross-tab communication for real-time updates
- **WebSocket simulation**: MSW-based WebSocket mocking for subscriptions
- **Event sourcing**: Change log tracking for subscription notifications

### 2. **Performance Optimization**
- **Worker thread migration**: Move database operations to Web Workers
- **WASM optimization**: Custom PGlite builds for specific use cases
- **CDN integration**: Asset serving optimization for static apps

### 3. **Developer Experience**
- **Hot reload**: Real-time code updates without losing database state
- **Debug tooling**: Enhanced tracing and performance monitoring
- **Testing utilities**: Better integration testing and mock data management

This architecture provides a solid foundation for Supabase-compatible API operations while maintaining the flexibility needed for future enhancements and optimizations.