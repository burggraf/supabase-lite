# API Endpoint Test Runners Documentation

## Overview

The API Endpoint Test Runners are comprehensive testing tools designed to validate Supabase Lite's compatibility with the official Supabase API. They replicate every test from the test-app's Authentication and API Testing tabs to identify compatibility issues and ensure 100% API parity.

## Architecture

### Test Runner Types

1. **HTTP-Based Runner (`curl-test-runner.js`)**
   - Uses raw HTTP fetch calls via `node-fetch`
   - Tests endpoints exactly as they would be called by any HTTP client
   - Identifies low-level compatibility issues with request/response handling

2. **Client Library Runner (`supabase-client-test-runner.js`)**
   - Uses the official `@supabase/supabase-js` client library
   - Tests endpoints through the official SDK abstraction layer
   - Identifies issues specific to client library integration

### Location and Structure

```
/api-endpoint-test-runners/
├── curl-test-runner.js           # HTTP-based test runner
├── supabase-client-test-runner.js # Supabase.js client test runner
├── quick-test.js                 # Simple connectivity test
├── package.json                  # Dependencies and scripts
└── TEST-RUNNERS-README.md        # Basic usage instructions
```

## Test Coverage

### Authentication Tests (~25 tests)

The test runners comprehensively test all authentication endpoints across multiple categories:

#### Basic Authentication
- **signup-email**: Create user with email/password
- **signin-email**: Authenticate with email/password
- **signin-phone**: Authenticate with phone/password
- **get-session**: Retrieve current session information
- **get-user**: Get current user profile
- **refresh-token**: Refresh access token
- **logout**: Sign out current session
- **logout-global**: Sign out from all sessions

#### User Management
- **update-user-profile**: Update user metadata
- **update-user-email**: Change user email address
- **update-user-phone**: Change phone number
- **update-password**: Change user password
- **request-password-reset**: Send password reset email
- **confirm-password-reset**: Complete password reset

#### Magic Link & OTP
- **magic-link-signin**: Request magic link
- **verify-magic-link**: Complete magic link auth
- **otp-email**: Request email OTP
- **otp-phone**: Request SMS OTP
- **verify-otp-email**: Verify email OTP
- **verify-otp-phone**: Verify SMS OTP

#### Multi-Factor Authentication (MFA)
- **list-mfa-factors**: Get enrolled MFA factors
- **enroll-totp-factor**: Enroll TOTP authenticator
- **verify-totp-enrollment**: Complete TOTP enrollment
- **enroll-phone-factor**: Enroll phone for SMS MFA
- **create-mfa-challenge**: Generate MFA challenge
- **verify-mfa-challenge**: Complete MFA verification
- **unenroll-mfa-factor**: Remove MFA factor

#### OAuth & Social Login
- **oauth-authorize-google**: Initiate Google OAuth
- **oauth-authorize-github**: Initiate GitHub OAuth
- **oauth-callback**: Handle OAuth provider callback
- **link-identity**: Link social identity to account
- **unlink-identity**: Remove linked social identity
- **get-identities**: List linked identities

#### Admin Operations (Service Role Required)
- **admin-list-users**: Paginated user listing
- **admin-get-user**: Get user by ID
- **admin-create-user**: Create user as admin
- **admin-update-user**: Update user as admin
- **admin-delete-user**: Delete user account
- **admin-generate-invite**: Generate invitation link

### REST API Tests (~25 tests)

The test runners validate all PostgREST-compatible endpoints:

#### Basic CRUD Operations
- **get-all-products**: Retrieve all products
- **get-specific-fields**: Select specific columns
- **get-single-product**: Retrieve by ID filter
- **create-product**: Insert new product
- **update-product**: Update existing product
- **delete-product**: Remove product

#### Advanced Filtering & Queries
- **price-filter**: Range queries (`gte`, `lte`)
- **text-search**: Case-insensitive text matching (`ilike`)
- **complex-filter**: Multiple filters with sorting
- **multiple-values**: IN operator testing
- **low-stock**: Complex business logic queries

#### Relationships & Joins
- **orders-with-customers**: Embedded related data
- **products-with-categories**: Foreign key relationships
- **order-details-full**: Multi-level joins
- **customer-order-count**: Aggregate queries

#### Pagination & Limits
- **basic-limit**: Simple result limiting
- **pagination**: Offset-based pagination
- **recent-orders**: Ordering with limits
- **count-only**: HEAD requests for counts

#### Business Scenarios
- **monthly-sales**: Date range filtering
- **vip-customers**: Aggregate filtering
- **premium-products**: Price-based segmentation
- **employee-territories**: Complex relationships

#### Error Handling & Edge Cases
- **table-not-found**: 404 error testing
- **invalid-column**: 400 error testing
- **missing-required-fields**: 422 validation errors
- **invalid-parameter**: Parameter validation

## Key Features

### Random User Generation

To prevent conflicts with existing users, both test runners generate unique random credentials for each test session:

