import '@testing-library/jest-dom'
import { afterEach, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from '../mocks/server'

// Memory cleanup utilities
function forceGarbageCollection() {
  if (global.gc) {
    global.gc()
  }
}

function clearModuleCache() {
  // Clear any module cache that might be holding references
  if (typeof jest !== 'undefined' && jest.resetModules) {
    jest.resetModules()
  }
}

// Start server before all tests with optimized settings
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'bypass',
    quiet: true // Reduce logging overhead
  })
})

// Enhanced cleanup after each test
afterEach(() => {
  // Reset MSW handlers first
  server.resetHandlers()
  
  // Clean up React Testing Library
  cleanup()
  
  // Clear all mocks
  vi.clearAllMocks()
  
  // Clear any timers
  vi.clearAllTimers()
  
  // Force garbage collection if available (for memory-intensive tests)
  if (process.env.NODE_ENV === 'test' && global.gc) {
    forceGarbageCollection()
  }
})

// Comprehensive cleanup after all tests
afterAll(async () => {
  // Close MSW server
  server.close()
  
  // Clear module cache
  clearModuleCache()
  
  // Final garbage collection
  forceGarbageCollection()
})

// Mock crypto.randomUUID if not available
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => Math.random().toString(36).substring(2, 15),
    subtle: {
      digest: vi.fn().mockImplementation(async (_algorithm, _data) => {
        // Simple mock hash - return a consistent hash for 'Password123$'
        const hashForPassword123$ = new Uint8Array([
          0xef, 0x92, 0xb7, 0x78, 0xba, 0xfe, 0x77, 0x1e,
          0x89, 0x24, 0x5b, 0x89, 0xec, 0xbc, 0x08, 0xa4,
          0x4a, 0x4e, 0x16, 0x6c, 0x06, 0x65, 0x99, 0x11,
          0x88, 0x1f, 0x38, 0x3d, 0x44, 0x73, 0xe9, 0x4f
        ])
        return hashForPassword123$.buffer
      }),
      importKey: vi.fn().mockImplementation(async (_format: string, _keyData: any, algorithm: any, extractable: boolean, keyUsages: string[]) => {
        // Return a mock key object
        return {
          algorithm,
          extractable,
          type: 'secret',
          usages: keyUsages
        }
      }),
      sign: vi.fn().mockImplementation(async (_algorithm: any, key: any, data: any) => {
        // Mock signature that varies based on key and data
        // const encoder = new TextEncoder()
        const keyStr = JSON.stringify(key)
        const dataStr = new TextDecoder().decode(data)

        // Create a simple hash-like signature based on key and data
        let hash = 0
        const combined = keyStr + dataStr
        for (let i = 0; i < combined.length; i++) {
          hash = ((hash << 5) - hash + combined.charCodeAt(i)) & 0xffffffff
        }

        // Generate 32-byte signature based on hash
        const signature = new Uint8Array(32)
        for (let i = 0; i < 32; i++) {
          signature[i] = (hash + i) & 0xff
        }

        return signature.buffer
      }),
      generateKey: vi.fn().mockImplementation(async (algorithm, extractable, keyUsages) => {
        // Return a mock ES256 key pair
        const privateKey = {
          algorithm,
          extractable,
          type: 'private',
          usages: (keyUsages as string[]).filter((usage: any) => ['sign'].includes(usage))
        }
        const publicKey = {
          algorithm,
          extractable,
          type: 'public',
          usages: (keyUsages as string[]).filter((usage: any) => ['verify'].includes(usage))
        }
        return { privateKey, publicKey }
      }),
      exportKey: vi.fn().mockImplementation(async (format, key) => {
        // Return mock JWK for public keys
        if (format === 'jwk' && key.type === 'public') {
          return {
            kty: 'EC',
            crv: 'P-256',
            x: 'mock-x-coordinate',
            y: 'mock-y-coordinate',
            use: 'sig',
            alg: 'ES256'
          }
        }
        throw new Error(`Unsupported format: ${format}`)
      })
    }
  }
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock performance.now
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now())
  }
})

// Mock ResizeObserver for Radix UI components
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock additional DOM APIs required by Radix UI components
Object.defineProperty(Element.prototype, 'hasPointerCapture', {
  value: vi.fn().mockReturnValue(false),
  writable: true
})

Object.defineProperty(Element.prototype, 'setPointerCapture', {
  value: vi.fn(),
  writable: true
})

Object.defineProperty(Element.prototype, 'releasePointerCapture', {
  value: vi.fn(),
  writable: true
})

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true
})

// Mock AbortController for WebVM Database Bridge
if (typeof global.AbortController === 'undefined') {
  class MockAbortController {
    signal = {
      aborted: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }
    
    abort() {
      this.signal.aborted = true
    }
  }
  
  global.AbortController = MockAbortController as any
}

