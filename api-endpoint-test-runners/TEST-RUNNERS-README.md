# API Endpoint Test Runners

> 📖 **For comprehensive documentation, see [/docs/API-Endpoint-Test-Runners.md](../docs/API-Endpoint-Test-Runners.md)**

This directory contains comprehensive test runners that validate Supabase Lite's compatibility with the official Supabase API. The test runners replicate every test from the test-app's Authentication and API Testing tabs to identify compatibility issues.

## 🎯 Perfect Test Parity Achievement

**Both test runners now have exactly 87 identical tests** - achieving perfect parity between HTTP-based and Supabase.js client testing approaches. This standardization ensures comprehensive validation from both perspectives.

## Overview

- **curl-test-runner.js**: Tests all endpoints using raw HTTP calls (node-fetch)
- **supabase-client-test-runner.js**: Tests same endpoints using @supabase/supabase-js client library
- **Both runners test exactly 87 identical endpoints** across authentication and REST API functionality
- **Complete coverage** of all 84 core tests from test-app + 3 enhancement tests

## Test Coverage

### Authentication Tests (58 tests across 10 categories)
- **Basic Authentication**: signup, signin, phone auth, session management, logout
- **User Management**: profile updates, email/phone changes, password management
- **Magic Link & OTP**: passwordless authentication, email/SMS verification
- **Email & Phone Verification**: account confirmation workflows
- **Multi-Factor Authentication**: TOTP, SMS MFA setup and verification
- **OAuth & Social Login**: Google, GitHub OAuth flows, identity linking
- **Admin Operations**: user management with service role privileges
- **Anonymous Authentication**: guest sessions and account conversion
- **Session Management**: multi-device sessions, token refresh, security
- **Security & Edge Cases**: rate limiting, validation, error handling

### API Tests (29 tests across 6 categories)  
- **Basic CRUD Operations**: GET, POST, PATCH, DELETE on Northwind tables
- **Advanced Filtering**: price ranges, text search, complex filters, IN queries
- **Relationships & Joins**: embedded customer/product data, multi-level joins
- **Pagination & Limits**: offset pagination, ordering, count-only queries
- **Business Scenarios**: sales reports, VIP customers, premium products
- **Error Handling**: missing tables, invalid columns, validation errors

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
   Total Tests: 87
   Passed: 71 (81.6%)
   Failed: 16 (18.4%)

🔐 Authentication Tests: 47/58 passed (81.0%)
🔗 API Tests: 24/29 passed (82.8%)

✅ Perfect Test Parity: Both curl and supabase-client runners execute identical tests

⚠️  Compatibility Issues Found: 8
   🔴 High Severity: 3
   🟡 Medium Severity: 5

⚠️  Top Compatibility Issues:
   1. [admin-list-users] Endpoint GET /auth/v1/admin/users returns 404 - admin endpoints need implementation
   2. [enroll-totp-factor] MFA enrollment not fully implemented
   3. [oauth-authorize-google] OAuth flow redirection needs configuration
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