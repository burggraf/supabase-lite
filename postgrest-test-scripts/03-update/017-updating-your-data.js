import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';
import { extractTableNamesFromSQL, executeCleanupSQL } from '../cleanup-utils.js';

// Test: Updating your data
// Function: update
// Example ID: updating-your-data

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
  console.log(`Running test: 017-updating-your-data`);
  console.log(`Function: update`);
  console.log(`Test: Updating your data`);
  console.log('='.repeat(60));

  // Expected response for comparison
    const expectedResponse = {
  "data": null,
  "status": 204,
  "statusText": "No Content"
};

  // Track tables created for cleanup
  let createdTables = [];

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

    // Setup SQL
    const setupSQL = `drop table if exists instruments;

create table
  instruments (id int8 primary key, name text);
insert into
  instruments (id, name)
values
  (1, 'harpsichord');`;
    if (setupSQL.trim()) {
      console.log('📋 Executing setup SQL...');
      createdTables = extractTableNamesFromSQL(setupSQL);
      await executeSetupSQL(setupSQL);
      console.log('✅ Setup completed');
    }

    // Execute test code
    console.log('🧪 Executing test code...');
    const { data, error } = await supabase
  .from('instruments')
  .update({ name: 'piano' })
  .eq('id', 1)

    // Basic validation - for basic update, data should be null
    const dataMatches = data === expectedResponse.data; // Both should be null
    const noError = !error;
    const testPassed = dataMatches && noError;
    
    console.log(`✅ Test result: ${testPassed ? 'PASS' : 'FAIL'}`);
    
    if (!testPassed) {
      console.log('📊 Expected data:', expectedResponse.data);
      console.log('📊 Actual data:', data);
      if (error) {
        console.log('❌ Error occurred:', error.message);
      }
    }
    
    return {
      testId: '017-updating-your-data',
      functionId: 'update',
      name: 'Updating your data',
      passed: testPassed,
      error: error ? error.message : null,
      data: data,
      expected: expectedResponse.data
    };

  } catch (err) {
    console.log(`❌ Test failed with error: ${err.message}`);
    return {
      testId: '017-updating-your-data',
      functionId: 'update',
      name: 'Updating your data',
      passed: false,
      error: err.message,
      data: null,
      expected: expectedResponse.data
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
