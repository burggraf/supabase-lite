import fetch from 'node-fetch'

const API_BASE_URL = 'http://localhost:3001'

async function testAPI() {
  console.log('🚀 Testing Supabase Lite API...\n')

  try {
    // Test /hello endpoint
    console.log('📞 Testing /hello endpoint...')
    const helloResponse = await fetch(`${API_BASE_URL}/hello`)
    const helloData = await helloResponse.json()
    console.log('✅ /hello:', helloData)
    console.log('')

    // Test /api/health endpoint
    console.log('📞 Testing /api/health endpoint...')
    const healthResponse = await fetch(`${API_BASE_URL}/api/health`)
    const healthData = await healthResponse.json()
    console.log('✅ /api/health:', healthData)
    console.log('')

    // Test REST API endpoint
    console.log('📞 Testing /rest/v1/users endpoint...')
    const restResponse = await fetch(`${API_BASE_URL}/rest/v1/users`)
    const restData = await restResponse.json()
    console.log('✅ /rest/v1/users:', restData)
    console.log('')

    // Test Auth endpoint
    console.log('📞 Testing /auth/v1/token endpoint...')
    const authResponse = await fetch(`${API_BASE_URL}/auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    })
    const authData = await authResponse.json()
    console.log('✅ /auth/v1/token:', authData)
    console.log('')

    console.log('🎉 All API tests completed successfully!')

  } catch (error) {
    console.error('❌ API test failed:', error.message)
    process.exit(1)
  }
}

// Check if server is running
async function checkServer() {
  try {
    await fetch(`${API_BASE_URL}/api/health`)
    return true
  } catch (error) {
    return false
  }
}

// Main execution
async function main() {
  const isServerRunning = await checkServer()
  
  if (!isServerRunning) {
    console.log('❌ MSW Server is not running!')
    console.log('Please start the server first:')
    console.log('  cd .. && npm run api:start')
    process.exit(1)
  }

  await testAPI()
}

main()