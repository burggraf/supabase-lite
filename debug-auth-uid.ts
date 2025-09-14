#!/usr/bin/env -S deno run --allow-all

/**
 * Debug script to check auth.uid() function behavior
 */

const SUPABASE_URL = 'http://localhost:5173';

async function testAuthUid(scenario: string, headers: Record<string, string>) {
  console.log(`\n🧪 Testing ${scenario}:`);

  // Test auth.uid() directly with SQL query
  const sqlQuery = "SELECT auth.uid() as current_user_id, current_setting('request.jwt.claim.sub', true) as jwt_sub, current_setting('request.jwt.claim.role', true) as jwt_role";

  const response = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({ sql: sqlQuery })
  });

  const result = await response.json();

  if (result.error) {
    console.log(`❌ Error: ${result.error}`);
  } else {
    console.log('✅ Auth function results:');
    console.table(result.data);
  }
}

// Test different scenarios
console.log('🔍 Debugging auth.uid() function behavior');

// Test 1: Anonymous (no headers)
await testAuthUid('Anonymous user', {});

// Test 2: Service role
await testAuthUid('Service role', {
  'apikey': 'test-service-role-key'
});

// Test 3: Try to simulate authenticated user
// First get a token by signing in Alice
console.log('\n🔑 Getting Alice auth token...');
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
  console.log('✅ Got Alice token');

  // Test 4: Authenticated user with Bearer token
  await testAuthUid('Alice with Bearer token', {
    'Authorization': `Bearer ${authData.access_token}`
  });

} else {
  const error = await signinResponse.text();
  console.log('❌ Failed to get Alice token:', error);
}