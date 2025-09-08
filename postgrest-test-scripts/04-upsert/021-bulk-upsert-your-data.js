import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';
import { extractTableNamesFromSQL, executeCleanupSQL } from '../cleanup-utils.js';

// Test: Bulk Upsert your data
// Function: upsert
// Example ID: bulk-upsert-your-data

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
  console.log(`Running test: 021-bulk-upsert-your-data`);
  console.log(`Function: upsert`);
  console.log(`Test: Bulk Upsert your data`);
  console.log('='.repeat(60));

  // Expected response for comparison
    const expectedResponse = {
  "data": [
    {
      "id": 1,
      "name": "piano"
    },
    {
      "id": 2,
      "name": "harp"
    }
  ],
  "status": 201,
  "statusText": "Created"
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
  .upsert([
    { id: 1, name: 'piano' },
    { id: 2, name: 'harp' },
  ])
  .select()

    // Basic validation with order-independent comparison
    if (data && expectedResponse && expectedResponse.data) {
      // Sort both arrays by id for consistent comparison
      const sortedData = [...data].sort((a, b) => a.id - b.id);
      const sortedExpected = [...expectedResponse.data].sort((a, b) => a.id - b.id);
      const dataMatches = JSON.stringify(sortedData) === JSON.stringify(sortedExpected);
      console.log(`✅ Test result: ${dataMatches ? 'PASS' : 'FAIL'}`);
      
      if (!dataMatches) {
        console.log('📊 Expected:', JSON.stringify(sortedExpected, null, 2));
        console.log('📊 Actual:', JSON.stringify(sortedData, null, 2));
      }
      
      return {
        testId: '021-bulk-upsert-your-data',
        functionId: 'upsert',
        name: 'Bulk Upsert your data',
        passed: dataMatches,
        error: null,
        data: sortedData,
        expected: sortedExpected
      };
    } else {
      console.log('⚠️  No expected response data to compare');
      return {
        testId: '021-bulk-upsert-your-data',
        functionId: 'upsert',
        name: 'Bulk Upsert your data',
        passed: data ? true : false,
        error: error ? error.message : null,
        data: data,
        expected: expectedResponse ? expectedResponse.data : null
      };
    }

  } catch (err) {
    console.log(`❌ Test failed with error: ${err.message}`);
    return {
      testId: '021-bulk-upsert-your-data',
      functionId: 'upsert',
      name: 'Bulk Upsert your data',
      passed: false,
      error: err.message,
      data: null,
      expected: expectedResponse ? expectedResponse.data : null
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
