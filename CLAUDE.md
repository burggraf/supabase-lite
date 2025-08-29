# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

#### NOTE

Do not say "You're absolutely right!" to me. I don't want to hear that "you've found the problem". Just do the thing.

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

## Development Commands

- `npm run dev` - Start development server (Vite on port 5173)
- `npm run build` - Build for production (TypeScript check + Vite build)
- `npm run lint` - Run ESLint for code quality checks
- `npm run preview` - Preview production build locally
- `npm run test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI interface
- `npm run test:coverage` - Run tests with coverage report

### Testing Single Components/Files

- `npm test -- src/components/ComponentName` - Run tests for specific component
- `npm test -- --run src/hooks/useHook.test.ts` - Run specific test file
- `npm test -- --grep "specific test name"` - Run tests matching pattern

### Testing Edge Functions Components

- `npm test -- src/components/edge-functions/` - Run all Edge Functions component tests
- `npm test -- src/lib/vfs/SyncManager.test.ts` - Test local folder synchronization
- `npm test -- src/pages/EdgeFunctions.test.tsx` - Test main Edge Functions page

### Testing Storage Components

- `npm test -- src/components/storage/` - Run all Storage component tests
- `npm test -- src/lib/storage/` - Test Storage API client and bucket management
- `npm test -- src/lib/vfs/SignedUrlManager.test.ts` - Test signed URL generation

### Testing Authentication Components

- `npm test -- src/components/auth/` - Run all Authentication component tests
- `npm test -- src/lib/auth/` - Test auth system components (AuthManager, JWTService, etc.)
- `npm test -- src/lib/auth/__tests__/rls-integration.test.ts` - Test Row Level Security integration

### Testing App Hosting Components

- `npm test -- src/components/app-hosting/` - Run all App Hosting component tests
- `npm test -- src/lib/vfs/FolderUploadService.test.ts` - Test folder upload and app deployment

### External Testing with test-app

- `cd test-app && npm install && npm run dev` - Start external test application on port 5176
- Test Supabase.js integration against local Supabase Lite instance
- Demonstrates cross-origin API access and authentication flows

## CRITICAL REQUIREMENT: 100% BROWSER-ONLY OPERATION

**🚨 ABSOLUTE RULE: This application MUST run entirely in the browser with NO server-side components, NO Node.js code execution, and NO file system access. NEVER add Node.js adapters, server-side storage, or file-based solutions. The MSW HTTP middleware runs in Vite's dev server context but ALL application logic must be browser-compatible.**

## Architecture Overview

### Core Database Layer

- **PGlite Integration**: WebAssembly PostgreSQL running in browser with IndexedDB persistence
- **DatabaseManager** (`src/lib/database/connection.ts`): Singleton class managing PGlite instance
  - **Connection Pooling**: Manages multiple project databases with automatic cleanup and efficient switching
  - **Schema Management**: Auto-initializes Supabase-compatible schemas (auth, storage, realtime) from seed SQL files
  - **Query Caching**: Built-in query caching with TTL and LRU eviction for performance optimization
  - **Performance Metrics**: Tracks query execution times and provides performance analytics
  - Provides database size calculation and table listing functionality
- **useDatabase Hook** (`src/hooks/useDatabase.ts`): React hook wrapping DatabaseManager
  - Manages connection state, error handling, and provides query execution interface
  - Includes useQueryHistory hook for localStorage-based query history (limit: 100 queries)
- **ProjectManager**: Multi-project management with localStorage persistence for seamless project switching

### Application Structure

- **Single Page Application**: React 19 + TypeScript + Vite
- **State Management**: React hooks (no external state library)
- **Routing**: Simple string-based page switching in App.tsx (no React Router)
- **UI Components**: shadcn/ui components with Tailwind CSS
- **Code Editor**: Monaco Editor for SQL editing with syntax highlighting

### Component Architecture

```
src/
├── components/
│   ├── ui/              # shadcn/ui components (button, card, badge)
│   ├── dashboard/       # Dashboard and Sidebar components
│   ├── sql-editor/      # SQLEditor component
│   ├── table-editor/    # Full-featured data table with filtering and CRUD
│   ├── edge-functions/  # Edge Functions development environment ✅
│   │   ├── FileExplorer.tsx      # Tree view file browser
│   │   ├── CodeEditor.tsx        # Monaco Editor integration
│   │   ├── FolderSync.tsx        # Local folder synchronization  
│   │   ├── DeploymentPanel.tsx   # Function deployment
│   │   └── DevTools.tsx          # Developer tools
│   ├── storage/         # Storage management interface ✅
│   │   ├── Storage.tsx           # Main storage interface
│   │   ├── BucketList.tsx        # Bucket management
│   │   ├── FileBrowser.tsx       # File browser and management
│   │   └── FileUpload.tsx        # File upload component
│   ├── auth/            # Authentication interface ✅
│   │   └── AuthTestPanel.tsx     # Auth testing and management
│   ├── app-hosting/     # Static app hosting ✅
│   │   ├── AppHosting.tsx        # Main app hosting interface
│   │   ├── AppList.tsx           # Deployed app management
│   │   └── AppDeploymentModal.tsx # App deployment dialog
│   └── api-test/        # API testing interface ✅
│       └── APITester.tsx         # REST API testing component
├── hooks/               # Custom React hooks for database operations
├── lib/
│   ├── database/        # DatabaseManager and PGlite connection
│   ├── vfs/            # Virtual File System for Edge Functions ✅
│   │   ├── VFSManager.ts        # File storage and management
│   │   ├── VFSBridge.ts         # API bridge integration
│   │   ├── SyncManager.ts       # Local folder sync
│   │   ├── SignedUrlManager.ts  # Signed URL generation for file access
│   │   └── FolderUploadService.ts # Folder upload and app deployment
│   ├── storage/         # Storage service implementation ✅
│   │   ├── StorageClient.ts     # Main storage API client (Supabase compatible)
│   │   ├── StorageBucket.ts     # Bucket operations and file management
│   │   └── StorageError.ts      # Storage error handling
│   ├── auth/            # Authentication system ✅
│   │   ├── AuthBridge.ts        # Main auth service bridge
│   │   ├── core/
│   │   │   ├── AuthManager.ts   # User management and authentication
│   │   │   ├── JWTService.ts    # JWT token generation and validation
│   │   │   └── SessionManager.ts # Session lifecycle management
│   │   ├── rls-enforcer.ts      # Row Level Security enforcement
│   │   └── services/
│   │       └── MFAService.ts    # Multi-factor authentication
│   ├── functions/       # Edge Functions service ✅
│   │   ├── FunctionsClient.ts   # Functions deployment and execution
│   │   └── integration.ts       # Functions integration with VFS
│   ├── infrastructure/ # Logger, ErrorHandler, ConfigManager
│   ├── constants.ts     # App config, navigation items, query examples
│   └── utils.ts         # Utility functions
├── pages/               # Main application pages
│   └── EdgeFunctions.tsx # Edge Functions main page ✅
├── mocks/               # MSW handlers and API bridge implementations
└── types/               # TypeScript interfaces for DB operations
```

### Key Design Patterns

- **Singleton Managers**:
  - `DatabaseManager`: Single PGlite instance with connection pooling for multi-project support
  - `ProjectManager`: Multi-project management with localStorage persistence
  - `AuthBridge`: Authentication service integration with JWT token management
  - `ConfigManager`: Type-safe application configuration management
  - `VFSManager`: Virtual file system for Edge Functions and app hosting
  - `AuthManager`: Core authentication logic with user management
- **Bridge Pattern**:
  - `SupabaseAPIBridge`: Basic PostgREST compatibility for REST API calls
  - `EnhancedSupabaseAPIBridge`: Advanced query parsing with full PostgREST syntax support
  - `AuthBridge`: Authentication endpoint handling with Supabase auth compatibility
  - `VFSBridge`: File system operations for Edge Functions and storage
  - `StorageClient`: Storage API compatibility with Supabase Storage
- **Infrastructure Layer**:
  - `Logger`: Structured logging with performance tracking
  - `ErrorHandler`: Centralized error handling with user-friendly messages
  - `APIBridge`: HTTP request abstraction with retry logic
- **Hook-based State**: Database operations wrapped in React hooks
- **Component Composition**: UI built with reusable shadcn/ui components
- **Local Persistence**: IndexedDB for database, localStorage for query history and project settings
- **Error Boundary Pattern**: Try-catch with user-friendly error states

### Technology Stack Details

- **Frontend**: React 19, TypeScript 5.8, Vite 7
- **Database**: @electric-sql/pglite (WebAssembly PostgreSQL)
- **Editor**: Monaco Editor (VS Code editor in browser)
- **UI**: Tailwind CSS + shadcn/ui + Lucide React icons
- **Build**: Vite with TypeScript checking, ESLint for linting

### Storage Architecture ✅ COMPLETE

The Storage module provides a complete file management system compatible with Supabase Storage:

#### Core Components
- **StorageClient** (`src/lib/storage/StorageClient.ts`): Main storage API client with Supabase compatibility
- **StorageBucket** (`src/lib/storage/StorageBucket.ts`): Bucket operations and file management
- **Storage UI** (`src/components/storage/Storage.tsx`): Main storage interface with bucket and file management
- **SignedUrlManager** (`src/lib/vfs/SignedUrlManager.ts`): Signed URL generation for secure file access

#### Key Features
- Full Supabase Storage API compatibility (createBucket, getBucket, listBuckets, upload, download)
- File upload/download with drag-and-drop support
- Bucket management with policies and settings
- Signed URL generation for secure file access
- Multi-select file operations and batch actions
- VFS integration for persistent storage using IndexedDB

### Authentication Architecture ✅ COMPLETE

The Authentication module provides a complete auth system compatible with Supabase Auth:

#### Core Components
- **AuthBridge** (`src/lib/auth/AuthBridge.ts`): Main authentication service bridge
- **AuthManager** (`src/lib/auth/core/AuthManager.ts`): User management and database operations
- **JWTService** (`src/lib/auth/core/JWTService.ts`): JWT token generation and validation
- **SessionManager** (`src/lib/auth/core/SessionManager.ts`): Session lifecycle management
- **MFAService** (`src/lib/auth/services/MFAService.ts`): Multi-factor authentication support
- **RLS Enforcer** (`src/lib/auth/rls-enforcer.ts`): Row Level Security implementation

#### Key Features
- JWT-based authentication with HS256 signing
- User signup, signin, password reset, and email verification
- Row Level Security (RLS) enforcement with automatic user context injection
- Session management with token refresh
- Multi-factor authentication (TOTP)
- Password hashing with bcrypt
- Compatible with Supabase Auth API endpoints

### App Hosting Architecture ✅ COMPLETE

The App Hosting module provides static web app deployment and serving:

#### Core Components
- **AppHosting** (`src/components/app-hosting/AppHosting.tsx`): Main app hosting interface
- **AppDeploymentModal** (`src/components/app-hosting/AppDeploymentModal.tsx`): App deployment dialog
- **FolderUploadService** (`src/lib/vfs/FolderUploadService.ts`): Folder upload and app deployment service

#### Key Features
- Drag-and-drop folder upload for static web apps
- App deployment with file validation and optimization
- Deployed app management and monitoring
- File serving with proper MIME types
- App versioning and rollback capabilities
- Integration with VFS for persistent app storage

### API Testing Architecture ✅ COMPLETE

The API Testing module provides comprehensive testing tools for the Supabase-compatible API:

#### Core Components
- **APITester** (`src/components/api-test/APITester.tsx`): Interactive API testing interface

#### Key Features
- Test REST API endpoints (GET, POST, PUT, DELETE)
- Authentication endpoint testing
- Query parameter validation
- Real-time response inspection
- Test history and result comparison
- Error handling and debugging tools

### Edge Functions Architecture ✅ COMPLETE

The Edge Functions module provides a complete serverless function development environment:

#### Core Components
- **EdgeFunctions Page** (`src/pages/EdgeFunctions.tsx`): Main orchestrator with tabbed interface
- **FileExplorer** (`src/components/edge-functions/FileExplorer.tsx`): Tree view file browser with CRUD
- **CodeEditor** (`src/components/edge-functions/CodeEditor.tsx`): Monaco Editor with TypeScript support
- **FolderSync** (`src/components/edge-functions/FolderSync.tsx`): Local folder synchronization
- **DeploymentPanel** (`src/components/edge-functions/DeploymentPanel.tsx`): Function deployment and testing
- **DevTools** (`src/components/edge-functions/DevTools.tsx`): Console logs and performance monitoring

#### Supporting Infrastructure
- **SyncManager** (`src/lib/vfs/SyncManager.ts`): File System Access API integration for local sync
- **VFS Integration**: Project-scoped file storage using existing Virtual File System
- **MSW Handlers**: Function execution simulation with realistic responses

#### Key Features
- Monaco Editor with full TypeScript IntelliSense and auto-completion
- Multi-file tab management with unsaved change indicators
- Auto-save with 2-second debounce to prevent excessive saves
- File System Access API for bidirectional local folder sync
- Environment variable management with secure storage
- Deployment history with rollback functionality
- Real-time console logs and performance metrics
- Function execution simulation with MSW integration

### Future Architecture Notes

All major Supabase services are now implemented: ✅ **Database**, ✅ **Authentication**, ✅ **Storage**, ✅ **Edge Functions**, ✅ **App Hosting**, and ✅ **API Testing**. The remaining feature is **Realtime** subscriptions which will use BroadcastChannel API for cross-tab communication.

### Key Implementation Files

**Database Core:**
- `src/lib/database/connection.ts` - DatabaseManager with PGlite integration
- `src/hooks/useDatabase.ts` - React hook for database operations
- `src/lib/projects/ProjectManager.ts` - Multi-project management

**Authentication System:**
- `src/lib/auth/AuthBridge.ts` - Main auth service
- `src/lib/auth/core/AuthManager.ts` - User management 
- `src/lib/auth/rls-enforcer.ts` - Row Level Security

**Storage System:**
- `src/lib/storage/StorageClient.ts` - Storage API client
- `src/lib/vfs/SignedUrlManager.ts` - Secure file access
- `src/components/storage/Storage.tsx` - Storage UI

**Virtual File System:**
- `src/lib/vfs/VFSManager.ts` - File storage management
- `src/lib/vfs/SyncManager.ts` - Local folder synchronization

**API & Testing:**
- `src/mocks/enhanced-bridge.ts` - PostgREST compatibility
- `src/mocks/handlers.ts` - MSW request handlers
- `src/test/setup.ts` - Global test configuration

## Testing Guidelines

### Testing Framework

- **Vitest**: Modern, fast unit test runner with built-in TypeScript support
- **React Testing Library**: Component testing with user-centric approach
- **jsdom**: Browser environment simulation for React components
- **Coverage**: Built-in coverage reporting with v8

### Test Structure

```
src/
├── components/
│   └── component-name/
│       ├── Component.tsx
│       └── __tests__/
│           └── Component.test.tsx
├── hooks/
│   ├── useHook.ts
│   └── __tests__/
│       └── useHook.test.ts
├── lib/
│   ├── module/
│   │   ├── file.ts
│   │   └── __tests__/
│   │       └── file.test.ts
└── test/
    └── setup.ts  # Global test configuration
