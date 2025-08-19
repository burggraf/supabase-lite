import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AuthBridge } from '../AuthBridge'
import type { SignInRequest, SignUpRequest } from '../types'

// Mock all dependencies
vi.mock('../core/AuthManager', () => ({
  AuthManager: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
      refreshSession: vi.fn(),
      requestPasswordRecovery: vi.fn(),
      resetPassword: vi.fn(),
      getCurrentUser: vi.fn(),
      getCurrentSession: vi.fn()
    }))
  }
}))

vi.mock('../core/JWTService', () => ({
  JWTService: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      generateToken: vi.fn(),
      verifyToken: vi.fn(),
      extractClaims: vi.fn()
    }))
  }
}))

vi.mock('../core/SessionManager', () => ({
  SessionManager: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      refreshSession: vi.fn()
    }))
  }
}))

vi.mock('../services/MFAService', () => ({
  MFAService: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn()
    }))
  }
}))

describe('AuthBridge API Compatibility', () => {
  let authBridge: AuthBridge
  let mockAuthManager: any
  let mockJWTService: any
  let mockSessionManager: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get mocked services
    const { AuthManager } = await import('../core/AuthManager')
    const { JWTService } = await import('../core/JWTService')
    const { SessionManager } = await import('../core/SessionManager')
    
    mockAuthManager = AuthManager.getInstance()
    mockJWTService = JWTService.getInstance()
    mockSessionManager = SessionManager.getInstance()

    authBridge = new AuthBridge()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Sign-in Response Format', () => {
    it('should return response matching exact Supabase sign-in format', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_verified: true,
        phone_verified: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        role: 'authenticated',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: { name: 'Test User' },
        is_anonymous: false
      }

      const mockSession = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'refresh_token_123',
        expires_in: 3600,
        user_id: 'user-123',
        created_at: '2023-01-01T00:00:00Z'
      }

      mockAuthManager.signIn.mockResolvedValue({
        user: mockUser,
        session: mockSession
      })

      const signInRequest: SignInRequest = {
        email: 'test@example.com',
        password: 'Password123!',
        grant_type: 'password'
      }

      const request = {
        endpoint: 'token',
        method: 'POST' as const,
        body: signInRequest,
        headers: { 'content-type': 'application/json' },
        url: new URL('http://localhost:5173/auth/v1/token')
      }

      const response = await authBridge.handleAuthRequest(request)

      // Verify response structure matches official Supabase API
      expect(response.status).toBe(200)
      expect(response.data).toEqual({
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'refresh_token_123',
        expires_in: 3600,
        expires_at: expect.any(Number), // Should be timestamp
        token_type: 'bearer',
        user: {
          id: 'user-123',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'test@example.com',
          email_confirmed_at: expect.any(String), // Should be ISO timestamp or null
          phone_confirmed_at: null,
          confirmed_at: expect.any(String), // Should be earliest of email/phone confirmation
          last_sign_in_at: expect.any(String),
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: { name: 'Test User' },
          identities: expect.any(Array),
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          phone: null,
          is_anonymous: false
        }
      })
    })

    it('should include all required JWT claims for Supabase compatibility', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'authenticated'
      }

      const mockSession = {
        access_token: 'jwt_token',
        refresh_token: 'refresh_token',
        expires_in: 3600,
        user_id: 'user-123'
      }

      // Mock JWT service to return proper claims
      mockJWTService.extractClaims.mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        session_id: 'session-123',
        aal: 'aal1',
        amr: ['password'],
        iss: expect.stringContaining('supabase'),
        iat: expect.any(Number),
        exp: expect.any(Number)
      })

      mockAuthManager.signIn.mockResolvedValue({
        user: mockUser,
        session: mockSession
      })

      const request = {
        endpoint: 'token',
        method: 'POST' as const,
        body: { email: 'test@example.com', password: 'Password123!', grant_type: 'password' },
        headers: { 'content-type': 'application/json' },
        url: new URL('http://localhost:5173/auth/v1/token')
      }

      const response = await authBridge.handleAuthRequest(request)

      // Extract and verify JWT claims
      const claims = mockJWTService.extractClaims()
      expect(claims.sub).toBe('user-123')
      expect(claims.aud).toBe('authenticated')
      expect(claims.role).toBe('authenticated')
      expect(claims.session_id).toBeDefined()
      expect(claims.aal).toBe('aal1')
      expect(claims.amr).toContain('password')
    })

    it('should handle sign-in errors in Supabase format', async () => {
      const authError = new Error('Invalid login credentials') as any
      authError.status = 400
      authError.code = 'invalid_credentials'

      mockAuthManager.signIn.mockRejectedValue(authError)

      const request = {
        endpoint: 'token',
        method: 'POST' as const,
        body: { email: 'test@example.com', password: 'wrong', grant_type: 'password' },
        headers: { 'content-type': 'application/json' },
        url: new URL('http://localhost:5173/auth/v1/token')
      }

      const response = await authBridge.handleAuthRequest(request)

      expect(response.status).toBe(400)
      expect(response.error).toEqual({
        error: 'invalid_credentials',
        error_description: 'Invalid login credentials'
      })
    })
  })

  describe('Sign-up Response Format', () => {
    it('should return response matching exact Supabase sign-up format', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'newuser@example.com',
        email_verified: false, // Email verification required
        phone_verified: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        role: 'authenticated',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        is_anonymous: false
      }

      mockAuthManager.signUp.mockResolvedValue({
        user: mockUser,
        session: null // No session until email verified
      })

      const signUpRequest: SignUpRequest = {
        email: 'newuser@example.com',
        password: 'Password123!'
      }

      const request = {
        endpoint: 'signup',
        method: 'POST' as const,
        body: signUpRequest,
        headers: { 'content-type': 'application/json' },
        url: new URL('http://localhost:5173/auth/v1/signup')
      }

      const response = await authBridge.handleAuthRequest(request)

      expect(response.status).toBe(200)
      expect(response.data).toEqual({
        user: {
          id: 'user-123',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'newuser@example.com',
          email_confirmed_at: null, // Not confirmed yet
          phone_confirmed_at: null,
          confirmed_at: null,
          last_sign_in_at: null,
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: {},
          identities: expect.any(Array),
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          phone: null,
          is_anonymous: false
        },
        session: null
      })
    })
  })

  describe('Token Refresh Response Format', () => {
    it('should handle token refresh with proper format', async () => {
      const mockSession = {
        access_token: 'new_jwt_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
        user_id: 'user-123',
        created_at: '2023-01-01T00:00:00Z'
      }

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'authenticated'
      }

      mockAuthManager.refreshSession.mockResolvedValue(mockSession)
      mockAuthManager.getCurrentUser.mockReturnValue(mockUser)

      const request = {
        endpoint: 'token',
        method: 'POST' as const,
        body: { grant_type: 'refresh_token', refresh_token: 'old_refresh_token' },
        headers: { 'content-type': 'application/json' },
        url: new URL('http://localhost:5173/auth/v1/token')
      }

      const response = await authBridge.handleAuthRequest(request)

      expect(response.status).toBe(200)
      expect(response.data).toEqual({
        access_token: 'new_jwt_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
        expires_at: expect.any(Number),
        token_type: 'bearer',
        user: expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          aud: 'authenticated',
          role: 'authenticated'
        })
      })
    })
  })

  describe('User Object Serialization', () => {
    it('should properly serialize user with all Supabase-compatible fields', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        phone: '+1234567890',
        email_verified: true,
        phone_verified: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        last_sign_in_at: '2023-01-03T00:00:00Z',
        role: 'authenticated',
        app_metadata: { 
          provider: 'email', 
          providers: ['email'],
          custom_claim: 'value'
        },
        user_metadata: { 
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg'
        },
        is_anonymous: false
      }

      mockAuthManager.getCurrentUser.mockReturnValue(mockUser)

      const request = {
        endpoint: 'user',
        method: 'GET' as const,
        body: null,
        headers: { 'authorization': 'Bearer valid_token' },
        url: new URL('http://localhost:5173/auth/v1/user')
      }

      const response = await authBridge.handleAuthRequest(request)

      expect(response.status).toBe(200)
      expect(response.data).toEqual({
        id: 'user-123',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'test@example.com',
        phone: '+1234567890',
        email_confirmed_at: expect.any(String), // Should convert from email_verified
        phone_confirmed_at: expect.any(String), // Should convert from phone_verified
        confirmed_at: expect.any(String), // Should be earliest confirmation
        last_sign_in_at: '2023-01-03T00:00:00Z',
        app_metadata: {
          provider: 'email',
          providers: ['email'],
          custom_claim: 'value'
        },
        user_metadata: {
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg'
        },
        identities: expect.any(Array),
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        is_anonymous: false
      })
    })

    it('should handle missing optional fields gracefully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_verified: false,
        phone_verified: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        role: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        is_anonymous: false
      }

      mockAuthManager.getCurrentUser.mockReturnValue(mockUser)

      const request = {
        endpoint: 'user',
        method: 'GET' as const,
        body: null,
        headers: { 'authorization': 'Bearer valid_token' },
        url: new URL('http://localhost:5173/auth/v1/user')
      }

      const response = await authBridge.handleAuthRequest(request)

      expect(response.data).toEqual({
        id: 'user-123',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'test@example.com',
        phone: null,
        email_confirmed_at: null,
        phone_confirmed_at: null,
        confirmed_at: null,
        last_sign_in_at: null,
        app_metadata: {},
        user_metadata: {},
        identities: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        is_anonymous: false
      })
    })
  })

  describe('Error Response Format', () => {
    it('should format all error types in Supabase format', async () => {
      const testCases = [
        {
          error: { message: 'User already registered', status: 422, code: 'email_already_exists' },
          expected: { error: 'email_already_exists', error_description: 'User already registered' }
        },
        {
          error: { message: 'Invalid JWT', status: 401, code: 'invalid_token' },
          expected: { error: 'invalid_token', error_description: 'Invalid JWT' }
        },
        {
          error: { message: 'Account locked', status: 423, code: 'account_locked' },
          expected: { error: 'account_locked', error_description: 'Account locked' }
        }
      ]

      for (const testCase of testCases) {
        const authError = new Error(testCase.error.message) as any
        authError.status = testCase.error.status
        authError.code = testCase.error.code

        mockAuthManager.signIn.mockRejectedValue(authError)

        const request = {
          endpoint: 'token',
          method: 'POST' as const,
          body: { email: 'test@example.com', password: 'wrong', grant_type: 'password' },
          headers: { 'content-type': 'application/json' },
          url: new URL('http://localhost:5173/auth/v1/token')
        }

        const response = await authBridge.handleAuthRequest(request)

        expect(response.status).toBe(testCase.error.status)
        expect(response.error).toEqual(testCase.expected)
      }
    })
  })
})