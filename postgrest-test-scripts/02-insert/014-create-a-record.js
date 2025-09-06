import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';
import { extractTableNamesFromSQL, executeCleanupSQL } from '../cleanup-utils.js';

// Test: Create a record
// Function: insert
// Example ID: create-a-record

async function executeSetupSQL(sql) {
  if (!sql.trim()) return;
  
  // Split multiple SQL commands by semicolon
  const commands = sql.split(';').map(cmd => cmd.trim()).filter(cmd => cmd.length > 0);
  
  for (const command of commands) {
    const response = await fetch(SUPABASE_CONFIG.debugSqlEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: command })
    });
    
    const result = await response.json();
    if (result.error) {
      throw new Error(`Setup SQL failed: ${result.error} - ${result.message || ''}`);
    }
  }
}

async function runTest() {
  console.log('='.repeat(60));
  console.log(`Running test: 014-create-a-record`);
  console.log(`Function: insert`);
  console.log(`Test: Create a record`);
  console.log('='.repeat(60));

  // Expected response for comparison
    const expectedResponse = {
  "status": 201,
  "statusText": "Created"
};

  // Track tables created for cleanup
  let createdTables = [];

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

    // Setup SQL
    const setupSQL = `drop table if exists countries;

create table
  countries (id int8 primary key, name text);`;
    if (setupSQL.trim()) {
      console.log('📋 Executing setup SQL...');
      createdTables = extractTableNamesFromSQL(setupSQL);
      await executeSetupSQL(setupSQL);
      console.log('✅ Setup completed');
    }

    // Execute test code
    console.log('🧪 Executing test code...');
    const { data, error } = await supabase
  .from('countries')
  .insert({ id: 1, name: 'Mordor' })

    // Basic validation - for inserts, success is typically when error is null
    const insertSuccess = !error;
    console.log(`✅ Test result: ${insertSuccess ? 'PASS' : 'FAIL'}`);
    
    if (error) {
      console.log('❌ Insert error:', error.message);
    } else {
      console.log('✅ Insert successful');
    }
    
    return {
      testId: '014-create-a-record',
      functionId: 'insert',
      name: 'Create a record',
      passed: insertSuccess,
      error: error ? error.message : null,
      data: data,
      expected: expectedResponse
    };

  } catch (err) {
    console.log(`❌ Test failed with error: ${err.message}`);
    return {
      testId: '014-create-a-record',
      functionId: 'insert',
      name: 'Create a record',
      passed: false,
      error: err.message,
      data: null,
      expected: expectedResponse
    };
  } finally {
    // Always cleanup, regardless of pass/fail
    await executeCleanupSQL(createdTables, SUPABASE_CONFIG.debugSqlEndpoint);
  }
}

// Export the test function
export default runTest;

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTest().then(result => {
    console.log('\n📋 Final Result:', result);
    process.exit(result.passed ? 0 : 1);
  }).catch(err => {
    console.error('💥 Test runner error:', err);
    process.exit(1);
  });
}
