import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';
import { extractTableNamesFromSQL, executeCleanupSQL } from '../cleanup-utils.js';

// Test: Querying with count option
// Function: select
// Example ID: querying-with-count-option

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
  console.log(`Running test: 010-querying-with-count-option`);
  console.log(`Function: select`);
  console.log(`Test: Querying with count option`);
  console.log('='.repeat(60));

  // Expected response for comparison
    const expectedResponse = {
  "count": 3,
  "status": 200,
  "statusText": "OK"
};

  // Track tables created for cleanup
  let createdTables = [];

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

    // Setup SQL
    const setupSQL = `drop table if exists characters;

create table
  characters (id int8 primary key, name text);
insert into
  characters (id, name)
values
  (1, 'Luke'),
  (2, 'Leia'),
  (3, 'Han');`;
    if (setupSQL.trim()) {
      console.log('📋 Executing setup SQL...');
      createdTables = extractTableNamesFromSQL(setupSQL);
      await executeSetupSQL(setupSQL);
      console.log('✅ Setup completed');
    }

    // Execute test code
    console.log('🧪 Executing test code...');
    const { count, error } = await supabase
  .from('characters')
  .select('*', { count: 'exact', head: true })

    // Validate count result
    if (error) {
      console.log(`❌ Query failed with error: ${error.message}`);
      return {
        testId: '010-querying-with-count-option',
        functionId: 'select',
        name: 'Querying with count option',
        passed: false,
        error: error.message,
        data: null,
        expected: expectedResponse
      };
    }

    const countMatches = count === expectedResponse.count;
    console.log(`✅ Test result: ${countMatches ? 'PASS' : 'FAIL'}`);
    
    if (!countMatches) {
      console.log('📊 Expected count:', expectedResponse.count);
      console.log('📊 Actual count:', count);
    }
    
    return {
      testId: '010-querying-with-count-option',
      functionId: 'select',
      name: 'Querying with count option',
      passed: countMatches,
      error: null,
      data: { count },
      expected: expectedResponse
    };

  } catch (err) {
    console.log(`❌ Test failed with error: ${err.message}`);
    return {
      testId: '010-querying-with-count-option',
      functionId: 'select',
      name: 'Querying with count option',
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
