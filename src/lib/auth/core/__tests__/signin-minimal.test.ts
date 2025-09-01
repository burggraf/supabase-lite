import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthManager } from '../AuthManager'
import bcrypt from 'bcryptjs'

// Minimal test to check if the signin variable scope issue is resolved
describe('Sign In Minimal Test', () => {
  let mockDbManager: any
  let mockJwtService: any
  let mockSessionManager: any
  let mockPasswordService: any

  beforeEach(() => {
    // Create minimal mocks
    mockDbManager = {
      query: vi.fn(),
      initialize: vi.fn(),
      isConnected: vi.fn(() => true)
    }

    mockJwtService = {
      initialize: vi.fn()
    }

    mockSessionManager = {
      initialize: vi.fn(),
      createSession: vi.fn(() => ({
        access_token: 'mock_token',
        refresh_token: 'mock_refresh',
        expires_at: Date.now() + 3600000,
        user_id: 'user-123'
      }))
    }

    mockPasswordService = {
      verifyPassword: vi.fn(async (password: string, hash: string) => {
        // Test bcrypt verification directly
        return await bcrypt.compare(password, hash)
      })
    }
  })

  it('should not throw ReferenceError for user variable in signIn', async () => {
    // Mock successful user lookup
    mockDbManager.query.mockImplementation((sql: string, params: any[]) => {
      if (sql.includes('SELECT * FROM auth.users WHERE email')) {
        return {
          rows: [{
            id: 'user-123',
            email: 'test@example.com',
            email_confirmed_at: '2023-01-01T00:00:00Z',
            raw_app_meta_data: '{}',
            raw_user_meta_data: '{}',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
            role: 'authenticated',
            is_anonymous: false
          }]
        }
      }
      if (sql.includes('SELECT encrypted_password FROM auth.users WHERE id = $1')) {
        return {
          rows: [{
            encrypted_password: '$2b$10$joIiTSJ/o2vPel8w3RZ2Ae9kyfz159cwX//e6of1IPFRT6bolGsAy' // bcrypt hash for 'Password123$'
          }]
        }
      }
      if (sql.includes('UPDATE auth.users SET last_sign_in_at')) {
        return { rows: [] }
      }
      return { rows: [] }
    })

    const authManager = new (AuthManager as any)()
    authManager['dbManager'] = mockDbManager
    authManager['jwtService'] = mockJwtService
    authManager['sessionManager'] = mockSessionManager
    authManager['passwordService'] = mockPasswordService

    // This should not throw a ReferenceError about 'user' being undefined
    const result = await authManager.signIn({
      email: 'test@example.com',
      password: 'Password123$'
    })

    expect(result).toBeDefined()
    expect(result.user).toBeDefined()
    expect(result.session).toBeDefined()
    expect(result.user.id).toBe('user-123')
  })
})