import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';
import { extractTableNamesFromSQL, executeCleanupSQL } from '../cleanup-utils.js';

// Test: Conditional Chaining
// Function: using-filters
// Example ID: conditional-chaining

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
  console.log(`Running test: 033-conditional-chaining`);
  console.log(`Function: using-filters`);
  console.log(`Test: Conditional Chaining`);
  console.log('='.repeat(60));

  // Track tables created for cleanup
  let createdTables = [];

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

    // Setup SQL
    const setupSQL = ``;
    if (setupSQL.trim()) {
      console.log('📋 Executing setup SQL...');
      createdTables = extractTableNamesFromSQL(setupSQL);
      await executeSetupSQL(setupSQL);
      console.log('✅ Setup completed');
    }

    // Execute test code
    console.log('🧪 Executing test code...');
    const filterByName = null
const filterPopLow = 1000
const filterPopHigh = 10000

let query = supabase
  .from('cities')
  .select('name, country_id')

if (filterByName)  { query = query.eq('name', filterByName) }
if (filterPopLow)  { query = query.gte('population', filterPopLow) }
if (filterPopHigh) { query = query.lt('population', filterPopHigh) }

const { data, error } = await query

    // Expected response for comparison
    const expectedResponse = null;

    // Basic validation
    if (data && expectedResponse && expectedResponse.data) {
      const dataMatches = JSON.stringify(data) === JSON.stringify(expectedResponse.data);
      console.log(`✅ Test result: ${dataMatches ? 'PASS' : 'FAIL'}`);
      
      if (!dataMatches) {
        console.log('📊 Expected:', JSON.stringify(expectedResponse.data, null, 2));
        console.log('📊 Actual:', JSON.stringify(data, null, 2));
      }
      
      return {
        testId: '033-conditional-chaining',
        functionId: 'using-filters',
        name: 'Conditional Chaining',
        passed: dataMatches,
        error: null,
        data: data,
        expected: expectedResponse.data
      };
    } else {
      console.log('⚠️  No expected response data to compare');
      return {
        testId: '033-conditional-chaining',
        functionId: 'using-filters',
        name: 'Conditional Chaining',
        passed: data ? true : false,
        error: error ? error.message : null,
        data: data,
        expected: expectedResponse ? expectedResponse.data : null
      };
    }

  } catch (err) {
    console.log(`❌ Test failed with error: ${err.message}`);
    return {
      testId: '033-conditional-chaining',
      functionId: 'using-filters',
      name: 'Conditional Chaining',
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
