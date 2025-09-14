#!/usr/bin/env -S deno run --allow-all

/**
 * RLS Test Runner for Supabase Lite
 *
 * This script processes the rls.test.json file and runs comprehensive
 * Row Level Security tests against a local Supabase Lite instance using
 * the real supabase.js client library.
 *
 * Tests cover:
 * - User authentication workflows (signup, signin, session management)
 * - Schema management (table creation, RLS enabling, policy creation)
 * - Data isolation (user-specific data operations)
 * - Cross-user security (access restriction verification)
 * - Role behavior (service role bypass, authenticated restrictions)
 * - Complex policy scenarios
 */

import { createClient } from "npm:@supabase/supabase-js@2.39.3";

interface TestLog {
  type: 'info' | 'error' | 'debug';
  message: string;
  timestamp: string;
}

interface TestResults {
  passed: boolean;
  log: TestLog[];
  skip: boolean;
}

interface WorkflowStep {
  step: string;
  name: string;
  operation: string;
  params?: any;
  sql?: string;
  table?: string;
  data?: any;
  select?: string;
  filter?: any;
  expected_result?: any;
  expected_error?: boolean;
}

interface Example {
  id: string;
  name: string;
  description: string;
  workflow: WorkflowStep[];
  results?: TestResults;
}

interface TestItem {
  id: string;
  title: string;
  description: string;
  examples: Example[];
}

interface Config {
  supabaseLiteUrl: string;
  serverPort: number;
  healthCheckRetries: number;
  healthCheckDelay: number;
  anonKey: string;
  serviceRoleKey: string;
}

interface UserCredentials {
  email: string;
  password: string;
  id?: string;
}

interface TestContext {
  currentUser: UserCredentials | null;
  serviceRole: boolean;
  supabaseClient: any;
  serviceClient: any;
  testData: Map<string, any>;
}

// Configuration
const config: Config = {
  supabaseLiteUrl: Deno.args[0] || 'http://localhost:5173',
  serverPort: 5173,
  healthCheckRetries: 10,
  healthCheckDelay: 1000,
  anonKey: 'test-anon-key',
  serviceRoleKey: 'test-service-role-key'
};

// Global test context
const testContext: TestContext = {
  currentUser: null,
  serviceRole: false,
  supabaseClient: null,
  serviceClient: null,
  testData: new Map()
};

// Logging utilities
function logInfo(message: string): TestLog {
  const log: TestLog = {
    type: 'info',
    message,
    timestamp: new Date().toISOString()
  };
  console.log(`ℹ️  ${message}`);
  return log;
}

function logError(message: string): TestLog {
  const log: TestLog = {
    type: 'error',
    message,
    timestamp: new Date().toISOString()
  };
  console.log(`❌ ${message}`);
  return log;
}

function logDebug(message: string): TestLog {
  const log: TestLog = {
    type: 'debug',
    message,
    timestamp: new Date().toISOString()
  };
  console.log(`🔍 ${message}`);
  return log;
}

