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
      digest: vi.fn().mockImplementation(async (algorithm, data) => {
        // Simple mock hash - return a consistent hash for 'password123'
        const hashForPassword123 = new Uint8Array([
          0xef, 0x92, 0xb7, 0x78, 0xba, 0xfe, 0x77, 0x1e, 
          0x89, 0x24, 0x5b, 0x89, 0xec, 0xbc, 0x08, 0xa4,
          0x4a, 0x4e, 0x16, 0x6c, 0x06, 0x65, 0x99, 0x11,
          0x88, 0x1f, 0x38, 0x3d, 0x44, 0x73, 0xe9, 0x4f
        ])
        return hashForPassword123.buffer
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

// Note: fetch is provided by MSW, don't mock it globally

// Global database manager instance mock helpers
global.mockPGliteInstance = {
  query: vi.fn().mockResolvedValue({ rows: [], affectedRows: 0 }),
  exec: vi.fn().mockResolvedValue(),
  close: vi.fn().mockResolvedValue(),
  waitReady: Promise.resolve(),
}

// Mock PGlite globally for all tests
vi.mock('@electric-sql/pglite', () => {
  return {
    PGlite: vi.fn().mockImplementation(() => global.mockPGliteInstance)
  }
})

// Reset database manager instance before each test
beforeEach(() => {
  // Clear any cached database manager instance
  try {
    const { DatabaseManager } = require('../lib/database/connection')
    if (DatabaseManager && DatabaseManager.instance) {
      DatabaseManager.instance = null
    }
  } catch (error) {
    // Module might not exist yet, ignore
  }
})