```

### Testing Requirements

#### 🚨 MANDATORY: TEST-DRIVEN DEVELOPMENT (TDD) ONLY

**ABSOLUTE RULE: ALL new features, components, hooks, and utilities MUST follow strict Test-Driven Development. NO EXCEPTIONS.**

- **TESTS MUST BE WRITTEN FIRST** - Writing implementation before tests is FORBIDDEN
- **Red-Green-Refactor cycle is MANDATORY** - No feature is complete without this process
- **NO CODE may be considered complete without comprehensive tests**
- **ALL new code MUST start with failing tests that define the expected behavior**

#### ENFORCED TDD WORKFLOW:

**STEP 1: RED - Write Failing Tests**
- Write tests that describe the exact behavior expected
- Tests MUST fail initially (red state)
- Tests should cover happy path, edge cases, and error conditions
- NO implementation code allowed until tests are written

**STEP 2: GREEN - Minimal Implementation**
- Write the absolute minimum code to make tests pass
- Focus only on making tests green, not on perfect code
- Implementation should be just enough to satisfy the test requirements

**STEP 3: REFACTOR - Improve Code Quality**
- Clean up code while keeping all tests green
- Apply best practices, design patterns, and optimizations
- All tests must continue to pass throughout refactoring

**STEP 4: REPEAT**
- Add new failing tests for additional functionality
- Continue the Red-Green-Refactor cycle until feature is complete

#### MANDATORY TDD RULES:

- **NO implementation before tests** - Violating this rule requires rewriting from scratch
- **Every line of code MUST be driven by a failing test**
- **Tests define the API and behavior contract before any code exists**
- **If you can't write a test for it, you can't implement it**

#### Test Types to Write:

**Component Tests:**

- Rendering with different props and states
- User interactions (clicks, form inputs, keyboard events)
- Conditional rendering based on props/state
- Error states and loading states
- Accessibility and proper semantic HTML

**Hook Tests:**

- Initial state and return values
- State updates and side effects
- Error handling and edge cases
- Cleanup and unmounting behavior
- Dependencies and re-rendering optimization

**Utility Function Tests:**

- Pure function behavior with various inputs
- Edge cases and boundary conditions
- Error handling for invalid inputs
- Type safety and parameter validation

**Database/API Tests:**

- Successful operations and data transformations
- Error handling and network failures
- Connection states and initialization
- Data persistence and retrieval
- Query formatting and parameter handling

#### Test Quality Standards:

- **Descriptive test names**: Use "should..." format that explains expected behavior
- **Arrange-Act-Assert pattern**: Clear test structure with setup, execution, verification
- **Test isolation**: Each test should be independent and not rely on others
- **Mock external dependencies**: Database calls, APIs, timers, browser APIs
- **Test user behavior**: Focus on what users do, not implementation details
- **Cover error paths**: Test failure scenarios and error boundaries

#### Running Tests:

- **Before committing**: Always run `npm test` to ensure all tests pass
- **During development**: Use `npm run test:watch` for immediate feedback
- **After changes**: Run affected tests to verify no regressions
- **Before deployment**: Run full test suite including coverage checks

#### Coverage Requirements:

- **Minimum 90% line coverage** for all new code
- **100% coverage for critical paths** (database operations, user actions)
- **No untested error handlers** or catch blocks
- **All public API methods must be tested**

### Testing Examples:

```typescript
// Component test example
describe('DatabaseStatus', () => {
	it('should display connected status when database is connected', () => {
		render(<DatabaseStatus isConnected={true} />)
		expect(screen.getByText('Connected')).toBeInTheDocument()
		expect(screen.getByTestId('status-indicator')).toHaveClass('bg-green-500')
	})
})

