# Bridge API Specifications

## Overview

This document provides detailed API specifications for all bridge implementations in the MSW system. Bridges are the core abstraction layer that convert HTTP requests into database operations while maintaining Supabase compatibility.

## Bridge Interface Contract

All bridges implement a common interface for consistency:

```typescript
interface Bridge {
  // Core request handling
  handleRequest(request: Request, context: RequestContext): Promise<Response>
  
  // Query parsing and validation
  parseQuery(url: URL): ParsedQuery
  validateQuery(query: ParsedQuery): ValidationResult
  
  // SQL generation
  generateSQL(query: ParsedQuery, table: string): SQLQuery
  
  // Response formatting
  formatResponse(results: DatabaseResult, query: ParsedQuery): Response
  
  // Error handling
  handleError(error: Error, context: RequestContext): Response
  
  // Capabilities reporting
  getSupportedFeatures(): FeatureSet
  isFeatureSupported(feature: string): boolean
}
```

## Enhanced Bridge

### Location
`src/mocks/enhanced-bridge.ts`

### Class Definition
```typescript
class EnhancedSupabaseAPIBridge implements Bridge {
  private queryCache: Map<string, ParsedQuery>
  private performance: PerformanceTracker
  
  constructor(options?: EnhancedBridgeOptions)
}
```

### Configuration Options
```typescript
interface EnhancedBridgeOptions {
  enableQueryCache?: boolean          // Default: true
  maxCacheSize?: number              // Default: 1000
  enablePerformanceTracking?: boolean // Default: true
  maxEmbeddingDepth?: number         // Default: 10
  enableAdvancedFeatures?: boolean   // Default: true
}
```

### Core Methods

#### handleRestRequest()
```typescript
async handleRestRequest(
  req: Request, 
  info: { params: Record<string, string>; db: PGlite }
): Promise<Response>
```

**Parameters**:
- `req`: HTTP request object
- `info.params`: URL parameters including table name
- `info.db`: PGlite database connection

**Returns**: HTTP response with PostgREST-compatible format

**Process Flow**:
1. Parse HTTP method and URL parameters
2. Extract and validate query components
3. Apply RLS filters if user context present
4. Generate SQL query with parameter binding
5. Execute query against database
6. Format results in PostgREST format
7. Add appropriate headers (Content-Range, etc.)

#### parseQuery()
```typescript
parseQuery(url: URL): EnhancedParsedQuery
```

**Advanced Query Parsing Features**:
- **OR/AND Logic**: `or=(name.eq.john,name.eq.jane)`
- **Multi-level Embedding**: `select=*,posts(*,comments(*))`
- **Table-qualified Filters**: `posts.status=eq.published`
- **JSON Path Expressions**: `data->field=eq.value`
- **Range Operations**: `age=ov.[18,65)`
- **Full-text Search**: `title=fts.search term`

**Return Structure**:
```typescript
interface EnhancedParsedQuery {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  table: string
  select: SelectClause
  filters: FilterExpression[]
  embedding: EmbeddingStructure[]
  ordering: OrderingClause[]
  pagination: PaginationInfo
  preferences: RequestPreferences
  jsonOperations: JSONOperation[]
  logicalOperators: LogicalExpression[]
}
```

#### generateSQL()
```typescript
generateSQL(query: EnhancedParsedQuery, userContext?: UserContext): SQLQuery
```

**SQL Generation Features**:
- **Complex JOINs**: Multi-table relationship handling
- **Subqueries**: For embedded resources
- **Window Functions**: For advanced analytics
- **Common Table Expressions**: For recursive queries
- **Parameter Binding**: SQL injection prevention
- **Query Optimization**: Automatic query plan optimization

**Return Structure**:
```typescript
interface SQLQuery {
  sql: string
  parameters: any[]
  estimatedCost: number
  queryPlan: QueryPlan
  cacheKey: string
}
```

### Supported Features

#### Filter Operators
```typescript
const ENHANCED_OPERATORS = {
  // Comparison
  'eq': '=', 'neq': '!=', 'gt': '>', 'gte': '>=', 'lt': '<', 'lte': '<=',
  
  // Pattern matching  
  'like': 'LIKE', 'ilike': 'ILIKE',
  
  // Array/Set operations
  'in': 'IN', 'cs': '@>', 'cd': '<@', 'ov': '&&',
  
  // Range operations
  'sl': '<<', 'sr': '>>', 'nxr': '&<', 'nxl': '&>', 'adj': '-|-',
  
  // Full-text search
  'fts': '@@', 'plfts': '@@', 'phfts': '@@', 'wfts': '@@',
  
  // NULL operations
  'is': 'IS', 'isnot': 'IS NOT'
}
```

