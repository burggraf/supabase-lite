import fetch from 'node-fetch'

const API_BASE_URL = 'http://localhost:3001'

const tests = [
  {
    name: 'Hello Endpoint',
    url: '/hello',
    method: 'GET',
    expectedStatus: 200,
    expectedProperties: ['message', 'timestamp', 'version']
  },
  {
    name: 'Health Check',
    url: '/api/health',
    method: 'GET',
    expectedStatus: 200,
    expectedProperties: ['status', 'timestamp']
  },
  {
    name: 'REST API Users',
    url: '/rest/v1/users',
    method: 'GET',
    expectedStatus: 200,
    expectedProperties: ['message', 'status']
  },
  {
    name: 'Auth Token',
    url: '/auth/v1/token',
    method: 'POST',
    expectedStatus: 200,
    expectedProperties: ['access_token', 'token_type', 'expires_in'],
    body: { email: 'test@example.com', password: 'password123' }
  }
]

async function runTest(test) {
  try {
    const options = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    if (test.body) {
      options.body = JSON.stringify(test.body)
    }

    const response = await fetch(`${API_BASE_URL}${test.url}`, options)
    const data = await response.json()

    // Check status
    if (response.status !== test.expectedStatus) {
      throw new Error(`Expected status ${test.expectedStatus}, got ${response.status}`)
    }

    // Check expected properties
    for (const prop of test.expectedProperties) {
      if (!(prop in data)) {
        throw new Error(`Missing expected property: ${prop}`)
      }
    }

    console.log(`✅ ${test.name} - PASSED`)
    return true
  } catch (error) {
    console.log(`❌ ${test.name} - FAILED: ${error.message}`)
    return false
  }
}

async function runAllTests() {
  console.log('🧪 Running API Tests...\n')
  
  let passed = 0
  let failed = 0

  for (const test of tests) {
    const result = await runTest(test)
    if (result) {
      passed++
    } else {
      failed++
    }
  }

  console.log('\n📊 Test Results:')
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📈 Total: ${passed + failed}`)

  if (failed === 0) {
    console.log('\n🎉 All tests passed!')
    process.exit(0)
  } else {
    console.log('\n💥 Some tests failed!')
    process.exit(1)
  }
}

runAllTests()