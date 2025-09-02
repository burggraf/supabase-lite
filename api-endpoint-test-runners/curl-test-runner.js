#!/usr/bin/env node

/**
 * Curl-based Test Runner for Supabase Lite
 * 
 * This script tests all Authentication and API endpoints exactly as they are
 * tested in the test-app, using HTTP fetch calls to identify compatibility
 * issues with the real Supabase API.
 * 
 * Usage: node curl-test-runner.js [base-url]
 * Default base URL: http://localhost:5173
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:5173';

// Generate random user credentials to avoid conflicts
function generateRandomUser() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return {
    email: `test-${timestamp}-${random}@example.com`,
    password: 'Password123$'
  };
}

const TEST_CREDENTIALS = generateRandomUser();

// Predefined credentials for tests that need existing users
const EXISTING_USER_CREDENTIALS = {
  email: 'existing-user@example.com',
  password: 'Password123$'
};

// Storage for auth state
let authState = {
  accessToken: null,
  refreshToken: null,
  session: null,
  user: null
};

// Test results storage
let testResults = {
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    startTime: new Date().toISOString(),
    endTime: null,
    baseUrl: BASE_URL
  },
  authentication: {
    tests: [],
    stats: { total: 0, passed: 0, failed: 0 }
  },
  api: {
    tests: [],
    stats: { total: 0, passed: 0, failed: 0 }
  },
  compatibility_issues: []
};

// Console output capture
let consoleOutput = [];
const originalLog = console.log;
const originalError = console.error;

// Override console.log to capture output
console.log = function(...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  consoleOutput.push(message);
  originalLog.apply(console, args);
};

// Override console.error to capture errors
console.error = function(...args) {
  const message = 'ERROR: ' + args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ');
  consoleOutput.push(message);
  originalError.apply(console, args);
};

// Authentication test definitions (from test-app/src/lib/auth-tests.ts)
const authTestCategories = [
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
        id: 'refresh-session',
        name: 'Refresh Session',
        method: 'POST',
        endpoint: '/auth/v1/token?grant_type=refresh_token',
        body: {
          refresh_token: 'mock-refresh-token'
        },
        description: 'Refresh the current session with refresh token',
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

// API test definitions (from test-app/src/lib/api-tests.ts)
const apiTestCategories = [
  {
    id: 'basic-crud',
    name: 'Basic CRUD Operations',
    description: 'Fundamental database operations on Northwind tables',
    tests: [
      {
        id: 'get-all-products',
        name: 'Get All Products',
        method: 'GET',
        endpoint: '/rest/v1/products',
        description: 'Retrieve all products from the catalog'
      },
      {
        id: 'get-specific-fields',
        name: 'Get Specific Fields',
        method: 'GET',
        endpoint: '/rest/v1/products?select=product_name,unit_price,units_in_stock',
        description: 'Select only specific columns from products table'
      },
      {
        id: 'get-single-product',
        name: 'Get Single Product',
        method: 'GET',
        endpoint: '/rest/v1/products?product_id=eq.1',
        description: 'Retrieve a specific product by ID'
      },
      {
        id: 'create-product',
        name: 'Create New Product',
        method: 'POST',
        endpoint: '/rest/v1/products',
        body: {
          product_id: 999,
          product_name: 'Test Product',
          unit_price: 25.99,
          units_in_stock: 100,
          category_id: 1,
          supplier_id: 1,
          discontinued: 0
        },
        description: 'Add a new product to the catalog'
      },
      {
        id: 'update-product',
        name: 'Update Product',
        method: 'PATCH',
        endpoint: '/rest/v1/products?product_id=eq.1',
        body: {
          unit_price: 29.99
        },
        description: 'Update an existing product\'s price'
      },
      {
        id: 'delete-product',
        name: 'Delete Test Product',
        method: 'DELETE',
        endpoint: '/rest/v1/products?product_name=eq.Test Product',
        description: 'Remove the test product we created'
      }
    ]
  },
  {
    id: 'advanced-filtering',
    name: 'Advanced Filtering & Queries',
    description: 'Complex query operations using PostgREST operators',
    tests: [
      {
        id: 'price-filter',
        name: 'Price Range Filter',
        method: 'GET',
        endpoint: '/rest/v1/products?unit_price=gte.20&unit_price=lte.50',
        description: 'Find products in a specific price range ($20-$50)'
      },
      {
        id: 'text-search',
        name: 'Text Search',
        method: 'GET',
        endpoint: '/rest/v1/products?product_name=ilike.*seafood*',
        description: 'Search for products containing "seafood" in the name'
      },
      {
        id: 'complex-filter',
        name: 'Complex Filter + Sort',
        method: 'GET',
        endpoint: '/rest/v1/products?discontinued=eq.0&order=unit_price.desc&limit=10',
        description: 'Active products sorted by price (highest first)'
      },
      {
        id: 'multiple-values',
        name: 'Multiple Values (IN)',
        method: 'GET',
        endpoint: '/rest/v1/products?category_id=in.1,2,3',
        description: 'Products from categories 1, 2, or 3'
      },
      {
        id: 'low-stock',
        name: 'Low Stock Alert',
        method: 'GET',
        endpoint: '/rest/v1/products?units_in_stock=lte.10&discontinued=eq.0',
        description: 'Find active products with low inventory (≤10 units)'
      }
    ]
  },
  {
    id: 'relationships',
    name: 'Relationships & Joins',
    description: 'Complex queries involving multiple related tables',
    tests: [
      {
        id: 'orders-with-customers',
        name: 'Orders with Customer Details',
        method: 'GET',
        endpoint: '/rest/v1/orders?select=*,customers(customer_id,company_name,contact_name)&limit=5',
        description: 'Get orders with embedded customer information'
      },
      {
        id: 'products-with-categories',
        name: 'Products with Categories',
        method: 'GET',
        endpoint: '/rest/v1/products?select=product_name,unit_price,categories(category_name)&limit=10',
        description: 'Products with their category names'
      },
      {
        id: 'order-details-full',
        name: 'Order Details with Products',
        method: 'GET',
        endpoint: '/rest/v1/order_details?select=*,orders(order_date),products(product_name,unit_price)&limit=5',
        description: 'Order line items with product and order information'
      },
      {
        id: 'customer-order-count',
        name: 'Customers with Order Count',
        method: 'GET',
        endpoint: '/rest/v1/customers?select=company_name,contact_name,orders(count)&limit=10',
        description: 'Customer list with total number of orders'
      }
    ]
  },
  {
    id: 'error-handling',
    name: 'Error Handling & Edge Cases',
    description: 'Testing error responses and edge case handling',
    tests: [
      {
        id: 'table-not-found',
        name: 'Table Not Found',
        method: 'GET',
        endpoint: '/rest/v1/nonexistent_table',
        description: 'Try to access a table that doesn\'t exist (404 error)'
      },
      {
        id: 'invalid-column',
        name: 'Invalid Column',
        method: 'GET',
        endpoint: '/rest/v1/products?invalid_column=eq.test',
        description: 'Query with non-existent column (400 error)'
      },
      {
        id: 'missing-required-fields',
        name: 'Missing Required Fields',
        method: 'POST',
        endpoint: '/rest/v1/products',
        body: {
          unit_price: 25.99
        },
        description: 'Create product without required fields (422 error)'
      },
      {
        id: 'invalid-parameter',
        name: 'Invalid Parameter',
        method: 'GET',
        endpoint: '/rest/v1/products?limit=invalid',
        description: 'Use invalid value for limit parameter (400 error)'
      }
    ]
  },
  {
    id: 'pagination',
    name: 'Pagination & Limits',
    description: 'Data pagination and result limiting techniques',
    tests: [
      {
        id: 'basic-limit',
        name: 'Basic Limit',
        method: 'GET',
        endpoint: '/rest/v1/products?limit=5',
        description: 'Get first 5 products'
      },
      {
        id: 'pagination',
        name: 'Pagination (Offset)',
        method: 'GET',
        endpoint: '/rest/v1/products?limit=5&offset=10',
        description: 'Get products 11-15 (page 3 with 5 per page)'
      },
      {
        id: 'recent-orders',
        name: 'Recent Orders',
        method: 'GET',
        endpoint: '/rest/v1/orders?order=order_date.desc&limit=10',
        description: 'Get 10 most recent orders'
      },
      {
        id: 'count-only',
        name: 'Count Only',
        method: 'HEAD',
        endpoint: '/rest/v1/products',
        description: 'Get total product count without data'
      }
    ]
  },
  {
    id: 'business-scenarios',
    name: 'Business Scenarios',
    description: 'Real-world business queries using Northwind data',
    tests: [
      {
        id: 'monthly-sales',
        name: 'Monthly Sales Report',
        method: 'GET',
        endpoint: '/rest/v1/orders?order_date=gte.1997-01-01&order_date=lt.1997-02-01&select=order_id,order_date,freight',
        description: 'Orders from January 1997 for sales analysis'
      },
      {
        id: 'vip-customers',
        name: 'VIP Customers',
        method: 'GET',
        endpoint: '/rest/v1/customers?select=*,orders(count)&orders.count=gte.10',
        description: 'Customers with 10 or more orders'
      },
      {
        id: 'premium-products',
        name: 'Premium Products',
        method: 'GET',
        endpoint: '/rest/v1/products?select=*,categories(category_name)&unit_price=gte.100',
        description: 'High-value products over $100'
      },
      {
        id: 'employee-territories',
        name: 'Employee Territories',
        method: 'GET',
        endpoint: '/rest/v1/employees?select=first_name,last_name,title,employee_territories(count)',
        description: 'Employee list with territory assignments'
      }
    ]
  }
];

// Utility functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isSuccessfulStatus(status) {
  return status >= 200 && status < 300;
}

function getStatusCategory(status) {
  if (status === 0) return 'network_error';
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client_error';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

// Authentication functions
async function ensureAuthenticated() {
  if (authState.accessToken) {
    console.log('🔐 Already authenticated');
    return { success: true };
  }

  console.log('🔐 Authentication required, attempting sign-in...');

  // Try signing in first
  try {
    const signinResult = await executeTest({
      id: 'auto-signin',
      method: 'POST',
      endpoint: '/auth/v1/signin',
      body: TEST_CREDENTIALS,
      skipAutoAuth: true
    }, 'auth');

    if (isSuccessfulStatus(signinResult.status)) {
      console.log('✅ Auto sign-in successful');
      return { success: true };
    }

    // If signin failed, try signup
    console.log('🔐 Sign-in failed, attempting sign-up...');
    const signupResult = await executeTest({
      id: 'auto-signup',
      method: 'POST',
      endpoint: '/auth/v1/signup',
      body: {
        ...TEST_CREDENTIALS,
        data: { full_name: 'Test User (Auto)' }
      },
      skipAutoAuth: true
    }, 'auth');

    if (isSuccessfulStatus(signupResult.status)) {
      console.log('✅ Auto sign-up successful');
      return { success: true };
    }

    return {
      success: false,
      error: `Authentication failed: Sign-in (${signinResult.status}) and Sign-up (${signupResult.status}) both failed`
    };

  } catch (error) {
    return {
      success: false,
      error: `Authentication error: ${error.message}`
    };
  }
}

// Function to prepare test body with appropriate credentials
function prepareTestBody(test) {
  if (!test.body) return null;
  
  // Clone the test body to avoid modifying the original
  let body = JSON.parse(JSON.stringify(test.body));
  
  // For specific tests that need existing users or error conditions
  if (test.id === 'invalid-credentials' || test.id === 'signin-existing-user') {
    // Use existing user credentials for these tests
    body.email = EXISTING_USER_CREDENTIALS.email;
    body.password = EXISTING_USER_CREDENTIALS.password;
  } else if (test.id === 'request-password-reset') {
    // Use current test user email for password reset
    body.email = TEST_CREDENTIALS.email;
  } else if (body.email || body.password) {
    // For most tests, use the random generated credentials
    if (body.email) body.email = TEST_CREDENTIALS.email;
    if (body.password) body.password = TEST_CREDENTIALS.password;
  }
  
  return body;
}

// Core test execution function
async function executeTest(test, testType) {
  const startTime = Date.now();
  
  try {
    // Auto-authenticate if test requires auth
    if (test.requiresAuth && !test.skipAutoAuth) {
      const authResult = await ensureAuthenticated();
      if (!authResult.success) {
        return {
          testId: test.id,
          name: test.name,
          method: test.method,
          endpoint: test.endpoint,
          status: 401,
          statusText: 'Authentication Required',
          data: { error: 'authentication_required', message: authResult.error },
          headers: {},
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          error: authResult.error,
          testType
        };
      }
    }

    const url = `${BASE_URL}${test.endpoint}`;
    const requestOptions = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Add API key for REST tests
    if (testType === 'api') {
      requestOptions.headers['apikey'] = 'test-api-key';
    }

    // Add authorization header if test requires auth
    if (test.requiresAuth && authState.accessToken) {
      requestOptions.headers['Authorization'] = `Bearer ${authState.accessToken}`;
    }

    // Prepare test body with appropriate credentials
    let testBody = prepareTestBody(test);
    
    // Handle refresh token specially
    if (test.id === 'refresh-token' && authState.refreshToken) {
      testBody = { refresh_token: authState.refreshToken };
    }

    // Add body for POST/PATCH/PUT
    if (testBody && ['POST', 'PATCH', 'PUT'].includes(test.method)) {
      requestOptions.body = JSON.stringify(testBody);
    }

    const response = await fetch(url, requestOptions);
    const responseTime = Date.now() - startTime;

    let data;
    const contentType = response.headers.get('content-type');

    if (response.status === 204) {
      data = null;
    } else if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }
    } else {
      data = await response.text();
    }

    // Store auth data from successful responses
    if (response.ok && (test.id.includes('signin') || test.id.includes('signup') || test.id.includes('refresh'))) {
      authState.accessToken = data?.access_token || data?.session?.access_token || authState.accessToken;
      authState.refreshToken = data?.refresh_token || data?.session?.refresh_token || authState.refreshToken;
      authState.session = data?.session || authState.session;
      authState.user = data?.user || authState.user;
    }

    // Clear auth data on logout
    if (response.ok && test.id.includes('logout')) {
      authState = { accessToken: null, refreshToken: null, session: null, user: null };
    }

    // Convert headers to plain object
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      testId: test.id,
      name: test.name,
      method: test.method,
      endpoint: test.endpoint,
      status: response.status,
      statusText: response.statusText,
      data,
      headers,
      responseTime,
      timestamp: new Date().toISOString(),
      testType
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      testId: test.id,
      name: test.name,
      method: test.method,
      endpoint: test.endpoint,
      status: 0,
      statusText: 'Network Error',
      data: null,
      headers: {},
      responseTime,
      timestamp: new Date().toISOString(),
      error: error.message,
      testType
    };
  }
}

// Test analysis functions
function analyzeCompatibilityIssues(result) {
  const issues = [];
  const { status, data, endpoint, method, testId } = result;

  // Check for common compatibility issues
  if (status === 404 && !testId.includes('not-found') && !testId.includes('nonexistent')) {
    issues.push({
      type: 'missing_endpoint',
      testId,
      endpoint,
      method,
      description: `Endpoint ${method} ${endpoint} returns 404 - may not be implemented`,
      severity: 'high'
    });
  }

  if (status === 400 && data?.message) {
    issues.push({
      type: 'parameter_error',
      testId,
      endpoint,
      method,
      description: `Parameter validation error: ${data.message}`,
      severity: 'medium'
    });
  }

  if (status === 500) {
    issues.push({
      type: 'server_error',
      testId,
      endpoint,
      method,
      description: 'Internal server error - possible implementation issue',
      severity: 'high'
    });
  }

  // Check response structure compatibility
  if (isSuccessfulStatus(status) && data) {
    if (endpoint.includes('/auth/v1/') && !data.access_token && !data.session && testId.includes('signin')) {
      issues.push({
        type: 'response_structure',
        testId,
        endpoint,
        description: 'Auth response missing expected access_token or session',
        severity: 'high'
      });
    }
  }

  return issues;
}

// Main test execution
async function runAuthenticationTests() {
  console.log('\n🔐 Running Authentication Tests...\n');
  
  for (const category of authTestCategories) {
    console.log(`📁 ${category.name} (${category.tests.length} tests)`);
    
    for (const test of category.tests) {
      process.stdout.write(`  ⏳ ${test.name}... `);
      
      const result = await executeTest(test, 'auth');
      const passed = isSuccessfulStatus(result.status) || 
                    (test.id.includes('invalid') || test.id.includes('wrong') || test.id.includes('malformed')) && result.status >= 400;
      
      if (passed) {
        console.log(`✅ ${test.name}: ${result.status} (${result.responseTime}ms)`);
        testResults.authentication.stats.passed++;
      } else {
        console.log(`❌ ${test.name}: ${result.status} ${result.statusText} (${result.responseTime}ms)`);
        testResults.authentication.stats.failed++;
        
        // Analyze compatibility issues
        const issues = analyzeCompatibilityIssues(result);
        testResults.compatibility_issues.push(...issues);
      }
      
      testResults.authentication.tests.push({
        ...result,
        passed,
        category: category.name
      });
      testResults.authentication.stats.total++;
      
      // Delay between tests (200ms like test-app)
      await sleep(200);
    }
    
    console.log('');
  }
}

async function runAPITests() {
  console.log('\n🔗 Running API Tests...\n');
  
  for (const category of apiTestCategories) {
    console.log(`📁 ${category.name} (${category.tests.length} tests)`);
    
    for (const test of category.tests) {
      process.stdout.write(`  ⏳ ${test.name}... `);
      
      const result = await executeTest(test, 'api');
      const passed = isSuccessfulStatus(result.status) || 
                    (test.id.includes('not-found') || test.id.includes('invalid') || test.id.includes('missing')) && result.status >= 400;
      
      if (passed) {
        console.log(`✅ ${test.name}: ${result.status} (${result.responseTime}ms)`);
        testResults.api.stats.passed++;
      } else {
        console.log(`❌ ${test.name}: ${result.status} ${result.statusText} (${result.responseTime}ms)`);
        testResults.api.stats.failed++;
        
        // Analyze compatibility issues
        const issues = analyzeCompatibilityIssues(result);
        testResults.compatibility_issues.push(...issues);
      }
      
      testResults.api.tests.push({
        ...result,
        passed,
        category: category.name
      });
      testResults.api.stats.total++;
      
      // Delay between tests (100ms like test-app)
      await sleep(100);
    }
    
    console.log('');
  }
}

function generateReport() {
  testResults.summary.endTime = new Date().toISOString();
  testResults.summary.total = testResults.authentication.stats.total + testResults.api.stats.total;
  testResults.summary.passed = testResults.authentication.stats.passed + testResults.api.stats.passed;
  testResults.summary.failed = testResults.authentication.stats.failed + testResults.api.stats.failed;
  
  // Save results to files
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonFilename = `curl-test-results-${timestamp}.json`;
  const txtFilename = `curl-test-results-${timestamp}.txt`;
  
  // Save JSON results
  fs.writeFileSync(jsonFilename, JSON.stringify(testResults, null, 2));
  
  // Save console output to TXT file
  fs.writeFileSync(txtFilename, consoleOutput.join('\n'));
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📅 Started: ${testResults.summary.startTime}`);
  console.log(`📅 Ended: ${testResults.summary.endTime}`);
  console.log('');
  console.log(`📈 Overall Results:`);
  console.log(`   Total Tests: ${testResults.summary.total}`);
  console.log(`   Passed: ${testResults.summary.passed} (${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${testResults.summary.failed} (${((testResults.summary.failed / testResults.summary.total) * 100).toFixed(1)}%)`);
  console.log('');
  console.log(`🔐 Authentication Tests: ${testResults.authentication.stats.passed}/${testResults.authentication.stats.total} passed`);
  console.log(`🔗 API Tests: ${testResults.api.stats.passed}/${testResults.api.stats.total} passed`);
  console.log('');
  
  if (testResults.compatibility_issues.length > 0) {
    console.log(`⚠️  Compatibility Issues Found: ${testResults.compatibility_issues.length}`);
    
    const highSeverity = testResults.compatibility_issues.filter(i => i.severity === 'high');
    const mediumSeverity = testResults.compatibility_issues.filter(i => i.severity === 'medium');
    
    if (highSeverity.length > 0) {
      console.log(`   🔴 High Severity: ${highSeverity.length}`);
    }
    if (mediumSeverity.length > 0) {
      console.log(`   🟡 Medium Severity: ${mediumSeverity.length}`);
    }
    
    console.log('\n⚠️  Top Compatibility Issues:');
    testResults.compatibility_issues.slice(0, 5).forEach((issue, index) => {
      console.log(`   ${index + 1}. [${issue.testId}] ${issue.description}`);
    });
    
    if (testResults.compatibility_issues.length > 5) {
      console.log(`   ... and ${testResults.compatibility_issues.length - 5} more issues`);
    }
  } else {
    console.log('✅ No compatibility issues detected!');
  }
  
  console.log('');
  console.log(`💾 Detailed results saved to: ${jsonFilename}`);
  console.log(`📝 Console output saved to: ${txtFilename}`);
  console.log('='.repeat(80));
}

// Pre-flight environment validation
async function validateEnvironment() {
  console.log('🔍 Running Pre-Flight Checks...');
  
  // Test the actual REST API endpoint that will be used by tests
  process.stdout.write('  ⏳ API & Database Check: ');
  try {
    const apiStart = Date.now();
    const apiResponse = await fetch(`${BASE_URL}/rest/v1/products?limit=1`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'apikey': 'test-api-key'
      },
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });
    
    const apiTime = Date.now() - apiStart;
    
    if (!apiResponse.ok) {
      console.log(`❌ Failed (${apiResponse.status} ${apiResponse.statusText})`);
      
      // Check for WebSocket bridge requirement
      if (apiResponse.status === 503) {
        try {
          const errorResponse = await apiResponse.json();
          if (errorResponse.error === 'Browser database not connected') {
            return {
              success: false,
              error: 'WebSocket bridge not active: Please open http://localhost:5173 in your browser to initialize the database connection, then run this test.'
            };
          }
        } catch (e) {
          // Fall through to generic error handling
        }
      }
      
      // Provide specific guidance based on status code
      let errorGuidance = '';
      if (apiResponse.status === 404) {
        errorGuidance = ' - REST API endpoints may not be configured';
      } else if (apiResponse.status >= 500) {
        errorGuidance = ' - Server or database connection issue';
      }
      
      return {
        success: false,
        error: `API check failed: ${apiResponse.status} ${apiResponse.statusText}${errorGuidance}`
      };
    }
    
    // Validate response contains data
    let productsData;
    try {
      productsData = await apiResponse.json();
    } catch (error) {
      console.log('❌ Invalid JSON response');
      return {
        success: false,
        error: 'API check failed: Invalid JSON response from products endpoint'
      };
    }
    
    // Check if we got products data
    if (!Array.isArray(productsData)) {
      console.log('❌ Unexpected response format');
      return {
        success: false,
        error: 'API check failed: Expected array response from products endpoint'
      };
    }
    
    if (productsData.length === 0) {
      console.log('❌ No products found');
      return {
        success: false,
        error: 'Database check failed: Products table is empty. Please load Northwind sample data.'
      };
    }
    
    console.log(`✅ API responding, Northwind data loaded (${apiTime}ms)`);
  } catch (error) {
    console.log(`❌ Failed (${error.message})`);
    
    // Provide specific guidance for common connection issues
    let errorGuidance = '';
    if (error.message.includes('ECONNREFUSED')) {
      errorGuidance = ' - Server not running on specified port';
    } else if (error.message.includes('timeout')) {
      errorGuidance = ' - Server response timeout, may be initializing';
    }
    
    return {
      success: false,
      error: `API check failed: ${error.message}${errorGuidance}`
    };
  }
  
  // Additional quick check: Test a simple products count via REST API
  process.stdout.write('  ⏳ Data Validation: ');
  try {
    const countStart = Date.now();
    const countResponse = await fetch(`${BASE_URL}/rest/v1/products?select=count()`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'apikey': 'test-api-key'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    const countTime = Date.now() - countStart;
    
    if (countResponse.ok) {
      const countData = await countResponse.json();
      const productCount = countData[0]?.count || 0;
      console.log(`✅ ${productCount} products available (${countTime}ms)`);
    } else {
      // If count query fails, it's not critical - we already validated basic API access
      console.log(`⚠️ Count query failed, but basic API is working (${countTime}ms)`);
    }
  } catch (error) {
    // Count validation is optional - don't fail if it doesn't work
    console.log(`⚠️ Count query failed, but basic API is working`);
  }
  
  console.log('  ✅ Environment Ready!\n');
  return { success: true };
}

// Main execution
async function main() {
  console.log('🚀 Supabase Lite Compatibility Test Runner (curl-based)');
  console.log(`🌐 Testing against: ${BASE_URL}`);
  console.log(`📧 Test credentials: ${TEST_CREDENTIALS.email}`);
  console.log('');
  
  try {
    // Run pre-flight validation
    const validation = await validateEnvironment();
    if (!validation.success) {
      console.error(`❌ Environment validation failed: ${validation.error}`);
      console.log('\n💡 Please ensure:');
      console.log('  1. Supabase Lite is running (npm run dev)');
      console.log('  2. Server is accessible at the specified URL');
      console.log('  3. Northwind sample data is loaded (products table)');
      console.log('  4. REST API endpoints are configured and working');
      process.exit(1);
    }
    
    await runAuthenticationTests();
    await runAPITests();
    generateReport();
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main, executeTest, authTestCategories, apiTestCategories };