```javascript
function generateRandomUser() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return {
    email: `test-${timestamp}-${random}@example.com`,
    password: 'Password123$'
  };
}
```

**Benefits:**
- Eliminates "user already exists" errors
- Enables clean test runs every time
- Allows parallel test execution
- Supports CI/CD integration

### Cross-Reference System

Every test includes a unique ID that matches between:
- Test-app implementation (`test-app/src/lib/auth-tests.ts`)
- HTTP test runner (`curl-test-runner.js`)
- Client test runner (`supabase-client-test-runner.js`)

This enables:
- **Easy maintenance**: Update parameters consistently across implementations
- **Issue tracking**: Identify failing tests by ID
- **Targeted fixes**: Fix specific endpoints without affecting others

### Compatibility Analysis

The test runners automatically detect and categorize compatibility issues:

#### HTTP Runner Issues
- **missing_endpoint**: 404 responses for implemented Supabase endpoints
- **parameter_error**: 400 responses indicating parameter format issues
- **server_error**: 500 responses suggesting implementation problems
- **response_structure**: Missing expected fields in successful responses

#### Client Library Issues
- **client_environment**: Environment setup problems (Node.js version, fetch polyfill)
- **client_config**: API key validation differences
- **missing_client_method**: Unimplemented client methods
- **schema_compatibility**: Database schema mismatches

### Authentication Flow Management

Both test runners include sophisticated authentication handling:

1. **Auto-Authentication**: Tests requiring auth automatically sign up/sign in
2. **Session Management**: Maintains auth state across test sequence
3. **Token Handling**: Manages access tokens, refresh tokens, and session data
4. **Auth State Persistence**: Stores authentication data for dependent tests

## Usage Guide

### Installation

```bash
cd api-endpoint-test-runners
npm install
```

### Basic Usage

```bash
# Run HTTP-based test runner
node curl-test-runner.js

# Run Supabase client test runner
node supabase-client-test-runner.js

# Run both for comparison
npm run test:both

# Test against different URL
node curl-test-runner.js http://localhost:5174
```

### Output Examples

#### Console Output
```
🚀 Supabase Lite Compatibility Test Runner (curl-based)
🌐 Testing against: http://localhost:5173
📧 Test credentials: test-1725234567890-abc123@example.com

🔐 Running Authentication Tests...

📁 Basic Authentication (6 tests)
  ⏳ Sign Up with Email... ✅ 200 (145ms)
  ⏳ Sign In with Email... ✅ 200 (89ms)
  ⏳ Get Current Session... ❌ 404 Not Found (23ms)
  ⏳ Get Current User... ✅ 200 (67ms)
  ⏳ Refresh Access Token... ✅ 200 (134ms)
  ⏳ Sign Out... ✅ 204 (45ms)

📁 User Management (3 tests)
  ⏳ Update User Profile... ✅ 200 (78ms)
  ⏳ Update Password... ❌ 422 Validation Error (34ms)
  ⏳ Request Password Reset... ✅ 200 (56ms)
```

#### JSON Report Structure
```json
{
  "summary": {
    "total": 50,
    "passed": 32,
    "failed": 18,
    "startTime": "2024-01-15T10:30:00.000Z",
    "endTime": "2024-01-15T10:32:15.456Z",
    "baseUrl": "http://localhost:5173"
  },
  "authentication": {
    "tests": [
      {
        "testId": "signup-email",
        "name": "Sign Up with Email",
        "method": "POST",
        "endpoint": "/auth/v1/signup",
        "status": 200,
        "statusText": "OK",
        "data": { "access_token": "...", "user": {...} },
        "headers": { "content-type": "application/json" },
        "responseTime": 145,
        "timestamp": "2024-01-15T10:30:01.234Z",
        "passed": true,
        "category": "Basic Authentication"
      }
    ],
    "stats": { "total": 25, "passed": 15, "failed": 10 }
  },
  "api": {
    "tests": [...],
    "stats": { "total": 25, "passed": 17, "failed": 8 }
  },
  "compatibility_issues": [
    {
      "type": "missing_endpoint",
      "testId": "get-session",
      "endpoint": "/auth/v1/session",
      "method": "GET",
      "description": "Endpoint GET /auth/v1/session returns 404 - may not be implemented",
      "severity": "high"
    }
  ]
}
```

## Integration Guide

### CI/CD Integration

The test runners are designed for automated testing pipelines:

```yaml
# Example GitHub Actions workflow
name: API Compatibility Tests
on: [push, pull_request]

jobs:
  compatibility-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          npm install
          cd api-endpoint-test-runners && npm install
      
      - name: Start Supabase Lite
        run: npm run dev &
        
      - name: Wait for server
        run: sleep 10
        
      - name: Run compatibility tests
        run: |
          cd api-endpoint-test-runners
          node curl-test-runner.js
          node supabase-client-test-runner.js
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: compatibility-reports
          path: api-endpoint-test-runners/*-test-results-*.json
```

