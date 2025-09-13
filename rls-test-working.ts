#!/usr/bin/env -S deno run --allow-all

/**
 * Working RLS Test - bypasses Supabase client auth issues
 * Tests RLS enforcement by making direct HTTP requests with proper auth headers
 */

const SUPABASE_URL = 'http://localhost:5173';
const ANON_KEY = 'test-anon-key';
const SERVICE_KEY = 'test-service-role-key';

// Test user credentials (these should exist from previous test runs)
const ALICE_EMAIL = 'alice@rlstest.com';
const BOB_EMAIL = 'bob@rlstest.com';
const PASSWORD = 'Password123!';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

async function makeAuthRequest(endpoint: string, body: any) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Auth request failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function makeAPIRequest(path: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  accessToken?: string;
  apiKey?: string;
} = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': options.apiKey || ANON_KEY,
    ...options.headers
  };

  if (options.accessToken) {
    headers['Authorization'] = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const responseData = await response.json();

  return {
    status: response.status,
    ok: response.ok,
    data: responseData
  };
}

async function cleanDatabase() {
  console.log('🧹 Cleaning database for test isolation...');

  // Clean auth tables first (users and related data)
  const authCleanupCommands = [
    'DELETE FROM auth.audit_log_entries',
    'DELETE FROM auth.identities',
    'DELETE FROM auth.instances',
    'DELETE FROM auth.mfa_amr_claims',
    'DELETE FROM auth.mfa_challenges',
    'DELETE FROM auth.mfa_factors',
    'DELETE FROM auth.refresh_tokens',
    'DELETE FROM auth.sessions',
    'DELETE FROM auth.users'
  ];

  for (const sql of authCleanupCommands) {
    try {
      await makeAPIRequest('/debug/sql', {
        method: 'POST',
        body: { sql },
        apiKey: SERVICE_KEY
      });
    } catch (error) {
      // Ignore errors for non-existent tables
      console.log(`⚠️  Could not execute: ${sql} (${error})`);
    }
  }

  // Drop and recreate public schema (like PostgREST tests)
  const schemaCommands = [
    'DROP SCHEMA IF EXISTS public CASCADE',
    'CREATE SCHEMA public',
    'GRANT ALL ON SCHEMA public TO postgres',
    'GRANT ALL ON SCHEMA public TO public'
  ];

  for (const sql of schemaCommands) {
    const response = await makeAPIRequest('/debug/sql', {
      method: 'POST',
      body: { sql },
      apiKey: SERVICE_KEY
    });

    if (!response.ok) {
      throw new Error(`Schema cleanup failed: ${JSON.stringify(response.data)}`);
    }
  }

  console.log('✅ Database cleaned successfully');
}

