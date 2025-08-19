import { http, HttpResponse } from 'msw'
import authManager from '../lib/auth/AuthManager.js'

// Sample orders data for testing
let orders = [
  {
    id: 1001,
    user_id: null, // Will be set when user signs in
    items: 'Laptop, Mouse',
    total: 1299.99,
    status: 'completed',
    order_date: '2025-01-15T10:30:00Z',
    created_at: '2025-01-15T10:30:00Z',
    updated_at: '2025-01-15T10:30:00Z'
  },
  {
    id: 1002,
    user_id: null,
    items: 'Keyboard, Monitor',
    total: 449.99,
    status: 'shipped',
    order_date: '2025-01-10T14:20:00Z',
    created_at: '2025-01-10T14:20:00Z',
    updated_at: '2025-01-10T14:20:00Z'
  },
  {
    id: 1003,
    user_id: null,
    items: 'Desk, Chair',
    total: 899.99,
    status: 'pending',
    order_date: '2025-01-08T09:15:00Z',
    created_at: '2025-01-08T09:15:00Z',
    updated_at: '2025-01-08T09:15:00Z'
  }
]

// MFA factors for testing (keeping simple structure for now)
let mfaFactors = {}

// Helper to extract authorization token
function getAuthToken(request) {
  const authorization = request.headers.get('authorization')
  return authorization?.replace('Bearer ', '')
}

// Helper to get user from token using AuthManager
function getUserFromToken(token) {
  return authManager.getUserFromToken(token)
}

