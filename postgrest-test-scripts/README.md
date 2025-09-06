# PostgREST Test Suite

Comprehensive test suite for PostgREST compatibility testing with 89 automatically generated test scripts covering all major Supabase client functionality.

## Structure

- **89 test scripts** across **41 PostgREST functions**
- Tests numbered sequentially from `001` to `089`
- Organized by function in subdirectories
- Each test includes SQL setup, test code execution, and result validation

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run all tests:**
   ```bash
   npm test
   ```

3. **Run specific function tests:**
   ```bash
   npm run test:select    # Only select() tests
   npm run test:insert    # Only insert() tests 
   npm run test:filters   # Only filter tests
   ```

4. **Run with verbose output:**
   ```bash
   npm run test:verbose
   ```

## Test Organization

### Core CRUD Operations
- **select/** (13 tests) - Data fetching, joins, JSON queries
- **insert/** (3 tests) - Record creation and bulk inserts
- **update/** (3 tests) - Data updates and JSON modifications
- **upsert/** (3 tests) - Insert-or-update operations
- **delete/** (3 tests) - Record deletion
- **rpc/** (5 tests) - PostgreSQL function calls

### Filtering & Querying
- **using-filters/** (5 tests) - Filter application and chaining
- **eq/, neq/, gt/, gte/, lt/, lte/** - Comparison operators
- **like/, ilike/** - Pattern matching
- **is/** - Null checking
- **in/** - Array membership
- **contains/, contained-by/** - Array/JSON operations
- **overlaps/** - Array/range overlaps
- **text-search/** (4 tests) - Full-text search
- **match/, not/, or/, filter/** - Complex conditions

### Modifiers & Utilities
- **order/** (3 tests) - Result ordering
- **limit/, range/** - Result pagination
- **single/, maybe-single/** - Single record operations
- **csv/** - CSV format responses
- **explain/** (2 tests) - Query execution plans

### Advanced Features  
- **abort-signal/** (2 tests) - Request cancellation
- **returns/, overrideTypes/** - TypeScript type overrides

## Test Script Format

Each test script follows this pattern:

```javascript
// 001-getting-your-data.js
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';

async function runTest() {
  // 1. Setup SQL (creates tables, inserts data)  
  // 2. Execute Supabase client code
  // 3. Compare with expected results
  // 4. Return pass/fail status
}

export default runTest;
```

## Configuration

**config/supabase-config.js:**
```javascript
export const SUPABASE_CONFIG = {
  url: 'http://localhost:5173',
  anonKey: 'eyJ...',  // JWT token
  debugSqlEndpoint: 'http://localhost:5173/debug/sql'
};
```

## Command Line Usage

```bash
# Run all tests
node run-all-tests.js

# Run specific function
node run-all-tests.js --function select

# Run specific test  
node run-all-tests.js --test 001-getting-your-data

# Verbose logging
node run-all-tests.js --verbose

# Help
node run-all-tests.js --help
```

## Test Results

Results are saved to `./results/` directory:

- `test-results-{timestamp}.json` - Full detailed results
- `test-report-{timestamp}.json` - Summary report  
- `latest-results.json` - Most recent results

## Example Output

```
🚀 Starting PostgREST Test Suite
📅 2024-01-15T10:30:00.000Z
⚙️  Concurrency: 5
⏰ Timeout: 30000ms

✅ PASS: 001-getting-your-data (245ms)
✅ PASS: 002-selecting-specific-columns (198ms)
❌ FAIL: 003-query-referenced-tables (312ms)

================================================================================
🏁 TEST SUITE SUMMARY
================================================================================
📊 Total Tests: 89
✅ Passed: 87
❌ Failed: 2  
📈 Pass Rate: 97.8%
⏱️  Total Duration: 12.34s
📊 Average Test Duration: 138ms
================================================================================
```

## Generated from JSON

This test suite was automatically generated from `postgrest.test.json` containing official Supabase PostgREST documentation examples. To regenerate:

```bash
npm run generate
```

## Requirements

- Node.js 18+
- Running Supabase Lite instance on `http://localhost:5173`
- `@supabase/supabase-js` client library