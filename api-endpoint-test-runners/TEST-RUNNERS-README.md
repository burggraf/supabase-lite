# API Endpoint Test Runners

> 📖 **For comprehensive documentation, see [/docs/API-Endpoint-Test-Runners.md](../docs/API-Endpoint-Test-Runners.md)**

This directory contains comprehensive test runners that validate Supabase Lite's compatibility with the official Supabase API. The test runners replicate every test from the test-app's Authentication and API Testing tabs to identify compatibility issues.

## Quick Start Guide

## Overview

- **curl-test-runner.js**: Tests all endpoints using raw HTTP calls (node-fetch)
- **supabase-client-test-runner.js**: Tests same endpoints using @supabase/supabase-js client library
- Both runners test **110+ endpoints** across authentication and REST API functionality

## Test Coverage

### Authentication Tests (~25 tests)
- Basic Authentication: signup, signin, session management, logout
- User Management: profile updates, password changes, password reset
- Magic Link & OTP: passwordless authentication methods
- And more categories from the test-app

### API Tests (~25 tests)  
- Basic CRUD Operations: GET, POST, PATCH, DELETE on Northwind tables
- Advanced Filtering: price ranges, text search, complex filters
- Relationships & Joins: embedded customer/product data
- Error Handling: testing edge cases and error responses
- And more categories from the test-app

## Setup

1. **Install dependencies:**
   ```bash
   cp test-runners-package.json package.json
   npm install
   ```

2. **Start Supabase Lite:**
   ```bash
   cd ../  # Go to main supabase-lite directory
   npm run dev  # Start on http://localhost:5173
   ```

## Usage

### Run Individual Test Runners

```bash
# Run curl-based test runner
node curl-test-runner.js

# Run Supabase client test runner  
node supabase-client-test-runner.js

# Run against different port
node curl-test-runner.js http://localhost:5174
node supabase-client-test-runner.js http://localhost:5174
```

### Run Both Test Runners

```bash
npm run test:both
```

## Output

Each test runner generates:

1. **Console output** with real-time test results:
   ```
   🔐 Running Authentication Tests...
   
   📁 Basic Authentication (6 tests)
     ⏳ Sign Up with Email... ✅ 200 (145ms)
     ⏳ Sign In with Email... ✅ 200 (89ms)
     ⏳ Get Current Session... ❌ 404 Not Found (23ms)
   ```

2. **JSON report files** with detailed results:
   - `curl-test-results-[timestamp].json`
   - `supabase-client-test-results-[timestamp].json`

3. **Summary report** with:
   - Overall pass/fail statistics
   - Compatibility issues identified
   - Response times and error details

## Test Results Analysis

### Compatibility Issues Detected

The test runners automatically identify common compatibility issues:

- **Missing endpoints**: HTTP 404 responses for implemented Supabase endpoints
- **Parameter errors**: HTTP 400 responses indicating parameter format issues
- **Authentication issues**: HTTP 401/403 responses showing auth flow problems
- **Response structure differences**: Missing expected fields in responses
- **Client library issues**: Differences between HTTP calls and Supabase.js behavior

### Example Report Output

```
📊 TEST RESULTS SUMMARY
================================================================================
🌐 Base URL: http://localhost:5173
📈 Overall Results:
   Total Tests: 50
   Passed: 32 (64.0%)
   Failed: 18 (36.0%)

🔐 Authentication Tests: 15/25 passed
🔗 API Tests: 17/25 passed

⚠️  Compatibility Issues Found: 12
   🔴 High Severity: 5
   🟡 Medium Severity: 7

⚠️  Top Compatibility Issues:
   1. [get-session] Endpoint GET /auth/v1/session returns 404 - may not be implemented
   2. [magic-link-signin] Parameter validation error: Invalid email format
   3. [orders-with-customers] Internal server error - possible implementation issue
```

## Cross-Reference with Test-App

Each test includes a unique ID that matches the test-app implementation:

**test-app/src/lib/auth-tests.ts:**
```javascript
{
  id: 'signin-email',  // <- This ID
  name: 'Sign In with Email',
  method: 'POST',
  endpoint: '/auth/v1/signin',
  // ...
}
```

**curl-test-runner.js:**
```javascript
{
  id: 'signin-email',  // <- Same ID for easy cross-reference
  name: 'Sign In with Email', 
  method: 'POST',
  endpoint: '/auth/v1/signin',
  // ...
}
```

This allows you to:
1. **Identify the exact test** that's failing in both test-app and script
2. **Update parameters consistently** across both implementations
3. **Track fixes** by re-running specific test IDs

## Fixing Compatibility Issues

When issues are identified:

1. **Check the JSON report** for detailed error information
2. **Cross-reference the test ID** with test-app implementation
3. **Fix the specific endpoint** in Supabase Lite
4. **Re-run the tests** to verify the fix
5. **Update test-app code** if parameters need adjustment

## Integration with Development

These test runners are designed to:

- **Run in CI/CD** to catch compatibility regressions
- **Validate fixes** before deployment
- **Compare behavior** between HTTP calls and client library
- **Generate compatibility reports** for stakeholders

The goal is 100% compatibility with the real Supabase API, and these test runners help identify exactly what needs to be fixed to achieve that goal.