// Initialize Supabase clients
function initializeClients() {
  testContext.supabaseClient = createClient(config.supabaseLiteUrl, config.anonKey);
  testContext.serviceClient = createClient(config.supabaseLiteUrl, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  console.log(`✅ Initialized Supabase clients for ${config.supabaseLiteUrl}`);
}

// Health check
async function healthCheck(): Promise<boolean> {
  console.log('🏥 Performing health check...');

  for (let i = 0; i < config.healthCheckRetries; i++) {
    try {
      const response = await fetch(`${config.supabaseLiteUrl}/health`, {
        method: 'GET',
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`
        }
      });

      if (response.ok) {
        const healthData = await response.json();
        console.log(`✅ Health check passed (attempt ${i + 1}):`, healthData);
        return true;
      }

      console.log(`⚠️  Health check failed (attempt ${i + 1}): ${response.status}`);
    } catch (error) {
      console.log(`⚠️  Health check failed (attempt ${i + 1}): ${error.message}`);
    }

    if (i < config.healthCheckRetries - 1) {
      console.log(`⏳ Waiting ${config.healthCheckDelay}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, config.healthCheckDelay));
    }
  }

  console.log(`❌ Health check failed after ${config.healthCheckRetries} attempts`);
  return false;
}

// Operation implementations
async function executeOperation(step: WorkflowStep, logs: TestLog[]): Promise<any> {
  const client = testContext.serviceRole ? testContext.serviceClient : testContext.supabaseClient;

  switch (step.operation) {
    case 'cleanup':
      return await executeCleanup(logs);

    case 'auth_signup':
      return await executeAuthSignup(step, logs);

    case 'auth_signin':
      return await executeAuthSignin(step, logs);

    case 'auth_signout':
      return await executeAuthSignout(logs);

    case 'auth_update_user':
      return await executeAuthUpdateUser(step, logs);

    case 'set_service_role':
      return executeSetServiceRole(logs);

    case 'raw_sql':
      return await executeRawSQL(step, logs);

    case 'table_insert':
      return await executeTableInsert(step, logs);

    case 'table_select':
      return await executeTableSelect(step, logs);

    case 'table_update':
      return await executeTableUpdate(step, logs);

    case 'table_delete':
      return await executeTableDelete(step, logs);

    default:
      throw new Error(`Unknown operation: ${step.operation}`);
  }
}

async function executeCleanup(logs: TestLog[]): Promise<any> {
  logs.push(logInfo('Starting cleanup of test data'));

  try {
    // Use service role for cleanup
    const wasServiceRole = testContext.serviceRole;
    testContext.serviceRole = true;

    // Drop test tables (ignore errors)
    const tablesToDrop = ['test_comments', 'test_documents', 'test_projects', 'test_posts'];

    for (const table of tablesToDrop) {
      try {
        // Just drop the table directly without checking if it exists first
        const response = await fetch(`${config.supabaseLiteUrl}/debug/sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.serviceRoleKey
          },
          body: JSON.stringify({
            sql: `DROP TABLE IF EXISTS ${table} CASCADE;`
          })
        });

        if (response.ok) {
          logs.push(logDebug(`Dropped table: ${table}`));
        } else {
          logs.push(logDebug(`Drop table warning for ${table}: HTTP ${response.status}`));
        }
      } catch (e) {
        // Ignore cleanup errors
        logs.push(logDebug(`Cleanup warning for ${table}: ${e.message}`));
      }
    }

    // Only clean up test users at the very beginning of the full test suite
    // For individual test cleanups, preserve users but clean their data
    const isFullCleanup = testContext.testData.get('isFirstCleanup') !== false;
    if (isFullCleanup) {
      testContext.testData.set('isFirstCleanup', false);

      try {
        const response = await fetch(`${config.supabaseLiteUrl}/debug/sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.serviceRoleKey
          },
          body: JSON.stringify({
            sql: `DELETE FROM auth.users WHERE email IN ('alice@rlstest.com', 'bob@rlstest.com', 'charlie@rlstest.com');`
          })
        });

        if (response.ok) {
          logs.push(logDebug('Full cleanup: Removed test users from auth.users'));
        }
      } catch (e) {
        logs.push(logDebug(`User cleanup warning: ${e.message}`));
      }
    } else {
      logs.push(logDebug('Selective cleanup: Preserving users, cleaning only table data'));
    }

    // Reset context
    testContext.serviceRole = wasServiceRole;
    testContext.currentUser = null;

    logs.push(logInfo('Cleanup completed'));
    return { success: true };

  } catch (error) {
    logs.push(logError(`Cleanup failed: ${error.message}`));
    return { success: false, error: error.message };
  }
}

