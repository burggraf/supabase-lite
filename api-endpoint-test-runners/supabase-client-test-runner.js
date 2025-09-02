#!/usr/bin/env node

/**
 * Supabase Client Test Runner for Supabase Lite
 * 
 * This script tests all Authentication and API endpoints using the official
 * @supabase/supabase-js client library to compare behavior with the curl-based
 * test runner and identify compatibility issues.
 * 
 * Usage: node supabase-client-test-runner.js [base-url]
 * Default base URL: http://localhost:5173
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:5173';
const ANON_KEY = 'test-api-key'; // Mock API key for demo

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

// Initialize Supabase client
const supabase = createClient(BASE_URL, ANON_KEY);

// Test results storage
let testResults = {
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    startTime: new Date().toISOString(),
    endTime: null,
    baseUrl: BASE_URL,
    clientVersion: 'latest' // Could be dynamic
  },
  authentication: {
    tests: [],
    stats: { total: 0, passed: 0, failed: 0 }
  },
  api: {
    tests: [],
    stats: { total: 0, passed: 0, failed: 0 }
  },
  compatibility_issues: [],
  client_specific_issues: []
};

// Test definitions (same structure as curl runner but mapped to client methods)
const authTestDefinitions = [
  {
    id: 'signup-email',
    name: 'Sign Up with Email',
    description: 'Create a new user account with email and password',
    clientMethod: 'signUp',
    params: {
      email: TEST_CREDENTIALS.email,
      password: TEST_CREDENTIALS.password,
      options: {
        data: {
          full_name: 'Test User'
        }
      }
    }
  },
  {
    id: 'signin-email',
    name: 'Sign In with Email',
    description: 'Authenticate user with email and password',
    clientMethod: 'signInWithPassword',
    params: {
      email: TEST_CREDENTIALS.email,
      password: TEST_CREDENTIALS.password
    }
  },
  {
    id: 'get-session',
    name: 'Get Current Session',
    description: 'Retrieve current session information',
    clientMethod: 'getSession',
    requiresAuth: true
  },
  {
    id: 'get-user',
    name: 'Get Current User',
    description: 'Get current user profile and metadata',
    clientMethod: 'getUser',
    requiresAuth: true
  },
  {
    id: 'refresh-session',
    name: 'Refresh Session',
    description: 'Refresh the current session',
    clientMethod: 'refreshSession',
    requiresAuth: true
  },
  {
    id: 'update-user-profile',
    name: 'Update User Profile',
    description: 'Update user metadata and profile information',
    clientMethod: 'updateUser',
    params: {
      data: {
        full_name: 'Updated Test User',
        avatar_url: 'https://example.com/avatar.jpg'
      }
    },
    requiresAuth: true
  },
  {
    id: 'update-password',
    name: 'Update Password',
    description: 'Change user password',
    clientMethod: 'updateUser',
    params: {
      password: 'newPassword123$'
    },
    requiresAuth: true
  },
  {
    id: 'request-password-reset',
    name: 'Request Password Reset',
    description: 'Send password reset email to user',
    clientMethod: 'resetPasswordForEmail',
    params: {
      email: TEST_CREDENTIALS.email
    }
  },
  {
    id: 'logout',
    name: 'Sign Out',
    description: 'Sign out current user session',
    clientMethod: 'signOut',
    requiresAuth: true
  }
];

const apiTestDefinitions = [
  {
    id: 'get-all-products',
    name: 'Get All Products',
    description: 'Retrieve all products from the catalog',
    table: 'products',
    operation: 'select',
    params: ['*']
  },
  {
    id: 'get-specific-fields',
    name: 'Get Specific Fields',
    description: 'Select only specific columns from products table',
    table: 'products',
    operation: 'select',
    params: ['product_name', 'unit_price', 'units_in_stock']
  },
  {
    id: 'get-single-product',
    name: 'Get Single Product',
    description: 'Retrieve a specific product by ID',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: [{ column: 'product_id', operator: 'eq', value: 1 }]
  },
  {
    id: 'create-product',
    name: 'Create New Product',
    description: 'Add a new product to the catalog',
    table: 'products',
    operation: 'insert',
    params: {
      product_id: 999,
      product_name: 'Test Product',
      unit_price: 25.99,
      units_in_stock: 100,
      category_id: 1,
      supplier_id: 1,
      discontinued: 0
    }
  },
  {
    id: 'update-product',
    name: 'Update Product',
    description: 'Update an existing product\'s price',
    table: 'products',
    operation: 'update',
    params: { unit_price: 29.99 },
    filters: [{ column: 'product_id', operator: 'eq', value: 1 }]
  },
  {
    id: 'delete-product',
    name: 'Delete Test Product',
    description: 'Remove the test product we created',
    table: 'products',
    operation: 'delete',
    filters: [{ column: 'product_name', operator: 'eq', value: 'Test Product' }]
  },
  {
    id: 'price-filter',
    name: 'Price Range Filter',
    description: 'Find products in a specific price range ($20-$50)',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: [
      { column: 'unit_price', operator: 'gte', value: 20 },
      { column: 'unit_price', operator: 'lte', value: 50 }
    ]
  },
  {
    id: 'text-search',
    name: 'Text Search',
    description: 'Search for products containing "seafood" in the name',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: [{ column: 'product_name', operator: 'ilike', value: '%seafood%' }]
  },
  {
    id: 'complex-filter',
    name: 'Complex Filter + Sort',
    description: 'Active products sorted by price (highest first)',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: [{ column: 'discontinued', operator: 'eq', value: 0 }],
    orderBy: { column: 'unit_price', ascending: false },
    limit: 10
  },
  {
    id: 'orders-with-customers',
    name: 'Orders with Customer Details',
    description: 'Get orders with embedded customer information',
    table: 'orders',
    operation: 'select',
    params: ['*, customers(customer_id, company_name, contact_name)'],
    limit: 5
  },
  {
    id: 'products-with-categories',
    name: 'Products with Categories',
    description: 'Products with their category names',
    table: 'products',
    operation: 'select',
    params: ['product_name', 'unit_price', 'categories(category_name)'],
    limit: 10
  }
];

// Utility functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getStatusFromSupabaseResponse(response) {
  if (response.error) {
    // Map common Supabase errors to HTTP status codes
    if (response.error.message.includes('not found') || response.error.message.includes('does not exist')) {
      return 404;
    }
    if (response.error.message.includes('permission') || response.error.message.includes('denied')) {
      return 403;
    }
    if (response.error.message.includes('invalid') || response.error.message.includes('bad request')) {
      return 400;
    }
    if (response.error.message.includes('unauthorized')) {
      return 401;
    }
    return 500; // Generic server error
  }
  return 200; // Success
}

function isSuccessfulResponse(response) {
  return !response.error;
}

// Authentication test execution
async function executeAuthTest(testDef) {
  const startTime = Date.now();
  
  try {
    let response;
    
    switch (testDef.clientMethod) {
      case 'signUp':
        response = await supabase.auth.signUp(testDef.params);
        break;
        
      case 'signInWithPassword':
        response = await supabase.auth.signInWithPassword(testDef.params);
        break;
        
      case 'getSession':
        response = await supabase.auth.getSession();
        break;
        
      case 'getUser':
        response = await supabase.auth.getUser();
        break;
        
      case 'refreshSession':
        response = await supabase.auth.refreshSession();
        break;
        
      case 'updateUser':
        response = await supabase.auth.updateUser(testDef.params);
        break;
        
      case 'resetPasswordForEmail':
        response = await supabase.auth.resetPasswordForEmail(testDef.params.email);
        break;
        
      case 'signOut':
        response = await supabase.auth.signOut();
        break;
        
      default:
        throw new Error(`Unknown auth method: ${testDef.clientMethod}`);
    }
    
    const responseTime = Date.now() - startTime;
    const status = getStatusFromSupabaseResponse(response);
    
    return {
      testId: testDef.id,
      name: testDef.name,
      clientMethod: testDef.clientMethod,
      status,
      data: response.data,
      error: response.error,
      responseTime,
      timestamp: new Date().toISOString(),
      testType: 'auth'
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      testId: testDef.id,
      name: testDef.name,
      clientMethod: testDef.clientMethod,
      status: 0,
      data: null,
      error: { message: error.message },
      responseTime,
      timestamp: new Date().toISOString(),
      testType: 'auth'
    };
  }
}

// API test execution
async function executeAPITest(testDef) {
  const startTime = Date.now();
  
  try {
    let query = supabase.from(testDef.table);
    let response;
    
    switch (testDef.operation) {
      case 'select':
        if (Array.isArray(testDef.params)) {
          query = query.select(testDef.params.join(', '));
        } else {
          query = query.select(testDef.params);
        }
        
        // Apply filters
        if (testDef.filters) {
          testDef.filters.forEach(filter => {
            query = query[filter.operator](filter.column, filter.value);
          });
        }
        
        // Apply ordering
        if (testDef.orderBy) {
          query = query.order(testDef.orderBy.column, { ascending: testDef.orderBy.ascending });
        }
        
        // Apply limit
        if (testDef.limit) {
          query = query.limit(testDef.limit);
        }
        
        response = await query;
        break;
        
      case 'insert':
        response = await query.insert(testDef.params);
        break;
        
      case 'update':
        if (testDef.filters) {
          testDef.filters.forEach(filter => {
            query = query[filter.operator](filter.column, filter.value);
          });
        }
        response = await query.update(testDef.params);
        break;
        
      case 'delete':
        if (testDef.filters) {
          testDef.filters.forEach(filter => {
            query = query[filter.operator](filter.column, filter.value);
          });
        }
        response = await query.delete();
        break;
        
      default:
        throw new Error(`Unknown API operation: ${testDef.operation}`);
    }
    
    const responseTime = Date.now() - startTime;
    const status = getStatusFromSupabaseResponse(response);
    
    return {
      testId: testDef.id,
      name: testDef.name,
      table: testDef.table,
      operation: testDef.operation,
      status,
      data: response.data,
      error: response.error,
      responseTime,
      timestamp: new Date().toISOString(),
      testType: 'api'
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      testId: testDef.id,
      name: testDef.name,
      table: testDef.table,
      operation: testDef.operation,
      status: 0,
      data: null,
      error: { message: error.message },
      responseTime,
      timestamp: new Date().toISOString(),
      testType: 'api'
    };
  }
}

// Auto-authentication for tests that require it
async function ensureAuthenticated() {
  try {
    // Check current session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('🔐 Already authenticated');
      return { success: true };
    }

    console.log('🔐 Authentication required, attempting sign-in...');

    // Try signing in first
    const { error: signinError } = await supabase.auth.signInWithPassword(TEST_CREDENTIALS);
    
    if (!signinError) {
      console.log('✅ Auto sign-in successful');
      return { success: true };
    }

    // If signin failed, try signup
    console.log('🔐 Sign-in failed, attempting sign-up...');
    const { error: signupError } = await supabase.auth.signUp({
      ...TEST_CREDENTIALS,
      options: {
        data: { full_name: 'Test User (Auto)' }
      }
    });

    if (!signupError) {
      console.log('✅ Auto sign-up successful');
      return { success: true };
    }

    return {
      success: false,
      error: `Authentication failed: ${signinError?.message || signupError?.message}`
    };

  } catch (error) {
    return {
      success: false,
      error: `Authentication error: ${error.message}`
    };
  }
}

// Analysis functions
function analyzeClientSpecificIssues(result) {
  const issues = [];
  const { error, testId, clientMethod, operation } = result;

  if (error) {
    // Check for client library specific issues
    if (error.message && error.message.includes('fetch is not defined')) {
      issues.push({
        type: 'client_environment',
        testId,
        description: 'Client library requires fetch polyfill or Node.js 18+',
        severity: 'high'
      });
    }

    if (error.message && error.message.includes('Invalid API key')) {
      issues.push({
        type: 'client_config',
        testId,
        description: 'Client library API key validation differs from direct HTTP calls',
        severity: 'medium'
      });
    }

    if (clientMethod && error.message && error.message.includes('not implemented')) {
      issues.push({
        type: 'missing_client_method',
        testId,
        clientMethod,
        description: `Client method ${clientMethod} may not be fully implemented`,
        severity: 'high'
      });
    }

    if (operation && error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
      issues.push({
        type: 'schema_compatibility',
        testId,
        operation,
        description: 'Database schema may not match client expectations',
        severity: 'high'
      });
    }
  }

  return issues;
}

// Test execution functions
async function runAuthenticationTests() {
  console.log('\n🔐 Running Authentication Tests (Supabase Client)...\n');
  
  for (const testDef of authTestDefinitions) {
    process.stdout.write(`  ⏳ ${testDef.name}... `);
    
    // Auto-authenticate if test requires auth
    if (testDef.requiresAuth) {
      const authResult = await ensureAuthenticated();
      if (!authResult.success) {
        console.log(`❌ Auth Failed (${authResult.error})`);
        testResults.authentication.stats.failed++;
        testResults.authentication.tests.push({
          testId: testDef.id,
          name: testDef.name,
          status: 401,
          error: { message: authResult.error },
          passed: false,
          responseTime: 0,
          timestamp: new Date().toISOString(),
          testType: 'auth'
        });
        testResults.authentication.stats.total++;
        continue;
      }
    }
    
    const result = await executeAuthTest(testDef);
    const passed = isSuccessfulResponse(result) && result.status === 200;
    
    if (passed) {
      console.log(`✅ Success (${result.responseTime}ms)`);
      testResults.authentication.stats.passed++;
    } else {
      console.log(`❌ ${result.status} ${result.error?.message || 'Unknown error'} (${result.responseTime}ms)`);
      testResults.authentication.stats.failed++;
      
      // Analyze client-specific issues
      const clientIssues = analyzeClientSpecificIssues(result);
      testResults.client_specific_issues.push(...clientIssues);
    }
    
    testResults.authentication.tests.push({
      ...result,
      passed
    });
    testResults.authentication.stats.total++;
    
    // Delay between tests (200ms like test-app)
    await sleep(200);
  }
}

async function runAPITests() {
  console.log('\n🔗 Running API Tests (Supabase Client)...\n');
  
  for (const testDef of apiTestDefinitions) {
    process.stdout.write(`  ⏳ ${testDef.name}... `);
    
    const result = await executeAPITest(testDef);
    const passed = isSuccessfulResponse(result) && result.status === 200;
    
    if (passed) {
      console.log(`✅ Success (${result.responseTime}ms)`);
      testResults.api.stats.passed++;
    } else {
      console.log(`❌ ${result.status} ${result.error?.message || 'Unknown error'} (${result.responseTime}ms)`);
      testResults.api.stats.failed++;
      
      // Analyze client-specific issues
      const clientIssues = analyzeClientSpecificIssues(result);
      testResults.client_specific_issues.push(...clientIssues);
    }
    
    testResults.api.tests.push({
      ...result,
      passed
    });
    testResults.api.stats.total++;
    
    // Delay between tests (100ms like test-app)
    await sleep(100);
  }
}

function generateReport() {
  testResults.summary.endTime = new Date().toISOString();
  testResults.summary.total = testResults.authentication.stats.total + testResults.api.stats.total;
  testResults.summary.passed = testResults.authentication.stats.passed + testResults.api.stats.passed;
  testResults.summary.failed = testResults.authentication.stats.failed + testResults.api.stats.failed;
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `supabase-client-test-results-${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(testResults, null, 2));
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUPABASE CLIENT TEST RESULTS');
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
  
  if (testResults.client_specific_issues.length > 0) {
    console.log(`⚠️  Client-Specific Issues Found: ${testResults.client_specific_issues.length}`);
    
    const highSeverity = testResults.client_specific_issues.filter(i => i.severity === 'high');
    const mediumSeverity = testResults.client_specific_issues.filter(i => i.severity === 'medium');
    
    if (highSeverity.length > 0) {
      console.log(`   🔴 High Severity: ${highSeverity.length}`);
    }
    if (mediumSeverity.length > 0) {
      console.log(`   🟡 Medium Severity: ${mediumSeverity.length}`);
    }
    
    console.log('\n⚠️  Top Client Issues:');
    testResults.client_specific_issues.slice(0, 5).forEach((issue, index) => {
      console.log(`   ${index + 1}. [${issue.testId}] ${issue.description}`);
    });
    
    if (testResults.client_specific_issues.length > 5) {
      console.log(`   ... and ${testResults.client_specific_issues.length - 5} more issues`);
    }
  } else {
    console.log('✅ No client-specific issues detected!');
  }
  
  console.log('');
  console.log(`💾 Detailed results saved to: ${filename}`);
  console.log('');
  console.log('💡 Next Steps:');
  console.log('   1. Compare with curl-test-runner.js results');
  console.log('   2. Identify discrepancies between HTTP and client library behavior');
  console.log('   3. Fix compatibility issues in Supabase Lite implementation');
  console.log('='.repeat(80));
}

// Main execution
async function main() {
  console.log('🚀 Supabase Lite Compatibility Test Runner (Supabase Client)');
  console.log(`🌐 Testing against: ${BASE_URL}`);
  console.log(`📧 Test credentials: ${TEST_CREDENTIALS.email}`);
  console.log(`🔑 API Key: ${ANON_KEY}`);
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

export { main, executeAuthTest, executeAPITest, authTestDefinitions, apiTestDefinitions };