import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';
import { extractTableNamesFromSQL, executeCleanupSQL } from '../cleanup-utils.js';

// Test: Bulk create
// Function: insert
// Example ID: bulk-create

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
  console.log(`Running test: 016-bulk-create`);
  console.log(`Function: insert`);
  console.log(`Test: Bulk create`);
  console.log('='.repeat(60));

  // Expected response for comparison - should be successful bulk insert
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

    // Execute test code - Bulk create test
    console.log('🧪 Testing bulk insert with array of records...');
    const { data, error } = await supabase
  .from('countries')
  .insert([
    { id: 1, name: 'Mordor' },
    { id: 2, name: 'The Shire' },
    { id: 3, name: 'Gondor' },
  ])
  .select()

    // Validate successful bulk insert
    const insertSuccess = !error && data && data.length === 3;
    
    console.log(`✅ Test result: ${insertSuccess ? 'PASS' : 'FAIL'}`);
    
    if (error) {
      console.log('❌ Bulk insert error:', error.message);
    } else {
      console.log('✅ Successfully bulk inserted', data?.length || 0, 'records');
      console.log('📊 Inserted data:', data);
    }
    
    return {
      testId: '016-bulk-create',
      functionId: 'insert',
      name: 'Bulk create',
      passed: insertSuccess,
      error: error ? error.message : null,
      data: data,
      expected: expectedResponse
    };

  } catch (err) {
    console.log(`❌ Test failed with error: ${err.message}`);
    return {
      testId: '016-bulk-create',
      functionId: 'insert',
      name: 'Bulk create',
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
