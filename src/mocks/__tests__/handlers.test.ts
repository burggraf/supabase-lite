import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from '../handlers'

const testServer = setupServer(...handlers)

beforeAll(() => testServer.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => testServer.resetHandlers())
afterAll(() => testServer.close())

describe('MSW Handlers', () => {
  it('should return hello message from /hello endpoint', async () => {
    const response = await fetch('/hello')
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('message', 'Hello, world.')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('version', '1.0.0')
  })

  it('should return health status from /api/health endpoint', async () => {
    const response = await fetch('/api/health')
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('status', 'ok')
    expect(data).toHaveProperty('timestamp')
  })

  it('should return mock REST API response', async () => {
    const response = await fetch('/rest/v1/users')
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('message', 'REST API for table: users')
    expect(data).toHaveProperty('status', 'mock_response')
  })

  it('should return mock auth token', async () => {
    const response = await fetch('/auth/v1/token', {
      method: 'POST'
    })
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('access_token')
    expect(data).toHaveProperty('token_type', 'bearer')
    expect(data).toHaveProperty('expires_in', 3600)
    expect(data.access_token).toMatch(/^mock_token_/)
  })

  it('should handle different table names in REST API', async () => {
    const response = await fetch('/rest/v1/posts')
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('message', 'REST API for table: posts')
    expect(data).toHaveProperty('status', 'mock_response')
  })
})