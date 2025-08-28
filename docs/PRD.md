# Supabase Lite - Product Requirements Document

**Version:** 1.0  
**Date:** August 18, 2025  
**Author:** Development Team  
**Status:** Active Development  

## Executive Summary

### Vision
Create a complete, browser-based implementation of Supabase that runs entirely offline with zero server dependencies, providing developers with a fully functional local development environment that maintains compatibility with the official Supabase ecosystem.

### Goals
- **Complete Offline Functionality**: All features work without internet connectivity
- **Supabase.js Compatibility**: Drop-in replacement for hosted Supabase instances
- **API Compatibility**: Full PostgREST, Auth, and Storage API compatibility
- **Developer Experience**: Match Supabase Studio's UI/UX and workflow
- **Testing Framework**: Validate compatibility against real Supabase instances

### Value Proposition
- **Instant Setup**: No Docker, servers, or complex configuration required
- **Offline Development**: Work anywhere without internet connectivity
- **Cost-Free Development**: No usage limits or billing concerns
- **Learning Platform**: Safe environment for experimentation and education
- **Rapid Prototyping**: Quick database schema and API testing

## Product Overview

### Core Concept
Supabase Lite is a complete reimplementation of the Supabase stack using browser-native technologies:

- **PGlite** (WebAssembly PostgreSQL) replaces hosted PostgreSQL
- **MSW (Mock Service Worker)** provides API endpoint simulation
- **IndexedDB** handles data persistence and file storage
- **React Dashboard** replicates Supabase Studio interface
- **Browser APIs** simulate realtime and function execution

### Target Users
- **Frontend Developers**: Building apps that use Supabase
- **Students & Educators**: Learning database and API concepts
- **Prototype Builders**: Rapid development and testing
- **Open Source Contributors**: Contributing to Supabase ecosystem

## Technical Architecture

### System Design
```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Environment                       │
├─────────────────────────────────────────────────────────────┤
│  React Dashboard (Supabase Studio Clone)                   │
│  ├── Table Editor    ├── SQL Editor    ├── Auth UI         │
│  ├── Storage UI      ├── Functions UI  ├── Realtime UI     │
├─────────────────────────────────────────────────────────────┤
│  MSW API Layer (Service Worker)                            │
│  ├── /rest/v1/*      ├── /auth/v1/*    ├── /storage/v1/*   │
│  ├── /functions/v1/* ├── /realtime/v1/*                    │
├─────────────────────────────────────────────────────────────┤
│  Common Infrastructure                                      │
│  ├── Database Manager ├── Auth Manager ├── Storage Manager │
│  ├── Function Manager ├── Realtime Manager                 │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                 │
│  ├── PGlite (PostgreSQL)  ├── IndexedDB (Files)           │
│  ├── LocalStorage (Config) ├── Memory (Sessions)           │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite
- **Database**: PGlite (WebAssembly PostgreSQL)
- **API Simulation**: MSW (Mock Service Worker)
- **UI Framework**: Tailwind CSS + shadcn/ui
- **Editor**: Monaco Editor (VS Code experience)
- **Storage**: IndexedDB (database + files)
- **Testing**: Vitest + React Testing Library

## Core Modules

### 1. Common Infrastructure Module

**Purpose**: Shared database and API handling patterns for all modules

**Components**:
- **DatabaseManager**: Enhanced singleton for PGlite operations
- **APIBridge**: Common request/response handling and validation
- **ConfigManager**: Application settings and connection strings
- **TypeGenerator**: Auto-generate TypeScript types from schema
- **MigrationManager**: Handle schema migrations and versioning

**Key Features**:
- Centralized database connection management
- Common error handling and logging
- Configuration management for all modules
- Schema introspection and type generation
- Migration tracking and rollback capabilities

**API Interface**:
```typescript
interface CommonInfrastructure {
  // Database operations
  query(sql: string, params?: any[]): Promise<QueryResult>
  transaction(queries: Query[]): Promise<QueryResult[]>
  
  // Configuration
  getConfig(key: string): any
  setConfig(key: string, value: any): void
  
  // Types and schema
  generateTypes(): Promise<string>
  getSchema(): Promise<DatabaseSchema>
  