async function executeAuthSignup(step: WorkflowStep, logs: TestLog[]): Promise<any> {
  logs.push(logInfo(`Signing up user: ${step.params.email}`));

  try {
    const { data, error } = await testContext.supabaseClient.auth.signUp({
      email: step.params.email,
      password: step.params.password,
      options: {
        data: step.params.data || {}
      }
    });

    if (error) {
      // Check if user already exists
      if (error.message.includes('already') || error.message.includes('exists')) {
        logs.push(logInfo(`User already exists: ${step.params.email}`));
        return { success: true, data, existing: true };
      }
      throw error;
    }

    if (data.user) {
      testContext.testData.set(step.params.email, {
        id: data.user.id,
        email: step.params.email,
        password: step.params.password
      });

      logs.push(logInfo(`User signed up successfully: ${step.params.email} (${data.user.id})`));
    }

    return { success: true, data };

  } catch (error) {
    logs.push(logError(`Signup failed for ${step.params.email}: ${error.message}`));
    throw error;
  }
}

async function executeAuthSignin(step: WorkflowStep, logs: TestLog[]): Promise<any> {
  logs.push(logInfo(`Signing in user: ${step.params.email}`));

  try {
    const { data, error } = await testContext.supabaseClient.auth.signInWithPassword({
      email: step.params.email,
      password: step.params.password
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      testContext.currentUser = {
        email: step.params.email,
        password: step.params.password,
        id: data.user.id
      };

      logs.push(logInfo(`User signed in successfully: ${step.params.email} (${data.user.id})`));
    }

    testContext.serviceRole = false;
    return { success: true, data };

  } catch (error) {
    logs.push(logError(`Signin failed for ${step.params.email}: ${error.message}`));
    throw error;
  }
}

async function executeAuthSignout(logs: TestLog[]): Promise<any> {
  logs.push(logInfo('Signing out current user'));

  try {
    const { error } = await testContext.supabaseClient.auth.signOut();

    if (error) {
      throw error;
    }

    testContext.currentUser = null;
    testContext.serviceRole = false;

    logs.push(logInfo('User signed out successfully'));
    return { success: true };

  } catch (error) {
    logs.push(logError(`Signout failed: ${error.message}`));
    throw error;
  }
}

async function executeAuthUpdateUser(step: WorkflowStep, logs: TestLog[]): Promise<any> {
  logs.push(logInfo('Updating user profile'));

  try {
    const { data, error } = await testContext.supabaseClient.auth.updateUser({
      data: step.params.data
    });

    if (error) {
      throw error;
    }

    logs.push(logInfo('User profile updated successfully'));
    return { success: true, data };

  } catch (error) {
    logs.push(logError(`User update failed: ${error.message}`));
    throw error;
  }
}

function executeSetServiceRole(logs: TestLog[]): any {
  logs.push(logInfo('Switching to service role'));
  testContext.serviceRole = true;
  testContext.currentUser = null;
  return { success: true };
}

async function executeRawSQL(step: WorkflowStep, logs: TestLog[]): Promise<any> {
  logs.push(logInfo(`Executing SQL: ${step.sql?.substring(0, 100)}...`));

  try {
    const client = testContext.serviceRole ? testContext.serviceClient : testContext.supabaseClient;

    // For authenticated users, need to inject user_id in INSERT statements
    let sql = step.sql || '';

    if (!testContext.serviceRole && testContext.currentUser && sql.includes('INSERT INTO')) {
      // Replace user_id placeholders with actual user ID
      sql = sql.replace(/user_id,/g, `user_id,`)
               .replace(/VALUES \(/g, `VALUES ('${testContext.currentUser.id}',`)
               .replace(/,\s*title/g, `, title`)
               .replace(/,\s*content/g, `, content`);

      // Handle cases where user_id is not explicitly specified but should be auto-filled
      if (sql.includes('INSERT INTO test_posts') && !sql.includes('user_id')) {
        sql = sql.replace(/INSERT INTO test_posts \(/, `INSERT INTO test_posts (user_id, `)
                 .replace(/VALUES \(/, `VALUES ('${testContext.currentUser.id}', `);
      }

      if (sql.includes('INSERT INTO test_projects') && !sql.includes('owner_id')) {
        sql = sql.replace(/INSERT INTO test_projects \(/, `INSERT INTO test_projects (owner_id, `)
                 .replace(/VALUES \(/, `VALUES ('${testContext.currentUser.id}', `);
      }

      if (sql.includes('INSERT INTO test_documents') && !sql.includes('owner_id')) {
        sql = sql.replace(/INSERT INTO test_documents \(/, `INSERT INTO test_documents (owner_id, `)
                 .replace(/VALUES \(/, `VALUES ('${testContext.currentUser.id}', `);
      }
    }

    // Execute via the debug SQL endpoint
    const response = await fetch(`${config.supabaseLiteUrl}/debug/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': testContext.serviceRole ? config.serviceRoleKey : config.anonKey,
        'Authorization': `Bearer ${testContext.serviceRole ? config.serviceRoleKey : config.anonKey}`
      },
      body: JSON.stringify({ sql })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    logs.push(logInfo(`SQL executed successfully, affected rows: ${result.data?.length || 0}`));
    return { success: true, data: result.data };

  } catch (error) {
    logs.push(logError(`SQL execution failed: ${error.message}`));
    throw error;
  }
}

async function executeTableInsert(step: WorkflowStep, logs: TestLog[]): Promise<any> {
  logs.push(logInfo(`Inserting into table: ${step.table}`));

  try {
    const client = testContext.serviceRole ? testContext.serviceClient : testContext.supabaseClient;

    let insertData = { ...step.data };

    // Auto-add user/owner IDs for authenticated users
    if (!testContext.serviceRole && testContext.currentUser) {
      if (step.table === 'test_posts' && !insertData.user_id) {
        insertData.user_id = testContext.currentUser.id;
      }
      if ((step.table === 'test_projects' || step.table === 'test_documents') && !insertData.owner_id) {
        insertData.owner_id = testContext.currentUser.id;
      }
      if (step.table === 'test_comments' && !insertData.author_id) {
        insertData.author_id = testContext.currentUser.id;
      }
    }

    const { data, error } = await client
      .from(step.table)
      .insert(insertData)
      .select();

    if (error) {
      if (step.expected_error) {
        logs.push(logInfo(`Expected error occurred: ${error.message}`));
        return { success: true, expected_error: true, error };
      }
      throw error;
    }

    if (step.expected_error) {
      throw new Error(`Expected an error but operation succeeded`);
    }

    logs.push(logInfo(`Insert successful, ${data?.length || 0} rows inserted`));
    return { success: true, data };

  } catch (error) {
    logs.push(logError(`Insert failed: ${error.message}`));
    throw error;
  }
}

async function executeTableSelect(step: WorkflowStep, logs: TestLog[]): Promise<any> {
  logs.push(logInfo(`Querying table: ${step.table}`));

  try {
    const client = testContext.serviceRole ? testContext.serviceClient : testContext.supabaseClient;

    let query = client.from(step.table).select(step.select || '*');

    // Apply filters
    if (step.filter) {
      for (const [column, conditions] of Object.entries(step.filter)) {
        for (const [operator, value] of Object.entries(conditions as any)) {
          query = query[operator](column, value);
        }
      }
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    logs.push(logInfo(`Query successful, ${data?.length || 0} rows returned`));

    // Validate expected results
    if (step.expected_result) {
      await validateExpectedResult(data, step.expected_result, logs);
    }

    return { success: true, data };

  } catch (error) {
    logs.push(logError(`Query failed: ${error.message}`));
    throw error;
  }
}

async function executeTableUpdate(step: WorkflowStep, logs: TestLog[]): Promise<any> {
  logs.push(logInfo(`Updating table: ${step.table}`));

  try {
    const client = testContext.serviceRole ? testContext.serviceClient : testContext.supabaseClient;

    let query = client.from(step.table).update(step.data);

    // Apply filters
    if (step.filter) {
      for (const [column, conditions] of Object.entries(step.filter)) {
        for (const [operator, value] of Object.entries(conditions as any)) {
          query = query[operator](column, value);
        }
      }
    }

    const { data, error, count } = await query.select();

    if (error) {
      throw error;
    }

    const rowCount = count ?? data?.length ?? 0;
    logs.push(logInfo(`Update successful, ${rowCount} rows affected`));

    // Validate expected results
    if (step.expected_result) {
      if (step.expected_result.row_count !== undefined) {
        if (rowCount !== step.expected_result.row_count) {
          throw new Error(`Expected ${step.expected_result.row_count} rows affected, got ${rowCount}`);
        }
      }
    }

    return { success: true, data, count: rowCount };

  } catch (error) {
    // Check if this error was expected
    if (step.expected_result?.should_error) {
      if (step.expected_result.error_message && error.message.includes(step.expected_result.error_message)) {
        logs.push(logInfo(`Expected error occurred: ${error.message}`));
        return { success: true, expected_error: true, error_message: error.message };
      } else if (!step.expected_result.error_message) {
        logs.push(logInfo(`Expected error occurred: ${error.message}`));
        return { success: true, expected_error: true, error_message: error.message };
      } else {
        logs.push(logError(`Expected error message "${step.expected_result.error_message}" but got: ${error.message}`));
      }
    }

    logs.push(logError(`Update failed: ${error.message}`));
    throw error;
  }
}

async function executeTableDelete(step: WorkflowStep, logs: TestLog[]): Promise<any> {
  logs.push(logInfo(`Deleting from table: ${step.table}`));

  try {
    const client = testContext.serviceRole ? testContext.serviceClient : testContext.supabaseClient;

    let query = client.from(step.table).delete();

    // Apply filters
    if (step.filter) {
      for (const [column, conditions] of Object.entries(step.filter)) {
        for (const [operator, value] of Object.entries(conditions as any)) {
          query = query[operator](column, value);
        }
      }
    }

    const { data, error, count } = await query.select();

    if (error) {
      throw error;
    }

    const rowCount = count ?? data?.length ?? 0;
    logs.push(logInfo(`Delete successful, ${rowCount} rows affected`));

    // Validate expected results
    if (step.expected_result) {
      if (step.expected_result.row_count !== undefined) {
        if (rowCount !== step.expected_result.row_count) {
          throw new Error(`Expected ${step.expected_result.row_count} rows affected, got ${rowCount}`);
        }
      }
    }

    return { success: true, data, count: rowCount };

  } catch (error) {
    // Check if this error was expected
    if (step.expected_result?.should_error) {
      if (step.expected_result.error_message && error.message.includes(step.expected_result.error_message)) {
        logs.push(logInfo(`Expected error occurred: ${error.message}`));
        return { success: true, expected_error: true, error_message: error.message };
      } else if (!step.expected_result.error_message) {
        logs.push(logInfo(`Expected error occurred: ${error.message}`));
        return { success: true, expected_error: true, error_message: error.message };
      } else {
        logs.push(logError(`Expected error message "${step.expected_result.error_message}" but got: ${error.message}`));
      }
    }

    logs.push(logError(`Delete failed: ${error.message}`));
    throw error;
  }
}

async function validateExpectedResult(data: any[], expected: any, logs: TestLog[]): Promise<void> {
  if (expected.row_count !== undefined) {
    if (data.length !== expected.row_count) {
      throw new Error(`Expected ${expected.row_count} rows, got ${data.length}`);
    }
    logs.push(logInfo(`✓ Row count validation passed: ${data.length}`));
  }

  if (expected.contains) {
    const containsArray = Array.isArray(expected.contains) ? expected.contains : [expected.contains];

    for (const expectedItem of containsArray) {
      const found = data.some(row => {
        return Object.entries(expectedItem).every(([key, value]) => row[key] === value);
      });

      if (!found) {
        throw new Error(`Expected to find item with ${JSON.stringify(expectedItem)}`);
      }

      logs.push(logInfo(`✓ Contains validation passed: ${JSON.stringify(expectedItem)}`));
    }
  }

  if (expected.not_contains) {
    const notContainsArray = Array.isArray(expected.not_contains) ? expected.not_contains : [expected.not_contains];

    for (const unexpectedItem of notContainsArray) {
      const found = data.some(row => {
        return Object.entries(unexpectedItem).every(([key, value]) => row[key] === value);
      });

      if (found) {
        throw new Error(`Expected NOT to find item with ${JSON.stringify(unexpectedItem)}`);
      }

      logs.push(logInfo(`✓ Not contains validation passed: ${JSON.stringify(unexpectedItem)}`));
    }
  }
}

// Execute a single example
async function executeExample(example: Example): Promise<TestResults> {
  const logs: TestLog[] = [];
  logs.push(logInfo(`Starting example: ${example.name}`));

  try {
    for (const step of example.workflow) {
      logs.push(logInfo(`Executing step: ${step.name}`));

      const result = await executeOperation(step, logs);

      if (!result.success && !result.expected_error) {
        throw new Error(`Step failed: ${step.name}`);
      }

      // Small delay between steps
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logs.push(logInfo(`Example completed successfully: ${example.name}`));
    return {
      passed: true,
      log: logs,
      skip: false
    };

  } catch (error) {
    logs.push(logError(`Example failed: ${error.message}`));
    return {
      passed: false,
      log: logs,
      skip: false
    };
  }
}

// Load test configuration
async function loadTestConfig(): Promise<TestItem[]> {
  try {
    const configText = await Deno.readTextFile('./rls.test.json');
    const config = JSON.parse(configText);
    return config;
  } catch (error) {
    console.error('❌ Failed to load rls.test.json:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('🚀 Supabase Lite RLS Test Runner');
  console.log(`🌐 Testing against: ${config.supabaseLiteUrl}`);
  console.log('');

  // Health check
  const healthy = await healthCheck();
  if (!healthy) {
    console.error('❌ Health check failed. Please ensure Supabase Lite is running.');
    Deno.exit(1);
  }

  // Initialize clients
  initializeClients();

  // Load test configuration
  console.log('📖 Loading RLS test configuration...');
  const testItems = await loadTestConfig();
  console.log(`📋 Loaded ${testItems.length} test categories`);
  console.log('');

  // Run tests
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const testItem of testItems) {
    console.log(`\n📂 ${testItem.title}`);
    console.log(`   ${testItem.description}`);
    console.log('');

    for (const example of testItem.examples) {
      console.log(`  🧪 Running: ${example.name}`);
      totalTests++;

      const results = await executeExample(example);

      if (results.passed) {
        console.log(`  ✅ ${example.name} - PASSED`);
        passedTests++;
      } else {
        console.log(`  ❌ ${example.name} - FAILED`);
        failedTests++;

        // Show last few log entries for failures
        const errorLogs = results.log.filter(log => log.type === 'error').slice(-3);
        for (const log of errorLogs) {
          console.log(`     💥 ${log.message}`);
        }
      }

      example.results = results;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 RLS TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests:  ${totalTests}`);
  console.log(`Passed:       ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(`Failed:       ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('');

  if (failedTests === 0) {
    console.log('🎉 All RLS tests passed! Your Supabase Lite RLS implementation is working correctly.');
  } else {
    console.log(`⚠️  ${failedTests} test(s) failed. Please review the errors above.`);
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = `rls-test-results-${timestamp}.json`;

  await Deno.writeTextFile(resultsFile, JSON.stringify({
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      success_rate: (passedTests / totalTests) * 100,
      timestamp: new Date().toISOString(),
      config
    },
    results: testItems
  }, null, 2));

  console.log(`📄 Detailed results saved to: ${resultsFile}`);
  console.log('='.repeat(60));

  // Exit with appropriate code
  Deno.exit(failedTests > 0 ? 1 : 0);
}

// Run if called directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('❌ Test runner failed:', error);
    Deno.exit(1);
  });
}