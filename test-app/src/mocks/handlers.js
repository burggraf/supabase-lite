import { http, HttpResponse } from 'msw'

// Simple in-memory store for testing
let users = []
let sessions = {}
let mfaFactors = {}

// Helper to generate IDs
function generateId() {
  return Math.random().toString(36).substr(2, 9)
}

// Helper to generate JWT-like token (for testing only)
function generateMockToken(userId) {
  const header = btoa(JSON.stringify({ alg: 'ES256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    sub: userId,
    email: `user-${userId}@example.com`,
    role: 'authenticated',
    aal: 'aal1',
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000)
  }))
  const signature = 'mock-signature'
  return `${header}.${payload}.${signature}`
}

export const handlers = [
  // Auth signup
  http.post('http://localhost:5173/auth/v1/signup', async ({ request }) => {
    const body = await request.json()
    const { email, password } = body
    
    if (!email || !password) {
      return HttpResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      )
    }
    
    const userId = generateId()
    const user = {
      id: userId,
      email,
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_metadata: body.options?.data || {},
      app_metadata: { provider: 'email' }
    }
    
    users.push(user)
    
    const accessToken = generateMockToken(userId)
    const refreshToken = generateId()
    
    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user
    }
    
    sessions[accessToken] = session
    
    return HttpResponse.json({
      user,
      session
    })
  }),

  // Auth signin
  http.post('http://localhost:5173/auth/v1/token', async ({ request }) => {
    const url = new URL(request.url)
    const grant_type = url.searchParams.get('grant_type')
    const body = await request.json()
    console.log('Token request - grant_type:', grant_type, 'body:', body)
    const { email, password } = body
    
    if (grant_type === 'password') {
      const user = users.find(u => u.email === email)
      if (!user) {
        return HttpResponse.json(
          { message: 'Invalid login credentials' },
          { status: 400 }
        )
      }
      
      const accessToken = generateMockToken(user.id)
      const refreshToken = generateId()
      
      const session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user
      }
      
      sessions[accessToken] = session
      
      return HttpResponse.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: 3600,
        user
      })
    }
    
    if (grant_type === 'refresh_token') {
      const { refresh_token } = body
      // Simple refresh logic for testing - find user by existing refresh token
      const existingSession = Object.values(sessions).find(s => s.refresh_token === refresh_token)
      if (!existingSession) {
        return HttpResponse.json(
          { message: 'Invalid refresh token' },
          { status: 400 }
        )
      }
      
      const accessToken = generateMockToken(existingSession.user.id)
      const refreshToken = generateId()
      
      const newSession = {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: existingSession.user
      }
      
      sessions[accessToken] = newSession
      
      return HttpResponse.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: 3600,
        user: existingSession.user
      })
    }
    
    return HttpResponse.json(
      { message: 'Unsupported grant type' },
      { status: 400 }
    )
  }),

  // Get user
  http.get('http://localhost:5173/auth/v1/user', async ({ request }) => {
    const authorization = request.headers.get('authorization')
    const token = authorization?.replace('Bearer ', '')
    
    console.log('Get user request - Authorization header:', authorization)
    console.log('Extracted token:', token)
    console.log('Available sessions:', Object.keys(sessions))
    
    const session = sessions[token]
    if (!session) {
      return HttpResponse.json(
        { message: 'Auth session missing!' },
        { status: 401 }
      )
    }
    
    return HttpResponse.json(session.user)
  }),

  // Update user
  http.put('http://localhost:5173/auth/v1/user', async ({ request }) => {
    const authorization = request.headers.get('authorization')
    const token = authorization?.replace('Bearer ', '')
    const body = await request.json()
    
    console.log('Update user request - Authorization header:', authorization)
    console.log('Update user extracted token:', token)
    console.log('Available sessions for update:', Object.keys(sessions))
    
    const session = sessions[token]
    if (!session) {
      return HttpResponse.json(
        { message: 'Auth session missing!' },
        { status: 401 }
      )
    }
    
    // Update user
    const userIndex = users.findIndex(u => u.id === session.user.id)
    if (userIndex !== -1) {
      users[userIndex] = {
        ...users[userIndex],
        ...body,
        updated_at: new Date().toISOString()
      }
      session.user = users[userIndex]
    }
    
    return HttpResponse.json(session.user)
  }),

  // Sign out
  http.post('http://localhost:5173/auth/v1/logout', async ({ request }) => {
    const authorization = request.headers.get('authorization')
    const token = authorization?.replace('Bearer ', '')
    
    if (token && sessions[token]) {
      delete sessions[token]
    }
    
    return HttpResponse.json({})
  }),

  // Password recovery
  http.post('http://localhost:5173/auth/v1/recover', async ({ request }) => {
    const body = await request.json()
    const { email } = body
    
    // For testing, always return success
    return HttpResponse.json({
      message: 'Recovery email sent (mock)'
    })
  }),

  // MFA - List factors
  http.get('http://localhost:5173/auth/v1/factors', async ({ request }) => {
    const authorization = request.headers.get('authorization')
    const token = authorization?.replace('Bearer ', '')
    
    const session = sessions[token]
    if (!session) {
      return HttpResponse.json(
        { message: 'Invalid token' },
        { status: 401 }
      )
    }
    
    const userFactors = mfaFactors[session.user.id] || { totp: [], phone: [] }
    return HttpResponse.json(userFactors)
  }),

  // MFA - Enroll factor
  http.post('http://localhost:5173/auth/v1/factors', async ({ request }) => {
    const authorization = request.headers.get('authorization')
    const token = authorization?.replace('Bearer ', '')
    const body = await request.json()
    
    const session = sessions[token]
    if (!session) {
      return HttpResponse.json(
        { message: 'Invalid token' },
        { status: 401 }
      )
    }
    
    const factorId = generateId()
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
        uri: `otpauth://totp/Test:${session.user.email}?secret=JBSWY3DPEHPK3PXP&issuer=Test`
      }
    }
    
    if (!mfaFactors[session.user.id]) {
      mfaFactors[session.user.id] = { totp: [], phone: [] }
    }
    
    if (body.factorType === 'totp') {
      mfaFactors[session.user.id].totp.push(factor)
    } else if (body.factorType === 'phone') {
      mfaFactors[session.user.id].phone.push(factor)
    }
    
    return HttpResponse.json(factor)
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