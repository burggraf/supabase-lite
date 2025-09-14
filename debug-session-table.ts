#!/usr/bin/env -S deno run --allow-all

/**
 * Debug the session context table approach
 */

const SUPABASE_URL = 'http://localhost:5173';

async function debugSessionTable() {
  console.log('🔍 Debugging session context table approach\n');

  // Test 1: Check if session table exists
  console.log('📋 Test 1: Check if session table exists');
  let response = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT * FROM _session_context;"
    })
  });
  let result = await response.json();
  console.log('Session table contents:');
  console.table(result.data || []);

  // Test 2: Manually insert session data
  console.log('\n🔧 Test 2: Manually insert session data');
  response = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: `DELETE FROM _session_context;
            INSERT INTO _session_context (key, value) VALUES
            ('role', 'authenticated'),
            ('user_id', '123e4567-e89b-12d3-a456-426614174000');`
    })
  });
  result = await response.json();
  console.log('Insert result:', result.data || result.error);

  // Test 3: Check if auth.uid() works now
  console.log('\n🆔 Test 3: Test auth.uid() after manual insert');
  response = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT auth.uid() as user_id, auth.role() as user_role, (SELECT COUNT(*) FROM _session_context) as context_rows;"
    })
  });
  result = await response.json();
  console.log('Auth functions after manual insert:');
  console.table(result.data);

  // Test 4: Test with Bearer token to see if context gets set
  console.log('\n🔑 Test 4: Get Alice token and test context setting');
  const signinResponse = await fetch(`${SUPABASE_URL}/auth/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'test-anon-key'
    },
    body: JSON.stringify({
      grant_type: 'password',
      username: 'alice@rlstest.com',
      password: 'Password123!'
    })
  });

  if (signinResponse.ok) {
    const authData = await signinResponse.json();
    console.log('✅ Got Alice token, now testing with Bearer header');

    // Test with auth header
    response = await fetch(`${SUPABASE_URL}/debug/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.access_token}`
      },
      body: JSON.stringify({
        sql: "SELECT auth.uid() as user_id, auth.role() as user_role, (SELECT COUNT(*) FROM _session_context) as context_rows;"
      })
    });
    result = await response.json();
    console.log('Auth functions with Bearer token:');
    console.table(result.data);

    // Check session table contents
    response = await fetch(`${SUPABASE_URL}/debug/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.access_token}`
      },
      body: JSON.stringify({
        sql: "SELECT * FROM _session_context ORDER BY key;"
      })
    });
    result = await response.json();
    console.log('\nSession table contents with Bearer token:');
    console.table(result.data || []);
  } else {
    console.log('❌ Failed to get auth token');
  }
}

await debugSessionTable();