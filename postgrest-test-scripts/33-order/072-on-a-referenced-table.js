import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';
import { extractTableNamesFromSQL, executeCleanupSQL } from '../cleanup-utils.js';

// Test: On a referenced table
// Function: order
// Example ID: on-a-referenced-table

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
  console.log(`Running test: 072-on-a-referenced-table`);
  console.log(`Function: order`);
  console.log(`Test: On a referenced table`);
  console.log('='.repeat(60));

  // Expected response for comparison
    const expectedResponse = {
  "data": [
    {
      "name": "strings",
      "instruments": [
        {
          "name": "violin"
        },
        {
          "name": "harp"
        }
      ]
    },
    {
      "name": "woodwinds",
      "characters": []
    }
  ],
  "status": 200,
  "statusText": "OK"
};

  // Track tables created for cleanup
  let createdTables = [];

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

    // Setup SQL
    const setupSQL = `drop table if exists instruments;
drop table if exists orchestral_sections;

create table
  orchestral_sections (id int8 primary key, name text);
create table
  instruments (
    id int8 primary key,
    section_id int8 not null references orchestral_sections,
    name text
  );
insert into
  orchestral_sections (id, name)
values
  (1, 'strings'),
  (2, 'woodwinds');
insert into
  instruments (id, section_id, name)
values
  (1, 1, 'harp'),
  (2, 1, 'violin');`;
    if (setupSQL.trim()) {
      console.log('📋 Executing setup SQL...');
      createdTables = extractTableNamesFromSQL(setupSQL);
      await executeSetupSQL(setupSQL);
      console.log('✅ Setup completed');
    }

    // Execute test code
    console.log('🧪 Executing test code...');
    const { data, error } = await supabase
    .from('orchestral_sections')
    .select(`
      name,
      instruments (
        name
      )
    `)
    .order('name', { referencedTable: 'instruments', ascending: false })

    // Basic validation
    if (data && expectedResponse && expectedResponse.data) {
      const dataMatches = JSON.stringify(data) === JSON.stringify(expectedResponse.data);
      console.log(`✅ Test result: ${dataMatches ? 'PASS' : 'FAIL'}`);
      
      if (!dataMatches) {
        console.log('📊 Expected:', JSON.stringify(expectedResponse.data, null, 2));
        console.log('📊 Actual:', JSON.stringify(data, null, 2));
      }
      
      return {
        testId: '072-on-a-referenced-table',
        functionId: 'order',
        name: 'On a referenced table',
        passed: dataMatches,
        error: null,
        data: data,
        expected: expectedResponse.data
      };
    } else {
      console.log('⚠️  No expected response data to compare');
      return {
        testId: '072-on-a-referenced-table',
        functionId: 'order',
        name: 'On a referenced table',
        passed: data ? true : false,
        error: error ? error.message : null,
        data: data,
        expected: expectedResponse ? expectedResponse.data : null
      };
    }

  } catch (err) {
    console.log(`❌ Test failed with error: ${err.message}`);
    return {
      testId: '072-on-a-referenced-table',
      functionId: 'order',
      name: 'On a referenced table',
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