async function setupTestData() {
  console.log('📋 Setting up test data...');

  // Execute SQL commands one at a time
  const sqlCommands = [
    'DROP TABLE IF EXISTS test_posts CASCADE',
    `CREATE TABLE test_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id),
      title TEXT NOT NULL,
      content TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    'ALTER TABLE test_posts ENABLE ROW LEVEL SECURITY',
    `CREATE POLICY "Users can only see own posts" ON test_posts
      FOR SELECT USING (auth.uid() = user_id)`,
    `CREATE POLICY "Users can only insert own posts" ON test_posts
      FOR INSERT WITH CHECK (auth.uid() = user_id)`,
    `CREATE POLICY "Users can only update own posts" ON test_posts
      FOR UPDATE USING (auth.uid() = user_id)`,
    `CREATE POLICY "Users can only delete own posts" ON test_posts
      FOR DELETE USING (auth.uid() = user_id)`
  ];

  for (const sql of sqlCommands) {
    const response = await makeAPIRequest('/debug/sql', {
      method: 'POST',
      apiKey: SERVICE_KEY,
      body: { sql }
    });

    if (!response.ok) {
      throw new Error(`Failed to execute SQL: ${sql.substring(0, 50)}... - ${JSON.stringify(response.data)}`);
    }
  }

  console.log('✅ Test table created with RLS policies');
}

async function insertTestData() {
  console.log('📝 Inserting test data as service role...');

  // Get user IDs first
  const usersResponse = await makeAPIRequest('/debug/sql', {
    method: 'POST',
    apiKey: SERVICE_KEY,
    body: { sql: "SELECT id, email FROM auth.users WHERE email IN ('alice@rlstest.com', 'bob@rlstest.com')" }
  });

  if (!usersResponse.ok || !usersResponse.data.data || usersResponse.data.data.length < 2) {
    throw new Error('Test users not found. Please run user creation first.');
  }

  const alice = usersResponse.data.data.find((u: any) => u.email === ALICE_EMAIL);
  const bob = usersResponse.data.data.find((u: any) => u.email === BOB_EMAIL);

  if (!alice || !bob) {
    throw new Error('Alice or Bob user not found');
  }

  // Insert test posts for each user
  const insertSQL = `
    INSERT INTO test_posts (user_id, title, content) VALUES
    ('${alice.id}', 'Alice Post 1', 'Content by Alice'),
    ('${alice.id}', 'Alice Post 2', 'Another post by Alice'),
    ('${bob.id}', 'Bob Post 1', 'Content by Bob'),
    ('${bob.id}', 'Bob Post 2', 'Another post by Bob');
  `;

  const insertResponse = await makeAPIRequest('/debug/sql', {
    method: 'POST',
    apiKey: SERVICE_KEY,
    body: { sql: insertSQL }
  });

  if (!insertResponse.ok) {
    throw new Error(`Failed to insert test data: ${JSON.stringify(insertResponse.data)}`);
  }

  console.log('✅ Test data inserted');
  return { alice: alice.id, bob: bob.id };
}

async function createTestUsers() {
  console.log('👥 Creating test users...');

  const users = [
    { email: ALICE_EMAIL, password: PASSWORD },
    { email: BOB_EMAIL, password: PASSWORD }
  ];

  for (const user of users) {
    try {
      // Try to sign up the user
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          email_confirm: true
        })
      });

      if (response.ok) {
        console.log(`✅ Created user: ${user.email}`);
      } else {
        // User might already exist, which is fine
        console.log(`ℹ️  User already exists: ${user.email}`);
      }
    } catch (error) {
      console.log(`ℹ️  User creation for ${user.email} failed (might already exist):`, error.message);
    }
  }
}

async function authenticateUser(email: string, password: string) {
  // Use manual auth request to avoid Supabase client issues
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY
    },
    body: JSON.stringify({
      email,
      password,
      grant_type: 'password'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function runRLSTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  try {
    // Clean database for test isolation
    await cleanDatabase();

    // Setup
    await setupTestData();

    // Create users if they don't exist
    await createTestUsers();

    const userIds = await insertTestData();

    console.log('\n🧪 Running RLS Tests...\n');

    // Test 1: Service role can see all data
    console.log('📊 Test 1: Service role sees all data');
    try {
      const serviceResponse = await makeAPIRequest('/rest/v1/test_posts', {
        method: 'GET',
        apiKey: SERVICE_KEY
      });

      if (serviceResponse.ok && Array.isArray(serviceResponse.data) && serviceResponse.data.length === 4) {
        results.push({ name: 'Service role sees all data', passed: true });
        console.log('✅ Service role can see all 4 posts');
      } else {
        results.push({
          name: 'Service role sees all data',
          passed: false,
          error: `Expected 4 posts, got ${serviceResponse.data?.length || 0}`,
          details: serviceResponse.data
        });
        console.log('❌ Service role test failed');
      }
    } catch (error) {
      results.push({ name: 'Service role sees all data', passed: false, error: error.message });
      console.log('❌ Service role test error:', error.message);
    }

    // Test 2: Anonymous user sees no data
    console.log('\n📊 Test 2: Anonymous user sees no data');
    try {
      const anonResponse = await makeAPIRequest('/rest/v1/test_posts', {
        method: 'GET',
        apiKey: ANON_KEY
      });

      if (anonResponse.ok && Array.isArray(anonResponse.data) && anonResponse.data.length === 0) {
        results.push({ name: 'Anonymous user blocked', passed: true });
        console.log('✅ Anonymous user correctly sees 0 posts');
      } else {
        results.push({
          name: 'Anonymous user blocked',
          passed: false,
          error: `Expected 0 posts, got ${anonResponse.data?.length || 0}`,
          details: anonResponse.data
        });
        console.log('❌ Anonymous user test failed');
      }
    } catch (error) {
      results.push({ name: 'Anonymous user blocked', passed: false, error: error.message });
      console.log('❌ Anonymous user test error:', error.message);
    }

    // Test 3: Alice sees only her posts
    console.log('\n📊 Test 3: Alice sees only her posts');
    try {
      const aliceToken = await authenticateUser(ALICE_EMAIL, PASSWORD);
      const aliceResponse = await makeAPIRequest('/rest/v1/test_posts', {
        method: 'GET',
        accessToken: aliceToken
      });

      if (aliceResponse.ok && Array.isArray(aliceResponse.data)) {
        const alicePosts = aliceResponse.data;
        const allAliceOwned = alicePosts.every(post => post.user_id === userIds.alice);

        if (alicePosts.length === 2 && allAliceOwned) {
          results.push({ name: 'Alice sees only her posts', passed: true });
          console.log('✅ Alice correctly sees only her 2 posts');
        } else {
          results.push({
            name: 'Alice sees only her posts',
            passed: false,
            error: `Expected 2 Alice posts, got ${alicePosts.length} posts, all owned by Alice: ${allAliceOwned}`,
            details: alicePosts
          });
          console.log('❌ Alice test failed');
        }
      } else {
        results.push({
          name: 'Alice sees only her posts',
          passed: false,
          error: `Request failed: ${aliceResponse.status}`,
          details: aliceResponse.data
        });
        console.log('❌ Alice request failed');
      }
    } catch (error) {
      results.push({ name: 'Alice sees only her posts', passed: false, error: error.message });
      console.log('❌ Alice test error:', error.message);
    }

    // Test 4: Bob sees only his posts
    console.log('\n📊 Test 4: Bob sees only his posts');
    try {
      const bobToken = await authenticateUser(BOB_EMAIL, PASSWORD);
      const bobResponse = await makeAPIRequest('/rest/v1/test_posts', {
        method: 'GET',
        accessToken: bobToken
      });

      if (bobResponse.ok && Array.isArray(bobResponse.data)) {
        const bobPosts = bobResponse.data;
        const allBobOwned = bobPosts.every(post => post.user_id === userIds.bob);

        if (bobPosts.length === 2 && allBobOwned) {
          results.push({ name: 'Bob sees only his posts', passed: true });
          console.log('✅ Bob correctly sees only his 2 posts');
        } else {
          results.push({
            name: 'Bob sees only his posts',
            passed: false,
            error: `Expected 2 Bob posts, got ${bobPosts.length} posts, all owned by Bob: ${allBobOwned}`,
            details: bobPosts
          });
          console.log('❌ Bob test failed');
        }
      } else {
        results.push({
          name: 'Bob sees only his posts',
          passed: false,
          error: `Request failed: ${bobResponse.status}`,
          details: bobResponse.data
        });
        console.log('❌ Bob request failed');
      }
    } catch (error) {
      results.push({ name: 'Bob sees only his posts', passed: false, error: error.message });
      console.log('❌ Bob test error:', error.message);
    }

    return results;

  } catch (error) {
    console.error('💥 Setup failed:', error.message);
    results.push({ name: 'Test setup', passed: false, error: error.message });
    return results;
  }
}

async function main() {
  console.log('🧪 RLS Working Test Runner\n');

  try {
    const results = await runRLSTests();

    // Print summary
    console.log('\n============================================================');
    console.log('📊 RLS TEST RESULTS SUMMARY');
    console.log('============================================================');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`Total Tests:  ${results.length}`);
    console.log(`Passed:       ${passed} (${((passed / results.length) * 100).toFixed(1)}%)`);
    console.log(`Failed:       ${failed} (${((failed / results.length) * 100).toFixed(1)}%)`);

    console.log('\nDetailed Results:');
    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}`);
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    if (failed > 0) {
      console.log(`\n⚠️  ${failed} test(s) failed. RLS enforcement may not be working correctly.`);
      Deno.exit(1);
    } else {
      console.log('\n🎉 All RLS tests passed! RLS enforcement is working correctly.');
      Deno.exit(0);
    }

  } catch (error) {
    console.error('💥 Test runner failed:', error.message);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}