#### Embedding Capabilities
```typescript
// Single level: users with their posts
select=*,posts(*)

// Multi-level: users with posts and comments
select=*,posts(*,comments(*))

// Filtered embedding: only published posts
select=*,posts(title,content)&posts.status=eq.published

// Table-qualified ordering
select=*,posts(*)&order=posts.created_at.desc

// Nested limits
select=*,posts(*).limit(5)
```

#### Logical Operators
```typescript
// OR conditions
/users?or=(name.eq.john,name.eq.jane)

// AND conditions  
/users?and=(age.gt.18,status.eq.active)

// Nested logic
/users?or=(and(age.gt.18,status.eq.active),role.eq.admin)

// Mixed with regular filters
/users?name=like.*john*&or=(age.gt.18,role.eq.admin)
```

### Performance Characteristics
- **Query Parsing**: 5-15ms for complex queries
- **SQL Generation**: 5-10ms with optimization
- **Embedding Processing**: 10-25ms for multi-level
- **Memory Usage**: ~2-5MB for complex query cache
- **Throughput**: ~100-200 requests/second

### Error Handling
```typescript
class EnhancedBridgeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: any
  )
}

// Error categories
const ERROR_CODES = {
  INVALID_QUERY: 'invalid_query',
  UNSUPPORTED_FEATURE: 'unsupported_feature', 
  SQL_GENERATION_ERROR: 'sql_generation_error',
  EMBEDDING_ERROR: 'embedding_error',
  PERFORMANCE_LIMIT: 'performance_limit'
}
```

## Simplified Bridge

### Location
`src/mocks/simplified-bridge.ts`

### Class Definition
```typescript
class SimplifiedSupabaseAPIBridge implements Bridge {
  private operatorMappings: Map<string, string>
  private debugMode: boolean
  
  constructor(options?: SimplifiedBridgeOptions)
}
```

### Configuration Options
```typescript
interface SimplifiedBridgeOptions {
  enableDebugLogging?: boolean    // Default: false
  maxQueryComplexity?: number     // Default: 100
  enableBasicCache?: boolean      // Default: true
  strictMode?: boolean            // Default: false
}
```

### Core Methods

#### handleRestRequest()
```typescript
async handleRestRequest(
  req: Request,
  info: { params: Record<string, string>; db: PGlite }
): Promise<Response>
```

**Simplified Processing**:
1. Basic HTTP method detection
2. Simple parameter extraction
3. Limited filter parsing
4. Basic SQL generation
5. Direct database execution
6. Simple response formatting

**Performance Optimizations**:
- No query caching overhead
- Streamlined parsing (1-3ms)
- Direct SQL generation (1-2ms)
- Minimal memory allocation

#### parseQuery()
```typescript
parseQuery(url: URL): SimplifiedParsedQuery
```

**Limited Query Parsing**:
- **Basic Filters Only**: eq, neq, gt, gte, lt, lte, like, ilike, in, is, cs, cd, ov
- **Single-level Embedding**: `select=*,relation(*)`
- **Simple Ordering**: `order=column.direction`
- **Basic Pagination**: `limit` and `offset` parameters

**Return Structure**:
```typescript
interface SimplifiedParsedQuery {
  method: string
  table: string
  select: string[]
  filters: SimpleFilter[]
  embedding: SimpleEmbedding[]
  ordering: SimpleOrder[]
  limit?: number
  offset?: number
}
```

### Supported Features (Subset)

#### Reduced Operator Set
```typescript
const SIMPLIFIED_OPERATORS = {
  // Basic comparison
  'eq': '=', 'neq': '!=', 'gt': '>', 'gte': '>=', 'lt': '<', 'lte': '<=',
  
  // Pattern matching
  'like': 'LIKE', 'ilike': 'ILIKE',
  
  // Basic set operations
  'in': 'IN', 'cs': '@>', 'cd': '<@',
  
  // Range overlaps (with known issues)
  'ov': '&&',   // Has debugging code - see common-issues.md
  
  // NULL operations
  'is': 'IS'
}
```

#### Known Limitations
```typescript
// Unsupported features that fail silently
const UNSUPPORTED_FEATURES = [
  'OR/AND logical operators',
  'Multi-level embedding (>1 level)',
  'Table-qualified filters',
  'Full-text search operators',
  'Advanced range operations',
  'JSON path expressions',
  'Window functions'
]
```