  // Migrations
  runMigration(migration: Migration): Promise<void>
  rollbackMigration(version: string): Promise<void>
}
```

### 2. PostgREST Compatibility Module

**Purpose**: Full PostgREST API compatibility for REST operations

**Priority**: HIGH (Primary implementation focus)

**Current Status**: Partially implemented in `SupabaseAPIBridge`

**Required Enhancements**:

**2.1 Query Features**:
- ✅ Basic CRUD operations (GET, POST, PATCH, DELETE)
- ✅ Select columns (`?select=id,name,email`)
- ✅ Basic filters (`?name=eq.John`, `?age=gte.18`)
- ⚠️ Advanced filters (and, or, not operations)
- ❌ Nested resource embedding (`?select=*,posts(*)`)
- ❌ Function calls (`rpc/function_name`)
- ❌ Full-text search (`?description=fts.word`)
- ❌ Array operations (`?tags=cs.{tag1,tag2}`)

**2.2 HTTP Features**:
- ✅ Basic CORS handling
- ❌ Prefer headers (`Prefer: return=representation`)
- ❌ Range headers for pagination
- ❌ Proper HTTP status codes (201, 204, etc.)
- ❌ Content negotiation

**2.3 Advanced Operations**:
```typescript
interface PostgRESTFeatures {
  // Embedding and joins
  embed: 'posts(*),comments(*)'
  
  // Aggregation
  aggregate: 'count,sum,avg,max,min'
  
  // Full-text search
  fullTextSearch: 'fts.search_term'
  
  // Stored procedures
  rpc: 'function_name'
  
  // Bulk operations
  bulkInsert: 'multiple_rows'
  bulkUpdate: 'batch_updates'
}
```

**Implementation Plan**:
1. Extend `SupabaseAPIBridge` with advanced query parsing
2. Add comprehensive filter operator support
3. Implement resource embedding and joins
4. Add stored procedure execution
5. Full HTTP compliance (headers, status codes, CORS)

### 3. Supabase Auth Module

**Purpose**: Complete authentication system simulation

**Priority**: HIGH (Secondary focus after PostgREST)

**Current Status**: Basic implementation exists

**Required Features**:

**3.1 Authentication Methods**:
- ✅ Email/password signup and signin
- ❌ Magic link authentication (email simulation)
- ❌ Social OAuth providers (simulation)
- ❌ Phone/SMS authentication (simulation)
- ❌ Anonymous authentication

**3.2 User Management**:
- ✅ Basic user CRUD operations
- ❌ User metadata management
- ❌ Email confirmation workflows
- ❌ Password reset flows
- ❌ User role and permission system

**3.3 Session Management**:
- ✅ JWT token generation
- ✅ Refresh token handling
- ❌ Session persistence across tabs
- ❌ Session timeout and renewal
- ❌ Device management

**3.4 Security Features**:
- ❌ Row Level Security (RLS) simulation
- ❌ Policy engine implementation
- ❌ Rate limiting and abuse protection
- ❌ Audit logging

**API Endpoints**:
```typescript
interface AuthAPI {
  // Authentication
  'POST /auth/v1/signup': SignupRequest
  'POST /auth/v1/signin': SigninRequest
  'POST /auth/v1/signout': SignoutRequest
  'POST /auth/v1/token': RefreshRequest
  'POST /auth/v1/recover': PasswordResetRequest
  'POST /auth/v1/confirm': EmailConfirmRequest
  
  // User management
  'GET /auth/v1/user': GetUserRequest
  'PUT /auth/v1/user': UpdateUserRequest
  'DELETE /auth/v1/user': DeleteUserRequest
  
  // Admin operations
  'GET /auth/v1/admin/users': ListUsersRequest
  'POST /auth/v1/admin/users': CreateUserRequest
  'DELETE /auth/v1/admin/users/:id': DeleteUserRequest
}
```

### 4. Storage Module (Stubbed Implementation)

**Purpose**: File management system with IndexedDB backend

**Priority**: MEDIUM (Implement after core features)

**Planned Features**:
- File upload/download simulation
- Bucket management
- File metadata and permissions
- Image transformation simulation
- CDN URL generation

**Storage Structure**:
```typescript
interface StorageAPI {
  // Bucket operations
  'GET /storage/v1/bucket': ListBucketsRequest
  'POST /storage/v1/bucket': CreateBucketRequest
  'DELETE /storage/v1/bucket/:id': DeleteBucketRequest
  
