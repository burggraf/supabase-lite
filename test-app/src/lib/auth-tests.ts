export interface AuthTest {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD' | 'PUT';
  endpoint: string;
  body?: any;
  description: string;
  requiresAuth?: boolean;
  adminOnly?: boolean;
  skipAutoAuth?: boolean;
}

export interface AuthResponse {
  status: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
  responseTime: number;
  timestamp: Date;
  error?: string;
}

export interface AuthTestCategory {
  id: string;
  name: string;
  description: string;
  tests: AuthTest[];
}

// Storage keys for auth state
export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'supabase-auth-token',
  REFRESH_TOKEN: 'supabase-refresh-token',
  SESSION: 'supabase-auth-session',
  USER: 'supabase-auth-user',
  PORT: 'supabase-lite-test-port'
} as const;

// Initialize base URL from localStorage or use default
const getInitialBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const savedPort = localStorage.getItem(AUTH_STORAGE_KEYS.PORT);
    if (savedPort) {
      const portNum = parseInt(savedPort);
      if (!isNaN(portNum) && portNum >= 1000 && portNum <= 65535) {
        return `http://localhost:${savedPort}`;
      }
    }
  }
  return 'http://localhost:5173'; // Default to Vite's default port
};

// Default base URL - can be overridden dynamically
let BASE_URL = getInitialBaseUrl();

export function setBaseUrl(url: string) {
  BASE_URL = url;
}

export function getBaseUrl(): string {
  return BASE_URL;
}

// Helper to get stored auth token
export function getStoredAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
  }
  return null;
}

// Helper to store auth data
export function storeAuthData(data: any) {
  if (typeof window !== 'undefined' && data) {
    if (data.access_token) {
      localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
    }
    if (data.refresh_token) {
      localStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
    }
    if (data.session) {
      localStorage.setItem(AUTH_STORAGE_KEYS.SESSION, JSON.stringify(data.session));
    }
    if (data.user) {
      // Handle case where user might be a string (JWT token) instead of object
      try {
        if (typeof data.user === 'string') {
          console.warn('User data is a string, storing as-is:', data.user.substring(0, 20) + '...');
          localStorage.setItem(AUTH_STORAGE_KEYS.USER, data.user);
        } else {
          localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(data.user));
        }
      } catch (error) {
        console.error('Error storing user data:', error, data.user);
      }
    }
  }
}

// Helper to clear auth data
export function clearAuthData() {
  if (typeof window !== 'undefined') {
    Object.values(AUTH_STORAGE_KEYS).forEach(key => {
      if (key !== AUTH_STORAGE_KEYS.PORT) {
        localStorage.removeItem(key);
      }
    });
  }
}

// Removed PostMessage logic - auth endpoints now use direct fetch through MSW like REST endpoints

// Check if current session is valid and not expired
export function isSessionValid(): boolean {
  if (typeof window === 'undefined') return false;

  const accessToken = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
  const sessionStr = localStorage.getItem(AUTH_STORAGE_KEYS.SESSION);

  if (!accessToken || !sessionStr) return false;

  try {
    const session = JSON.parse(sessionStr);
    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    return Date.now() < expiresAt - 30000; // 30s buffer
  } catch {
    return false;
  }
}

