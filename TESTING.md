# Testing & Coverage Guide

This document provides comprehensive information about the testing strategy, coverage goals, and implementation details for both the main Supabase Lite application and the supabase-lite CLI package.

## 📊 Current Coverage Status

### Main Application

- **Test Files**: 54 test files covering all major modules
- **Coverage Targets**:
  - Lines: 75%
  - Functions: 80%
  - Branches: 75%
  - Statements: 75%

### Supabase Lite Package

- **Test Files**: 14 test files covering CLI functionality
- **Coverage Targets**:
  - Lines: 80%
  - Functions: 85%
  - Branches: 80%
  - Statements: 80%

## 🧪 Test Categories

### 1. Unit Tests

**Location**: `src/components/**/__tests__/`, `src/lib/**/__tests__/`, `src/hooks/**/__tests__/`

Tests individual components, hooks, and utilities in isolation.

**Examples**:

- UI component rendering and interactions
- Hook state management and side effects
- Utility function behavior and edge cases
- Database connection and query handling

**Key Test Files**:

- `src/components/ui/__tests__/button.test.tsx` - Button component variations
- `src/components/ui/__tests__/card.test.tsx` - Card component structure
- `src/hooks/__tests__/useDatabase.test.ts` - Database hook functionality
- `src/lib/auth/__tests__/AuthBridge.api.test.ts` - Authentication API tests

### 2. Integration Tests

**Location**: `src/__tests__/integration/`

Tests cross-component functionality and complete user workflows.

**Examples**:

- Complete table management workflow (create → edit → delete)
- Authentication flow integration
- File upload and storage operations
- Cross-component data flow

**Key Test Files**:

- `src/__tests__/integration/table-workflow.test.tsx` - Complete table CRUD workflow

### 3. Performance Tests

**Location**: `src/__tests__/performance/`

Benchmarks performance-critical operations with specific thresholds.

**Examples**:

- Database query execution times
- Large result set handling
- Concurrent operation performance
- Memory usage during repeated operations

**Key Test Files**:

- `src/__tests__/performance/database-performance.test.ts` - Database performance benchmarks

### 4. API Tests

**Location**: `src/lib/auth/__tests__/`, `src/mocks/__tests__/`

Tests REST API endpoints and MSW handler integration.

**Examples**:

- Authentication endpoints
- PostgREST-compatible API calls
- Error handling and status codes
- Request/response validation

### 5. Package Tests

**Location**: `packages/supabase-lite/tests/`

Tests CLI functionality and integration workflows.

**Examples**:

- Command-line interface operations
- SQL client functionality
- Result formatting
- URL parsing and connection handling

**Key Test Files**:

- `packages/supabase-lite/tests/integration.test.ts` - End-to-end package workflows

## 🚀 Running Tests

### Main Application

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI interface
npm run test:ui

# Run specific test categories
npm run test:integration     # Integration tests only
npm run test:performance     # Performance benchmarks only

# Run tests for CI/CD
npm run test:ci

# Show coverage summary
npm run test:summary
```

### Supabase Lite Package

```bash
# Navigate to package directory
cd packages/supabase-lite

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run tests for CI/CD
npm run test:ci
```

## 🎯 Writing New Tests

### Test-Driven Development (TDD) Requirements

**🚨 MANDATORY: ALL new features MUST follow strict TDD methodology:**

1. **RED**: Write failing tests first that define expected behavior
2. **GREEN**: Write minimal code to make tests pass
3. **REFACTOR**: Improve code quality while keeping tests green
4. **REPEAT**: Continue cycle until feature is complete

### Component Tests

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { YourComponent } from '../YourComponent'

describe('YourComponent', () => {
	describe('Rendering', () => {
		it('should render with required props', () => {
			render(<YourComponent title='Test' />)
			expect(screen.getByText('Test')).toBeInTheDocument()
		})
	})

	describe('User Interactions', () => {
		it('should handle click events', async () => {
			const user = userEvent.setup()
			const handleClick = vi.fn()

			render(<YourComponent onClick={handleClick} />)
			await user.click(screen.getByRole('button'))

			expect(handleClick).toHaveBeenCalledTimes(1)
		})
	})

	describe('Accessibility', () => {
		it('should have proper ARIA labels', () => {
			render(<YourComponent aria-label='Test component' />)
			const component = screen.getByLabelText('Test component')
			expect(component).toBeInTheDocument()
		})
	})
})
```

### Hook Tests

```typescript
import { renderHook, act } from '@testing-library/react'
import { useYourHook } from '../useYourHook'

describe('useYourHook', () => {
	it('should initialize with default values', () => {
		const { result } = renderHook(() => useYourHook())

		expect(result.current.value).toBe(null)
		expect(result.current.isLoading).toBe(false)
	})

	it('should update state correctly', async () => {
		const { result } = renderHook(() => useYourHook())

		await act(async () => {
			result.current.updateValue('new value')
		})

		expect(result.current.value).toBe('new value')
	})
})
```

### Integration Tests

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/App'

describe('User Workflow Integration', () => {
	it('should complete full user workflow', async () => {
		const user = userEvent.setup()

		render(<App />)

		// Step 1: Navigate to feature
		const navButton = screen.getByText('Feature')
		await user.click(navButton)

		// Step 2: Perform actions
		const actionButton = screen.getByText('Create')
		await user.click(actionButton)

		// Step 3: Verify results
		await waitFor(() => {
			expect(screen.getByText('Success')).toBeInTheDocument()
		})
	})
})
```

### Performance Tests

```typescript
import { performance } from 'perf_hooks'
import { performExpensiveOperation } from '../operations'

