/**
 * Test MSW handlers integration with AuthManager
 * Verifies that the MSW endpoints properly use the real authentication system
 */

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { handlers } from './src/mocks/handlers.js'

// Setup MSW server for Node.js environment
const server = setupServer(...handlers)

async function testMSWIntegration() {
  console.log('🔧 Starting MSW integration test...')
  
  try {
    // Start the mock server
    server.listen({ onUnhandledRequest: 'error' })
    console.log('✅ MSW server started')
    
    const testEmail = `test${Date.now()}@example.com`
    const testPassword = 'MySecurePassword123!'
    
    // Test 1: Sign up via MSW endpoint
    console.log('✍️  Testing signup via MSW...')
    const signupResponse = await fetch('http://localhost:5173/auth/v1/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        options: {
          data: { name: 'Test User' }
        }
      })
    })
    
    if (!signupResponse.ok) {
      const error = await signupResponse.json()
      throw new Error(`Signup failed: ${error.message}`)
    }
    
    const signupData = await signupResponse.json()
    console.log('✅ MSW signup successful!')
    console.log(`   - User ID: ${signupData.user.id}`)
    console.log(`   - Email: ${signupData.user.email}`)
    
    // Verify real UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(signupData.user.id)) {
      throw new Error(`Expected real UUID, got: ${signupData.user.id}`)
    }
    console.log('✅ Real UUID generated via MSW')
    
    // Test 2: Sign in via MSW endpoint  
    console.log('🔑 Testing signin via MSW...')
    const signinResponse = await fetch('http://localhost:5173/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    })
    
    if (!signinResponse.ok) {
      const error = await signinResponse.json()
      throw new Error(`Signin failed: ${error.message}`)
    }
    
    const signinData = await signinResponse.json()
    console.log('✅ MSW signin successful!')
    console.log(`   - Access token length: ${signinData.access_token.length}`)
    
    // Test 3: Get user via MSW endpoint
    console.log('👤 Testing get user via MSW...')
    const getUserResponse = await fetch('http://localhost:5173/auth/v1/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${signinData.access_token}`,
        'Content-Type': 'application/json',
      }
    })
    
    if (!getUserResponse.ok) {
      const error = await getUserResponse.json()
      throw new Error(`Get user failed: ${error.message}`)
    }
    
    const userData = await getUserResponse.json()
    console.log('✅ MSW get user successful!')
    console.log(`   - User ID: ${userData.id}`)
    console.log(`   - Email: ${userData.email}`)
    
    // Test 4: Wrong password via MSW
    console.log('❌ Testing wrong password via MSW...')
    const wrongPasswordResponse = await fetch('http://localhost:5173/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword'
      })
    })
    
    if (wrongPasswordResponse.ok) {
      throw new Error('Wrong password should have been rejected!')
    }
    
    const wrongPasswordError = await wrongPasswordResponse.json()
    console.log('✅ Wrong password correctly rejected via MSW')
    console.log(`   - Error: ${wrongPasswordError.message}`)
    
    // Test 5: Sign out via MSW
    console.log('🚪 Testing signout via MSW...')
    const signoutResponse = await fetch('http://localhost:5173/auth/v1/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${signinData.access_token}`,
        'Content-Type': 'application/json',
      }
    })
    
    if (!signoutResponse.ok) {
      const error = await signoutResponse.json()
      throw new Error(`Signout failed: ${error.message}`)
    }
    
    console.log('✅ MSW signout successful!')
    
    // Test 6: Verify token is invalidated
    console.log('🔒 Testing token invalidation...')
    const invalidTokenResponse = await fetch('http://localhost:5173/auth/v1/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${signinData.access_token}`,
        'Content-Type': 'application/json',
      }
    })
    
    if (invalidTokenResponse.ok) {
      throw new Error('Token should have been invalidated after signout!')
    }
    
    console.log('✅ Token properly invalidated after signout')
    
    console.log('\\n🎉 ALL MSW INTEGRATION TESTS PASSED!')
    console.log('✅ MSW handlers properly use AuthManager')
    console.log('✅ Real authentication via HTTP endpoints')
    console.log('✅ Proper error handling in MSW layer')
    console.log('✅ Session management works via MSW')
    
    return {
      success: true,
      tests: {
        signup: true,
        signin: true,
        getUser: true,
        wrongPassword: true,
        signout: true,
        tokenInvalidation: true
      }
    }
    
  } catch (error) {
    console.error('❌ MSW integration test failed:', error.message)
    return {
      success: false,
      error: error.message
    }
  } finally {
    // Stop the mock server
    server.close()
    console.log('🔧 MSW server stopped')
  }
}

// Run the test
testMSWIntegration().then(result => {
  console.log('\\n📊 MSW Integration Test Results:')
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.success ? 0 : 1)
}).catch(error => {
  console.error('❌ Test runner failed:', error)
  process.exit(1)
})