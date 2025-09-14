#!/usr/bin/env -S deno run --allow-all

/**
 * Debug script to test session variable setting in PGlite
 */

const SUPABASE_URL = 'http://localhost:5173';

async function testSessionVariables() {
  console.log('🔍 Testing session variable setting capabilities in PGlite\n');

  // Test 1: Basic session variable setting
  console.log('📝 Test 1: Basic session variable setting');
  let response = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SET LOCAL test_var = 'hello world';"
    })
  });
  let result = await response.json();
  console.log('SET result:', result.data);

  // Test 2: Reading the set variable
  console.log('\n📖 Test 2: Reading the set variable');
  response = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT current_setting('test_var', true) as test_value;"
    })
  });
  result = await response.json();
  console.log('READ result:');
  console.table(result.data);

  // Test 3: Try setting request.jwt.claim.sub
  console.log('\n🎯 Test 3: Setting JWT claim variable');
  response = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SET LOCAL \"request.jwt.claim.sub\" = '123e4567-e89b-12d3-a456-426614174000';"
    })
  });
  result = await response.json();
  console.log('JWT SET result:', result.data || result.error);

  // Test 4: Reading JWT claim variable
  console.log('\n🔑 Test 4: Reading JWT claim variable');
  response = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT current_setting('request.jwt.claim.sub', true) as jwt_sub;"
    })
  });
  result = await response.json();
  console.log('JWT READ result:');
  console.table(result.data);

  // Test 5: Check if auth.uid() now works
  console.log('\n🆔 Test 5: Testing auth.uid() function');
  response = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT auth.uid() as user_id;"
    })
  });
  result = await response.json();
  console.log('auth.uid() result:');
  console.table(result.data);

  // Test 6: Try alternative session variable format
  console.log('\n🔄 Test 6: Alternative session variable format');
  response = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SET session \"request.jwt.claim.sub\" = '456e7890-e89b-12d3-a456-426614174111';"
    })
  });
  result = await response.json();
  console.log('Session SET result:', result.data || result.error);

  response = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT current_setting('request.jwt.claim.sub', true) as jwt_sub_alt;"
    })
  });
  result = await response.json();
  console.log('Session READ result:');
  console.table(result.data);
}

await testSessionVariables();