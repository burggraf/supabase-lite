import '@testing-library/jest-dom'
import { afterEach, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from '../mocks/server'

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))

// Reset handlers after each test (important for test isolation)
afterEach(() => {
  server.resetHandlers()
  cleanup()
  vi.clearAllMocks()
})

// Clean up after the tests are finished
afterAll(() => server.close())

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
      importKey: vi.fn().mockImplementation(async (format, keyData, algorithm, extractable, keyUsages) => {
        // Return a mock key object
        return {
          algorithm,
          extractable,
          type: 'secret',
          usages: keyUsages
        }
      }),
      sign: vi.fn().mockImplementation(async (algorithm, key, data) => {
        // Mock signature that varies based on key and data
        const encoder = new TextEncoder()
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
          usages: keyUsages.filter(usage => ['sign'].includes(usage))
        }
        const publicKey = {
          algorithm,
          extractable,
          type: 'public',
          usages: keyUsages.filter(usage => ['verify'].includes(usage))
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
    jwtVerify: vi.fn().mockImplementation(async (jwt, key, options) => {
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

// Reset database manager instance before each test
beforeEach(() => {
  // Clear any cached database manager instance
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseManager } = require('../lib/database/connection')
    if (DatabaseManager && DatabaseManager.instance) {
      DatabaseManager.instance = null
    }
  } catch (_error) {
    // Module might not exist yet, ignore
  }
})