describe('Performance Tests', () => {
	it('should complete operation within time threshold', async () => {
		const startTime = performance.now()

		const result = await performExpensiveOperation()

		const endTime = performance.now()
		const executionTime = endTime - startTime

		expect(result).toBeDefined()
		expect(executionTime).toBeLessThan(100) // Must complete within 100ms
	})
})
```

## 🔧 Configuration

### Vitest Configuration

**Main App** (`vitest.config.ts`):

```typescript
export default defineConfig({
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/test/setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			thresholds: {
				global: {
					branches: 75,
					functions: 80,
					lines: 75,
					statements: 75,
				},
			},
		},
	},
})
```

**Package** (`packages/supabase-lite/vitest.config.ts`):

```typescript
export default defineConfig({
	test: {
		environment: 'node',
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'json', 'lcov'],
			thresholds: {
				global: {
					branches: 80,
					functions: 85,
					lines: 80,
					statements: 80,
				},
			},
		},
	},
})
```

### Test Setup

Global test setup includes:

- PGlite database mocking
- MSW server configuration
- React Testing Library setup
- LocalStorage and crypto API mocks

## 🤖 CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/test-coverage.yml` workflow automatically:

1. **Runs tests** for both main app and package
2. **Generates coverage reports** with multiple formats
3. **Uploads artifacts** for coverage data
4. **Comments on PRs** with coverage summary
5. **Uploads to Codecov** for tracking trends

### Coverage Thresholds

Tests will **fail** if coverage falls below:

**Main Application**:

- Lines: 75%
- Functions: 80%
- Branches: 75%
- Statements: 75%

**Supabase Lite Package**:

- Lines: 80%
- Functions: 85%
- Branches: 80%
- Statements: 80%

## 📈 Coverage Improvement Areas

### Current Gap Analysis

Based on the baseline analysis, priority areas for improvement:

1. **UI Components** - Many shadcn/ui components lack comprehensive tests
2. **Error Handling** - Edge cases and error scenarios need more coverage
3. **Integration Workflows** - Cross-component user journeys need testing
4. **Performance Monitoring** - Benchmark tests for critical operations
5. **Browser APIs** - File System Access, IndexedDB, WebSocket testing

### Implementation Roadmap

**Phase 1: Core Component Coverage** ✅

- [x] Button, Card, Input component tests
- [x] Basic integration test framework
- [x] Performance benchmark structure

**Phase 2: Advanced Integration** (Next)

- [ ] Authentication workflow tests
- [ ] Storage operation integration
- [ ] Edge Functions development workflow

**Phase 3: Performance & Reliability** (Future)

- [ ] Stress testing implementation
- [ ] Memory leak detection
- [ ] Network failure simulation

## 🛠️ Tools & Libraries

### Testing Framework

- **Vitest** - Fast unit test runner with native TypeScript support
- **React Testing Library** - User-centric component testing
- **jsdom** - Browser environment simulation

### Mocking & Fixtures

- **MSW (Mock Service Worker)** - API request mocking
- **vi.mock()** - Module mocking for unit tests
- **Fake IndexedDB** - Database simulation

### Coverage & Reporting

- **V8 Coverage** - Native Node.js coverage provider
- **Codecov** - Coverage tracking and PR integration
- **JUnit Reporter** - CI-compatible test result format

## 📋 Best Practices

### 1. Test Naming

```typescript
// ✅ Good: Descriptive test names
it('should display error message when API call fails', () => {})
it('should disable submit button when form is invalid', () => {})

// ❌ Bad: Vague test names
it('should work', () => {})
it('handles errors', () => {})
```

### 2. Test Structure

```typescript
describe('Component/Feature', () => {
	describe('Rendering', () => {
		// Test what is rendered
	})

	describe('User Interactions', () => {
		// Test user events and responses
	})

	describe('Accessibility', () => {
		// Test ARIA labels, keyboard navigation
	})

	describe('Error States', () => {
		// Test error handling and edge cases
	})
})
```

### 3. Mocking Strategy

- Mock external dependencies (APIs, databases)
- Mock complex internal modules when testing integration
- Use real implementations for utility functions
- Mock timers and dates for consistent tests

### 4. Async Testing

```typescript
// ✅ Good: Proper async/await usage
it('should load data on mount', async () => {
	render(<Component />)

	await waitFor(() => {
		expect(screen.getByText('Data loaded')).toBeInTheDocument()
	})
})

// ✅ Good: User event handling
it('should submit form on click', async () => {
	const user = userEvent.setup()
	render(<Form />)

	await user.click(screen.getByRole('button'))

	expect(mockSubmit).toHaveBeenCalled()
})
```

## 🔍 Debugging Tests

### Common Issues

1. **Test Isolation**: Each test should be independent
2. **Async Operations**: Use `waitFor()` for async state changes
3. **Mock Cleanup**: Reset mocks between tests
4. **Component Cleanup**: Unmount components to prevent memory leaks

### Debug Commands

```bash
# Run tests with verbose output
npm test -- --reporter=verbose

# Run specific test file
npm test src/path/to/test.ts

# Run tests matching pattern
npm test -- --grep "should handle errors"

# Debug with Chrome DevTools
npm test -- --inspect-brk
```

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library Guide](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/docs/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**Remember**: Good tests are not just about coverage numbers—they should provide confidence in your code, catch regressions, and serve as living documentation of your application's behavior.
