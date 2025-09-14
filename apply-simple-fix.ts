#!/usr/bin/env -S deno run --allow-all

/**
 * Apply the simple auth.uid() fix
 */

const SUPABASE_URL = 'http://localhost:5173';

async function applySimpleFix() {
  console.log('🔧 Applying simple auth.uid() fix...');

  // Read the SQL fix file
  const sqlFix = await Deno.readTextFile('simple-auth-fix.sql');

  // Execute the fix
  const response = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: sqlFix })
  });

  const result = await response.json();

  if (result.error) {
    console.log('❌ Error applying fix:', result.error);
  } else {
    console.log('✅ Simple auth functions recreated successfully');
  }

  // Test the new auth.uid() function
  console.log('\n🧪 Testing new auth.uid() function...');

  const testResponse = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT auth.uid() as user_id, auth.role() as user_role;"
    })
  });

  const testResult = await testResponse.json();
  console.log('Test result:');
  console.table(testResult.data);

  // Test manual user update
  console.log('\n🔧 Testing manual user context update...');
  const updateResponse = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "UPDATE _current_user SET user_id = '123e4567-e89b-12d3-a456-426614174000', role = 'authenticated';"
    })
  });

  const updateResult = await updateResponse.json();
  console.log('Update result:', updateResult.error || 'Success');

  // Test auth functions after update
  const testAfterResponse = await fetch(`${SUPABASE_URL}/debug/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: "SELECT auth.uid() as user_id, auth.role() as user_role;"
    })
  });

  const testAfterResult = await testAfterResponse.json();
  console.log('Auth functions after manual update:');
  console.table(testAfterResult.data);
}

await applySimpleFix();