export const handlers = [
  // PostgREST API - Orders table
  http.get('http://localhost:5173/rest/v1/orders', async ({ request }) => {
    // Debug: Log all headers to see what Supabase is sending
    console.log('🔍 MSW: Orders request intercepted!')
    console.log('Orders request headers:', Object.fromEntries(request.headers.entries()))
    
    const token = getAuthToken(request)
    console.log('Extracted token:', token)
    console.log('Token type:', typeof token)
    console.log('Token length:', token?.length || 0)
    
    const user = getUserFromToken(token)
    console.log('User from token:', user)
    console.log('Available sessions:', Object.keys(sessions))
    
    if (!user) {
      return HttpResponse.json(
        { message: 'Authorization required' },
        { status: 401 }
      )
    }
    
    // Return orders for the current user
    const userOrders = orders.map(order => ({
      ...order,
      user_id: user.id // Associate orders with current user
    }))
    
    return HttpResponse.json(userOrders, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Range': `0-${userOrders.length - 1}/${userOrders.length}`
      }
    })
  }),

  http.post('http://localhost:5173/rest/v1/orders', async ({ request }) => {
    const token = getAuthToken(request)
    const user = getUserFromToken(token)
    
    if (!user) {
      return HttpResponse.json(
        { message: 'Authorization required' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const newOrder = {
      id: Math.max(...orders.map(o => o.id)) + 1,
      user_id: user.id,
      items: body.items,
      total: body.total,
      status: body.status || 'pending',
      order_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    orders.push(newOrder)
    
    return HttpResponse.json([newOrder], {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }),

  // Auth signup
  http.post('http://localhost:5173/auth/v1/signup', async ({ request }) => {
    try {
      const body = await request.json()
      const { email, password, options } = body
      
      console.log('🔐 MSW: Signup request for:', email)
      
      const result = await authManager.signUp({
        email,
        password,
        options
      })
      
      console.log('✅ MSW: Signup successful for user:', result.user.id)
      
      return HttpResponse.json(result)
    } catch (error) {
      console.error('❌ MSW: Signup failed:', error.message)
      return HttpResponse.json(
        { message: error.message },
        { status: 400 }
      )
    }
  }),

  // Auth signin
  http.post('http://localhost:5173/auth/v1/token', async ({ request }) => {
    try {
      const url = new URL(request.url)
      const grant_type = url.searchParams.get('grant_type')
      const body = await request.json()
      
      console.log('🔐 MSW: Token request - grant_type:', grant_type)
      
      if (grant_type === 'password') {
        const { email, password } = body
        
        console.log('🔐 MSW: Signin request for:', email)
        
        const result = await authManager.signIn({
          email,
          password
        })
        
        console.log('✅ MSW: Signin successful for user:', result.user.id)
        
        return HttpResponse.json(result)
      }
      
      if (grant_type === 'refresh_token') {
        const { refresh_token } = body
        
        console.log('🔐 MSW: Refresh token request')
        
        const result = await authManager.refreshToken(refresh_token)
        
        console.log('✅ MSW: Token refresh successful')
        
        return HttpResponse.json(result)
      }
      
      return HttpResponse.json(
        { message: 'Unsupported grant type' },
        { status: 400 }
      )
    } catch (error) {
      console.error('❌ MSW: Token request failed:', error.message)
      return HttpResponse.json(
        { message: error.message },
        { status: 400 }
      )
    }
  }),

  // Get user
  http.get('http://localhost:5173/auth/v1/user', async ({ request }) => {
    try {
      const token = getAuthToken(request)
      
      console.log('🔐 MSW: Get user request')
      
      if (!token) {
        return HttpResponse.json(
          { message: 'Authorization token missing' },
          { status: 401 }
        )
      }
      
      const user = getUserFromToken(token)
      if (!user) {
        return HttpResponse.json(
          { message: 'Auth session missing!' },
          { status: 401 }
        )
      }
      
      console.log('✅ MSW: User retrieved:', user.email)
      
      return HttpResponse.json(user)
    } catch (error) {
      console.error('❌ MSW: Get user failed:', error.message)
      return HttpResponse.json(
        { message: 'Internal server error' },
        { status: 500 }
      )
    }
  }),

  // Update user
  http.put('http://localhost:5173/auth/v1/user', async ({ request }) => {
    try {
      const token = getAuthToken(request)
      const body = await request.json()
      
      console.log('🔐 MSW: Update user request')
      
      if (!token) {
        return HttpResponse.json(
          { message: 'Authorization token missing' },
          { status: 401 }
        )
      }
      
      const updatedUser = await authManager.updateUser(token, body)
      
      console.log('✅ MSW: User updated:', updatedUser.email)
      
      return HttpResponse.json(updatedUser)
    } catch (error) {
      console.error('❌ MSW: Update user failed:', error.message)
      const status = error.message === 'Auth session missing!' ? 401 : 500
      return HttpResponse.json(
        { message: error.message },
        { status }
      )
    }
  }),

  // Sign out
  http.post('http://localhost:5173/auth/v1/logout', async ({ request }) => {
    try {
      const token = getAuthToken(request)
      
      console.log('🔐 MSW: Sign out request')
      
      if (token) {
        await authManager.signOut(token)
        console.log('✅ MSW: Sign out successful')
      }
      
      return HttpResponse.json({})
    } catch (error) {
      console.error('❌ MSW: Sign out failed:', error.message)
      // Still return success for sign out even if there's an error
      return HttpResponse.json({})
    }
  }),

  // Password recovery
  http.post('http://localhost:5173/auth/v1/recover', async ({ request }) => {
    try {
      const body = await request.json()
      const { email } = body
      
      console.log('🔐 MSW: Password recovery request for:', email)
      
      const result = await authManager.resetPasswordForEmail(email)
      
      console.log('✅ MSW: Password recovery request processed')
      
      return HttpResponse.json(result)
    } catch (error) {
      console.error('❌ MSW: Password recovery failed:', error.message)
      return HttpResponse.json(
        { message: error.message },
        { status: 400 }
      )
    }
  }),

  // MFA - List factors
  http.get('http://localhost:5173/auth/v1/factors', async ({ request }) => {
    try {
      const token = getAuthToken(request)
      
      console.log('🔐 MSW: List MFA factors request')
      
      if (!token) {
        return HttpResponse.json(
          { message: 'Authorization token missing' },
          { status: 401 }
        )
      }
      
      const user = getUserFromToken(token)
      if (!user) {
        return HttpResponse.json(
          { message: 'Invalid token' },
          { status: 401 }
        )
      }
      
      const userFactors = mfaFactors[user.id] || { totp: [], phone: [] }
      
      console.log('✅ MSW: MFA factors retrieved for user:', user.id)
      
      return HttpResponse.json(userFactors)
    } catch (error) {
      console.error('❌ MSW: List MFA factors failed:', error.message)
      return HttpResponse.json(
        { message: 'Internal server error' },
        { status: 500 }
      )
    }
  }),

  // MFA - Enroll factor
  http.post('http://localhost:5173/auth/v1/factors', async ({ request }) => {
    try {
      const token = getAuthToken(request)
      const body = await request.json()
      
      console.log('🔐 MSW: Enroll MFA factor request')
      
      if (!token) {
        return HttpResponse.json(
          { message: 'Authorization token missing' },
          { status: 401 }
        )
      }
      
      const user = getUserFromToken(token)
      if (!user) {
        return HttpResponse.json(
          { message: 'Invalid token' },
          { status: 401 }
        )
      }
      
      const factorId = crypto.randomUUID()
      const factor = {
        id: factorId,
        type: body.factorType,
        friendly_name: body.friendlyName,
        status: 'unverified'
      }
      
      if (body.factorType === 'totp') {
        factor.totp = {
          qr_code: 'data:image/png;base64,mock-qr-code',
          secret: 'JBSWY3DPEHPK3PXP',
          uri: `otpauth://totp/Test:${user.email}?secret=JBSWY3DPEHPK3PXP&issuer=Test`
        }
      }
      
      if (!mfaFactors[user.id]) {
        mfaFactors[user.id] = { totp: [], phone: [] }
      }
      
      if (body.factorType === 'totp') {
        mfaFactors[user.id].totp.push(factor)
      } else if (body.factorType === 'phone') {
        mfaFactors[user.id].phone.push(factor)
      }
      
      console.log('✅ MSW: MFA factor enrolled for user:', user.id)
      
      return HttpResponse.json(factor)
    } catch (error) {
      console.error('❌ MSW: Enroll MFA factor failed:', error.message)
      return HttpResponse.json(
        { message: 'Internal server error' },
        { status: 500 }
      )
    }
  }),


  // Catch-all to log unhandled requests
  http.all('http://localhost:5173/auth/v1/*', async ({ request }) => {
    console.log('Unhandled auth request:', request.method, request.url)
    const body = await request.text()
    console.log('Request body:', body)
    return HttpResponse.json(
      { message: 'Endpoint not implemented in MSW' },
      { status: 404 }
    )
  }),

  // CORS preflight
  http.options('*', () => {
    return new HttpResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
      },
    })
  })
]