import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';
import { extractTableNamesFromSQL, executeCleanupSQL } from '../cleanup-utils.js';

// Test: Delete multiple records
// Function: delete
// Example ID: delete-multiple-records

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
  console.log(`Running test: 025-delete-multiple-records`);
  console.log(`Function: delete`);
  console.log(`Test: Delete multiple records`);
  console.log('='.repeat(60));

  // Expected response for comparison
    const expectedResponse = {
  "status": 204,
  "statusText": "No Content"
};

  // Track tables created for cleanup
  let createdTables = [];

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

    // Setup SQL
    const setupSQL = `create table
  countries (id int8 primary key, name text);

insert into
  countries (id, name)
values
  (1, 'Rohan'), (2, 'The Shire'), (3, 'Mordor');`;
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
      .delete()
      .in('id', [1, 2, 3])

    // For DELETE operations with status 204, we expect no data and no error
    const testPassed = error === null;
    console.log(`✅ Test result: ${testPassed ? 'PASS' : 'FAIL'}`);
    
    if (!testPassed && error) {
      console.log('❌ Error:', JSON.stringify(error, null, 2));
    }
    
    if (testPassed) {
      console.log('✅ DELETE operation completed successfully (status 204 - No Content expected)');
    }

    return {
      testId: '025-delete-multiple-records',
      functionId: 'delete',
      name: 'Delete multiple records',
      passed: testPassed,
      error: error ? error.message : null,
      data: data,
      expected: expectedResponse
    };

  } catch (err) {
    console.log(`❌ Test failed with error: ${err.message}`);
    return {
      testId: '025-delete-multiple-records',
      functionId: 'delete',
      name: 'Delete multiple records',
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
