import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';
import { extractTableNamesFromSQL, executeCleanupSQL } from '../cleanup-utils.js';

// Test: Applying Filters
// Function: using-filters
// Example ID: applying-filters

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
  console.log(`Running test: 031-applying-filters`);
  console.log(`Function: using-filters`);
  console.log(`Test: Applying Filters`);
  console.log('='.repeat(60));

  // Expected response for comparison
  const expectedResponse = {
    "error": {
      "code": "UNKNOWN",
      "details": null,
      "hint": null,
      "message": "supabase.from(...).eq is not a function"
    },
    "status": 400,
    "statusText": "Bad Request"
  };
  
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
    
    let data = null;
    let error = null;
    
    try {
      // First approach: with select (correct usage)
      const { data: data1, error: error1 } = await supabase
        .from('instruments')
        .select('name, section_id')
        .eq('name', 'violin')    // Correct
      
      console.log('✅ Correct approach worked:', { data: data1, error: error1 });
      
      // Second approach: without select (demonstrating incorrect usage - should throw error)
      const { data: data2, error: error2 } = await supabase
        .from('instruments')
        .eq('name', 'violin')    // Incorrect - this should fail
        .select('name, section_id');
      
      // If we get here without error, that's unexpected
      data = data2;
      error = error2;
      console.log('⚠️  Incorrect approach unexpectedly succeeded:', { data, error });
      
    } catch (err) {
      // This is expected - the incorrect usage should throw an error
      console.log('✅ Incorrect approach correctly failed with error:', err.message);
      error = {
        code: 'UNKNOWN',
        details: null,
        hint: null,
        message: err.message
      };
    }

    // Basic validation - check if we got the expected error
    if (error && expectedResponse && expectedResponse.error) {
      const errorMatches = error.message === expectedResponse.error.message;
      console.log(`✅ Test result: ${errorMatches ? 'PASS' : 'FAIL'}`);
      
      if (!errorMatches) {
        console.log('📊 Expected error message:', expectedResponse.error.message);
        console.log('📊 Actual error message:', error.message);
      }
      
      return {
        testId: '031-applying-filters',
        functionId: 'using-filters',
        name: 'Applying Filters',
        passed: errorMatches,
        error: null,
        data: { error },
        expected: expectedResponse.error
      };
    } else if (!error && expectedResponse && expectedResponse.error) {
      // Expected an error but didn't get one
      console.log('❌ Expected an error but none occurred');
      return {
        testId: '031-applying-filters',
        functionId: 'using-filters',
        name: 'Applying Filters',
        passed: false,
        error: 'Expected an error but none occurred',
        data: data,
        expected: expectedResponse.error
      };
    } else {
      console.log('⚠️  Unexpected test scenario');
      return {
        testId: '031-applying-filters',
        functionId: 'using-filters',
        name: 'Applying Filters',
        passed: false,
        error: 'Unexpected test scenario',
        data: data,
        expected: expectedResponse ? expectedResponse.error : null
      };
    }

  } catch (err) {
    console.log(`❌ Test failed with error: ${err.message}`);
    return {
      testId: '031-applying-filters',
      functionId: 'using-filters',
      name: 'Applying Filters',
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
