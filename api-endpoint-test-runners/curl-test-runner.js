#!/usr/bin/env node

/**
 * Curl-based Test Runner for Supabase Lite
 * 
 * This script tests all Authentication and API endpoints exactly as they are
 * tested in the test-app, using HTTP fetch calls to identify compatibility
 * issues with the real Supabase API.
 * 
 * Usage: node curl-test-runner.js [base-url]
 * Default base URL: http://localhost:5173
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:5173';

// Generate random user credentials to avoid conflicts
function generateRandomUser() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return {
    email: `test-${timestamp}-${random}@example.com`,
    password: 'Password123$'
  };
}

const TEST_CREDENTIALS = generateRandomUser();

// Predefined credentials for tests that need existing users
const EXISTING_USER_CREDENTIALS = {
  email: 'existing-user@example.com',
  password: 'Password123$'
};

// Storage for auth state
let authState = {
  accessToken: null,
  refreshToken: null,
  session: null,
  user: null
};

// Test results storage
let testResults = {
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    startTime: new Date().toISOString(),
    endTime: null,
    baseUrl: BASE_URL
  },
  authentication: {
    tests: [],
    stats: { total: 0, passed: 0, failed: 0 }
  },
  api: {
    tests: [],
    stats: { total: 0, passed: 0, failed: 0 }
  },
  compatibility_issues: []
};

// Authentication test definitions (from test-app/src/lib/auth-tests.ts)
const authTestCategories = [
  {
    id: 'basic-auth',
    name: 'Basic Authentication',
    description: 'Core sign up, sign in, and session management operations',
    tests: [
      {
        id: 'signup-email',
        name: 'Sign Up with Email',
        method: 'POST',
        endpoint: '/auth/v1/signup',
        body: {
          email: 'test@example.com',
          password: 'Password123$',
          data: {
            full_name: 'Test User'
          }
        },
        description: 'Create a new user account with email and password'
      },
      {
        id: 'signin-email',
        name: 'Sign In with Email',
        method: 'POST',
        endpoint: '/auth/v1/signin',
        body: {
          email: 'test@example.com',
          password: 'Password123$'
        },
        description: 'Authenticate user with email and password'
      },
      {
        id: 'get-session',
        name: 'Get Current Session',
        method: 'GET',
        endpoint: '/auth/v1/session',
        description: 'Retrieve current session information',
        requiresAuth: true
      },
      {
        id: 'get-user',
        name: 'Get Current User',
        method: 'GET',
        endpoint: '/auth/v1/user',
        description: 'Get current user profile and metadata',
        requiresAuth: true
      },
      {
        id: 'refresh-token',
        name: 'Refresh Access Token',
        method: 'POST',
        endpoint: '/auth/v1/token?grant_type=refresh_token',
        body: {},
        description: 'Get new access token using refresh token'
      },
      {
        id: 'logout',
        name: 'Sign Out',
        method: 'POST',
        endpoint: '/auth/v1/logout',
        description: 'Sign out current user session',
        requiresAuth: true
      }
    ]
  },
  {
    id: 'user-management',
    name: 'User Management',
    description: 'User profile updates, password management, and account operations',
    tests: [
      {
        id: 'update-user-profile',
        name: 'Update User Profile',
        method: 'PUT',
        endpoint: '/auth/v1/user',
        body: {
          data: {
            full_name: 'Updated Test User',
            avatar_url: 'https://example.com/avatar.jpg'
          }
        },
        description: 'Update user metadata and profile information',
        requiresAuth: true
      },
      {
        id: 'update-password',
        name: 'Update Password',
        method: 'PUT',
        endpoint: '/auth/v1/user',
        body: {
          password: 'newPassword123$'
        },
        description: 'Change user password (requires current session)',
        requiresAuth: true
      },
      {
        id: 'request-password-reset',
        name: 'Request Password Reset',
        method: 'POST',
        endpoint: '/auth/v1/recover',
        body: {
          email: 'test@example.com'
        },
        description: 'Send password reset email to user'
      }
    ]
  },
  {
    id: 'magic-link-otp',
    name: 'Magic Link & OTP',
    description: 'Passwordless authentication using magic links and one-time passwords',
    tests: [
      {
        id: 'magic-link-signin',
        name: 'Request Magic Link',
        method: 'POST',
        endpoint: '/auth/v1/magiclink',
        body: {
          email: 'test@example.com'
        },
        description: 'Send magic link for passwordless sign in'
      },
      {
        id: 'otp-email',
        name: 'Request OTP (Email)',
        method: 'POST',
        endpoint: '/auth/v1/otp',
        body: {
          email: 'test@example.com',
          create_user: false
        },
        description: 'Send one-time password to email'
      }
    ]
  }
];

// API test definitions (from test-app/src/lib/api-tests.ts)
const apiTestCategories = [
  {
    id: 'basic-crud',
    name: 'Basic CRUD Operations',
    description: 'Fundamental database operations on Northwind tables',
    tests: [
      {
        id: 'get-all-products',
        name: 'Get All Products',
        method: 'GET',
        endpoint: '/rest/v1/products',
        description: 'Retrieve all products from the catalog'
      },
      {
        id: 'get-specific-fields',
        name: 'Get Specific Fields',
        method: 'GET',
        endpoint: '/rest/v1/products?select=product_name,unit_price,units_in_stock',
        description: 'Select only specific columns from products table'
      },
      {
        id: 'get-single-product',
        name: 'Get Single Product',
        method: 'GET',
        endpoint: '/rest/v1/products?product_id=eq.1',
        description: 'Retrieve a specific product by ID'
      },
      {
        id: 'create-product',
        name: 'Create New Product',
        method: 'POST',
        endpoint: '/rest/v1/products',
        body: {
          product_id: 999,
          product_name: 'Test Product',
          unit_price: 25.99,
          units_in_stock: 100,
          category_id: 1,
          supplier_id: 1,
          discontinued: 0
        },
        description: 'Add a new product to the catalog'
      },
      {
        id: 'update-product',
        name: 'Update Product',
        method: 'PATCH',
        endpoint: '/rest/v1/products?product_id=eq.1',
        body: {
          unit_price: 29.99
        },
        description: 'Update an existing product\'s price'
      },
      {
        id: 'delete-product',
        name: 'Delete Test Product',
        method: 'DELETE',
        endpoint: '/rest/v1/products?product_name=eq.Test Product',
        description: 'Remove the test product we created'
      }
    ]
  },
  {
    id: 'advanced-filtering',
    name: 'Advanced Filtering & Queries',
    description: 'Complex query operations using PostgREST operators',
    tests: [
      {
        id: 'price-filter',
        name: 'Price Range Filter',
        method: 'GET',
        endpoint: '/rest/v1/products?unit_price=gte.20&unit_price=lte.50',
        description: 'Find products in a specific price range ($20-$50)'
      },
      {
        id: 'text-search',
        name: 'Text Search',
        method: 'GET',
        endpoint: '/rest/v1/products?product_name=ilike.*seafood*',
        description: 'Search for products containing "seafood" in the name'
      },
      {
        id: 'complex-filter',
        name: 'Complex Filter + Sort',
        method: 'GET',
        endpoint: '/rest/v1/products?discontinued=eq.0&order=unit_price.desc&limit=10',
        description: 'Active products sorted by price (highest first)'
      }
    ]
  },
  {
    id: 'relationships',
    name: 'Relationships & Joins',
    description: 'Complex queries involving multiple related tables',
    tests: [
      {
        id: 'orders-with-customers',
        name: 'Orders with Customer Details',
        method: 'GET',
        endpoint: '/rest/v1/orders?select=*,customers(customer_id,company_name,contact_name)&limit=5',
        description: 'Get orders with embedded customer information'
      },
      {
        id: 'products-with-categories',
        name: 'Products with Categories',
        method: 'GET',
        endpoint: '/rest/v1/products?select=product_name,unit_price,categories(category_name)&limit=10',
        description: 'Products with their category names'
      }
    ]
  },
  {
    id: 'error-handling',
    name: 'Error Handling & Edge Cases',
    description: 'Testing error responses and edge case handling',
    tests: [
      {
        id: 'table-not-found',
        name: 'Table Not Found',
        method: 'GET',
        endpoint: '/rest/v1/nonexistent_table',
        description: 'Try to access a table that doesn\'t exist (404 error)'
      },
      {
        id: 'invalid-column',
        name: 'Invalid Column',
        method: 'GET',
        endpoint: '/rest/v1/products?invalid_column=eq.test',
        description: 'Query with non-existent column (400 error)'
      }
    ]
  }
];

// Utility functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isSuccessfulStatus(status) {
  return status >= 200 && status < 300;
}

function getStatusCategory(status) {
  if (status === 0) return 'network_error';
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client_error';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

// Authentication functions
async function ensureAuthenticated() {
  if (authState.accessToken) {
    console.log('🔐 Already authenticated');
    return { success: true };
  }

  console.log('🔐 Authentication required, attempting sign-in...');

  // Try signing in first
  try {
    const signinResult = await executeTest({
      id: 'auto-signin',
      method: 'POST',
      endpoint: '/auth/v1/signin',
      body: TEST_CREDENTIALS,
      skipAutoAuth: true
    }, 'auth');

    if (isSuccessfulStatus(signinResult.status)) {
      console.log('✅ Auto sign-in successful');
      return { success: true };
    }

    // If signin failed, try signup
    console.log('🔐 Sign-in failed, attempting sign-up...');
    const signupResult = await executeTest({
      id: 'auto-signup',
      method: 'POST',
      endpoint: '/auth/v1/signup',
      body: {
        ...TEST_CREDENTIALS,
        data: { full_name: 'Test User (Auto)' }
      },
      skipAutoAuth: true
    }, 'auth');

    if (isSuccessfulStatus(signupResult.status)) {
      console.log('✅ Auto sign-up successful');
      return { success: true };
    }

    return {
      success: false,
      error: `Authentication failed: Sign-in (${signinResult.status}) and Sign-up (${signupResult.status}) both failed`
    };

  } catch (error) {
    return {
      success: false,
      error: `Authentication error: ${error.message}`
    };
  }
}

// Function to prepare test body with appropriate credentials
function prepareTestBody(test) {
  if (!test.body) return null;
  
  // Clone the test body to avoid modifying the original
  let body = JSON.parse(JSON.stringify(test.body));
  
  // For specific tests that need existing users or error conditions
  if (test.id === 'invalid-credentials' || test.id === 'signin-existing-user') {
    // Use existing user credentials for these tests
    body.email = EXISTING_USER_CREDENTIALS.email;
    body.password = EXISTING_USER_CREDENTIALS.password;
  } else if (test.id === 'request-password-reset') {
    // Use current test user email for password reset
    body.email = TEST_CREDENTIALS.email;
  } else if (body.email || body.password) {
    // For most tests, use the random generated credentials
    if (body.email) body.email = TEST_CREDENTIALS.email;
    if (body.password) body.password = TEST_CREDENTIALS.password;
  }
  
  return body;
}

// Core test execution function
async function executeTest(test, testType) {
  const startTime = Date.now();
  
  try {
    // Auto-authenticate if test requires auth
    if (test.requiresAuth && !test.skipAutoAuth) {
      const authResult = await ensureAuthenticated();
      if (!authResult.success) {
        return {
          testId: test.id,
          name: test.name,
          method: test.method,
          endpoint: test.endpoint,
          status: 401,
          statusText: 'Authentication Required',
          data: { error: 'authentication_required', message: authResult.error },
          headers: {},
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          error: authResult.error,
          testType
        };
      }
    }

    const url = `${BASE_URL}${test.endpoint}`;
    const requestOptions = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Add API key for REST tests
    if (testType === 'api') {
      requestOptions.headers['apikey'] = 'test-api-key';
    }

    // Add authorization header if test requires auth
    if (test.requiresAuth && authState.accessToken) {
      requestOptions.headers['Authorization'] = `Bearer ${authState.accessToken}`;
    }

    // Prepare test body with appropriate credentials
    let testBody = prepareTestBody(test);
    
    // Handle refresh token specially
    if (test.id === 'refresh-token' && authState.refreshToken) {
      testBody = { refresh_token: authState.refreshToken };
    }

    // Add body for POST/PATCH/PUT
    if (testBody && ['POST', 'PATCH', 'PUT'].includes(test.method)) {
      requestOptions.body = JSON.stringify(testBody);
    }

    const response = await fetch(url, requestOptions);
    const responseTime = Date.now() - startTime;

    let data;
    const contentType = response.headers.get('content-type');

    if (response.status === 204) {
      data = null;
    } else if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }
    } else {
      data = await response.text();
    }

    // Store auth data from successful responses
    if (response.ok && (test.id.includes('signin') || test.id.includes('signup') || test.id.includes('refresh'))) {
      authState.accessToken = data?.access_token || data?.session?.access_token || authState.accessToken;
      authState.refreshToken = data?.refresh_token || data?.session?.refresh_token || authState.refreshToken;
      authState.session = data?.session || authState.session;
      authState.user = data?.user || authState.user;
    }

    // Clear auth data on logout
    if (response.ok && test.id.includes('logout')) {
      authState = { accessToken: null, refreshToken: null, session: null, user: null };
    }

    // Convert headers to plain object
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      testId: test.id,
      name: test.name,
      method: test.method,
      endpoint: test.endpoint,
      status: response.status,
      statusText: response.statusText,
      data,
      headers,
      responseTime,
      timestamp: new Date().toISOString(),
      testType
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      testId: test.id,
      name: test.name,
      method: test.method,
      endpoint: test.endpoint,
      status: 0,
      statusText: 'Network Error',
      data: null,
      headers: {},
      responseTime,
      timestamp: new Date().toISOString(),
      error: error.message,
      testType
    };
  }
}

// Test analysis functions
function analyzeCompatibilityIssues(result) {
  const issues = [];
  const { status, data, endpoint, method, testId } = result;

  // Check for common compatibility issues
  if (status === 404 && !testId.includes('not-found') && !testId.includes('nonexistent')) {
    issues.push({
      type: 'missing_endpoint',
      testId,
      endpoint,
      method,
      description: `Endpoint ${method} ${endpoint} returns 404 - may not be implemented`,
      severity: 'high'
    });
  }

  if (status === 400 && data?.message) {
    issues.push({
      type: 'parameter_error',
      testId,
      endpoint,
      method,
      description: `Parameter validation error: ${data.message}`,
      severity: 'medium'
    });
  }

  if (status === 500) {
    issues.push({
      type: 'server_error',
      testId,
      endpoint,
      method,
      description: 'Internal server error - possible implementation issue',
      severity: 'high'
    });
  }

  // Check response structure compatibility
  if (isSuccessfulStatus(status) && data) {
    if (endpoint.includes('/auth/v1/') && !data.access_token && !data.session && testId.includes('signin')) {
      issues.push({
        type: 'response_structure',
        testId,
        endpoint,
        description: 'Auth response missing expected access_token or session',
        severity: 'high'
      });
    }
  }

  return issues;
}

// Main test execution
async function runAuthenticationTests() {
  console.log('\n🔐 Running Authentication Tests...\n');
  
  for (const category of authTestCategories) {
    console.log(`📁 ${category.name} (${category.tests.length} tests)`);
    
    for (const test of category.tests) {
      process.stdout.write(`  ⏳ ${test.name}... `);
      
      const result = await executeTest(test, 'auth');
      const passed = isSuccessfulStatus(result.status) || 
                    (test.id.includes('invalid') || test.id.includes('wrong') || test.id.includes('malformed')) && result.status >= 400;
      
      if (passed) {
        console.log(`✅ ${result.status} (${result.responseTime}ms)`);
        testResults.authentication.stats.passed++;
      } else {
        console.log(`❌ ${result.status} ${result.statusText} (${result.responseTime}ms)`);
        testResults.authentication.stats.failed++;
        
        // Analyze compatibility issues
        const issues = analyzeCompatibilityIssues(result);
        testResults.compatibility_issues.push(...issues);
      }
      
      testResults.authentication.tests.push({
        ...result,
        passed,
        category: category.name
      });
      testResults.authentication.stats.total++;
      
      // Delay between tests (200ms like test-app)
      await sleep(200);
    }
    
    console.log('');
  }
}

async function runAPITests() {
  console.log('\n🔗 Running API Tests...\n');
  
  for (const category of apiTestCategories) {
    console.log(`📁 ${category.name} (${category.tests.length} tests)`);
    
    for (const test of category.tests) {
      process.stdout.write(`  ⏳ ${test.name}... `);
      
      const result = await executeTest(test, 'api');
      const passed = isSuccessfulStatus(result.status) || 
                    (test.id.includes('not-found') || test.id.includes('invalid') || test.id.includes('missing')) && result.status >= 400;
      
      if (passed) {
        console.log(`✅ ${result.status} (${result.responseTime}ms)`);
        testResults.api.stats.passed++;
      } else {
        console.log(`❌ ${result.status} ${result.statusText} (${result.responseTime}ms)`);
        testResults.api.stats.failed++;
        
        // Analyze compatibility issues
        const issues = analyzeCompatibilityIssues(result);
        testResults.compatibility_issues.push(...issues);
      }
      
      testResults.api.tests.push({
        ...result,
        passed,
        category: category.name
      });
      testResults.api.stats.total++;
      
      // Delay between tests (100ms like test-app)
      await sleep(100);
    }
    
    console.log('');
  }
}

function generateReport() {
  testResults.summary.endTime = new Date().toISOString();
  testResults.summary.total = testResults.authentication.stats.total + testResults.api.stats.total;
  testResults.summary.passed = testResults.authentication.stats.passed + testResults.api.stats.passed;
  testResults.summary.failed = testResults.authentication.stats.failed + testResults.api.stats.failed;
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `curl-test-results-${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(testResults, null, 2));
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📅 Started: ${testResults.summary.startTime}`);
  console.log(`📅 Ended: ${testResults.summary.endTime}`);
  console.log('');
  console.log(`📈 Overall Results:`);
  console.log(`   Total Tests: ${testResults.summary.total}`);
  console.log(`   Passed: ${testResults.summary.passed} (${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${testResults.summary.failed} (${((testResults.summary.failed / testResults.summary.total) * 100).toFixed(1)}%)`);
  console.log('');
  console.log(`🔐 Authentication Tests: ${testResults.authentication.stats.passed}/${testResults.authentication.stats.total} passed`);
  console.log(`🔗 API Tests: ${testResults.api.stats.passed}/${testResults.api.stats.total} passed`);
  console.log('');
  
  if (testResults.compatibility_issues.length > 0) {
    console.log(`⚠️  Compatibility Issues Found: ${testResults.compatibility_issues.length}`);
    
    const highSeverity = testResults.compatibility_issues.filter(i => i.severity === 'high');
    const mediumSeverity = testResults.compatibility_issues.filter(i => i.severity === 'medium');
    
    if (highSeverity.length > 0) {
      console.log(`   🔴 High Severity: ${highSeverity.length}`);
    }
    if (mediumSeverity.length > 0) {
      console.log(`   🟡 Medium Severity: ${mediumSeverity.length}`);
    }
    
    console.log('\n⚠️  Top Compatibility Issues:');
    testResults.compatibility_issues.slice(0, 5).forEach((issue, index) => {
      console.log(`   ${index + 1}. [${issue.testId}] ${issue.description}`);
    });
    
    if (testResults.compatibility_issues.length > 5) {
      console.log(`   ... and ${testResults.compatibility_issues.length - 5} more issues`);
    }
  } else {
    console.log('✅ No compatibility issues detected!');
  }
  
  console.log('');
  console.log(`💾 Detailed results saved to: ${filename}`);
  console.log('='.repeat(80));
}

// Main execution
async function main() {
  console.log('🚀 Supabase Lite Compatibility Test Runner (curl-based)');
  console.log(`🌐 Testing against: ${BASE_URL}`);
  console.log(`📧 Test credentials: ${TEST_CREDENTIALS.email}`);
  console.log('');
  
  try {
    await runAuthenticationTests();
    await runAPITests();
    generateReport();
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main, executeTest, authTestCategories, apiTestCategories };