  // File operations
  'POST /storage/v1/object/:bucket/*': UploadFileRequest
  'GET /storage/v1/object/:bucket/*': DownloadFileRequest
  'DELETE /storage/v1/object/:bucket/*': DeleteFileRequest
  'PATCH /storage/v1/object/:bucket/*': UpdateFileRequest
}
```

### 5. Edge Functions Module ✅ COMPLETE

**Purpose**: Complete serverless function development environment

**Priority**: ✅ IMPLEMENTED (100% Complete)

**Implemented Features**:
- **File Explorer**: Tree view file browser with full CRUD operations
- **Monaco Editor**: Professional code editing with TypeScript support
- **Local Folder Sync**: File System Access API integration for bidirectional sync
- **Deployment System**: Environment variables, deployment history, and rollback
- **Developer Tools**: Console logs, performance metrics, and network monitoring
- **Function Execution**: MSW-based function simulation with realistic responses
- **Multi-Project Support**: Project-scoped functions with VFS integration

**Technical Implementation**:
- **Components**: FileExplorer, CodeEditor, FolderSync, DeploymentPanel, DevTools
- **Infrastructure**: SyncManager for local sync, VFS integration for file storage
- **API Endpoints**: Function execution, deployment, logs, and metrics endpoints
- **Browser Compatibility**: Full support in Chrome/Edge, core functionality in all browsers

### 6. Realtime Module (Stubbed Implementation)

**Purpose**: Real-time subscription simulation using BroadcastChannel

**Priority**: LOW (Future implementation)

**Planned Features**:
- Database change notifications
- Channel-based messaging
- Presence tracking
- Cross-tab synchronization

## Dashboard UI/UX Requirements

### Design Principles
- **Supabase Studio Parity**: Match official dashboard look and feel
- **Responsive Design**: Work on all screen sizes
- **Accessibility**: WCAG 2.1 AA compliance
- **Performance**: Fast loading and smooth interactions

### Core Interface Components

**4.1 Navigation Structure**:
```
Sidebar Navigation:
├── 📊 Dashboard (Overview)
├── 🗃️ Table Editor
├── 📝 SQL Editor  
├── 🔐 Authentication
├── 🗂️ Storage
├── ⚡ Edge Functions
├── 📡 Realtime
├── ⚙️ Settings
└── 🧪 API Tester
```

**4.2 Dashboard Page**:
- Database connection status and metrics
- Quick stats (tables, rows, storage used)
- Recent activity feed
- Quick actions and shortcuts
- Resource usage visualization

**4.3 Table Editor** (Currently Implemented):
- ✅ Spreadsheet-like data grid
- ✅ CRUD operations on rows
- ✅ Column management and filtering
- ⚠️ Schema editing (add/modify columns)
- ❌ Relationship visualization
- ❌ Index management
- ❌ Constraint management

**4.4 SQL Editor** (Currently Implemented):
- ✅ Monaco Editor with SQL syntax highlighting
- ✅ Query execution and result display
- ✅ Query history management
- ❌ Query saving and organization
- ❌ Schema browser sidebar
- ❌ Query performance metrics
- ❌ Export results to CSV/JSON

**4.5 Authentication Interface**:
- User management table
- Authentication method configuration
- Policy editor for RLS
- Session and token management
- Auth provider settings

**4.6 Settings Interface**:
- Database configuration
- API key management
- Connection string display
- Export/import data
- Reset database option

## Testing & Compatibility Framework

### Testing Strategy
Use the hosted `supabase-lite` Supabase project to validate compatibility

**5.1 Compatibility Testing Module**:
```typescript
interface CompatibilityTest {
  name: string
  description: string
  localTest: () => Promise<any>
  remoteTest: () => Promise<any>
  compareResults: (local: any, remote: any) => boolean
}
```

**5.2 Test Categories**:
- **API Compatibility**: REST endpoint behavior matching
- **Authentication Flow**: Complete auth workflows
- **Data Operations**: CRUD operations and complex queries
- **Error Handling**: Error format and status code consistency
- **Performance**: Response time and data size comparison

**5.3 Test Automation**:
- Automated test suite running against both environments
- Continuous compatibility monitoring
- Regression detection
- Performance benchmarking

**5.4 MCP Integration**:
- Use Supabase MCP server for remote testing
- Automated setup and teardown of test data
- Environment synchronization

### Implementation Plan:
1. Create `TestingFramework` class
2. Implement dual-environment test runner
3. Add comprehensive test suites for each module
4. Create compatibility dashboard
5. Set up continuous testing pipeline

## Local Development Server

### MSW Static Server Setup

**6.1 Server Configuration**:
```typescript
interface LocalServer {
  baseURL: string        // Default: http://localhost:3001
  apiKey: string        // Local anon key
  serviceRoleKey: string // Local service role key
  projectRef: string    // Local project identifier
}
```

**6.2 Connection Switching**:
```typescript
interface ConnectionConfig {
  mode: 'local' | 'remote'
  local: {
    url: 'http://localhost:3001'
    anonKey: 'local-anon-key'
    serviceRoleKey: 'local-service-role-key'
  }
  remote: {
    url: 'https://[project].supabase.co'
    anonKey: 'real-anon-key'
    serviceRoleKey: 'real-service-role-key'
  }
}
```

**6.3 Test Application**:
- Simple CRUD application using supabase-js
- Environment switcher (local vs remote)
- Side-by-side comparison interface
- Feature compatibility matrix

### Implementation:
1. Create standalone test application
2. Implement environment switching
3. Add comparison utilities
4. Document setup process

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
**Goals**: Establish solid foundation and core infrastructure

**Tasks**:
1. ✅ Basic project structure and tooling
2. ✅ PGlite integration and database management
3. ✅ MSW setup with basic API endpoints
4. 🔄 Enhanced Common Infrastructure module
5. 🔄 Comprehensive testing framework setup

### Phase 2: PostgREST Excellence (Weeks 3-5)
**Goals**: Achieve high PostgREST API compatibility

**Tasks**:
1. Advanced query features (embedding, functions, search)
2. Complete filter operator support
3. Proper HTTP compliance (headers, status codes)
4. Resource embedding and joins
5. Comprehensive PostgREST test suite

### Phase 3: Authentication System (Weeks 6-8)
**Goals**: Complete authentication implementation

**Tasks**:
1. Enhanced user management
2. Session management across tabs
3. Row Level Security simulation
4. Authentication UI components
5. Auth compatibility testing

### Phase 4: Dashboard Enhancement (Weeks 9-10)
**Goals**: Feature-complete dashboard interface

**Tasks**:
1. Enhanced table editor with schema management
2. Advanced SQL editor features
3. Authentication interface
4. Settings and configuration UI
5. API tester and debugging tools

### Phase 5: Integration & Testing (Weeks 11-12)
**Goals**: Comprehensive testing and compatibility validation

**Tasks**:
1. Complete compatibility testing framework
2. Local development server setup
3. Test application development
4. Performance optimization
5. Documentation and examples

### Phase 6: Advanced Features (In Progress)
**Goals**: Storage, Functions ✅, and Realtime modules

**Tasks**:
1. Storage module implementation
2. ✅ **Edge Functions implementation** - Complete serverless development environment
3. Realtime subscriptions
4. Advanced dashboard features
5. Performance monitoring

## Success Metrics

### Compatibility Metrics
- **API Compatibility**: 95% PostgREST endpoint compatibility
- **supabase-js Compatibility**: 90% client library method support
- **Error Handling**: 100% error format consistency
- **Response Time**: <200ms average for typical operations

### Functionality Metrics
- **Database Operations**: All basic CRUD operations
- **Advanced Queries**: Complex joins, filters, and aggregations
- **Authentication**: Complete signup/signin flows
- **UI Components**: Feature parity with Supabase Studio core features

### Developer Experience Metrics
- **Setup Time**: <5 minutes from clone to running
- **Documentation**: Complete setup and usage guides
- **Test Coverage**: >90% code coverage
- **Bug Reports**: <5 open issues at any time

## Technical Constraints & Considerations

### Browser Limitations
- **File Size**: Large database files may impact performance
- **Memory Usage**: PGlite memory consumption monitoring
- **Storage Quotas**: IndexedDB storage limits
- **Cross-Origin**: Limitations for external API testing

### Security Considerations
- **Local Data**: All data stored locally in browser
- **No Network Security**: Authentication is simulation only
- **Development Only**: Not suitable for production use
- **Data Privacy**: Clear communication about local storage

### Performance Considerations
- **Database Size**: Optimize for databases up to 100MB
- **Query Performance**: Efficient SQL generation and execution
- **UI Responsiveness**: Maintain 60fps interactions
- **Memory Management**: Proper cleanup and garbage collection

### Compatibility Considerations
- **Browser Support**: Modern browsers with WebAssembly support
- **supabase-js Versions**: Support latest stable version
- **API Evolution**: Plan for Supabase API changes
- **Feature Parity**: Prioritize commonly used features

## Conclusion

Supabase Lite represents an ambitious but achievable goal: creating a complete, browser-based implementation of Supabase that provides developers with a powerful local development environment. By focusing on compatibility, developer experience, and comprehensive testing, we can deliver a tool that serves both educational and practical development needs.

The phased approach ensures we deliver value incrementally while building toward the complete vision. The emphasis on PostgREST and authentication compatibility ensures the most commonly used features work seamlessly, while the testing framework validates our implementation against real Supabase instances.

This PRD serves as the roadmap for development, ensuring all team members understand the goals, requirements, and implementation approach for creating Supabase Lite.

---

**Next Steps**: 
1. Review and approval of this PRD
2. Begin Phase 1 implementation
3. Set up development environment and testing framework
4. Start building enhanced Common Infrastructure module

**Document Maintenance**: This PRD should be updated as requirements evolve and new learnings emerge during development.