// Hook test example
describe('useDatabase', () => {
	it('should execute queries and return results', async () => {
		const { result } = renderHook(() => useDatabase())
		await act(async () => {
			const queryResult = await result.current.executeQuery('SELECT 1')
			expect(queryResult.rows).toEqual([{ '?column?': 1 }])
		})
	})
})

// Utility test example
describe('formatBytes', () => {
	it('should format bytes correctly', () => {
		expect(formatBytes(1024)).toBe('1 KB')
		expect(formatBytes(0)).toBe('0 B')
		expect(formatBytes(1536)).toBe('1.5 KB')
	})
})
```

### 🚨 CRITICAL TESTING WORKFLOW - TDD ENFORCEMENT:

**MANDATORY STEPS FOR EVERY FEATURE/FIX:**

1. 🔴 **RED**: Write failing tests that define expected behavior - NO implementation yet
2. 🔴 **VERIFY**: Run tests to confirm they fail for the right reasons
3. 🟢 **GREEN**: Write minimal code to make tests pass - nothing more
4. 🟢 **VERIFY**: Run tests to confirm they all pass
5. 🔵 **REFACTOR**: Improve code quality while keeping tests green
6. ✅ **VALIDATE**: Run full test suite: `npm test`
7. ✅ **QUALITY**: Check coverage and add tests for missed cases (must be 90%+)
8. ✅ **LINT**: Run `npm run lint` - no warnings allowed
9. ✅ **BUILD**: Run `npm run build` - must pass without errors

**ZERO TOLERANCE POLICY:**
- ❌ **Implementation without tests first = REJECTED**
- ❌ **Tests written after implementation = START OVER**
- ❌ **Skipping any step in TDD cycle = INCOMPLETE**
- ❌ **Less than 90% coverage = NOT DONE**

**TDD is non-negotiable. Every single line of code must be test-driven.**

### Test Configuration Files:

- `vitest.config.ts` - Vitest configuration with React support
- `src/test/setup.ts` - Global test setup and mocks
  - PGlite, crypto, localStorage, and performance APIs are globally mocked
  - MSW server configuration with proper cleanup between tests
  - React Testing Library custom render with providers
- Tests run with jsdom environment for React component testing

### MSW (Mock Service Worker) Integration

- **Browser-based API mocking**: MSW handlers in `src/mocks/` provide Supabase-compatible REST API
- **EnhancedSupabaseAPIBridge**: Advanced bridge class with full PostgREST compatibility
  - Complete query syntax support (filters, ordering, pagination, range queries)
  - Row Level Security (RLS) implementation with user context extraction
  - Project resolution pattern with `withProjectResolution()` higher-order function
- **Cross-Origin API Handler**: HTTP middleware for external app integration with 100% Supabase.js compatibility
- **Test isolation**: MSW server setup in test/setup.ts with proper cleanup between tests
- **API endpoints**: PostgREST-compatible endpoints for GET, POST, PATCH, DELETE operations
- **Authentication simulation**: Mock auth endpoints for signup, signin, token refresh with JWT token management
- **Debug Endpoints**: SQL execution endpoint for development and testing (`/debug/sql`)

## Quick Database Access

### SQL Execution via Debug Endpoint

For quick database queries during development, use the debug SQL endpoint:

```javascript
// Execute SQL against the local PGlite database
async function executeSQL(sql) {
	const response = await fetch('http://localhost:5173/debug/sql', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ sql }),
	})
	const result = await response.json()
	console.table(result.data)
	return result
}

// Examples:
executeSQL('SELECT COUNT(*) FROM auth.users')
executeSQL('SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 10')
executeSQL('SELECT * FROM public.products LIMIT 5')
```

### Browser Console Access

The debug endpoint is accessible from any browser context (including test-app):

```javascript
// Check auth users
fetch('http://localhost:5173/debug/sql', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ sql: 'SELECT id, email, created_at FROM auth.users' }),
})
	.then((r) => r.json())
	.then(console.table)

// Check database schema
fetch('http://localhost:5173/debug/sql', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth'",
	}),
})
	.then((r) => r.json())
	.then(console.log)
```