### Known Issues
```typescript
// Evidence of active debugging in production code
console.log('Overlaps operator debug:', overlapResults) // TODO: Remove

// Issue: Silent failures for unsupported features
// No error thrown when OR/AND operators used
// Multi-level embedding requests ignored
```

### Performance Characteristics
- **Query Parsing**: 1-3ms (optimized)
- **SQL Generation**: 1-2ms (direct)
- **Memory Usage**: ~500KB-1MB
- **Throughput**: ~500-1000 requests/second
- **Cache Overhead**: Minimal

## Auth Bridge

### Location
`src/lib/auth/AuthBridge.ts`

### Class Definition
```typescript
class AuthBridge {
  private authManager: AuthManager
  private jwtService: JWTService
  private sessionManager: SessionManager
  private mfaService: MFAService
  
  constructor(databaseManager: DatabaseManager)
}
```

### Core Methods

#### handleAuthRequest()
```typescript
async handleAuthRequest(
  req: Request,
  info: { params: Record<string, string>; db: PGlite }
): Promise<Response>
```

**Supported Endpoints**:
- `POST /auth/v1/signup` - User registration
- `POST /auth/v1/token` - Login/token refresh
- `GET /auth/v1/user` - Get user info
- `POST /auth/v1/logout` - Sign out
- `POST /auth/v1/recover` - Password recovery
- `POST /auth/v1/verify` - Email verification
- `POST /auth/v1/mfa/challenge` - MFA challenge
- `POST /auth/v1/mfa/verify` - MFA verification

#### JWT Token Management
```typescript
interface JWTPayload {
  sub: string              // User ID
  email: string            // User email
  role: string             // User role (authenticated, anon)
  aud: string              // Audience
  exp: number              // Expiration time
  iat: number              // Issued at
  app_metadata: object     // Application metadata
  user_metadata: object    // User metadata
}

// JWT Service methods
generateToken(user: User, expiresIn?: number): string
verifyToken(token: string): JWTPayload | null
refreshToken(refreshToken: string): { accessToken: string; refreshToken: string }
```

#### User Management
```typescript
// AuthManager methods
async createUser(email: string, password: string, metadata?: any): Promise<User>
async authenticateUser(email: string, password: string): Promise<User | null>
async getUserById(id: string): Promise<User | null>
async updateUser(id: string, updates: Partial<User>): Promise<User>
async deleteUser(id: string): Promise<void>
```

#### Session Management
```typescript
// SessionManager methods
async createSession(user: User): Promise<Session>
async getSession(token: string): Promise<Session | null>
async refreshSession(refreshToken: string): Promise<Session>
async invalidateSession(token: string): Promise<void>
async cleanupExpiredSessions(): Promise<void>
```

### Authentication Flow
```typescript
// Complete authentication process
1. User submits credentials
2. AuthManager validates against database
3. JWTService generates access/refresh tokens  
4. SessionManager creates session record
5. Response includes tokens and user data
6. Subsequent requests validated via JWT
7. RLS applied based on user context
```

### Security Features
- **Password Hashing**: bcrypt with configurable rounds
- **JWT Signing**: HMAC SHA-256 with secret key
- **Session Security**: Secure token generation and validation
- **MFA Support**: TOTP-based multi-factor authentication
- **Rate Limiting**: Configurable login attempt limits
- **Email Verification**: Secure email confirmation flow

## VFS Bridge

### Location
`src/lib/vfs/VFSBridge.ts`

### Class Definition
```typescript
class VFSBridge {
  private vfsManager: VFSManager
  private signedUrlManager: SignedUrlManager
  
  constructor(projectId: string)
}
```

### Core Methods

#### handleFileRequest()
```typescript
async handleFileRequest(
  req: Request,
  info: { params: Record<string, string> }
): Promise<Response>
```

**Supported Operations**:
- `GET /storage/v1/object/:bucket/:path` - Download file
- `POST /storage/v1/object/:bucket/:path` - Upload file
- `DELETE /storage/v1/object/:bucket/:path` - Delete file
- `POST /storage/v1/object/list/:bucket` - List objects
- `POST /storage/v1/object/sign/:bucket/:path` - Create signed URL

#### File Management
```typescript
// VFS Manager methods
async uploadFile(bucket: string, path: string, file: File): Promise<UploadResult>
async downloadFile(bucket: string, path: string): Promise<File | null>
async deleteFile(bucket: string, path: string): Promise<boolean>
async listFiles(bucket: string, options?: ListOptions): Promise<FileInfo[]>
async getFileInfo(bucket: string, path: string): Promise<FileInfo | null>
```

