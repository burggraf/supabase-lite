#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5173';

// Generate random user credentials to avoid conflicts
function generateRandomUser() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return {
    email: `test-${timestamp}-${random}@example.com`,
    password: 'Password123$'
  };
}

const TEST_CREDENTIALS = generateRandomUser();

async function quickTest() {
  console.log('🚀 Quick Supabase Lite Test');
  console.log(`🌐 Testing against: ${BASE_URL}`);
  
  // Test 1: Basic auth endpoint
  console.log('\n1. Testing auth signup...');
  try {
    const response = await fetch(`${BASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_CREDENTIALS.email,
        password: TEST_CREDENTIALS.password,
        data: { full_name: 'Test User' }
      })
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
    } else {
      const text = await response.text();
      console.log(`   Response: ${text}`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  // Test 2: Basic API endpoint
  console.log('\n2. Testing API endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/rest/v1/products?limit=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': 'test-api-key'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
    } else {
      const text = await response.text();
      console.log(`   Response: ${text}`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  console.log('\n✅ Quick test completed');
}

quickTest().catch(console.error);