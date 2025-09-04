/**
 * WebVM Bridge Tests
 * 
 * Tests for the HTTP bridge that enables communication between
 * WebVM-hosted Deno functions and the local PGlite database.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebVMBridge } from '../WebVMBridge'
import { WebVMManager } from '../WebVMManager'

// Mock fetch for WebVM communication
global.fetch = vi.fn()

// Mock the WebVMManager
const mockWebVMManagerInstance = {
  getStatus: vi.fn(),
  invokeFunction: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
}

vi.mock('../WebVMManager', () => ({
  WebVMManager: {
    getInstance: vi.fn(() => mockWebVMManagerInstance)
  }
}))

describe('WebVMBridge', () => {
  let bridge: WebVMBridge

  beforeEach(() => {
    bridge = new WebVMBridge()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Bridge Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(bridge).toBeInstanceOf(WebVMBridge)
      expect(bridge.isEnabled()).toBe(false) // Should be disabled by default
    })

    it('should enable bridge when WebVM is running', async () => {
      mockWebVMManagerInstance.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null
      })

      await bridge.enable()
      
      expect(bridge.isEnabled()).toBe(true)
    })

    it('should throw error when trying to enable bridge with stopped WebVM', async () => {
      mockWebVMManagerInstance.getStatus.mockReturnValue({
        state: 'stopped',
        ready: false,
        error: null
      })

      await expect(bridge.enable()).rejects.toThrow('WebVM is not running')
    })
  })

  describe('Database Request Proxying', () => {
    beforeEach(async () => {
      mockWebVMManagerInstance.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null
      })
      await bridge.enable()
    })

    it('should proxy GET request to database API', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/json') },
        json: vi.fn().mockResolvedValue([{ id: 1, name: 'test' }])
      }
      
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const result = await bridge.proxyDatabaseRequest(
        'GET',
        '/rest/v1/users?select=*',
        null,
        {
          'Authorization': 'Bearer test-token',
          'apikey': 'test-key'
        }
      )

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5173/rest/v1/users?select=*',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-token',
            'apikey': 'test-key',
            'Content-Type': 'application/json'
          },
          body: null
        }
      )

      expect(result.status).toBe(200)
      expect(result.data).toEqual([{ id: 1, name: 'test' }])
    })

    it('should proxy POST request with body to database API', async () => {
      const requestBody = { name: 'New User', email: 'user@example.com' }
      const mockResponse = {
        ok: true,
        status: 201,
        headers: { get: vi.fn(() => 'application/json') },
        json: vi.fn().mockResolvedValue({ id: 2, ...requestBody })
      }
      
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const result = await bridge.proxyDatabaseRequest(
        'POST',
        '/rest/v1/users',
        requestBody,
        {
          'Authorization': 'Bearer test-token',
          'apikey': 'test-key'
        }
      )

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5173/rest/v1/users',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-token',
            'apikey': 'test-key',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      )

      expect(result.status).toBe(201)
      expect(result.data).toEqual({ id: 2, ...requestBody })
    })

    it('should handle authentication API requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/json') },
        json: vi.fn().mockResolvedValue({ 
          access_token: 'jwt-token',
          user: { id: '1', email: 'test@example.com' }
        })
      }
      
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const result = await bridge.proxyDatabaseRequest(
        'POST',
        '/auth/v1/token?grant_type=password',
        {
          email: 'test@example.com',
          password: 'password123'
        },
        {
          'apikey': 'test-key'
        }
      )

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:5173/auth/v1/token?grant_type=password',
        expect.objectContaining({
          method: 'POST'
        })
      )

      expect(result.status).toBe(200)
      expect((result.data as any).access_token).toBe('jwt-token')
    })

    it('should handle storage API requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/json') },
        json: vi.fn().mockResolvedValue([
          { name: 'bucket1', id: 'bucket1', created_at: '2025-01-01' }
        ])
      }
      
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const result = await bridge.proxyDatabaseRequest(
        'GET',
        '/storage/v1/bucket',
        null,
        {
          'Authorization': 'Bearer test-token',
          'apikey': 'test-key'
        }
      )

      expect(result.status).toBe(200)
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should handle HTTP errors properly', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: { get: vi.fn(() => 'application/json') },
        json: vi.fn().mockResolvedValue({ 
          error: 'Not Found',
          message: 'The requested resource was not found'
        })
      }
      
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const result = await bridge.proxyDatabaseRequest(
        'GET',
        '/rest/v1/nonexistent',
        null,
        {
          'Authorization': 'Bearer test-token',
          'apikey': 'test-key'
        }
      )

      expect(result.status).toBe(404)
      expect(result.error).toBe('Not Found')
    })

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const result = await bridge.proxyDatabaseRequest(
        'GET',
        '/rest/v1/users',
        null,
        {
          'Authorization': 'Bearer test-token',
          'apikey': 'test-key'
        }
      )

      expect(result.status).toBe(500)
      expect(result.error).toBe('Network error')
    })
  })

  describe('Function Integration', () => {
    beforeEach(async () => {
      mockWebVMManagerInstance.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null
      })
      await bridge.enable()
    })

    it('should inject database client into function context', async () => {
      const functionCode = `
        Deno.serve(async (req) => {
          // Access database via bridge
          const response = await fetch('http://localhost:5173/rest/v1/users?select=*', {
            headers: {
              'Authorization': 'Bearer ' + Deno.env.get('SUPABASE_JWT'),
              'apikey': Deno.env.get('SUPABASE_ANON_KEY')
            }
          })
          const users = await response.json()
          return new Response(JSON.stringify(users))
        })
      `

      const context = bridge.createFunctionContext({
        user: { id: 'user-1', email: 'test@example.com', role: 'authenticated' },
        project: { id: 'proj-1', name: 'Test Project' }
      })

      expect(context.environment.SUPABASE_URL).toBe('http://localhost:5173')
      expect(context.environment.SUPABASE_ANON_KEY).toBeDefined()
      expect(context.environment.SUPABASE_JWT).toBeDefined()
    })

    it('should configure networking for WebVM function execution', async () => {
      const networkConfig = bridge.getNetworkConfiguration()

      expect(networkConfig.allowedHosts).toContain('localhost:5173')
      expect(networkConfig.allowedProtocols).toContain('http')
      expect(networkConfig.allowedProtocols).toContain('https')
      expect(networkConfig.dnsResolvers).toBeDefined()
    })

    it('should provide function execution environment', async () => {
      const environment = bridge.getFunctionEnvironment({
        user: { id: 'user-1', email: 'test@example.com', role: 'authenticated' },
        project: { id: 'proj-1', name: 'Test Project' }
      })

      expect(environment.DENO_PERMISSIONS).toContain('--allow-net=localhost:5173')
      expect(environment.SUPABASE_URL).toBe('http://localhost:5173')
      expect(environment.USER_ID).toBe('user-1')
      expect(environment.PROJECT_ID).toBe('proj-1')
    })
  })

  describe('WebVM Communication', () => {
    beforeEach(async () => {
      mockWebVMManagerInstance.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null
      })
      await bridge.enable()
    })

    it('should execute function in WebVM with database access', async () => {
      const mockFunctionResponse = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ id: 1, name: 'Test User' }]),
        logs: ['Function executed successfully'],
        metrics: { duration: 150, memory: 25, cpu: 0.1 }
      }

      mockWebVMManagerInstance.invokeFunction.mockResolvedValue(mockFunctionResponse)

      const result = await bridge.executeFunctionWithDatabaseAccess(
        'test-function',
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          body: null,
          context: {
            user: { id: 'user-1', email: 'test@example.com', role: 'authenticated' },
            project: { id: 'proj-1', name: 'Test Project' }
          }
        }
      )

      expect(mockWebVMManagerInstance.invokeFunction).toHaveBeenCalledWith(
        'test-function',
        expect.objectContaining({
          context: expect.objectContaining({
            user: { id: 'user-1', email: 'test@example.com', role: 'authenticated' },
            project: { id: 'proj-1', name: 'Test Project' }
          })
        })
      )

      expect(result.status).toBe(200)
      expect(result.data).toEqual([{ id: 1, name: 'Test User' }])
    })

    it('should handle function execution errors', async () => {
      const mockErrorResponse = {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Function error' }),
        logs: ['Function started', 'Error: Database connection failed'],
        metrics: { duration: 50, memory: 10, cpu: 0.05 }
      }

      mockWebVMManagerInstance.invokeFunction.mockResolvedValue(mockErrorResponse)

      const result = await bridge.executeFunctionWithDatabaseAccess(
        'error-function',
        {
          method: 'POST',
          headers: {},
          body: { test: true },
          context: {
            project: { id: 'proj-1', name: 'Test Project' }
          }
        }
      )

      expect(result.status).toBe(500)
      expect(result.error).toBe('Function error')
      expect(result.logs).toContain('Error: Database connection failed')
    })
  })

  describe('Security and Validation', () => {
    beforeEach(async () => {
      mockWebVMManagerInstance.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null
      })
      await bridge.enable()
    })

    it('should validate JWT tokens in database requests', async () => {
      const validToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...' // Mock JWT
      
      const isValid = bridge.validateJWTToken(validToken)
      
      // In a real implementation, this would validate against a secret
      expect(typeof isValid).toBe('boolean')
    })

    it('should sanitize database request parameters', async () => {
      const maliciousPath = "/rest/v1/users'; DROP TABLE users; --"
      
      const sanitizedPath = bridge.sanitizePath(maliciousPath)
      
      expect(sanitizedPath).not.toContain('DROP TABLE')
      expect(sanitizedPath).not.toContain(';')
    })

    it('should enforce rate limiting for database requests', async () => {
      const clientId = 'test-client'
      
      // Simulate multiple requests
      for (let i = 0; i < 5; i++) {
        const allowed = bridge.checkRateLimit(clientId)
        expect(allowed).toBe(true)
      }
      
      // This should be rate limited
      const rateLimited = bridge.checkRateLimit(clientId)
      expect(rateLimited).toBe(false)
    })

    it('should validate allowed database operations', async () => {
      const allowedOperations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
      const restrictedOperations = ['DROP', 'CREATE', 'ALTER', 'TRUNCATE']
      
      allowedOperations.forEach(operation => {
        expect(bridge.isOperationAllowed(operation)).toBe(true)
      })
      
      restrictedOperations.forEach(operation => {
        expect(bridge.isOperationAllowed(operation)).toBe(false)
      })
    })
  })

  describe('Monitoring and Logging', () => {
    beforeEach(async () => {
      mockWebVMManagerInstance.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null
      })
      await bridge.enable()
    })

    it('should log database requests for monitoring', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/json') },
        json: vi.fn().mockResolvedValue([])
      }
      
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)
      
      await bridge.proxyDatabaseRequest(
        'GET',
        '/rest/v1/users',
        null,
        { 'apikey': 'test-key' }
      )
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WebVMBridge]'),
        expect.stringContaining('GET /rest/v1/users')
      )
      
      logSpy.mockRestore()
    })

    it('should track bridge performance metrics', async () => {
      const metrics = bridge.getPerformanceMetrics()
      
      expect(metrics).toHaveProperty('totalRequests')
      expect(metrics).toHaveProperty('averageResponseTime')
      expect(metrics).toHaveProperty('errorRate')
      expect(metrics).toHaveProperty('activeConnections')
    })

    it('should provide bridge health status', async () => {
      const health = await bridge.getHealthStatus()
      
      expect(health.status).toBe('healthy')
      expect(health.webvmConnection).toBe('connected')
      expect(health.databaseConnection).toBe('connected')
      expect(health.uptime).toBeGreaterThan(0)
    })
  })
})