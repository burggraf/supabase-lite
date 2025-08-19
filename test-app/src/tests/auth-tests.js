/**
 * Authentication Tests for Supabase Lite Compatibility
 * Tests auth endpoints against both local (MSW) and remote (hosted) environments
 */

export const authTests = {
  // Basic Authentication Tests
  'auth_signup_email': async (supabase) => {
    const testEmail = `test-${Date.now()}@testuser.dev`
    const testPassword = 'TestPassword123!'
    
    console.log(`Testing signup with email: ${testEmail}`)
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: 'Test User',
          test_run: Date.now()
        }
      }
    })

    if (error) throw error

    return {
      success: !!data.user,
      user_id: data.user?.id,
      email: data.user?.email,
      session_exists: !!data.session,
      email_confirmed: data.user?.email_confirmed_at !== null
    }
  },

  'auth_signin_email': async (supabase) => {
    // First create a user for testing
    const testEmail = `signin-test-${Date.now()}@testuser.dev`
    const testPassword = 'TestPassword123!'
    
    console.log(`Testing signin with email: ${testEmail}`)
    
    // Create user first
    await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    })

    // Sign out any existing session
    await supabase.auth.signOut()

    // Now test signin
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    if (error) throw error

    return {
      success: !!data.user,
      user_id: data.user?.id,
      email: data.user?.email,
      session_exists: !!data.session,
      access_token_exists: !!data.session?.access_token
    }
  },

  'auth_signout': async (supabase) => {
    // Ensure we have a session first
    const testEmail = `signout-test-${Date.now()}@testuser.dev`
    const testPassword = 'TestPassword123!'
    
    await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    })

    console.log('Testing signout')
    
    const { error } = await supabase.auth.signOut()
    
    if (error) throw error

    const { data: { user } } = await supabase.auth.getUser()
    
    return {
      success: !user,
      user_cleared: !user
    }
  },

  'auth_get_user': async (supabase) => {
    // Create and signin user first
    const testEmail = `getuser-test-${Date.now()}@testuser.dev`
    const testPassword = 'TestPassword123!'
    
    await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: { name: 'Get User Test' }
      }
    })

    // Sign in explicitly since persistSession is false
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    console.log('Testing get user')
    
    const { data, error } = await supabase.auth.getUser()
    
    if (error) throw error

    return {
      success: !!data.user,
      user_id: data.user?.id,
      email: data.user?.email,
      has_metadata: !!data.user?.user_metadata?.name
    }
  },

  'auth_update_user': async (supabase) => {
    // Create and signin user first
    const testEmail = `update-test-${Date.now()}@testuser.dev`
    const testPassword = 'TestPassword123!'
    
    await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    })

    // Sign in explicitly since persistSession is false
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    console.log('Testing update user')
    
    const { data, error } = await supabase.auth.updateUser({
      data: {
        name: 'Updated Name',
        updated_at: new Date().toISOString()
      }
    })

    if (error) throw error

    return {
      success: !!data.user,
      user_id: data.user?.id,
      has_updated_metadata: data.user?.user_metadata?.name === 'Updated Name'
    }
  },

  'auth_reset_password': async (supabase) => {
    const testEmail = `reset-test-${Date.now()}@testuser.dev`
    
    console.log(`Testing password reset for: ${testEmail}`)
    
    const { error } = await supabase.auth.resetPasswordForEmail(testEmail, {
      redirectTo: 'http://localhost:3001/reset-callback'
    })

    // Note: This should not error even if email doesn't exist (security)
    return {
      success: !error,
      error_message: error?.message || null
    }
  },

  // Session Management Tests
  'auth_refresh_session': async (supabase) => {
    // Create and signin user first
    const testEmail = `refresh-test-${Date.now()}@testuser.dev`
    const testPassword = 'TestPassword123!'
    
    await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    })

    console.log('Testing session refresh')
    
    const { data, error } = await supabase.auth.refreshSession()
    
    if (error) throw error

    return {
      success: !!data.session,
      user_exists: !!data.user,
      access_token_exists: !!data.session?.access_token,
      refresh_token_exists: !!data.session?.refresh_token
    }
  },

  'auth_get_session': async (supabase) => {
    // Create and signin user first
    const testEmail = `session-test-${Date.now()}@testuser.dev`
    const testPassword = 'TestPassword123!'
    
    await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    })

    console.log('Testing get session')
    
    const { data, error } = await supabase.auth.getSession()
    
    if (error) throw error

    return {
      success: !!data.session,
      user_exists: !!data.session?.user,
      access_token_exists: !!data.session?.access_token,
      expires_at_exists: !!data.session?.expires_at
    }
  },

  // MFA Tests (will work differently in local vs remote)
  'auth_mfa_enroll_totp': async (supabase) => {
    // Create and signin user first
    const testEmail = `mfa-test-${Date.now()}@testuser.dev`
    const testPassword = 'TestPassword123!'
    
    await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    })

    console.log('Testing MFA TOTP enrollment')
    
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Test Authenticator'
      })

      if (error) throw error

      return {
        success: !!data,
        factor_id: data?.id,
        qr_code_exists: !!data?.totp?.qr_code,
        secret_exists: !!data?.totp?.secret,
        uri_exists: !!data?.totp?.uri
      }
    } catch (error) {
      // MFA might not be fully implemented in remote
      return {
        success: false,
        error_message: error.message,
        not_implemented: error.message.includes('not implemented') || error.message.includes('404')
      }
    }
  },

  'auth_mfa_list_factors': async (supabase) => {
    // Create and signin user first
    const testEmail = `mfa-list-test-${Date.now()}@testuser.dev`
    const testPassword = 'TestPassword123!'
    
    await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    })

    console.log('Testing MFA list factors')
    
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()

      if (error) throw error

      return {
        success: true,
        totp_factors_count: data?.totp?.length || 0,
        phone_factors_count: data?.phone?.length || 0,
        total_factors: (data?.totp?.length || 0) + (data?.phone?.length || 0)
      }
    } catch (error) {
      return {
        success: false,
        error_message: error.message,
        not_implemented: error.message.includes('not implemented') || error.message.includes('404')
      }
    }
  },

  // JWT and Token Tests
  'auth_jwt_decode': async (supabase) => {
    // Create and signin user first
    const testEmail = `jwt-test-${Date.now()}@testuser.dev`
    const testPassword = 'TestPassword123!'
    
    await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: { test_claim: 'jwt_test' }
      }
    })

    console.log('Testing JWT token structure')
    
    const { data } = await supabase.auth.getSession()
    
    if (!data.session?.access_token) {
      throw new Error('No access token found')
    }

    // Decode JWT payload (client-side decode for testing)
    const token = data.session.access_token
    const parts = token.split('.')
    
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format')
    }

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))

    return {
      success: true,
      has_sub: !!payload.sub,
      has_email: !!payload.email,
      has_role: !!payload.role,
      has_aud: !!payload.aud,
      has_exp: !!payload.exp,
      has_iat: !!payload.iat,
      aal_level: payload.aal,
      role: payload.role,
      expires_at: payload.exp
    }
  },

  // Error Handling Tests
  'auth_invalid_credentials': async (supabase) => {
    console.log('Testing invalid credentials error handling')
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'nonexistent@testuser.dev',
      password: 'wrongpassword'
    })

    // Should have an error
    const hasExpectedError = !!error && (
      error.message.includes('Invalid login credentials') ||
      error.message.includes('invalid_credentials') ||
      error.message.includes('Email not confirmed')
    )

    return {
      success: hasExpectedError,
      error_exists: !!error,
      error_message: error?.message,
      no_user_data: !data.user,
      no_session_data: !data.session
    }
  },

  'auth_weak_password': async (supabase) => {
    const testEmail = `weak-pwd-test-${Date.now()}@testuser.dev`
    
    console.log('Testing weak password validation')
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: '123' // Intentionally weak password
    })

    // Should have an error or warning about weak password
    const hasWeakPasswordHandling = !!error || !!data?.weak_password

    return {
      success: hasWeakPasswordHandling,
      error_exists: !!error,
      weak_password_detected: !!data?.weak_password,
      error_message: error?.message || null,
      weak_password_reasons: data?.weak_password?.reasons || null
    }
  }
}

// Export individual test categories for organization
export const basicAuthTests = {
  'auth_signup_email': authTests['auth_signup_email'],
  'auth_signin_email': authTests['auth_signin_email'],
  'auth_signout': authTests['auth_signout'],
  'auth_get_user': authTests['auth_get_user']
}

export const sessionTests = {
  'auth_get_session': authTests['auth_get_session'],
  'auth_refresh_session': authTests['auth_refresh_session']
}

export const userManagementTests = {
  'auth_update_user': authTests['auth_update_user'],
  'auth_reset_password': authTests['auth_reset_password']
}

export const mfaTests = {
  'auth_mfa_enroll_totp': authTests['auth_mfa_enroll_totp'],
  'auth_mfa_list_factors': authTests['auth_mfa_list_factors']
}

export const jwtTests = {
  'auth_jwt_decode': authTests['auth_jwt_decode']
}

export const errorHandlingTests = {
  'auth_invalid_credentials': authTests['auth_invalid_credentials'],
  'auth_weak_password': authTests['auth_weak_password']
}