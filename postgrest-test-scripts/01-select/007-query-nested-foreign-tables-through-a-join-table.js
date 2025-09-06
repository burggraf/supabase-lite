import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';
import { extractTableNamesFromSQL, executeCleanupSQL } from '../cleanup-utils.js';

// Test: Query nested foreign tables through a join table
// Function: select
// Example ID: query-nested-foreign-tables-through-a-join-table

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
  console.log(`Running test: 007-query-nested-foreign-tables-through-a-join-table`);
  console.log(`Function: select`);
  console.log(`Test: Query nested foreign tables through a join table`);
  console.log('='.repeat(60));

  // Expected response for comparison
    const expectedResponse = {
  "data": [
    {
      "game_id": 1,
      "away_team": {
        "users": [
          {
            "id": 1,
            "name": "Kiran"
          },
          {
            "id": 2,
            "name": "Evan"
          }
        ]
      }
    },
    {
      "game_id": 2,
      "away_team": {
        "users": [
          {
            "id": 1,
            "name": "Kiran"
          }
        ]
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

    // Setup SQL
    const setupSQL = `drop table if exists users_teams;
drop table if exists users;
drop table if exists games;
drop table if exists teams;

create table
  users (
    id int8 primary key,
    name text
  );
create table
  teams (
    id int8 primary key,
    name text
  );
-- join table
create table
  users_teams (
    user_id int8 not null references users,
    team_id int8 not null references teams,

    primary key (user_id, team_id)
  );
create table
  games (
    id int8 primary key,
    home_team int8 not null references teams,
    away_team int8 not null references teams,
    name text
  );
insert into users (id, name)
values
  (1, 'Kiran'),
  (2, 'Evan');
insert into
  teams (id, name)
values
  (1, 'Green'),
  (2, 'Blue');
insert into
  users_teams (user_id, team_id)
values
  (1, 1),
  (1, 2),
  (2, 2);
insert into
  games (id, home_team, away_team, name)
values
  (1, 1, 2, 'Green vs Blue'),
  (2, 2, 1, 'Blue vs Green');`;
    if (setupSQL.trim()) {
      console.log('📋 Executing setup SQL...');
      createdTables = extractTableNamesFromSQL(setupSQL);
      await executeSetupSQL(setupSQL);
      console.log('✅ Setup completed');
    }

    // Execute test code
    console.log('🧪 Executing test code...');
    const { data, error } = await supabase
    .from('games')
    .select(`
      game_id:id,
      away_team:teams!games_away_team_fkey (
        users (
          id,
          name
        )
      )
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
        testId: '007-query-nested-foreign-tables-through-a-join-table',
        functionId: 'select',
        name: 'Query nested foreign tables through a join table',
        passed: dataMatches,
        error: null,
        data: data,
        expected: expectedResponse.data
      };
    } else {
      console.log('⚠️  No expected response data to compare');
      return {
        testId: '007-query-nested-foreign-tables-through-a-join-table',
        functionId: 'select',
        name: 'Query nested foreign tables through a join table',
        passed: data ? true : false,
        error: error ? error.message : null,
        data: data,
        expected: expectedResponse ? expectedResponse.data : null
      };
    }

  } catch (err) {
    console.log(`❌ Test failed with error: ${err.message}`);
    return {
      testId: '007-query-nested-foreign-tables-through-a-join-table',
      functionId: 'select',
      name: 'Query nested foreign tables through a join table',
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
