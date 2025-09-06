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

  // Expected response for comparison
    const expectedResponse = {
  "error": {
    "code": "23505",
    "details": "Key (id)=(1) already exists.",
    "hint": null,
    "message": "duplicate key value violates unique constraint \"countries_pkey\""
  },
  "status": 409,
  "statusText": "Conflict"
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

    // Execute test code - PROPER bulk create test
    console.log('🧪 Phase 1: Testing SUCCESSFUL bulk insert...');
    const { data: bulkData, error: bulkError } = await supabase
  .from('countries')
  .insert([
    { id: 1, name: 'Mordor' },
    { id: 2, name: 'The Shire' },
    { id: 3, name: 'Gondor' },
  ])
  .select()

    if (bulkError) {
      throw new Error(`Bulk insert should have succeeded: ${bulkError.message}`);
    }

    console.log('✅ Successfully inserted', bulkData?.length || 0, 'records via bulk operation');
    console.log('📊 Bulk insert data:', bulkData);

    // Phase 2: Test constraint violation (as per original spec)
    console.log('🧪 Phase 2: Testing constraint violation handling...');
    const { error } = await supabase
  .from('countries')
  .insert([
    { id: 4, name: 'Rohan' },
    { id: 1, name: 'Duplicate Test' }, // Should conflict with existing id: 1
  ])

    // Validate constraint violation occurred
    const hasExpectedError = error && 
      error.message.includes('duplicate key value violates unique constraint') &&
      error.message.includes('countries_pkey');
    
    // Overall test passes if bulk insert worked AND constraint violation was caught
    const bulkInsertWorked = bulkData && bulkData.length === 3;
    const constraintHandlingWorked = hasExpectedError;
    const overallSuccess = bulkInsertWorked && constraintHandlingWorked;
    
    console.log(`✅ Test result: ${overallSuccess ? 'PASS' : 'FAIL'}`);
    console.log(`   - Bulk insert success: ${bulkInsertWorked ? '✅' : '❌'}`);
    console.log(`   - Constraint handling: ${constraintHandlingWorked ? '✅' : '❌'}`);
    
    if (error) {
      console.log('✅ Expected constraint violation caught:', error.message);
    } else {
      console.log('❌ Expected duplicate key constraint violation but operation succeeded');
    }
    
    return {
      testId: '016-bulk-create',
      functionId: 'insert',
      name: 'Bulk create',
      passed: overallSuccess,
      error: error ? error.message : null,
      data: bulkData, // Contains the successfully bulk-inserted records
      expected: expectedResponse,
      bulkInsertWorked: bulkInsertWorked,
      constraintHandlingWorked: constraintHandlingWorked
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
      expected: expectedResponse,
      bulkInsertWorked: false,
      constraintHandlingWorked: false
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
