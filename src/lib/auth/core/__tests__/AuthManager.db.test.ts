import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AuthManager } from '../AuthManager'
import { DatabaseManager } from '../../../database/connection'
import type { User, SignUpCredentials, SignInCredentials } from '../../types'

// Mock the DatabaseManager
vi.mock('../../../database/connection', () => ({
  DatabaseManager: {
    getInstance: vi.fn(() => ({
      query: vi.fn(),
      exec: vi.fn(),
      isConnected: vi.fn(() => true),
      initialize: vi.fn()
    }))
  }
}))

// Mock the AuthQueryBuilder
vi.mock('../../utils/DatabaseQueryBuilder', () => ({
  AuthQueryBuilder: vi.fn().mockImplementation(() => ({
    getUserByEmail: vi.fn(),
    getUserByPhone: vi.fn(),
    getUserById: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    getPasswordHash: vi.fn(),
    storePasswordHash: vi.fn(),
    updatePasswordHash: vi.fn(),
    recordFailedAttempt: vi.fn(),
    clearFailedAttempts: vi.fn(),
    getFailedAttemptsCount: vi.fn(),
    storeAuditLog: vi.fn(),
    query: vi.fn()
  }))
}))

describe('AuthManager Database Operations', () => {
  let authManager: AuthManager
  let mockDbManager: any
  let mockAuthQuery: any

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Get the mocked database manager
    mockDbManager = DatabaseManager.getInstance()
    
    // Get the mocked AuthQueryBuilder 
    const { AuthQueryBuilder } = await import('../../utils/DatabaseQueryBuilder')
    mockAuthQuery = new (AuthQueryBuilder as any)()
    
    // Create new AuthManager instance
    authManager = new (AuthManager as any)()
    authManager['dbManager'] = mockDbManager
    authManager['authQuery'] = mockAuthQuery
    authManager['jwtService'] = {
      initialize: vi.fn(),
      extractClaims: vi.fn()
    }
    authManager['sessionManager'] = {
      initialize: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
      signOut: vi.fn()
    }
    authManager['passwordService'] = {
      hashPassword: vi.fn(() => ({
        hash: 'hashed_password',
        salt: 'salt_value',
        algorithm: 'PBKDF2',
        iterations: 100000
      })),
      verifyPassword: vi.fn(),
      generatePasswordResetToken: vi.fn(() => 'reset_token'),
      isValidPasswordResetToken: vi.fn(),
      hashForAudit: vi.fn()
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Database Parameter Binding', () => {
    it('should handle parameterized queries correctly with special characters', async () => {
      const email = "test+user@example.com"
      const expectedUser = {
        id: 'user-id',
        email: email,
        phone: null,
        email_confirmed_at: '2023-01-01T00:00:00Z',
        phone_confirmed_at: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        role: 'authenticated',
        raw_app_meta_data: { provider: 'email' },
        raw_user_meta_data: {},
        is_anonymous: false
      }

      // Mock AuthQueryBuilder method
      mockAuthQuery.getUserByEmail.mockResolvedValue(expectedUser)

      // Call getUserByEmail
      const result = await authManager['getUserByEmail'](email)

      // Verify the AuthQueryBuilder method was called with correct parameters
      expect(mockAuthQuery.getUserByEmail).toHaveBeenCalledWith(email)
      
      // Verify result is properly mapped
      expect(result).toBeDefined()
      expect(result?.email).toBe(email)
      expect(result?.email_verified).toBe(true) // should convert from timestamp
    })

    it('should prevent SQL injection in email parameters', async () => {
      const maliciousEmail = "'; DROP TABLE auth.users; --"
      
      mockAuthQuery.getUserByEmail.mockResolvedValue(null)

      await authManager['getUserByEmail'](maliciousEmail)

      // AuthQueryBuilder should use parameterized queries, preventing SQL injection
      expect(mockAuthQuery.getUserByEmail).toHaveBeenCalledWith(maliciousEmail)
    })

    it('should handle null and undefined values correctly', async () => {
      const credentials: SignUpCredentials = {
        email: 'test@example.com',
        password: 'Password123!',
        data: { profile: null }
      }

      mockDbManager.query.mockResolvedValue({ rows: [] })

      await expect(authManager.signUp(credentials)).resolves.toBeDefined()

      // Check that createUserInDB was called with proper null handling
      const createUserCalls = mockDbManager.query.mock.calls.filter(call => 
        call[0].includes('INSERT INTO auth.users')
      )
      
      expect(createUserCalls.length).toBeGreaterThan(0)
      const insertQuery = createUserCalls[0][0]
      expect(insertQuery).toContain('NULL')
    })

    it('should handle boolean values correctly in formatSqlWithValues', async () => {
      const credentials: SignUpCredentials = {
        email: 'test@example.com',
        password: 'Password123!'
      }

      mockDbManager.query.mockResolvedValue({ rows: [] })

      await authManager.signUp(credentials)

      const createUserCalls = mockDbManager.query.mock.calls.filter(call => 
        call[0].includes('INSERT INTO auth.users')
      )
      
      const insertQuery = createUserCalls[0][0]
      // Should contain 'false' for is_anonymous boolean value
      expect(insertQuery).toContain('false')
      expect(insertQuery).not.toContain('$')
    })
  })

  describe('Schema Mapping Compatibility', () => {
    it('should map email_verified boolean to email_confirmed_at timestamp correctly', async () => {
      const credentials: SignUpCredentials = {
        email: 'test@example.com',
        password: 'Password123!'
      }

      mockDbManager.query.mockResolvedValue({ rows: [] })

      await authManager.signUp(credentials)

      const createUserCalls = mockDbManager.query.mock.calls.filter(call => 
        call[0].includes('INSERT INTO auth.users')
      )
      
      const insertQuery = createUserCalls[0][0]
      
      // Should insert email_confirmed_at with a timestamp (not just true/false)
      expect(insertQuery).toContain('email_confirmed_at')
      expect(insertQuery).not.toContain('email_verified')
      
      // Since requireEmailVerification is false by default, should have a timestamp
      expect(insertQuery).toMatch(/'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z'/)
    })

    it('should correctly map database user to User interface', async () => {
      const dbUser = {
        id: 'user-id',
        email: 'test@example.com',
        phone: null,
        email_confirmed_at: '2023-01-01T00:00:00Z',
        phone_confirmed_at: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        last_sign_in_at: '2023-01-01T00:00:00Z',
        role: 'authenticated',
        raw_app_meta_data: '{"provider": "email"}',
        raw_user_meta_data: '{"name": "Test User"}',
        is_anonymous: false
      }

      mockDbManager.query.mockResolvedValue({
        rows: [dbUser]
      })

      const result = await authManager['getUserByEmail']('test@example.com')

      expect(result).toBeDefined()
      expect(result?.id).toBe('user-id')
      expect(result?.email).toBe('test@example.com')
      
      // Check that timestamp fields are properly handled
      expect(result?.email_verified).toBe(true) // should be converted from timestamp
      expect(result?.phone_verified).toBe(false) // should be false when phone_confirmed_at is null
      
      // Check metadata parsing
      expect(result?.app_metadata).toEqual({ provider: 'email' })
      expect(result?.user_metadata).toEqual({ name: 'Test User' })
    })

    it('should handle missing confirmed_at timestamps as unverified', async () => {
      const dbUser = {
        id: 'user-id',
        email: 'test@example.com',
        phone: '+1234567890',
        email_confirmed_at: null,
        phone_confirmed_at: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        role: 'authenticated',
        raw_app_meta_data: '{}',
        raw_user_meta_data: '{}',
        is_anonymous: false
      }

      mockDbManager.query.mockResolvedValue({
        rows: [dbUser]
      })

      const result = await authManager['getUserByEmail']('test@example.com')

      expect(result?.email_verified).toBe(false)
      expect(result?.phone_verified).toBe(false)
    })
  })

  describe('Database Query Consistency', () => {
    it('should use consistent query format across all database operations', async () => {
      mockDbManager.query.mockResolvedValue({ rows: [] })

      // Test multiple operations that should all use formatSqlWithValues
      await authManager['getUserByEmail']('test@example.com')
      await authManager['getUserByPhone']('+1234567890')
      await authManager['getStoredPassword']('user-id')

      // All queries should be formatted (no $ parameters)
      mockDbManager.query.mock.calls.forEach(call => {
        const query = call[0]
        expect(query).not.toContain('$1')
        expect(query).not.toContain('$2')
        expect(query).not.toContain('$3')
      })
    })

    it('should handle complex JSON metadata in database operations', async () => {
      const credentials: SignUpCredentials = {
        email: 'test@example.com',
        password: 'Password123!',
        data: {
          profile: {
            name: 'Test User',
            preferences: {
              theme: 'dark',
              language: 'en'
            }
          },
          tags: ['developer', 'tester']
        }
      }

      mockDbManager.query.mockResolvedValue({ rows: [] })

      await authManager.signUp(credentials)

      const createUserCalls = mockDbManager.query.mock.calls.filter(call => 
        call[0].includes('INSERT INTO auth.users')
      )
      
      const insertQuery = createUserCalls[0][0]
      
      // Should properly stringify complex JSON
      expect(insertQuery).toContain('"profile"')
      expect(insertQuery).toContain('"preferences"')
      expect(insertQuery).toContain('"tags"')
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockDbManager.query.mockRejectedValue(new Error('Database connection failed'))

      await expect(authManager['getUserByEmail']('test@example.com'))
        .rejects.toThrow('Database connection failed')
    })

    it('should handle malformed database responses', async () => {
      mockDbManager.query.mockResolvedValue({ rows: [null] })

      const result = await authManager['getUserByEmail']('test@example.com')
      expect(result).toBeNull()
    })

    it('should handle invalid JSON in metadata fields', async () => {
      const dbUser = {
        id: 'user-id',
        email: 'test@example.com',
        raw_app_meta_data: 'invalid json{',
        raw_user_meta_data: '{"valid": "json"}',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        role: 'authenticated',
        is_anonymous: false
      }

      mockDbManager.query.mockResolvedValue({
        rows: [dbUser]
      })

      const result = await authManager['getUserByEmail']('test@example.com')

      // Should handle invalid JSON gracefully
      expect(result?.app_metadata).toEqual({})
      expect(result?.user_metadata).toEqual({ valid: 'json' })
    })
  })

  describe('Performance and Security', () => {
    it('should not log sensitive information in queries', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      mockDbManager.query.mockResolvedValue({ rows: [] })

      await authManager['getUserByEmail']('test@example.com')

      // Check that no sensitive data is logged
      const logCalls = consoleSpy.mock.calls.flat().join(' ')
      expect(logCalls).not.toContain('password')
      expect(logCalls).not.toContain('token')
      
      consoleSpy.mockRestore()
    })

    it('should handle concurrent database operations', async () => {
      mockDbManager.query.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ rows: [] }), 10))
      )

      // Simulate concurrent requests
      const promises = [
        authManager['getUserByEmail']('user1@example.com'),
        authManager['getUserByEmail']('user2@example.com'),
        authManager['getUserByEmail']('user3@example.com')
      ]

      await Promise.all(promises)

      expect(mockDbManager.query).toHaveBeenCalledTimes(3)
    })
  })

  describe('Audit Logging', () => {
    it('should handle audit logging failures gracefully', async () => {
      mockDbManager.query
        .mockResolvedValueOnce({ rows: [] }) // getUserByEmail
        .mockRejectedValueOnce(new Error('Audit log failed')) // logAuditEvent

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const credentials: SignUpCredentials = {
        email: 'test@example.com',
        password: 'Password123!'
      }

      // Should not throw even if audit logging fails
      await expect(authManager.signUp(credentials)).resolves.toBeDefined()
      
      expect(consoleSpy).toHaveBeenCalledWith('Audit logging failed:', expect.any(Error))
      
      consoleSpy.mockRestore()
    })
  })
})