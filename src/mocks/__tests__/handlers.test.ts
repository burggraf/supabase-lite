import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock JWTService directly to avoid JOSE library issues in test environment
vi.mock('../../../lib/auth/core/JWTService', () => {
  console.log('🔧 JWTService mock being applied!')
  
  return {
    JWTService: vi.fn().mockImplementation(() => ({
      getInstance: vi.fn().mockReturnThis(),
      initialize: vi.fn().mockResolvedValue(undefined),
      createAccessToken: vi.fn().mockResolvedValue('mock.access.token'),
      createRefreshToken: vi.fn().mockReturnValue('mock.refresh.token'),
      createTokenPair: vi.fn().mockResolvedValue({
        access_token: 'mock.access.token',
        refresh_token: 'mock.refresh.token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: 'user-123',
          email: 'signin@test.com',
          email_verified: false,
          phone_verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          role: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          is_anonymous: false
        }
      }),
      verifyToken: vi.fn().mockResolvedValue({
        sub: 'user-123',
        role: 'authenticated'
      }),
      getJWKS: vi.fn().mockResolvedValue({
        keys: [{
          kty: 'EC',
          kid: 'mock-key-id',
          use: 'sig',
          alg: 'ES256',
          crv: 'P-256',
          x: 'mock-x',
          y: 'mock-y'
        }]
      })
    }))
  }
})

// Note: Using global MSW server from test/setup.ts instead of creating a new one
// This prevents double-handler registration that was causing requests to be processed twice

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks()
  
  // Setup specific mock responses for database operations in tests
  global.mockPGliteInstance.query.mockResolvedValue({ rows: [], affectedRows: 0 })
  global.mockPGliteInstance.exec.mockResolvedValue()
})


describe('Supabase Lite API Handlers', () => {
  it('should return health status from /health endpoint', async () => {
    const response = await fetch('/health')
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('status', 'ok')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('message', 'Supabase Lite API is running')
  })

  it('should handle REST API GET request for users table', async () => {
    const response = await fetch('/rest/v1/users')
    
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('should handle REST API POST request to create user', async () => {
    // Mock the database response for INSERT
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      created_at: new Date().toISOString()
    }
    global.mockPGliteInstance.query.mockResolvedValue({
      rows: [mockUser],
      affectedRows: 1
    })
    
    const newUser = {
      email: 'test@example.com',
      name: 'Test User'
    }
    
    const response = await fetch('/rest/v1/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newUser)
    })
    
    if (response.status !== 201) {
      console.log('POST response status:', response.status)
      const errorData = await response.json()
      console.log('POST response data:', errorData)
    }
    expect(response.status).toBe(201)
    const data = await response.json()
    console.log('POST success data:', data)
    
    // If data is an array, check the first element
    const responseData = Array.isArray(data) ? data[0] : data
    expect(responseData).toHaveProperty('email', 'test@example.com')
    expect(responseData).toHaveProperty('name', 'Test User')
    expect(responseData).toHaveProperty('id')
  })

  it('should handle auth signup request', async () => {
    // Mock the database responses for auth signup
    global.mockPGliteInstance.query
      .mockResolvedValueOnce({ rows: [], affectedRows: 0 }) // Check if user exists (should be empty)
      .mockResolvedValueOnce({ rows: [{ id: 1 }], affectedRows: 1 }) // Insert user
      .mockResolvedValueOnce({ rows: [{ id: 1 }], affectedRows: 1 }) // Insert session
    
    const signupData = {
      email: 'user@test.com',
      password: 'password123'
    }
    
    const response = await fetch('/auth/v1/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(signupData)
    })
    
    if (response.status !== 200) {
      const errorData = await response.json()
      console.error('Signup error:', errorData)
    }
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('access_token')
    expect(data).toHaveProperty('refresh_token')
    expect(data).toHaveProperty('user')
    expect(data.user).toHaveProperty('email', 'user@test.com')
  })

  it('should handle auth signin request', async () => {
    // Mock database responses for signin
    const hashedPassword = '$2b$10$.R9eT89SGtgfPu//pw0l/exjhzf3oFBAiTU5SEXyxTslc5z1WW70S' // bcrypt hash of 'password123'
    const mockUser = {
      id: 'user-123',
      email: 'signin@test.com',
      encrypted_password: hashedPassword,
      raw_user_meta_data: '{}'
    }
    
    // Setup comprehensive mocks - use implementation to handle different query types
    global.mockPGliteInstance.query.mockImplementation((sql: string) => {
      console.log('🔍 Mock DB Query:', sql.substring(0, 50) + '...')
      
      if (sql.includes('SELECT * FROM auth.users WHERE email')) {
        console.log('📧 Mock: User lookup by email')
        return Promise.resolve({ rows: [mockUser], affectedRows: 1 })
      }
      if (sql.includes('SELECT encrypted_password FROM auth.users WHERE id')) {
        console.log('🔐 Mock: Password hash lookup')
        return Promise.resolve({ rows: [{ encrypted_password: hashedPassword }], affectedRows: 1 })
      }
      if (sql.includes('UPDATE auth.users SET last_sign_in_at')) {
        console.log('📅 Mock: Update last signin')
        return Promise.resolve({ rows: [], affectedRows: 1 })
      }
      if (sql.includes('INSERT INTO auth.sessions') || sql.includes('session')) {
        console.log('🎫 Mock: Create session')
        return Promise.resolve({ rows: [{ id: 'session-123' }], affectedRows: 1 })
      }
      if (sql.includes('INSERT INTO auth.refresh_tokens')) {
        console.log('🔄 Mock: Create refresh token')
        return Promise.resolve({ rows: [{ token: 'refresh-token-123' }], affectedRows: 1 })
      }
      
      console.log('❓ Mock: Unknown query, returning empty')
      return Promise.resolve({ rows: [], affectedRows: 0 })
    })
    
    const signinData = {
      email: 'signin@test.com',
      password: 'password123'
    }
    
    const response = await fetch('/auth/v1/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(signinData)
    })
    
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('access_token')
    expect(data).toHaveProperty('refresh_token')
    expect(data).toHaveProperty('user')
    expect(data.user).toHaveProperty('email', 'signin@test.com')
  })

  it('should handle PostgREST query parameters', async () => {
    // Test with select parameter
    const response = await fetch('/rest/v1/users?select=id,email')
    
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('should handle CORS preflight requests', async () => {
    const response = await fetch('/rest/v1/users', {
      method: 'OPTIONS'
    })
    
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})