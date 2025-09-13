#!/usr/bin/env -S deno run --allow-all

/**
 * Simple anonymous query test to see debug logs
 */

async function testAnonymousQuery() {
  console.log('🧪 Testing anonymous query to see debug logs');

  try {
    const response = await fetch('http://localhost:5173/rest/v1/test_posts', {
      method: 'GET',
      headers: {
        'apikey': 'test-anon-key',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('❌ Request failed:', response.status, await response.text());
      return;
    }

    const data = await response.json();
    console.log('📊 Anonymous query result:', {
      status: response.status,
      dataLength: data?.length || 0,
      data: data
    });

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

await testAnonymousQuery();