// Ensure user is authenticated by signing in with default test credentials
export async function ensureAuthenticated(): Promise<{ success: boolean; response?: AuthResponse; error?: string }> {
  // Check if already authenticated with valid session
  if (isSessionValid()) {
    console.log('🔐 Already authenticated with valid session');
    return { success: true };
  }

  console.log('🔐 Authentication required, attempting sign-in...');

  // First try signing in (user might already exist)
  const signinTest: AuthTest = {
    id: 'auto-signin',
    name: 'Auto Sign In',
    method: 'POST',
    endpoint: '/auth/v1/signin',
    body: {
      email: 'test@example.com',
      password: 'Password123$'
    },
    description: 'Automatic sign-in for authentication',
    skipAutoAuth: true
  };

  try {
    const signinResponse = await executeAuthTest(signinTest);

    // If signin successful, we're done
    if (signinResponse.status >= 200 && signinResponse.status < 300) {
      console.log('✅ Auto sign-in successful');
      return { success: true, response: signinResponse };
    }

    // If signin failed, try signup
    console.log('🔐 Sign-in failed, attempting sign-up...');
    const signupTest: AuthTest = {
      id: 'auto-signup',
      name: 'Auto Sign Up',
      method: 'POST',
      endpoint: '/auth/v1/signup',
      body: {
        email: 'test@example.com',
        password: 'Password123$',
        data: {
          full_name: 'Test User (Auto)'
        }
      },
      description: 'Automatic sign-up for authentication',
      skipAutoAuth: true
    };

    const signupResponse = await executeAuthTest(signupTest);

    if (signupResponse.status >= 200 && signupResponse.status < 300) {
      console.log('✅ Auto sign-up successful');
      return { success: true, response: signupResponse };
    }

    // Both failed
    return {
      success: false,
      error: `Authentication failed: Sign-in (${signinResponse.status}) and Sign-up (${signupResponse.status}) both failed`,
      response: signupResponse
    };

  } catch (error) {
    return {
      success: false,
      error: `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Test Categories
export const authTestCategories: AuthTestCategory[] = [
  {
    id: 'basic-auth',
    name: 'Basic Authentication',
    description: 'Core sign up, sign in, and session management operations',
    tests: [
      {
        id: 'signup-email',
        name: 'Sign Up with Email',
        method: 'POST',
        endpoint: '/auth/v1/signup',
        body: {
          email: 'test@example.com',
          password: 'Password123$',
          data: {
            full_name: 'Test User'
          }
        },
        description: 'Create a new user account with email and password'
      },
      {
        id: 'signup-phone',
        name: 'Sign Up with Phone',
        method: 'POST',
        endpoint: '/auth/v1/signup',
        body: {
          phone: '+1234567890',
          password: 'Password123$',
          data: {
            full_name: 'Test Phone User'
          }
        },
        description: 'Create a new user account with phone number and password'
      },
      {
        id: 'signin-email',
        name: 'Sign In with Email',
        method: 'POST',
        endpoint: '/auth/v1/signin',
        body: {
          email: 'test@example.com',
          password: 'Password123$'
        },
        description: 'Authenticate user with email and password'
      },
      {
        id: 'signin-phone',
        name: 'Sign In with Phone',
        method: 'POST',
        endpoint: '/auth/v1/signin',
        body: {
          phone: '+1234567890',
          password: 'Password123$'
        },
        description: 'Authenticate user with phone number and password'
      },
      {
        id: 'get-session',
        name: 'Get Current Session',
        method: 'GET',
        endpoint: '/auth/v1/session',
        description: 'Retrieve current session information',
        requiresAuth: true
      },
      {
        id: 'get-user',
        name: 'Get Current User',
        method: 'GET',
        endpoint: '/auth/v1/user',
        description: 'Get current user profile and metadata',
        requiresAuth: true
      },
      {
        id: 'refresh-token',
        name: 'Refresh Access Token',
        method: 'POST',
        endpoint: '/auth/v1/token?grant_type=refresh_token',
        body: {},
        description: 'Get new access token using refresh token'
      },
      {
        id: 'logout',
        name: 'Sign Out',
        method: 'POST',
        endpoint: '/auth/v1/logout',
        description: 'Sign out current user session',
        requiresAuth: true
      },
      {
        id: 'logout-global',
        name: 'Sign Out (All Sessions)',
        method: 'POST',
        endpoint: '/auth/v1/logout',
        body: {
          scope: 'global'
        },
        description: 'Sign out user from all sessions',
        requiresAuth: true
      }
    ]
  },
  {
    id: 'user-management',
    name: 'User Management',
    description: 'User profile updates, password management, and account operations',
    tests: [
      {
        id: 'update-user-profile',
        name: 'Update User Profile',
        method: 'PUT',
        endpoint: '/auth/v1/user',
        body: {
          data: {
            full_name: 'Updated Test User',
            avatar_url: 'https://example.com/avatar.jpg'
          }
        },
        description: 'Update user metadata and profile information',
        requiresAuth: true
      },
      {
        id: 'update-user-email',
        name: 'Update Email Address',
        method: 'PUT',
        endpoint: '/auth/v1/user',
        body: {
          email: 'newemail@example.com'
        },
        description: 'Change user email address (requires confirmation)',
        requiresAuth: true
      },
      {
        id: 'update-user-phone',
        name: 'Update Phone Number',
        method: 'PUT',
        endpoint: '/auth/v1/user',
        body: {
          phone: '+9876543210'
        },
        description: 'Change user phone number (requires verification)',
        requiresAuth: true
      },
      {
        id: 'update-password',
        name: 'Update Password',
        method: 'PUT',
        endpoint: '/auth/v1/user',
        body: {
          password: 'newPassword123$'
        },
        description: 'Change user password (requires current session)',
        requiresAuth: true
      },
      {
        id: 'request-password-reset',
        name: 'Request Password Reset',
        method: 'POST',
        endpoint: '/auth/v1/recover',
        body: {
          email: 'test@example.com'
        },
        description: 'Send password reset email to user'
      },
      {
        id: 'confirm-password-reset',
        name: 'Confirm Password Reset',
        method: 'POST',
        endpoint: '/auth/v1/verify',
        body: {
          type: 'recovery',
          token: 'mock-recovery-token',
          password: 'resetPassword123$'
        },
        description: 'Complete password reset with token'
      }
    ]
  },
  {
    id: 'magic-link-otp',
    name: 'Magic Link & OTP',
    description: 'Passwordless authentication using magic links and one-time passwords',
    tests: [
      {
        id: 'magic-link-signin',
        name: 'Request Magic Link',
        method: 'POST',
        endpoint: '/auth/v1/magiclink',
        body: {
          email: 'test@example.com'
        },
        description: 'Send magic link for passwordless sign in'
      },
      {
        id: 'verify-magic-link',
        name: 'Verify Magic Link Token',
        method: 'POST',
        endpoint: '/auth/v1/verify',
        body: {
          type: 'magiclink',
          token: 'mock-magic-token',
          email: 'test@example.com'
        },
        description: 'Complete magic link authentication'
      },
      {
        id: 'otp-email',
        name: 'Request OTP (Email)',
        method: 'POST',
        endpoint: '/auth/v1/otp',
        body: {
          email: 'test@example.com',
          create_user: false
        },
        description: 'Send one-time password to email'
      },
      {
        id: 'otp-phone',
        name: 'Request OTP (SMS)',
        method: 'POST',
        endpoint: '/auth/v1/otp',
        body: {
          phone: '+1234567890',
          create_user: false
        },
        description: 'Send one-time password via SMS'
      },
      {
        id: 'verify-otp-email',
        name: 'Verify OTP (Email)',
        method: 'POST',
        endpoint: '/auth/v1/verify',
        body: {
          type: 'email',
          token: '123456',
          email: 'test@example.com'
        },
        description: 'Verify email OTP token'
      },
      {
        id: 'verify-otp-phone',
        name: 'Verify OTP (Phone)',
        method: 'POST',
        endpoint: '/auth/v1/verify',
        body: {
          type: 'sms',
          token: '654321',
          phone: '+1234567890'
        },
        description: 'Verify SMS OTP token'
      }
    ]
  },
  {
    id: 'email-verification',
    name: 'Email & Phone Verification',
    description: 'Account verification workflows for email and phone confirmation',
    tests: [
      {
        id: 'resend-email-confirmation',
        name: 'Resend Email Confirmation',
        method: 'POST',
        endpoint: '/auth/v1/resend',
        body: {
          type: 'signup',
          email: 'test@example.com'
        },
        description: 'Resend email confirmation link'
      },
      {
        id: 'verify-email-token',
        name: 'Verify Email Token',
        method: 'POST',
        endpoint: '/auth/v1/verify',
        body: {
          type: 'signup',
          token: 'mock-confirmation-token',
          email: 'test@example.com'
        },
        description: 'Complete email verification'
      },
      {
        id: 'resend-phone-confirmation',
        name: 'Resend Phone Confirmation',
        method: 'POST',
        endpoint: '/auth/v1/resend',
        body: {
          type: 'sms',
          phone: '+1234567890'
        },
        description: 'Resend phone verification SMS'
      },
      {
        id: 'verify-phone-token',
        name: 'Verify Phone Token',
        method: 'POST',
        endpoint: '/auth/v1/verify',
        body: {
          type: 'sms',
          token: '789012',
          phone: '+1234567890'
        },
        description: 'Complete phone number verification'
      }
    ]
  },
  {
    id: 'mfa',
    name: 'Multi-Factor Authentication',
    description: 'TOTP and SMS-based multi-factor authentication setup and verification',
    tests: [
      {
        id: 'list-mfa-factors',
        name: 'List MFA Factors',
        method: 'GET',
        endpoint: '/auth/v1/factors',
        description: 'Get all enrolled MFA factors for user',
        requiresAuth: true
      },
      {
        id: 'enroll-totp-factor',
        name: 'Enroll TOTP Factor',
        method: 'POST',
        endpoint: '/auth/v1/factors',
        body: {
          factorType: 'totp',
          friendly_name: 'My Authenticator App'
        },
        description: 'Enroll a new TOTP (authenticator app) factor',
        requiresAuth: true
      },
      {
        id: 'verify-totp-enrollment',
        name: 'Verify TOTP Enrollment',
        method: 'POST',
        endpoint: '/auth/v1/factors/mock-factor-id/verify',
        body: {
          code: '123456'
        },
        description: 'Complete TOTP factor enrollment with code',
        requiresAuth: true
      },
      {
        id: 'enroll-phone-factor',
        name: 'Enroll Phone Factor',
        method: 'POST',
        endpoint: '/auth/v1/factors',
        body: {
          factorType: 'phone',
          phone: '+1234567890'
        },
        description: 'Enroll phone number for SMS MFA',
        requiresAuth: true
      },
      {
        id: 'create-mfa-challenge',
        name: 'Create MFA Challenge',
        method: 'POST',
        endpoint: '/auth/v1/factors/mock-factor-id/challenge',
        body: {},
        description: 'Generate MFA challenge for authentication',
        requiresAuth: true
      },
      {
        id: 'verify-mfa-challenge',
        name: 'Verify MFA Challenge',
        method: 'POST',
        endpoint: '/auth/v1/factors/mock-factor-id/verify',
        body: {
          challengeId: 'mock-challenge-id',
          code: '654321'
        },
        description: 'Complete MFA challenge verification',
        requiresAuth: true
      },
      {
        id: 'unenroll-mfa-factor',
        name: 'Unenroll MFA Factor',
        method: 'DELETE',
        endpoint: '/auth/v1/factors/mock-factor-id',
        description: 'Remove MFA factor from account',
        requiresAuth: true
      }
    ]
  },
  {
    id: 'oauth-social',
    name: 'OAuth & Social Login',
    description: 'Social authentication providers and OAuth flow simulation',
    tests: [
      {
        id: 'oauth-authorize-google',
        name: 'OAuth Authorize (Google)',
        method: 'GET',
        endpoint: '/auth/v1/authorize?provider=google&redirect_to=http://localhost:5176/callback',
        description: 'Initiate Google OAuth authorization flow'
      },
      {
        id: 'oauth-authorize-github',
        name: 'OAuth Authorize (GitHub)',
        method: 'GET',
        endpoint: '/auth/v1/authorize?provider=github&redirect_to=http://localhost:5176/callback',
        description: 'Initiate GitHub OAuth authorization flow'
      },
      {
        id: 'oauth-callback',
        name: 'OAuth Callback',
        method: 'POST',
        endpoint: '/auth/v1/callback',
        body: {
          provider: 'google',
          code: 'mock-oauth-code',
          state: 'mock-state'
        },
        description: 'Handle OAuth provider callback'
      },
      {
        id: 'link-identity',
        name: 'Link Social Identity',
        method: 'POST',
        endpoint: '/auth/v1/user/identities',
        body: {
          provider: 'github',
          access_token: 'mock-provider-token'
        },
        description: 'Link additional social identity to account',
        requiresAuth: true
      },
      {
        id: 'unlink-identity',
        name: 'Unlink Social Identity',
        method: 'DELETE',
        endpoint: '/auth/v1/user/identities/mock-identity-id',
        description: 'Remove linked social identity',
        requiresAuth: true
      },
      {
        id: 'get-identities',
        name: 'Get Linked Identities',
        method: 'GET',
        endpoint: '/auth/v1/user/identities',
        description: 'List all linked social identities',
        requiresAuth: true
      }
    ]
  },
  {
    id: 'admin-operations',
    name: 'Admin Operations',
    description: 'Administrative user management functions (requires admin privileges)',
    tests: [
      {
        id: 'admin-list-users',
        name: 'List All Users (Admin)',
        method: 'GET',
        endpoint: '/auth/v1/admin/users?page=1&per_page=10',
        description: 'Get paginated list of all users',
        requiresAuth: true,
        adminOnly: true
      },
      {
        id: 'admin-get-user',
        name: 'Get User by ID (Admin)',
        method: 'GET',
        endpoint: '/auth/v1/admin/users/mock-user-id',
        description: 'Get specific user details by ID',
        requiresAuth: true,
        adminOnly: true
      },
      {
        id: 'admin-create-user',
        name: 'Create User (Admin)',
        method: 'POST',
        endpoint: '/auth/v1/admin/users',
        body: {
          email: 'admin-created@example.com',
          password: 'Password123$',
          email_confirm: true,
          user_metadata: {
            full_name: 'Admin Created User'
          }
        },
        description: 'Create new user account as admin',
        requiresAuth: true,
        adminOnly: true
      },
      {
        id: 'admin-update-user',
        name: 'Update User (Admin)',
        method: 'PUT',
        endpoint: '/auth/v1/admin/users/mock-user-id',
        body: {
          role: 'authenticated',
          user_metadata: {
            full_name: 'Updated by Admin'
          },
          ban_duration: 'none'
        },
        description: 'Update user account as admin',
        requiresAuth: true,
        adminOnly: true
      },
      {
        id: 'admin-delete-user',
        name: 'Delete User (Admin)',
        method: 'DELETE',
        endpoint: '/auth/v1/admin/users/mock-user-id',
        description: 'Permanently delete user account',
        requiresAuth: true,
        adminOnly: true
      },
      {
        id: 'admin-generate-invite',
        name: 'Generate Invite Link',
        method: 'POST',
        endpoint: '/auth/v1/admin/generate_link',
        body: {
          type: 'invite',
          email: 'invite@example.com',
          redirect_to: 'http://localhost:5176/welcome'
        },
        description: 'Generate invitation link for new user',
        requiresAuth: true,
        adminOnly: true
      }
    ]
  },
  {
    id: 'anonymous-auth',
    name: 'Anonymous Authentication',
    description: 'Anonymous user sessions and guest authentication',
    tests: [
      {
        id: 'signin-anonymous',
        name: 'Sign In Anonymously',
        method: 'POST',
        endpoint: '/auth/v1/signup',
        body: {
          data: {
            anonymous: true
          }
        },
        description: 'Create anonymous user session'
      },
      {
        id: 'convert-anonymous',
        name: 'Convert Anonymous to Permanent',
        method: 'PUT',
        endpoint: '/auth/v1/user',
        body: {
          email: 'converted@example.com',
          password: 'Password123$'
        },
        description: 'Convert anonymous user to permanent account',
        requiresAuth: true
      },
      {
        id: 'link-anonymous-session',
        name: 'Link Anonymous Session',
        method: 'POST',
        endpoint: '/auth/v1/user/identities',
        body: {
          provider: 'email',
          email: 'existing@example.com'
        },
        description: 'Link anonymous session to existing account',
        requiresAuth: true
      }
    ]
  },
  {
    id: 'session-management',
    name: 'Session Management',
    description: 'Advanced session handling, device management, and security',
    tests: [
      {
        id: 'list-sessions',
        name: 'List All Sessions',
        method: 'GET',
        endpoint: '/auth/v1/sessions',
        description: 'Get all active sessions for current user',
        requiresAuth: true
      },
      {
        id: 'revoke-session',
        name: 'Revoke Specific Session',
        method: 'DELETE',
        endpoint: '/auth/v1/sessions/mock-session-id',
        description: 'Revoke a specific session by ID',
        requiresAuth: true
      },
      {
        id: 'revoke-other-sessions',
        name: 'Revoke Other Sessions',
        method: 'POST',
        endpoint: '/auth/v1/logout',
        body: {
          scope: 'others'
        },
        description: 'Sign out from all other sessions',
        requiresAuth: true
      },
      {
        id: 'extend-session',
        name: 'Extend Session',
        method: 'POST',
        endpoint: '/auth/v1/token?grant_type=refresh_token',
        body: {
          refresh_token: 'stored-refresh-token'
        },
        description: 'Extend session before expiry'
      }
    ]
  },
  {
    id: 'security-edge-cases',
    name: 'Security & Edge Cases',
    description: 'Security testing, rate limiting, and error condition handling',
    tests: [
      {
        id: 'invalid-credentials',
        name: 'Invalid Credentials',
        method: 'POST',
        endpoint: '/auth/v1/signin',
        body: {
          email: 'test@example.com',
          password: 'wrongpassword'
        },
        description: 'Test authentication with wrong password (401 error)'
      },
      {
        id: 'malformed-email',
        name: 'Malformed Email',
        method: 'POST',
        endpoint: '/auth/v1/signup',
        body: {
          email: 'not-an-email',
          password: 'Password123$'
        },
        description: 'Test signup with invalid email format (422 error)'
      },
      {
        id: 'weak-password',
        name: 'Weak Password',
        method: 'POST',
        endpoint: '/auth/v1/signup',
        body: {
          email: 'weak@example.com',
          password: '123'
        },
        description: 'Test password strength validation (422 error)'
      },
      {
        id: 'expired-token',
        name: 'Expired Token Access',
        method: 'GET',
        endpoint: '/auth/v1/user',
        description: 'Test access with expired JWT token (401 error)',
        requiresAuth: true
      },
      {
        id: 'invalid-token',
        name: 'Invalid Token Format',
        method: 'GET',
        endpoint: '/auth/v1/user',
        description: 'Test access with malformed token (401 error)'
      },
      {
        id: 'rate-limit-test',
        name: 'Rate Limit Test',
        method: 'POST',
        endpoint: '/auth/v1/signin',
        body: {
          email: 'rate-limit-test@example.com',
          password: 'Password123$'
        },
        description: 'Test authentication rate limiting (429 error after multiple attempts)'
      }
    ]
  }
];

export async function executeAuthTest(test: AuthTest, options: { skipAutoAuth?: boolean } = {}): Promise<AuthResponse> {
  const startTime = Date.now();

  try {
    // Auto-authenticate if test requires auth and we're not skipping auto-auth
    if ((test.requiresAuth || test.adminOnly) && !options.skipAutoAuth && !test.skipAutoAuth) {
      const authResult = await ensureAuthenticated();
      if (!authResult.success) {
        // Return authentication failure as test response
        return {
          status: 401,
          statusText: 'Authentication Required',
          data: {
            error: 'authentication_required',
            message: authResult.error || 'Could not authenticate for this test'
          },
          headers: {},
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          error: authResult.error
        };
      }
    }

    // Use direct fetch for all contexts - let MSW handle it
    const url = `${BASE_URL}${test.endpoint}`;
    const requestOptions: RequestInit = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Add authorization header if test requires auth
    if (test.requiresAuth || test.adminOnly) {
      const token = getStoredAuthToken();
      if (token) {
        requestOptions.headers = {
          ...requestOptions.headers,
          'Authorization': `Bearer ${token}`,
        };
      }
    }

    // Add admin header for admin-only tests
    if (test.adminOnly) {
      requestOptions.headers = {
        ...requestOptions.headers,
        'X-Admin-Request': 'true',
      };
    }

    // Handle refresh token specially
    if (test.id === 'refresh-token') {
      const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshToken) {
        test.body = { refresh_token: refreshToken };
      }
    }

    if (test.body && (test.method === 'POST' || test.method === 'PATCH' || test.method === 'PUT')) {
      requestOptions.body = JSON.stringify(test.body);
    }

    const response = await fetch(url, requestOptions);
    const responseTime = Date.now() - startTime;

    let data: any;
    const contentType = response.headers.get('content-type');

    // Handle 204 No Content responses (like logout) - they have no body
    if (response.status === 204) {
      data = null;
    } else if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (error) {
        // Handle empty JSON responses gracefully
        console.warn('Failed to parse JSON response, treating as empty:', error);
        data = null;
      }
    } else {
      data = await response.text();
    }

    // Store auth data from successful responses
    if (response.ok && (test.id.includes('signin') || test.id.includes('signup') || test.id.includes('refresh') ||
      test.id.includes('auto-signin') || test.id.includes('auto-signup'))) {
      // Handle both direct token format and session format
      const authData = {
        access_token: data?.access_token || data?.session?.access_token,
        refresh_token: data?.refresh_token || data?.session?.refresh_token,
        session: data?.session,
        user: data?.user
      };
      storeAuthData(authData);
    }

    // Clear auth data on logout
    if (response.ok && test.id.includes('logout')) {
      clearAuthData();
    }

    // Convert headers to plain object
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      data,
      headers,
      responseTime,
      timestamp: new Date(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: 0,
      statusText: 'Network Error',
      data: null,
      headers: {},
      responseTime,
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function getStatusColor(status: number): string {
  if (status === 0) return 'text-red-600';
  if (status >= 200 && status < 300) return 'text-green-600';
  if (status >= 300 && status < 400) return 'text-blue-600';
  if (status >= 400 && status < 500) return 'text-orange-600';
  if (status >= 500) return 'text-red-600';
  return 'text-gray-600';
}

export function getMethodColor(method: string): string {
  switch (method) {
    case 'GET': return 'success';
    case 'POST': return 'default';
    case 'PATCH':
    case 'PUT': return 'warning';
    case 'DELETE': return 'destructive';
    default: return 'outline';
  }
}