### Development Workflow

1. **Run tests before changes**: Establish baseline compatibility
2. **Implement endpoint fixes**: Address specific failing test IDs
3. **Re-run specific tests**: Verify fixes without full test suite
4. **Compare results**: Use JSON reports to track improvements
5. **Update test-app**: Keep UI tests in sync with runner changes

### Custom Test Configuration

The test runners support customization for different environments:

```javascript
// Custom configuration example
const TEST_CONFIG = {
  baseUrl: process.env.SUPABASE_URL || 'http://localhost:5173',
  skipAuthTests: process.env.SKIP_AUTH === 'true',
  onlyFailedTests: process.env.ONLY_FAILED === 'true',
  testTimeout: parseInt(process.env.TEST_TIMEOUT) || 30000,
  maxRetries: parseInt(process.env.MAX_RETRIES) || 0
};
```

## Troubleshooting

### Common Issues

#### Request Timeouts
**Symptoms**: Tests fail with 500 "Request timeout" errors
**Causes**: 
- Database initialization delays
- Heavy CPU load during test execution
- Network connectivity issues

**Solutions**:
- Increase test timeout values
- Ensure database is properly initialized
- Run fewer concurrent tests

#### Authentication Failures
**Symptoms**: Tests fail with 401 "Unauthorized" errors
**Causes**:
- Invalid API keys
- Broken authentication flow
- Session expiration issues

**Solutions**:
- Verify API key configuration
- Check authentication endpoint implementations
- Review session management logic

#### Database Schema Issues
**Symptoms**: API tests fail with "relation does not exist" errors
**Causes**:
- Missing database tables
- Incomplete schema initialization
- Wrong database connection

**Solutions**:
- Ensure Northwind sample data is loaded
- Verify database initialization scripts
- Check connection string configuration

### Debug Mode

Enable verbose logging for detailed debugging:

```bash
DEBUG=1 node curl-test-runner.js
```

This provides:
- Request/response details
- Authentication flow steps
- Database query information
- Timing breakdowns

## Performance Considerations

### Test Execution Times

Typical execution times:
- **HTTP Runner**: ~30 seconds for full suite
- **Client Runner**: ~45 seconds for full suite
- **Individual test**: 50-200ms average

### Optimization Strategies

1. **Parallel Execution**: Run both runners simultaneously
2. **Selective Testing**: Target specific test categories
3. **Caching**: Reuse authentication tokens where possible
4. **Resource Limits**: Configure appropriate timeouts

### Scalability

The test runners are designed to scale with Supabase Lite development:

- **Extensible**: Easy to add new test categories
- **Maintainable**: Clear separation between test logic and execution
- **Configurable**: Adaptable to different environments
- **Reportable**: Structured output for analysis tools

## Reporting and Analysis

### Test Reports

Each test run generates comprehensive JSON reports containing:

- **Executive Summary**: Overall pass/fail statistics
- **Detailed Results**: Individual test outcomes with timing
- **Compatibility Issues**: Categorized problems with severity levels
- **Trend Analysis**: Historical comparison data
- **Actionable Insights**: Specific recommendations for fixes

### Issue Prioritization

Issues are categorized by severity:

- **High Severity**: Missing endpoints, server errors, authentication failures
- **Medium Severity**: Parameter validation issues, response format problems
- **Low Severity**: Performance concerns, minor compatibility differences

### Metrics Tracking

Key metrics tracked across test runs:

- **Compatibility Percentage**: Overall API compatibility score
- **Response Times**: Performance benchmarking
- **Error Rates**: Stability measurements
- **Coverage**: Test execution completeness

## Maintenance and Updates

### Keeping Tests Current

1. **Monitor Supabase Releases**: Update tests for new API features
2. **Sync with Test-App**: Maintain parity with UI test implementations
3. **Review Error Patterns**: Identify recurring compatibility issues
4. **Update Dependencies**: Keep Node.js packages current

### Adding New Tests

To add new test cases:

1. **Define in test-app**: Add to appropriate test category file
2. **Update HTTP runner**: Add corresponding HTTP test definition
3. **Update client runner**: Add corresponding client library test
4. **Verify cross-references**: Ensure test IDs match across implementations
5. **Test thoroughly**: Validate new tests against known-good API

### Version Compatibility

The test runners are designed to work with:
- **Node.js**: 18.0.0 or higher
- **Supabase.js**: 2.38.4 or higher
- **Supabase API**: All current endpoints and versions

## Conclusion

The API Endpoint Test Runners provide comprehensive validation of Supabase Lite's API compatibility, enabling:

- **Quality Assurance**: Ensure every endpoint works correctly
- **Development Velocity**: Quickly identify and fix compatibility issues  
- **Confidence**: Deploy with certainty of API parity
- **Maintenance**: Keep compatibility high as both codebases evolve

By replicating every test from the test-app and providing detailed analysis of failures, these tools are essential for achieving 100% Supabase API compatibility.