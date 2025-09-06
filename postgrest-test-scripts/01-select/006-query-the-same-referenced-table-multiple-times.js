import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';
import { extractTableNamesFromSQL, executeCleanupSQL } from '../cleanup-utils.js';

// Test: Query the same referenced table multiple times
// Function: select
// Example ID: query-the-same-referenced-table-multiple-times

async function executeSetupSQL(sql) {
  if (!sql.trim()) return;
  
  // Split multiple SQL commands by semicolon
  const commands = sql.split(';').map(cmd => cmd.trim()).filter(cmd => cmd.length > 0);
  
  for (const command of commands) {
    console.log(`🗃️ Executing: ${command}`);
    const response = await fetch(SUPABASE_CONFIG.debugSqlEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: command })
    });
    
    const result = await response.json();
    console.log(`📋 Result:`, result);
    
    if (result.error || !response.ok) {
      throw new Error(`Setup SQL failed: ${result.error || result.message || 'Unknown error'}`);
    }
  }
}

async function runTest() {
  console.log('='.repeat(60));
  console.log(`Running test: 006-query-the-same-referenced-table-multiple-times`);
  console.log(`Function: select`);
  console.log(`Test: Query the same referenced table multiple times`);
  console.log('='.repeat(60));

  // Expected response for comparison
    const expectedResponse = {
  "data": [
    {
      "content": "👋",
      "from": {
        "name": "Kiran"
      },
      "to": {
        "name": "Evan"
      }
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

    // Setup SQL - use explicit public schema to avoid conflicts with system tables
    const setupSQL = `drop table if exists public.messages cascade;
drop table if exists public.users cascade;

create table public.users (id int8 primary key, name text);
create table public.messages (
     sender_id int8 not null references public.users,
     receiver_id int8 not null references public.users,
     content text
   );
insert into public.users (id, name)
 values
   (1, 'Kiran'),
   (2, 'Evan');
insert into public.messages (sender_id, receiver_id, content)
 values
   (1, 2, '👋');`;
    if (setupSQL.trim()) {
      console.log('📋 Executing setup SQL...');
      createdTables = extractTableNamesFromSQL(setupSQL);
      await executeSetupSQL(setupSQL);
      console.log('✅ Setup completed');
    }

    // Execute test code
    console.log('🧪 Executing test code...');
    
    // Query the same referenced table multiple times using aliases
    // This demonstrates querying the users table twice through different foreign keys
    // First approach: explicit foreign key constraint names
    const { data, error } = await supabase
      .from('messages')
      .select(`
        content,
        from:users!messages_sender_id_fkey(name),
        to:users!messages_receiver_id_fkey(name)
      `)

    // Basic validation
    if (data && expectedResponse && expectedResponse.data) {
      const dataMatches = JSON.stringify(data) === JSON.stringify(expectedResponse.data);
      console.log(`✅ Test result: ${dataMatches ? 'PASS' : 'FAIL'}`);
      
      if (!dataMatches) {
        console.log('📊 Expected:', JSON.stringify(expectedResponse.data, null, 2));
        console.log('📊 Actual:', JSON.stringify(data, null, 2));
      }
      
      return {
        testId: '006-query-the-same-referenced-table-multiple-times',
        functionId: 'select',
        name: 'Query the same referenced table multiple times',
        passed: dataMatches,
        error: null,
        data: data,
        expected: expectedResponse.data
      };
    } else {
      console.log('⚠️  No expected response data to compare');
      return {
        testId: '006-query-the-same-referenced-table-multiple-times',
        functionId: 'select',
        name: 'Query the same referenced table multiple times',
        passed: data ? true : false,
        error: error ? error.message : null,
        data: data,
        expected: expectedResponse ? expectedResponse.data : null
      };
    }

  } catch (err) {
    console.log(`❌ Test failed with error: ${err.message}`);
    return {
      testId: '006-query-the-same-referenced-table-multiple-times',
      functionId: 'select',
      name: 'Query the same referenced table multiple times',
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
