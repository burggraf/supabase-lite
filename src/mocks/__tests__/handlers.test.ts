import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from '../handlers'

const testServer = setupServer(...handlers)

beforeAll(() => testServer.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => testServer.resetHandlers())
afterAll(() => testServer.close())

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
    
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data).toHaveProperty('email', 'test@example.com')
    expect(data).toHaveProperty('name', 'Test User')
    expect(data).toHaveProperty('id')
  })

  it('should handle auth signup request', async () => {
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
    
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('access_token')
    expect(data).toHaveProperty('refresh_token')
    expect(data).toHaveProperty('user')
    expect(data.user).toHaveProperty('email', 'user@test.com')
  })

  it('should handle auth signin request', async () => {
    // First signup a user
    const signupData = {
      email: 'signin@test.com',
      password: 'password123'
    }
    
    await fetch('/auth/v1/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(signupData)
    })
    
    // Then try to sign in
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