// Mock parent window and postMessage for WebVM Database Bridge
const mockParentWindow = {
  postMessage: vi.fn((message: any, origin: string) => {
    // Simulate the parent window handling database requests
    if (message.type === 'database-request') {
      setTimeout(async () => {
        try {
          // Simulate HTTP request to MSW handlers
          const url = `http://localhost:5173${message.request.path}`
          
          console.log(`📦 Mock Parent Window: Processing ${message.request.method} ${url}`)
          console.log(`📦 Mock Parent Window: Headers:`, message.request.headers)
          
          const fetchOptions: RequestInit = {
            method: message.request.method,
            headers: message.request.headers
          }

          if (message.request.body && ['POST', 'PUT', 'PATCH'].includes(message.request.method)) {
            fetchOptions.body = message.request.body
            console.log(`📦 Mock Parent Window: Body:`, message.request.body)
          }

          // Use the global fetch (which is intercepted by MSW)
          const response = await fetch(url, fetchOptions)
          
          console.log(`📦 Mock Parent Window: Response status ${response.status}`)
          
          const responseData = await response.json()

          const databaseResponse = {
            status: response.status,
            data: responseData.data || responseData,
            message: responseData.message,
            error: response.ok ? undefined : (responseData.error || responseData.message || 'Request failed')
          }

          // Send response back via window message event
          window.dispatchEvent(new MessageEvent('message', {
            data: {
              type: 'database-response',
              requestId: message.requestId,
              response: databaseResponse
            },
            origin: origin
          }))

        } catch (error) {
          // Send error response back
          window.dispatchEvent(new MessageEvent('message', {
            data: {
              type: 'database-response',
              requestId: message.requestId,
              response: {
                status: 500,
                error: error instanceof Error ? error.message : 'Unknown error',
                message: 'Failed to process database request'
              }
            },
            origin: origin
          }))
        }
      }, 10) // Small delay to simulate async behavior
    }
  })
}

Object.defineProperty(window, 'parent', {
  value: mockParentWindow,
  writable: true
})

// Note: fetch is provided by MSW, don't mock it globally

// Global database manager instance mock helpers
global.mockPGliteInstance = {
  query: vi.fn().mockResolvedValue({ rows: [], affectedRows: 0 }),
  exec: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  waitReady: Promise.resolve(),
}

// Mock PGlite globally for all tests
vi.mock('@electric-sql/pglite', () => {
  return {
    PGlite: vi.fn().mockImplementation(() => global.mockPGliteInstance)
  }
})

// Mock jose JWT library
vi.mock('jose', () => {
  return {
    SignJWT: vi.fn().mockImplementation(() => ({
      setProtectedHeader: vi.fn().mockReturnThis(),
      setIssuedAt: vi.fn().mockReturnThis(),
      setExpirationTime: vi.fn().mockReturnThis(),
      setIssuer: vi.fn().mockReturnThis(),
      setAudience: vi.fn().mockReturnThis(),
      setSubject: vi.fn().mockReturnThis(),
      setJti: vi.fn().mockReturnThis(),
      sign: vi.fn().mockImplementation(async () => {
        // Return a mock JWT token
        const header = btoa(JSON.stringify({ alg: 'ES256', typ: 'JWT' }))
        const payload = btoa(JSON.stringify({
          iss: 'mock-issuer',
          sub: 'mock-subject',
          aud: 'mock-audience',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          jti: 'mock-jti'
        }))
        const signature = btoa('mock-signature')
        return `${header}.${payload}.${signature}`
      })
    })),
    jwtVerify: vi.fn().mockImplementation(async (jwt: string, _key: any, _options: any) => {
      // Simple mock verification - just decode the JWT
      const parts = jwt.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid token: Invalid Compact JWS')
      }

      try {
        const payload = JSON.parse(atob(parts[1]))
        return {
          payload,
          protectedHeader: JSON.parse(atob(parts[0]))
        }
      } catch (error) {
        throw new Error('Invalid token: Invalid Compact JWS')
      }
    })
  }
})

// Enhanced database manager cleanup
beforeEach(async () => {
  // Clear any cached database manager instance
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseManager } = require('../lib/database/connection')
    if (DatabaseManager && DatabaseManager.instance) {
      // Properly close existing connection before clearing
      try {
        await DatabaseManager.instance.close()
      } catch (_closeError) {
        // Ignore close errors during cleanup
      }
      DatabaseManager.instance = null
    }
  } catch (_error) {
    // Module might not exist yet, ignore
  }
  
  // Clear any auth bridge instances
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AuthBridge } = require('../lib/auth/AuthBridge')
    if (AuthBridge && AuthBridge.instance) {
      AuthBridge.instance = null
    }
  } catch (_error) {
    // Module might not exist yet, ignore
  }
})

// Memory monitoring for debugging
if (process.env.DEBUG_MEMORY === 'true') {
  let testCount = 0
  
  afterEach(() => {
    testCount++
    if (testCount % 10 === 0) {
      const memUsage = process.memoryUsage()
      console.log(`[Memory Debug] After ${testCount} tests:`, {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
      })
    }
  })
}