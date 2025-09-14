#!/usr/bin/env -S deno run --allow-all

/**
 * Apply the auth.uid() fix
 */


const SUPABASE_URL = 'http://localhost:5173';

async function applyFix() {
  console.log('🔧 Applying auth.uid() fix...');

  // Read the SQL fix file
  const sqlFix = await Deno.readTextFile('fix-auth-uid.sql');

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
    console.log('✅ Auth functions recreated successfully');
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
}

await applyFix();