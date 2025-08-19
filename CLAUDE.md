# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server (Vite on port 5173)
- `npm run build` - Build for production (TypeScript check + Vite build)
- `npm run lint` - Run ESLint for code quality checks
- `npm run preview` - Preview production build locally
- `npm run test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI interface
- `npm run test:coverage` - Run tests with coverage report

## Architecture Overview

### Core Database Layer
- **PGlite Integration**: WebAssembly PostgreSQL running in browser with IndexedDB persistence
- **DatabaseManager** (`src/lib/database/connection.ts`): Singleton class managing PGlite instance
  - Handles initialization, schema setup, query execution, and connection state
  - Auto-creates `auth`, `storage`, `realtime` schemas and sample `users`/`posts` tables
  - Provides database size calculation and table listing functionality
- **useDatabase Hook** (`src/hooks/useDatabase.ts`): React hook wrapping DatabaseManager
  - Manages connection state, error handling, and provides query execution interface
  - Includes useQueryHistory hook for localStorage-based query history (limit: 100 queries)

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
│   └── sql-editor/      # SQLEditor component
├── hooks/               # Custom React hooks for database operations
├── lib/
│   ├── database/        # DatabaseManager and PGlite connection
│   ├── constants.ts     # App config, navigation items, query examples
│   └── utils.ts         # Utility functions
└── types/               # TypeScript interfaces for DB operations
```

### Key Design Patterns
- **Singleton Database Manager**: Single PGlite instance shared across application
- **Hook-based State**: Database operations wrapped in React hooks
- **Component Composition**: UI built with reusable shadcn/ui components
- **Local Persistence**: IndexedDB for database, localStorage for query history
- **Error Boundary Pattern**: Try-catch with user-friendly error states

### Technology Stack Details
- **Frontend**: React 19, TypeScript 5.8, Vite 7
- **Database**: @electric-sql/pglite (WebAssembly PostgreSQL)
- **Editor**: Monaco Editor (VS Code editor in browser)
- **UI**: Tailwind CSS + shadcn/ui + Lucide React icons
- **Build**: Vite with TypeScript checking, ESLint for linting

### Future Architecture Notes
Navigation items in constants.ts show planned features (auth, storage, realtime, edge-functions, api) that will extend the current database-focused architecture. The DatabaseManager already creates schemas for these future services.

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

#### MANDATORY: Test Everything You Build
- **Write tests BEFORE or ALONGSIDE implementation** - never after
- **Test every new feature, component, hook, and utility function**
- **Run tests immediately after writing them** to ensure they pass
- **Always run the full test suite before considering a feature complete**

#### For New Features:
1. **Plan tests first**: Identify what needs testing (happy path, edge cases, errors)
2. **Write failing tests**: Create tests that describe the expected behavior
3. **Implement feature**: Write the minimal code to make tests pass
4. **Refactor**: Improve code while keeping tests green
5. **Test coverage**: Ensure all branches and edge cases are covered

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

### CRITICAL TESTING WORKFLOW:

**For Every Feature/Fix:**
1. ✅ Write tests that describe the expected behavior
2. ✅ Run tests to ensure they fail initially (red)
3. ✅ Implement the minimal code to make tests pass (green)
4. ✅ Refactor code while keeping tests green
5. ✅ Run full test suite: `npm test`
6. ✅ Check coverage and add tests for missed cases
7. ✅ Run lint: `npm run lint`
8. ✅ Run build: `npm run build`

**Never skip testing!** Tests are as important as the feature itself. Untested code is broken code waiting to happen.

### Test Configuration Files:
- `vitest.config.ts` - Vitest configuration with React support
- `src/test/setup.ts` - Global test setup and mocks
- Tests run with jsdom environment for React component testing

### MSW (Mock Service Worker) Integration
- **Browser-based API mocking**: MSW handlers in `src/mocks/` provide Supabase-compatible REST API
- **SupabaseAPIBridge**: Bridge class that translates REST API calls to PGlite database operations
- **Test isolation**: MSW server setup in test/setup.ts with proper cleanup between tests
- **API endpoints**: PostgREST-compatible endpoints for GET, POST, PATCH, DELETE operations
- **Authentication simulation**: Mock auth endpoints for signup, signin, token refresh

## Quick Database Access

### SQL Execution via Debug Endpoint
For quick database queries during development, use the debug SQL endpoint:

```javascript
// Execute SQL against the local PGlite database
async function executeSQL(sql) {
  const response = await fetch('http://localhost:5173/debug/sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  const result = await response.json();
  console.table(result.data);
  return result;
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
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({sql: 'SELECT id, email, created_at FROM auth.users'})
}).then(r => r.json()).then(console.table)

// Check database schema
fetch('http://localhost:5173/debug/sql', {
  method: 'POST', 
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({sql: 'SELECT table_name FROM information_schema.tables WHERE table_schema = \'auth\''})
}).then(r => r.json()).then(console.log)
```