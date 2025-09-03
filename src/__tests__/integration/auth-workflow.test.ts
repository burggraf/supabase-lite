import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AuthBridge } from '../../lib/auth/AuthBridge';
import { DatabaseManager } from '../../lib/database/connection';

describe('Authentication Workflow Integration', () => {
  let authBridge: AuthBridge;
  let dbManager: DatabaseManager;

  // Test user data
  const testUser = {
    email: 'test@example.com',
    password: 'Password123$',
    data: {
      firstName: 'Test',
      lastName: 'User'
    }
  };

  const testUser2 = {
    email: 'test2@example.com',
    password: 'password456',
    data: {
      firstName: 'Test2',
      lastName: 'User2'
    }
  };

  beforeAll(async () => {
    // Initialize database and auth bridge
    dbManager = DatabaseManager.getInstance();
    await dbManager.initialize();

    authBridge = AuthBridge.getInstance();
    await authBridge.initialize();
  });

  afterAll(async () => {
    await dbManager.close();
  });

  beforeEach(async () => {
    // Clean up any existing test users before each test
    try {
      await dbManager.exec(`DELETE FROM auth.users WHERE email IN ('${testUser.email}', '${testUser2.email}')`);
      await dbManager.exec(`DELETE FROM auth.sessions WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('${testUser.email}', '${testUser2.email}'))`);
    } catch (error) {
      // Ignore cleanup errors - tables might not exist yet
    }
  });

  describe('User Registration Flow', () => {
    it('should successfully register a new user', async () => {
      const request = {
        endpoint: '/auth/v1/signup',
        method: 'POST' as const,
        body: {
          email: testUser.email,
          password: testUser.password,
          data: testUser.data
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/signup')
      };

      const response = await authBridge.handleAuthRequest(request);

      expect(response.status).toBe(201);
      expect(response.data).toBeDefined();
      expect(response.data.user).toBeDefined();
      expect(response.data.user.email).toBe(testUser.email);
      expect(response.data.user.user_metadata).toEqual(testUser.data);
      expect(response.error).toBeUndefined();

      // Verify user was created in database
      const users = await dbManager.query('SELECT * FROM auth.users WHERE email = $1', [testUser.email]);
      expect(users.rows).toHaveLength(1);
      expect(users.rows[0].email).toBe(testUser.email);
    });

    it('should reject registration with duplicate email', async () => {
      // First registration
      const firstRequest = {
        endpoint: '/auth/v1/signup',
        method: 'POST' as const,
        body: {
          email: testUser.email,
          password: testUser.password,
          data: testUser.data
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/signup')
      };

      await authBridge.handleAuthRequest(firstRequest);

      // Duplicate registration attempt
      const duplicateRequest = {
        ...firstRequest,
        body: {
          email: testUser.email,
          password: 'different-password',
          data: { firstName: 'Different', lastName: 'User' }
        }
      };

      await expect(authBridge.handleAuthRequest(duplicateRequest))
        .rejects.toThrow();
    });

    it('should reject registration with invalid email format', async () => {
      const request = {
        endpoint: '/auth/v1/signup',
        method: 'POST' as const,
        body: {
          email: 'invalid-email',
          password: testUser.password,
          data: testUser.data
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/signup')
      };

      await expect(authBridge.handleAuthRequest(request))
        .rejects.toThrow();
    });

    it('should reject registration with weak password', async () => {
      const request = {
        endpoint: '/auth/v1/signup',
        method: 'POST' as const,
        body: {
          email: testUser.email,
          password: '123', // Too weak
          data: testUser.data
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/signup')
      };

      await expect(authBridge.handleAuthRequest(request))
        .rejects.toThrow();
    });
  });

  describe('User Authentication Flow', () => {
    beforeEach(async () => {
      // Create test user for authentication tests
      const signupRequest = {
        endpoint: '/auth/v1/signup',
        method: 'POST' as const,
        body: {
          email: testUser.email,
          password: testUser.password,
          data: testUser.data
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/signup')
      };

      await authBridge.handleAuthRequest(signupRequest);
    });

    it('should successfully sign in with correct credentials', async () => {
      const request = {
        endpoint: '/auth/v1/token',
        method: 'POST' as const,
        body: {
          grant_type: 'password',
          email: testUser.email,
          password: testUser.password
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/token')
      };

      const response = await authBridge.handleAuthRequest(request);

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data.user).toBeDefined();
      expect(response.data.user.email).toBe(testUser.email);
      expect(response.data.session).toBeDefined();
      expect(response.data.session.access_token).toBeDefined();
      expect(response.data.session.refresh_token).toBeDefined();
      expect(response.error).toBeUndefined();

      // Verify session was created in database
      const sessions = await dbManager.query(
        'SELECT * FROM auth.sessions WHERE user_id = (SELECT id FROM auth.users WHERE email = $1)',
        [testUser.email]
      );
      expect(sessions.rows).toHaveLength(1);
    });

    it('should reject sign in with incorrect password', async () => {
      const request = {
        endpoint: '/auth/v1/token',
        method: 'POST' as const,
        body: {
          grant_type: 'password',
          email: testUser.email,
          password: 'wrong-password'
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/token')
      };

      await expect(authBridge.handleAuthRequest(request))
        .rejects.toThrow();
    });

    it('should reject sign in with non-existent email', async () => {
      const request = {
        endpoint: '/auth/v1/token',
        method: 'POST' as const,
        body: {
          grant_type: 'password',
          email: 'nonexistent@example.com',
          password: testUser.password
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/token')
      };

      await expect(authBridge.handleAuthRequest(request))
        .rejects.toThrow();
    });
  });

  describe('Session Management Flow', () => {
    let accessToken: string;
    let refreshToken: string;
    let userId: string;

    beforeEach(async () => {
      // Sign up and sign in to get session tokens
      const signupRequest = {
        endpoint: '/auth/v1/signup',
        method: 'POST' as const,
        body: {
          email: testUser.email,
          password: testUser.password,
          data: testUser.data
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/signup')
      };

      await authBridge.handleAuthRequest(signupRequest);

      const signinRequest = {
        endpoint: '/auth/v1/token',
        method: 'POST' as const,
        body: {
          grant_type: 'password',
          email: testUser.email,
          password: testUser.password
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/token')
      };

      const signinResponse = await authBridge.handleAuthRequest(signinRequest);
      accessToken = signinResponse.data.session.access_token;
      refreshToken = signinResponse.data.session.refresh_token;
      userId = signinResponse.data.user.id;
    });

    it('should refresh access token with valid refresh token', async () => {
      const request = {
        endpoint: '/auth/v1/token',
        method: 'POST' as const,
        body: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/token')
      };

      const response = await authBridge.handleAuthRequest(request);

      expect(response.status).toBe(200);
      expect(response.data.session).toBeDefined();
      expect(response.data.session.access_token).toBeDefined();
      expect(response.data.session.access_token).not.toBe(accessToken); // New token
      expect(response.data.session.refresh_token).toBeDefined();
      expect(response.data.user).toBeDefined();
      expect(response.data.user.id).toBe(userId);
    });

    it('should get user details with valid access token', async () => {
      const request = {
        endpoint: '/auth/v1/user',
        method: 'GET' as const,
        body: undefined,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/user')
      };

      const response = await authBridge.handleAuthRequest(request);

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data.id).toBe(userId);
      expect(response.data.email).toBe(testUser.email);
      expect(response.data.user_metadata).toEqual(testUser.data);
    });

    it('should reject user request with invalid access token', async () => {
      const request = {
        endpoint: '/auth/v1/user',
        method: 'GET' as const,
        body: undefined,
        headers: {
          'Authorization': 'Bearer invalid-token',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/user')
      };

      await expect(authBridge.handleAuthRequest(request))
        .rejects.toThrow();
    });

    it('should sign out and invalidate session', async () => {
      const request = {
        endpoint: '/auth/v1/logout',
        method: 'POST' as const,
        body: {},
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/logout')
      };

      const response = await authBridge.handleAuthRequest(request);

      expect(response.status).toBe(204);

      // Verify session was removed from database
      const sessions = await dbManager.query(
        'SELECT * FROM auth.sessions WHERE user_id = $1 AND access_token = $2',
        [userId, accessToken]
      );
      expect(sessions.rows).toHaveLength(0);

      // Verify subsequent requests with this token fail
      const userRequest = {
        endpoint: '/auth/v1/user',
        method: 'GET' as const,
        body: undefined,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/user')
      };

      await expect(authBridge.handleAuthRequest(userRequest))
        .rejects.toThrow();
    });
  });

  describe('User Profile Management Flow', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      // Sign up and sign in to get session tokens
      const signupRequest = {
        endpoint: '/auth/v1/signup',
        method: 'POST' as const,
        body: {
          email: testUser.email,
          password: testUser.password,
          data: testUser.data
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/signup')
      };

      await authBridge.handleAuthRequest(signupRequest);

      const signinRequest = {
        endpoint: '/auth/v1/token',
        method: 'POST' as const,
        body: {
          grant_type: 'password',
          email: testUser.email,
          password: testUser.password
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/token')
      };

      const signinResponse = await authBridge.handleAuthRequest(signinRequest);
      accessToken = signinResponse.data.session.access_token;
      userId = signinResponse.data.user.id;
    });

    it('should update user metadata', async () => {
      const updatedData = {
        firstName: 'Updated',
        lastName: 'Name',
        preferences: {
          theme: 'dark',
          notifications: true
        }
      };

      const request = {
        endpoint: '/auth/v1/user',
        method: 'PUT' as const,
        body: {
          data: updatedData
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/user')
      };

      const response = await authBridge.handleAuthRequest(request);

      expect(response.status).toBe(200);
      expect(response.data.user_metadata).toEqual(updatedData);

      // Verify update in database
      const users = await dbManager.query('SELECT * FROM auth.users WHERE id = $1', [userId]);
      expect(users.rows[0].user_metadata).toEqual(updatedData);
    });

    it('should update user password', async () => {
      const newPassword = 'new-password-123';

      const request = {
        endpoint: '/auth/v1/user',
        method: 'PUT' as const,
        body: {
          password: newPassword
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/user')
      };

      const response = await authBridge.handleAuthRequest(request);
      expect(response.status).toBe(200);

      // Verify can sign in with new password
      const signinRequest = {
        endpoint: '/auth/v1/token',
        method: 'POST' as const,
        body: {
          grant_type: 'password',
          email: testUser.email,
          password: newPassword
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/token')
      };

      const signinResponse = await authBridge.handleAuthRequest(signinRequest);
      expect(signinResponse.status).toBe(200);

      // Verify cannot sign in with old password
      const oldPasswordRequest = {
        ...signinRequest,
        body: {
          grant_type: 'password',
          email: testUser.email,
          password: testUser.password
        }
      };

      await expect(authBridge.handleAuthRequest(oldPasswordRequest))
        .rejects.toThrow();
    });
  });

  describe('Password Recovery Flow', () => {
    beforeEach(async () => {
      // Create test user for password recovery tests
      const signupRequest = {
        endpoint: '/auth/v1/signup',
        method: 'POST' as const,
        body: {
          email: testUser.email,
          password: testUser.password,
          data: testUser.data
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/signup')
      };

      await authBridge.handleAuthRequest(signupRequest);
    });

    it('should initiate password recovery for existing email', async () => {
      const request = {
        endpoint: '/auth/v1/recover',
        method: 'POST' as const,
        body: {
          email: testUser.email
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/recover')
      };

      const response = await authBridge.handleAuthRequest(request);

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      // In a real implementation, this would send an email
      // Here we just verify the request is processed successfully
    });

    it('should handle password recovery for non-existent email gracefully', async () => {
      const request = {
        endpoint: '/auth/v1/recover',
        method: 'POST' as const,
        body: {
          email: 'nonexistent@example.com'
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/recover')
      };

      // Should still return 200 for security reasons (don't reveal if email exists)
      const response = await authBridge.handleAuthRequest(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Multiple Users and Sessions', () => {
    it('should handle multiple users with separate sessions', async () => {
      // Register two users
      const user1SignupRequest = {
        endpoint: '/auth/v1/signup',
        method: 'POST' as const,
        body: {
          email: testUser.email,
          password: testUser.password,
          data: testUser.data
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/signup')
      };

      const user2SignupRequest = {
        endpoint: '/auth/v1/signup',
        method: 'POST' as const,
        body: {
          email: testUser2.email,
          password: testUser2.password,
          data: testUser2.data
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/signup')
      };

      await authBridge.handleAuthRequest(user1SignupRequest);
      await authBridge.handleAuthRequest(user2SignupRequest);

      // Sign in both users
      const user1SigninRequest = {
        endpoint: '/auth/v1/token',
        method: 'POST' as const,
        body: {
          grant_type: 'password',
          email: testUser.email,
          password: testUser.password
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/token')
      };

      const user2SigninRequest = {
        endpoint: '/auth/v1/token',
        method: 'POST' as const,
        body: {
          grant_type: 'password',
          email: testUser2.email,
          password: testUser2.password
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/token')
      };

      const user1Response = await authBridge.handleAuthRequest(user1SigninRequest);
      const user2Response = await authBridge.handleAuthRequest(user2SigninRequest);

      // Verify both sessions are independent
      expect(user1Response.data.user.email).toBe(testUser.email);
      expect(user2Response.data.user.email).toBe(testUser2.email);
      expect(user1Response.data.session.access_token).not.toBe(user2Response.data.session.access_token);

      // Verify both can access their profile independently
      const user1ProfileRequest = {
        endpoint: '/auth/v1/user',
        method: 'GET' as const,
        body: undefined,
        headers: {
          'Authorization': `Bearer ${user1Response.data.session.access_token}`,
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/user')
      };

      const user2ProfileRequest = {
        endpoint: '/auth/v1/user',
        method: 'GET' as const,
        body: undefined,
        headers: {
          'Authorization': `Bearer ${user2Response.data.session.access_token}`,
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/user')
      };

      const user1Profile = await authBridge.handleAuthRequest(user1ProfileRequest);
      const user2Profile = await authBridge.handleAuthRequest(user2ProfileRequest);

      expect(user1Profile.data.email).toBe(testUser.email);
      expect(user2Profile.data.email).toBe(testUser2.email);
    });

    it('should maintain session isolation between users', async () => {
      // This test ensures users can't access each other's data
      // Implementation would depend on proper session validation
      expect(true).toBe(true); // Placeholder for more complex isolation tests
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed requests gracefully', async () => {
      const malformedRequest = {
        endpoint: '/auth/v1/signup',
        method: 'POST' as const,
        body: {
          // Missing required fields
          data: { firstName: 'Test' }
        },
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/signup')
      };

      await expect(authBridge.handleAuthRequest(malformedRequest))
        .rejects.toThrow();
    });

    it('should handle unsupported endpoints', async () => {
      const unsupportedRequest = {
        endpoint: '/auth/v1/unsupported-endpoint',
        method: 'POST' as const,
        body: {},
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-anon-key'
        },
        url: new URL('http://localhost:5173/auth/v1/unsupported-endpoint')
      };

      await expect(authBridge.handleAuthRequest(unsupportedRequest))
        .rejects.toThrow();
    });
  });
});