#### Bucket Management
```typescript
async createBucket(name: string, options?: BucketOptions): Promise<Bucket>
async getBucket(name: string): Promise<Bucket | null>
async listBuckets(): Promise<Bucket[]>
async deleteBucket(name: string): Promise<boolean>
```

#### Signed URL Generation
```typescript
async createSignedUrl(
  bucket: string, 
  path: string, 
  expiresIn: number,
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
): Promise<string>
```

### Storage Architecture
- **IndexedDB Backend**: Persistent browser storage
- **Blob Handling**: Direct browser File/Blob API
- **Metadata Storage**: Structured object information
- **MIME Type Detection**: Automatic content-type assignment
- **Access Control**: Bucket-level permissions

## Legacy Bridge (Deprecated)

### Location
`src/mocks/supabase-bridge.ts`

### Status
**⚠️ DEPRECATED - Do not use for new development**

### Limited Capabilities
- Basic CRUD operations only
- No embedding support
- Limited filter operators
- No logical operators
- Basic error handling
- No performance optimization

### Migration Path
```typescript
// Migrate from Legacy Bridge
// OLD: Basic filter only
/users?name=eq.john

// NEW: Use Enhanced Bridge for advanced features
/users?or=(name.eq.john,email.like.*john*)&select=*,posts(*)
```

## Bridge Selection Logic

### Current Implementation
```typescript
// In src/mocks/handlers/rest.ts
const USE_SIMPLIFIED_BRIDGE = false  // Feature flag
const activeBridge = USE_SIMPLIFIED_BRIDGE ? simplifiedBridge : enhancedBridge

// Bridge selection context
const selectBridge = (request: Request): Bridge => {
  const url = new URL(request.url)
  
  // Auth requests always use AuthBridge
  if (url.pathname.includes('/auth/')) {
    return authBridge
  }
  
  // Storage requests always use VFSBridge
  if (url.pathname.includes('/storage/')) {
    return vfsBridge
  }
  
  // REST requests use configurable bridge
  if (url.pathname.includes('/rest/')) {
    return activeBridge
  }
  
  throw new Error('No suitable bridge found')
}
```

### Runtime Bridge Switching
```typescript
// Debug utilities for bridge testing
window.switchToEnhancedBridge = () => {
  window.forceBridgeSelection = 'enhanced'
  console.log('🌉 Switched to Enhanced Bridge')
}

window.switchToSimplifiedBridge = () => {
  window.forceBridgeSelection = 'simplified'
  console.log('🌉 Switched to Simplified Bridge')
}
```

## Bridge Extension Points

### Custom Bridge Implementation
```typescript
class CustomBridge implements Bridge {
  async handleRequest(request: Request, context: RequestContext): Promise<Response> {
    // Custom implementation
    const query = this.parseQuery(new URL(request.url))
    const sql = this.generateSQL(query)
    const results = await context.db.query(sql.sql, sql.parameters)
    return this.formatResponse(results, query)
  }
  
  // Implement other required methods...
}

// Register custom bridge
const customBridge = new CustomBridge()
```

### Bridge Middleware
```typescript
type BridgeMiddleware = (
  request: Request,
  context: RequestContext,
  next: (req: Request, ctx: RequestContext) => Promise<Response>
) => Promise<Response>

// Example: Logging middleware
const loggingMiddleware: BridgeMiddleware = async (req, ctx, next) => {
  console.log('🔍 Bridge request:', req.url)
  const response = await next(req, ctx)
  console.log('✅ Bridge response:', response.status)
  return response
}
```

## Testing Bridge APIs

### Unit Testing
```typescript
// Test Enhanced Bridge parsing
const bridge = new EnhancedSupabaseAPIBridge()
const query = bridge.parseQuery(new URL('/users?select=*,posts(*)&name=eq.john'))

expect(query.filters).toHaveLength(1)
expect(query.embedding).toHaveLength(1)
expect(query.embedding[0].table).toBe('posts')
```

### Integration Testing
```typescript
// Test complete request flow
const request = new Request('/rest/v1/users?select=*&limit=5', {
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' }
})

const response = await bridge.handleRequest(request, { db: mockDb })
expect(response.status).toBe(200)
```

This comprehensive bridge API reference provides complete specifications for all bridge implementations, enabling developers to understand exactly how each bridge processes requests and generates responses.