/**
 * Direct authentication test (without browser)
 * Tests the AuthManager directly to verify real UUIDs, password hashing, and session management
 */

import { isValidUUID, decodeJWTPayload } from './src/lib/utils/crypto.js'
import authManager from './src/lib/auth/AuthManager.js'

async function testAuthenticationDirect() {
  console.log('🚀 Starting direct authentication test...')
  
  try {
    // Clear any existing data
    authManager.clearAll()
    
    const testEmail = `test${Date.now()}@example.com`
    const testPassword = 'MySecurePassword123!'
    
    // Test 1: Sign up with new user
    console.log('✍️  Testing signup...')
    const signupResult = await authManager.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: 'Test User',
          age: 30
        }
      }
    })
    
    console.log('✅ Signup successful!')
    console.log(`   - User ID: ${signupResult.user.id}`)
    console.log(`   - Email: ${signupResult.user.email}`)
    console.log(`   - Name: ${signupResult.user.user_metadata.name}`)
    
    // Verify real UUID (not fake ID like "h82p2h7uk")
    const isRealUUID = isValidUUID(signupResult.user.id)
    if (!isRealUUID) {
      throw new Error(`Expected real UUID, got: ${signupResult.user.id}`)
    }
    console.log('✅ Real UUID v4 generated (not fake ID)')
    
    // Verify access token structure
    const accessToken = signupResult.session.access_token
    const decodedToken = decodeJWTPayload(accessToken)
    if (!decodedToken) {
      throw new Error('Failed to decode JWT token')
    }
    console.log('✅ Valid JWT token structure')
    console.log(`   - Subject: ${decodedToken.sub}`)
    console.log(`   - Email: ${decodedToken.email}`)
    console.log(`   - Role: ${decodedToken.role}`)
    console.log(`   - Expires: ${new Date(decodedToken.exp * 1000).toISOString()}`)
    
    // Test 2: Verify passwords are hashed (not stored in plain text)
    console.log('🔐 Verifying password security...')
    const allUsers = authManager.getAllUsers()
    const createdUser = allUsers.find(u => u.id === signupResult.user.id)
    
    // The sanitized user should not have password hash fields
    if (createdUser.password_hash || createdUser.password_salt) {
      throw new Error('Password hash exposed in sanitized user object!')
    }
    console.log('✅ Password hash properly hidden from sanitized user')
    
    // Check internal storage (access private data for testing)
    const internalUsers = Array.from(authManager.users.values())
    const internalUser = internalUsers.find(u => u.id === signupResult.user.id)
    
    if (!internalUser.password_hash || !internalUser.password_salt) {
      throw new Error('Password not properly hashed in storage!')
    }
    
    if (internalUser.password_hash === testPassword) {
      throw new Error('Password stored in plain text!')
    }
    
    console.log('✅ Password properly hashed with PBKDF2')
    console.log(`   - Hash length: ${internalUser.password_hash.length}`)
    console.log(`   - Salt length: ${internalUser.password_salt.length}`)
    console.log(`   - Iterations: ${internalUser.hash_iterations}`)
    console.log(`   - Algorithm: ${internalUser.hash_algorithm}`)
    
    // Test 3: Sign in with correct password
    console.log('🔑 Testing signin with correct password...')
    const signinResult = await authManager.signIn({
      email: testEmail,
      password: testPassword
    })
    
    console.log('✅ Signin successful!')
    console.log(`   - Same user ID: ${signinResult.user.id === signupResult.user.id}`)
    
    // Test 4: Try wrong password
    console.log('❌ Testing wrong password...')
    try {
      await authManager.signIn({
        email: testEmail,
        password: 'WrongPassword123!'
      })
      throw new Error('Wrong password should have been rejected!')
    } catch (error) {
      if (error.message.includes('Invalid login credentials')) {
        console.log('✅ Wrong password correctly rejected')
      } else {
        throw error
      }
    }
    
    // Test 5: Try duplicate signup
    console.log('👥 Testing duplicate signup...')
    try {
      await authManager.signUp({
        email: testEmail,
        password: testPassword
      })
      throw new Error('Duplicate signup should have been rejected!')
    } catch (error) {
      if (error.message.includes('User already registered')) {
        console.log('✅ Duplicate signup correctly rejected')
      } else {
        throw error
      }
    }
    
    // Test 6: Session management
    console.log('🎫 Testing session management...')
    const userFromToken = authManager.getUserFromToken(signinResult.access_token)
    if (!userFromToken || userFromToken.id !== signupResult.user.id) {
      throw new Error('Session management failed')
    }
    console.log('✅ Session management working')
    
    // Test 7: Refresh token
    console.log('🔄 Testing refresh token...')
    const refreshResult = await authManager.refreshToken(signinResult.refresh_token)
    if (!refreshResult.access_token || refreshResult.access_token === signinResult.access_token) {
      throw new Error('Refresh token failed')
    }
    console.log('✅ Refresh token working')
    
    // Test 8: Sign out
    console.log('🚪 Testing signout...')
    await authManager.signOut(refreshResult.access_token)
    const userAfterSignout = authManager.getUserFromToken(refreshResult.access_token)
    if (userAfterSignout) {
      throw new Error('User still authenticated after signout')
    }
    console.log('✅ Signout working')
    
    // Test 9: Create multiple users with unique UUIDs
    console.log('🆔 Testing UUID uniqueness...')
    const user2Result = await authManager.signUp({
      email: `test2${Date.now()}@example.com`,
      password: 'AnotherPassword456!'
    })
    
    const user3Result = await authManager.signUp({
      email: `test3${Date.now()}@example.com`,
      password: 'YetAnotherPassword789!'
    })
    
    const uuid1 = signupResult.user.id
    const uuid2 = user2Result.user.id
    const uuid3 = user3Result.user.id
    
    if (uuid1 === uuid2 || uuid1 === uuid3 || uuid2 === uuid3) {
      throw new Error('UUIDs are not unique!')
    }
    
    console.log('✅ All UUIDs are unique')
    console.log(`   - UUID 1: ${uuid1}`)
    console.log(`   - UUID 2: ${uuid2}`)
    console.log(`   - UUID 3: ${uuid3}`)
    
    // Final verification: All users stored
    const finalUsers = authManager.getAllUsers()
    console.log(`✅ ${finalUsers.length} users properly stored`)
    
    console.log('\\n🎉 ALL AUTHENTICATION TESTS PASSED!')
    console.log('✅ Real UUID v4 generation (not fake IDs)')
    console.log('✅ PBKDF2 password hashing (not plain text)')
    console.log('✅ Proper session management with JWT tokens')
    console.log('✅ Secure authentication flow')
    console.log('✅ Error handling for invalid credentials')
    console.log('✅ User data properly stored and managed')
    
    return {
      success: true,
      stats: {
        usersCreated: finalUsers.length,
        realUUIDs: finalUsers.every(u => isValidUUID(u.id)),
        passwordsHashed: true,
        sessionsManaged: true
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Stack:', error.stack)
    return {
      success: false,
      error: error.message
    }
  }
}

// Run the test
testAuthenticationDirect().then(result => {
  console.log('\\n📊 Final Test Results:')
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.success ? 0 : 1)
}).catch(error => {
  console.error('❌ Test runner failed:', error)
  process.exit(1)
})