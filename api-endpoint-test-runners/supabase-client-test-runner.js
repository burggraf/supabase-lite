#!/usr/bin/env node

/**
 * Supabase Client Test Runner for Supabase Lite
 * 
 * This script tests all Authentication and API endpoints using the official
 * @supabase/supabase-js client library to compare behavior with the curl-based
 * test runner and identify compatibility issues.
 * 
 * Usage: node supabase-client-test-runner.js [base-url]
 * Default base URL: http://localhost:5173
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:5173';
const ANON_KEY = 'test-api-key'; // Mock API key for demo

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

// Initialize Supabase client
const supabase = createClient(BASE_URL, ANON_KEY);

// Test results storage
let testResults = {
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    startTime: new Date().toISOString(),
    endTime: null,
    baseUrl: BASE_URL,
    clientVersion: 'latest' // Could be dynamic
  },
  authentication: {
    tests: [],
    stats: { total: 0, passed: 0, failed: 0 }
  },
  api: {
    tests: [],
    stats: { total: 0, passed: 0, failed: 0 }
  },
  compatibility_issues: [],
  client_specific_issues: []
};

// Test definitions (same structure as curl runner but mapped to client methods)
const authTestDefinitions = [
  {
    id: 'signup-email',
    name: 'Sign Up with Email',
    description: 'Create a new user account with email and password',
    clientMethod: 'signUp',
    params: {
      email: TEST_CREDENTIALS.email,
      password: TEST_CREDENTIALS.password,
      options: {
        data: {
          full_name: 'Test User'
        }
      }
    }
  },
  {
    id: 'auto-signin',
    name: 'Auto Sign In (Helper)',
    description: 'Helper method to sign in for testing auth-required endpoints',
    clientMethod: 'signInWithPassword',
    params: {
      email: TEST_CREDENTIALS.email,
      password: TEST_CREDENTIALS.password
    },
    isHelper: true
  },
  {
    id: 'auto-signup',
    name: 'Auto Sign Up (Helper)',
    description: 'Helper method to sign up when auto sign-in fails',
    clientMethod: 'signUp',
    params: {
      email: TEST_CREDENTIALS.email,
      password: TEST_CREDENTIALS.password,
      options: {
        data: {
          full_name: 'Test User (Auto)'
        }
      }
    },
    isHelper: true
  },
  {
    id: 'signin-email',
    name: 'Sign In with Email',
    description: 'Authenticate user with email and password',
    clientMethod: 'signInWithPassword',
    params: {
      email: TEST_CREDENTIALS.email,
      password: TEST_CREDENTIALS.password
    }
  },
  {
    id: 'get-session',
    name: 'Get Current Session',
    description: 'Retrieve current session information',
    clientMethod: 'getSession',
    requiresAuth: true
  },
  {
    id: 'get-user',
    name: 'Get Current User',
    description: 'Get current user profile and metadata',
    clientMethod: 'getUser',
    requiresAuth: true
  },
  {
    id: 'refresh-session',
    name: 'Refresh Session',
    description: 'Refresh the current session',
    clientMethod: 'refreshSession',
    requiresAuth: true
  },
  {
    id: 'update-user-profile',
    name: 'Update User Profile',
    description: 'Update user metadata and profile information',
    clientMethod: 'updateUser',
    params: {
      data: {
        full_name: 'Updated Test User',
        avatar_url: 'https://example.com/avatar.jpg'
      }
    },
    requiresAuth: true
  },
  {
    id: 'update-password',
    name: 'Update Password',
    description: 'Change user password',
    clientMethod: 'updateUser',
    params: {
      password: 'newPassword123$'
    },
    requiresAuth: true
  },
  {
    id: 'request-password-reset',
    name: 'Request Password Reset',
    description: 'Send password reset email to user',
    clientMethod: 'resetPasswordForEmail',
    params: {
      email: TEST_CREDENTIALS.email
    }
  },
  {
    id: 'signup-phone',
    name: 'Sign Up with Phone',
    description: 'Create a new user account with phone number and password',
    clientMethod: 'signUp',
    params: {
      phone: '+1234567890',
      password: 'Password123$',
      options: {
        data: {
          full_name: 'Test Phone User'
        }
      }
    }
  },
  {
    id: 'signin-phone',
    name: 'Sign In with Phone',
    description: 'Authenticate user with phone number and password',
    clientMethod: 'signInWithPassword',
    params: {
      phone: '+1234567890',
      password: 'Password123$'
    }
  },
  {
    id: 'update-user-email',
    name: 'Update Email Address',
    description: 'Change user email address (requires confirmation)',
    clientMethod: 'updateUser',
    params: {
      email: 'newemail@example.com'
    },
    requiresAuth: true
  },
  {
    id: 'update-user-phone',
    name: 'Update Phone Number',
    description: 'Change user phone number (requires verification)',
    clientMethod: 'updateUser',
    params: {
      phone: '+9876543210'
    },
    requiresAuth: true
  },
  {
    id: 'confirm-password-reset',
    name: 'Confirm Password Reset',
    description: 'Complete password reset with token',
    clientMethod: 'verifyOtp',
    params: {
      type: 'recovery',
      token: 'mock-recovery-token'
    }
  },
  {
    id: 'magic-link-signin',
    name: 'Request Magic Link',
    description: 'Send magic link for passwordless sign in',
    clientMethod: 'signInWithOtp',
    params: {
      email: TEST_CREDENTIALS.email
    }
  },
  {
    id: 'verify-magic-link',
    name: 'Verify Magic Link Token',
    description: 'Complete magic link authentication',
    clientMethod: 'verifyOtp',
    params: {
      type: 'magiclink',
      token: 'mock-magic-token',
      email: TEST_CREDENTIALS.email
    }
  },
  {
    id: 'otp-email',
    name: 'Request OTP (Email)',
    description: 'Send one-time password to email',
    clientMethod: 'signInWithOtp',
    params: {
      email: TEST_CREDENTIALS.email,
      options: {
        shouldCreateUser: false
      }
    }
  },
  {
    id: 'otp-phone',
    name: 'Request OTP (SMS)',
    description: 'Send one-time password via SMS',
    clientMethod: 'signInWithOtp',
    params: {
      phone: '+1234567890',
      options: {
        shouldCreateUser: false
      }
    }
  },
  {
    id: 'verify-otp-email',
    name: 'Verify OTP (Email)',
    description: 'Verify email OTP token',
    clientMethod: 'verifyOtp',
    params: {
      type: 'email',
      token: '123456',
      email: TEST_CREDENTIALS.email
    }
  },
  {
    id: 'verify-otp-phone',
    name: 'Verify OTP (Phone)',
    description: 'Verify SMS OTP token',
    clientMethod: 'verifyOtp',
    params: {
      type: 'sms',
      token: '654321',
      phone: '+1234567890'
    }
  },
  {
    id: 'resend-email-confirmation',
    name: 'Resend Email Confirmation',
    description: 'Resend email confirmation link',
    clientMethod: 'resend',
    params: {
      type: 'signup',
      email: TEST_CREDENTIALS.email
    }
  },
  {
    id: 'verify-email-token',
    name: 'Verify Email Token',
    description: 'Complete email verification',
    clientMethod: 'verifyOtp',
    params: {
      type: 'signup',
      token: 'mock-confirmation-token',
      email: TEST_CREDENTIALS.email
    }
  },
  {
    id: 'resend-phone-confirmation',
    name: 'Resend Phone Confirmation',
    description: 'Resend phone verification SMS',
    clientMethod: 'resend',
    params: {
      type: 'sms',
      phone: '+1234567890'
    }
  },
  {
    id: 'verify-phone-token',
    name: 'Verify Phone Token',
    description: 'Complete phone number verification',
    clientMethod: 'verifyOtp',
    params: {
      type: 'sms',
      token: '789012',
      phone: '+1234567890'
    }
  },
  {
    id: 'list-mfa-factors',
    name: 'List MFA Factors',
    description: 'Get all enrolled MFA factors for user',
    clientMethod: 'mfa.listFactors',
    requiresAuth: true
  },
  {
    id: 'enroll-totp-factor',
    name: 'Enroll TOTP Factor',
    description: 'Enroll a new TOTP (authenticator app) factor',
    clientMethod: 'mfa.enroll',
    params: {
      factorType: 'totp',
      friendlyName: 'My Authenticator App'
    },
    requiresAuth: true
  },
  {
    id: 'verify-totp-enrollment',
    name: 'Verify TOTP Enrollment',
    description: 'Complete TOTP factor enrollment with code',
    clientMethod: 'mfa.challengeAndVerify',
    params: {
      factorId: 'mock-factor-id',
      code: '123456'
    },
    requiresAuth: true
  },
  {
    id: 'enroll-phone-factor',
    name: 'Enroll Phone Factor',
    description: 'Enroll phone number for SMS MFA',
    clientMethod: 'mfa.enroll',
    params: {
      factorType: 'phone',
      phone: '+1234567890'
    },
    requiresAuth: true
  },
  {
    id: 'create-mfa-challenge',
    name: 'Create MFA Challenge',
    description: 'Generate MFA challenge for authentication',
    clientMethod: 'mfa.challenge',
    params: {
      factorId: 'mock-factor-id'
    },
    requiresAuth: true
  },
  {
    id: 'verify-mfa-challenge',
    name: 'Verify MFA Challenge',
    description: 'Complete MFA challenge verification',
    clientMethod: 'mfa.verify',
    params: {
      factorId: 'mock-factor-id',
      challengeId: 'mock-challenge-id',
      code: '654321'
    },
    requiresAuth: true
  },
  {
    id: 'unenroll-mfa-factor',
    name: 'Unenroll MFA Factor',
    description: 'Remove MFA factor from account',
    clientMethod: 'mfa.unenroll',
    params: {
      factorId: 'mock-factor-id'
    },
    requiresAuth: true
  },
  {
    id: 'oauth-authorize-google',
    name: 'OAuth Authorize (Google)',
    description: 'Initiate Google OAuth authorization flow',
    clientMethod: 'signInWithOAuth',
    params: {
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:5176/callback'
      }
    }
  },
  {
    id: 'oauth-authorize-github',
    name: 'OAuth Authorize (GitHub)',
    description: 'Initiate GitHub OAuth authorization flow',
    clientMethod: 'signInWithOAuth',
    params: {
      provider: 'github',
      options: {
        redirectTo: 'http://localhost:5176/callback'
      }
    }
  },
  {
    id: 'oauth-callback',
    name: 'OAuth Callback',
    description: 'Handle OAuth provider callback',
    clientMethod: 'exchangeCodeForSession',
    params: {
      authCode: 'mock-oauth-code'
    }
  },
  {
    id: 'link-identity',
    name: 'Link Social Identity',
    description: 'Link additional social identity to account',
    clientMethod: 'linkIdentity',
    params: {
      provider: 'github'
    },
    requiresAuth: true
  },
  {
    id: 'unlink-identity',
    name: 'Unlink Social Identity',
    description: 'Remove linked social identity',
    clientMethod: 'unlinkIdentity',
    params: {
      identity: {
        provider: 'github',
        id: 'mock-identity-id'
      }
    },
    requiresAuth: true
  },
  {
    id: 'get-identities',
    name: 'Get Linked Identities',
    description: 'List all linked social identities',
    clientMethod: 'getUserIdentities',
    requiresAuth: true
  },
  {
    id: 'admin-list-users',
    name: 'List All Users (Admin)',
    description: 'Get paginated list of all users',
    clientMethod: 'admin.listUsers',
    params: {
      page: 1,
      perPage: 10
    },
    requiresAuth: true,
    adminOnly: true
  },
  {
    id: 'admin-get-user',
    name: 'Get User by ID (Admin)',
    description: 'Get specific user details by ID',
    clientMethod: 'admin.getUserById',
    params: {
      uid: 'mock-user-id'
    },
    requiresAuth: true,
    adminOnly: true
  },
  {
    id: 'admin-create-user',
    name: 'Create User (Admin)',
    description: 'Create new user account as admin',
    clientMethod: 'admin.createUser',
    params: {
      email: 'admin-created@example.com',
      password: 'Password123$',
      email_confirm: true,
      user_metadata: {
        full_name: 'Admin Created User'
      }
    },
    requiresAuth: true,
    adminOnly: true
  },
  {
    id: 'admin-update-user',
    name: 'Update User (Admin)',
    description: 'Update user account as admin',
    clientMethod: 'admin.updateUserById',
    params: {
      uid: 'mock-user-id',
      attributes: {
        role: 'authenticated',
        user_metadata: {
          full_name: 'Updated by Admin'
        }
      }
    },
    requiresAuth: true,
    adminOnly: true
  },
  {
    id: 'admin-delete-user',
    name: 'Delete User (Admin)',
    description: 'Permanently delete user account',
    clientMethod: 'admin.deleteUser',
    params: {
      uid: 'mock-user-id'
    },
    requiresAuth: true,
    adminOnly: true
  },
  {
    id: 'admin-generate-invite',
    name: 'Generate Invite Link',
    description: 'Generate invitation link for new user',
    clientMethod: 'admin.generateLink',
    params: {
      type: 'invite',
      email: 'invite@example.com',
      options: {
        redirectTo: 'http://localhost:5176/welcome'
      }
    },
    requiresAuth: true,
    adminOnly: true
  },
  {
    id: 'signin-anonymous',
    name: 'Sign In Anonymously',
    description: 'Create anonymous user session',
    clientMethod: 'signInAnonymously'
  },
  {
    id: 'convert-anonymous',
    name: 'Convert Anonymous to Permanent',
    description: 'Convert anonymous user to permanent account',
    clientMethod: 'updateUser',
    params: {
      email: 'converted@example.com',
      password: 'Password123$'
    },
    requiresAuth: true
  },
  {
    id: 'link-anonymous-session',
    name: 'Link Anonymous Session',
    description: 'Link anonymous session to existing account',
    clientMethod: 'linkIdentity',
    params: {
      provider: 'email',
      email: 'existing@example.com'
    },
    requiresAuth: true
  },
  {
    id: 'list-sessions',
    name: 'List All Sessions',
    description: 'Get all active sessions for current user',
    clientMethod: 'admin.listSessions',
    requiresAuth: true
  },
  {
    id: 'revoke-session',
    name: 'Revoke Specific Session',
    description: 'Revoke a specific session by ID',
    clientMethod: 'admin.deleteSession',
    params: {
      sessionId: 'mock-session-id'
    },
    requiresAuth: true
  },
  {
    id: 'revoke-other-sessions',
    name: 'Revoke Other Sessions',
    description: 'Sign out from all other sessions',
    clientMethod: 'signOut',
    params: {
      scope: 'others'
    },
    requiresAuth: true
  },
  {
    id: 'extend-session',
    name: 'Extend Session',
    description: 'Extend session before expiry',
    clientMethod: 'refreshSession',
    requiresAuth: true
  },
  {
    id: 'invalid-credentials',
    name: 'Invalid Credentials',
    description: 'Test authentication with wrong password (401 error)',
    clientMethod: 'signInWithPassword',
    params: {
      email: TEST_CREDENTIALS.email,
      password: 'wrongpassword'
    }
  },
  {
    id: 'malformed-email',
    name: 'Malformed Email',
    description: 'Test signup with invalid email format (422 error)',
    clientMethod: 'signUp',
    params: {
      email: 'not-an-email',
      password: 'Password123$'
    }
  },
  {
    id: 'weak-password',
    name: 'Weak Password',
    description: 'Test password strength validation (422 error)',
    clientMethod: 'signUp',
    params: {
      email: 'weak@example.com',
      password: '123'
    }
  },
  {
    id: 'expired-token',
    name: 'Expired Token Access',
    description: 'Test access with expired JWT token (401 error)',
    clientMethod: 'getUser',
    requiresAuth: true
  },
  {
    id: 'invalid-token',
    name: 'Invalid Token Format',
    description: 'Test access with malformed token (401 error)',
    clientMethod: 'getUser'
  },
  {
    id: 'rate-limit-test',
    name: 'Rate Limit Test',
    description: 'Test authentication rate limiting (429 error after multiple attempts)',
    clientMethod: 'signInWithPassword',
    params: {
      email: 'rate-limit-test@example.com',
      password: 'Password123$'
    }
  },
  {
    id: 'logout',
    name: 'Sign Out',
    description: 'Sign out current user session',
    clientMethod: 'signOut',
    requiresAuth: true
  },
  {
    id: 'logout-global',
    name: 'Sign Out (All Sessions)',
    description: 'Sign out user from all sessions',
    clientMethod: 'signOut',
    params: {
      scope: 'global'
    },
    requiresAuth: true
  },
  {
    id: 'convert-anonymous',
    name: 'Convert Anonymous to Permanent',
    description: 'Convert anonymous user to permanent account',
    clientMethod: 'updateUser',
    params: {
      email: 'converted@example.com',
      password: 'Password123$'
    },
    requiresAuth: true
  },
  {
    id: 'rate-limit-test',
    name: 'Rate Limit Test',
    description: 'Test authentication rate limiting (429 error after multiple attempts)',
    clientMethod: 'signInWithPassword',
    params: {
      email: 'rate-limit-test@example.com',
      password: 'Password123$'
    }
  },
  {
    id: 'refresh-token',
    name: 'Refresh Access Token',
    description: 'Get new access token using refresh token',
    clientMethod: 'refreshSession',
    requiresAuth: true
  }
];

const apiTestDefinitions = [
  {
    id: 'get-all-products',
    name: 'Get All Products',
    description: 'Retrieve all products from the catalog',
    table: 'products',
    operation: 'select',
    params: ['*']
  },
  {
    id: 'text-search',
    name: 'Text Search',
    description: 'Search for products containing "seafood" in the name',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: [{ column: 'product_name', operator: 'ilike', value: '%seafood%' }]
  },
  {
    id: 'get-specific-fields',
    name: 'Get Specific Fields',
    description: 'Select only specific columns from products table',
    table: 'products',
    operation: 'select',
    params: ['product_name', 'unit_price', 'units_in_stock']
  },
  {
    id: 'get-single-product',
    name: 'Get Single Product',
    description: 'Retrieve a specific product by ID',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: [{ column: 'product_id', operator: 'eq', value: 1 }]
  },
  {
    id: 'create-product',
    name: 'Create New Product',
    description: 'Add a new product to the catalog',
    table: 'products',
    operation: 'insert',
    params: {
      product_id: 999,
      product_name: 'Test Product',
      unit_price: 25.99,
      units_in_stock: 100,
      category_id: 1,
      supplier_id: 1,
      discontinued: 0
    }
  },
  {
    id: 'update-product',
    name: 'Update Product',
    description: 'Update an existing product\'s price',
    table: 'products',
    operation: 'update',
    params: { unit_price: 29.99 },
    filters: [{ column: 'product_id', operator: 'eq', value: 1 }]
  },
  {
    id: 'delete-product',
    name: 'Delete Test Product',
    description: 'Remove the test product we created',
    table: 'products',
    operation: 'delete',
    filters: [{ column: 'product_name', operator: 'eq', value: 'Test Product' }]
  },
  {
    id: 'price-filter',
    name: 'Price Range Filter',
    description: 'Find products in a specific price range ($20-$50)',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: [
      { column: 'unit_price', operator: 'gte', value: 20 },
      { column: 'unit_price', operator: 'lte', value: 50 }
    ]
  },
  {
    id: 'text-search',
    name: 'Text Search',
    description: 'Search for products containing "seafood" in the name',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: [{ column: 'product_name', operator: 'ilike', value: '%seafood%' }]
  },
  {
    id: 'complex-filter',
    name: 'Complex Filter + Sort',
    description: 'Active products sorted by price (highest first)',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: [{ column: 'discontinued', operator: 'eq', value: 0 }],
    orderBy: { column: 'unit_price', ascending: false },
    limit: 10
  },
  {
    id: 'orders-with-customers',
    name: 'Orders with Customer Details',
    description: 'Get orders with embedded customer information',
    table: 'orders',
    operation: 'select',
    params: ['*, customers(customer_id, company_name, contact_name)'],
    limit: 5
  },
  {
    id: 'products-with-categories',
    name: 'Products with Categories',
    description: 'Products with their category names',
    table: 'products',
    operation: 'select',
    params: ['product_name', 'unit_price', 'categories(category_name)'],
    limit: 10
  },
  {
    id: 'multiple-values',
    name: 'Multiple Values (IN)',
    description: 'Products from categories 1, 2, or 3',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: [{ column: 'category_id', operator: 'in', value: '(1,2,3)' }]
  },
  {
    id: 'low-stock',
    name: 'Low Stock Alert',
    description: 'Find active products with low inventory (≤10 units)',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: [
      { column: 'units_in_stock', operator: 'lte', value: 10 },
      { column: 'discontinued', operator: 'eq', value: 0 }
    ]
  },
  {
    id: 'order-details-full',
    name: 'Order Details with Products',
    description: 'Order line items with product and order information',
    table: 'order_details',
    operation: 'select',
    params: ['*, orders(order_date), products(product_name, unit_price)'],
    limit: 5
  },
  {
    id: 'customer-order-count',
    name: 'Customers with Order Count',
    description: 'Customer list with total number of orders',
    table: 'customers',
    operation: 'select',
    params: ['company_name', 'contact_name', 'orders(count)'],
    limit: 10
  },
  {
    id: 'basic-limit',
    name: 'Basic Limit',
    description: 'Get first 5 products',
    table: 'products',
    operation: 'select',
    params: ['*'],
    limit: 5
  },
  {
    id: 'pagination',
    name: 'Pagination (Offset)',
    description: 'Get products 11-15 (page 3 with 5 per page)',
    table: 'products',
    operation: 'select',
    params: ['*'],
    limit: 5,
    offset: 10
  },
  {
    id: 'recent-orders',
    name: 'Recent Orders',
    description: 'Get 10 most recent orders',
    table: 'orders',
    operation: 'select',
    params: ['*'],
    orderBy: { column: 'order_date', ascending: false },
    limit: 10
  },
  {
    id: 'count-only',
    name: 'Count Only',
    description: 'Get total product count without data',
    table: 'products',
    operation: 'select',
    params: ['count(*)'],
    single: true
  },
  {
    id: 'monthly-sales',
    name: 'Monthly Sales Report',
    description: 'Orders from January 1997 for sales analysis',
    table: 'orders',
    operation: 'select',
    params: ['order_id', 'order_date', 'freight'],
    filters: [
      { column: 'order_date', operator: 'gte', value: '1997-01-01' },
      { column: 'order_date', operator: 'lt', value: '1997-02-01' }
    ]
  },
  {
    id: 'vip-customers',
    name: 'VIP Customers',
    description: 'Customers with 10 or more orders',
    table: 'customers',
    operation: 'select',
    params: ['*, orders(count)'],
    filters: [{ column: 'orders.count', operator: 'gte', value: 10 }]
  },
  {
    id: 'premium-products',
    name: 'Premium Products',
    description: 'High-value products over $100',
    table: 'products',
    operation: 'select',
    params: ['*, categories(category_name)'],
    filters: [{ column: 'unit_price', operator: 'gte', value: 100 }]
  },
  {
    id: 'employee-territories',
    name: 'Employee Territories',
    description: 'Employee list with territory assignments',
    table: 'employees',
    operation: 'select',
    params: ['first_name', 'last_name', 'title', 'employee_territories(count)']
  },
  {
    id: 'table-not-found',
    name: 'Table Not Found',
    description: 'Try to access a table that doesn\'t exist (404 error)',
    table: 'nonexistent_table',
    operation: 'select',
    params: ['*']
  },
  {
    id: 'invalid-column',
    name: 'Invalid Column',
    description: 'Query with non-existent column (400 error)',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: [{ column: 'invalid_column', operator: 'eq', value: 'test' }]
  },
  {
    id: 'missing-required-fields',
    name: 'Missing Required Fields',
    description: 'Create product without required fields (422 error)',
    table: 'products',
    operation: 'insert',
    params: {
      unit_price: 25.99
    }
  },
  {
    id: 'invalid-parameter',
    name: 'Invalid Parameter',
    description: 'Use invalid value for limit parameter (400 error)',
    table: 'products',
    operation: 'select',
    params: ['*'],
    limit: 'invalid'
  },
  {
    id: 'complex-filter',
    name: 'Complex Filter + Sort',
    description: 'Active products sorted by price (highest first)',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: {
      discontinued: { eq: 0 }
    },
    order: { column: 'unit_price', ascending: false },
    limit: 10
  },
  {
    id: 'multiple-values',
    name: 'Multiple Values (IN)',
    description: 'Products from categories 1, 2, or 3',
    table: 'products',
    operation: 'select',
    params: ['*'],
    filters: {
      category_id: { in: [1, 2, 3] }
    }
  }
];

// Utility functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getStatusFromSupabaseResponse(response) {
  if (response.error) {
    // Map common Supabase errors to HTTP status codes
    if (response.error.message.includes('not found') || response.error.message.includes('does not exist')) {
      return 404;
    }
    if (response.error.message.includes('permission') || response.error.message.includes('denied')) {
      return 403;
    }
    if (response.error.message.includes('invalid') || response.error.message.includes('bad request')) {
      return 400;
    }
    if (response.error.message.includes('unauthorized')) {
      return 401;
    }
    return 500; // Generic server error
  }
  return 200; // Success
}

function isSuccessfulResponse(response) {
  return !response.error;
}

// Authentication test execution
async function executeAuthTest(testDef) {
  const startTime = Date.now();
  
  try {
    let response;
    
    switch (testDef.clientMethod) {
      case 'signUp':
        response = await supabase.auth.signUp(testDef.params);
        break;
        
      case 'signInWithPassword':
        response = await supabase.auth.signInWithPassword(testDef.params);
        break;
        
      case 'getSession':
        response = await supabase.auth.getSession();
        break;
        
      case 'getUser':
        response = await supabase.auth.getUser();
        break;
        
      case 'refreshSession':
        response = await supabase.auth.refreshSession();
        break;
        
      case 'updateUser':
        response = await supabase.auth.updateUser(testDef.params);
        break;
        
      case 'resetPasswordForEmail':
        response = await supabase.auth.resetPasswordForEmail(testDef.params.email);
        break;
        
      case 'signOut':
        response = await supabase.auth.signOut(testDef.params);
        break;
        
      case 'signInWithOtp':
        response = await supabase.auth.signInWithOtp(testDef.params);
        break;
        
      case 'verifyOtp':
        response = await supabase.auth.verifyOtp(testDef.params);
        break;
        
      case 'resend':
        response = await supabase.auth.resend(testDef.params);
        break;
        
      case 'mfa.listFactors':
        response = await supabase.auth.mfa.listFactors();
        break;
        
      case 'mfa.enroll':
        response = await supabase.auth.mfa.enroll(testDef.params);
        break;
        
      case 'mfa.challengeAndVerify':
        response = await supabase.auth.mfa.challengeAndVerify(testDef.params);
        break;
        
      case 'mfa.challenge':
        response = await supabase.auth.mfa.challenge(testDef.params);
        break;
        
      case 'mfa.verify':
        response = await supabase.auth.mfa.verify(testDef.params);
        break;
        
      case 'mfa.unenroll':
        response = await supabase.auth.mfa.unenroll(testDef.params);
        break;
        
      case 'signInWithOAuth':
        response = await supabase.auth.signInWithOAuth(testDef.params.provider, testDef.params.options);
        break;
        
      case 'exchangeCodeForSession':
        response = await supabase.auth.exchangeCodeForSession(testDef.params.authCode);
        break;
        
      case 'linkIdentity':
        response = await supabase.auth.linkIdentity(testDef.params);
        break;
        
      case 'unlinkIdentity':
        response = await supabase.auth.unlinkIdentity(testDef.params.identity);
        break;
        
      case 'getUserIdentities':
        response = await supabase.auth.getUserIdentities();
        break;
        
      case 'admin.listUsers':
        response = await supabase.auth.admin.listUsers(testDef.params);
        break;
        
      case 'admin.getUserById':
        response = await supabase.auth.admin.getUserById(testDef.params.uid);
        break;
        
      case 'admin.createUser':
        response = await supabase.auth.admin.createUser(testDef.params);
        break;
        
      case 'admin.updateUserById':
        response = await supabase.auth.admin.updateUserById(testDef.params.uid, testDef.params.attributes);
        break;
        
      case 'admin.deleteUser':
        response = await supabase.auth.admin.deleteUser(testDef.params.uid);
        break;
        
      case 'admin.generateLink':
        response = await supabase.auth.admin.generateLink(testDef.params);
        break;
        
      case 'signInAnonymously':
        response = await supabase.auth.signInAnonymously();
        break;
        
      case 'admin.listSessions':
        response = await supabase.auth.admin.listSessions();
        break;
        
      case 'admin.deleteSession':
        response = await supabase.auth.admin.deleteSession(testDef.params.sessionId);
        break;
        
      default:
        throw new Error(`Unknown auth method: ${testDef.clientMethod}`);
    }
    
    const responseTime = Date.now() - startTime;
    const status = getStatusFromSupabaseResponse(response);
    
    return {
      testId: testDef.id,
      name: testDef.name,
      clientMethod: testDef.clientMethod,
      status,
      data: response.data,
      error: response.error,
      responseTime,
      timestamp: new Date().toISOString(),
      testType: 'auth'
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      testId: testDef.id,
      name: testDef.name,
      clientMethod: testDef.clientMethod,
      status: 0,
      data: null,
      error: { message: error.message },
      responseTime,
      timestamp: new Date().toISOString(),
      testType: 'auth'
    };
  }
}

// API test execution
async function executeAPITest(testDef) {
  const startTime = Date.now();
  
  try {
    let query = supabase.from(testDef.table);
    let response;
    
    switch (testDef.operation) {
      case 'select':
        if (Array.isArray(testDef.params)) {
          query = query.select(testDef.params.join(', '));
        } else {
          query = query.select(testDef.params);
        }
        
        // Apply filters
        if (testDef.filters) {
          testDef.filters.forEach(filter => {
            query = query[filter.operator](filter.column, filter.value);
          });
        }
        
        // Apply ordering
        if (testDef.orderBy) {
          query = query.order(testDef.orderBy.column, { ascending: testDef.orderBy.ascending });
        }
        
        // Apply limit and offset
        if (testDef.limit) {
          query = query.limit(testDef.limit);
        }
        
        if (testDef.offset) {
          query = query.range(testDef.offset, testDef.offset + (testDef.limit || 10) - 1);
        }
        
        // Handle single row responses
        if (testDef.single) {
          response = await query.single();
        } else {
          response = await query;
        }
        break;
        
      case 'insert':
        response = await query.insert(testDef.params);
        break;
        
      case 'update':
        if (testDef.filters) {
          testDef.filters.forEach(filter => {
            query = query[filter.operator](filter.column, filter.value);
          });
        }
        response = await query.update(testDef.params);
        break;
        
      case 'delete':
        if (testDef.filters) {
          testDef.filters.forEach(filter => {
            query = query[filter.operator](filter.column, filter.value);
          });
        }
        response = await query.delete();
        break;
        
      default:
        throw new Error(`Unknown API operation: ${testDef.operation}`);
    }
    
    const responseTime = Date.now() - startTime;
    const status = getStatusFromSupabaseResponse(response);
    
    return {
      testId: testDef.id,
      name: testDef.name,
      table: testDef.table,
      operation: testDef.operation,
      status,
      data: response.data,
      error: response.error,
      responseTime,
      timestamp: new Date().toISOString(),
      testType: 'api'
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      testId: testDef.id,
      name: testDef.name,
      table: testDef.table,
      operation: testDef.operation,
      status: 0,
      data: null,
      error: { message: error.message },
      responseTime,
      timestamp: new Date().toISOString(),
      testType: 'api'
    };
  }
}

// Auto-authentication for tests that require it
async function ensureAuthenticated() {
  try {
    // Check current session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('🔐 Already authenticated');
      return { success: true };
    }

    console.log('🔐 Authentication required, attempting sign-in...');

    // Try signing in first
    const { error: signinError } = await supabase.auth.signInWithPassword(TEST_CREDENTIALS);
    
    if (!signinError) {
      console.log('✅ Auto sign-in successful');
      return { success: true };
    }

    // If signin failed, try signup
    console.log('🔐 Sign-in failed, attempting sign-up...');
    const { error: signupError } = await supabase.auth.signUp({
      ...TEST_CREDENTIALS,
      options: {
        data: { full_name: 'Test User (Auto)' }
      }
    });

    if (!signupError) {
      console.log('✅ Auto sign-up successful');
      return { success: true };
    }

    return {
      success: false,
      error: `Authentication failed: ${signinError?.message || signupError?.message}`
    };

  } catch (error) {
    return {
      success: false,
      error: `Authentication error: ${error.message}`
    };
  }
}

// Analysis functions
function analyzeClientSpecificIssues(result) {
  const issues = [];
  const { error, testId, clientMethod, operation } = result;

  if (error) {
    // Check for client library specific issues
    if (error.message && error.message.includes('fetch is not defined')) {
      issues.push({
        type: 'client_environment',
        testId,
        description: 'Client library requires fetch polyfill or Node.js 18+',
        severity: 'high'
      });
    }

    if (error.message && error.message.includes('Invalid API key')) {
      issues.push({
        type: 'client_config',
        testId,
        description: 'Client library API key validation differs from direct HTTP calls',
        severity: 'medium'
      });
    }

    if (clientMethod && error.message && error.message.includes('not implemented')) {
      issues.push({
        type: 'missing_client_method',
        testId,
        clientMethod,
        description: `Client method ${clientMethod} may not be fully implemented`,
        severity: 'high'
      });
    }

    if (operation && error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
      issues.push({
        type: 'schema_compatibility',
        testId,
        operation,
        description: 'Database schema may not match client expectations',
        severity: 'high'
      });
    }
  }

  return issues;
}

// Test execution functions
async function runAuthenticationTests() {
  console.log('\n🔐 Running Authentication Tests (Supabase Client)...\n');
  
  for (const testDef of authTestDefinitions) {
    process.stdout.write(`  ⏳ ${testDef.name}... `);
    
    // Auto-authenticate if test requires auth
    if (testDef.requiresAuth) {
      const authResult = await ensureAuthenticated();
      if (!authResult.success) {
        console.log(`❌ Auth Failed (${authResult.error})`);
        testResults.authentication.stats.failed++;
        testResults.authentication.tests.push({
          testId: testDef.id,
          name: testDef.name,
          status: 401,
          error: { message: authResult.error },
          passed: false,
          responseTime: 0,
          timestamp: new Date().toISOString(),
          testType: 'auth'
        });
        testResults.authentication.stats.total++;
        continue;
      }
    }
    
    const result = await executeAuthTest(testDef);
    const passed = isSuccessfulResponse(result) && result.status === 200;
    
    if (passed) {
      console.log(`✅ Success (${result.responseTime}ms)`);
      testResults.authentication.stats.passed++;
    } else {
      console.log(`❌ ${result.status} ${result.error?.message || 'Unknown error'} (${result.responseTime}ms)`);
      testResults.authentication.stats.failed++;
      
      // Analyze client-specific issues
      const clientIssues = analyzeClientSpecificIssues(result);
      testResults.client_specific_issues.push(...clientIssues);
    }
    
    testResults.authentication.tests.push({
      ...result,
      passed
    });
    testResults.authentication.stats.total++;
    
    // Delay between tests (200ms like test-app)
    await sleep(200);
  }
}

async function runAPITests() {
  console.log('\n🔗 Running API Tests (Supabase Client)...\n');
  
  for (const testDef of apiTestDefinitions) {
    process.stdout.write(`  ⏳ ${testDef.name}... `);
    
    const result = await executeAPITest(testDef);
    const passed = isSuccessfulResponse(result) && result.status === 200;
    
    if (passed) {
      console.log(`✅ Success (${result.responseTime}ms)`);
      testResults.api.stats.passed++;
    } else {
      console.log(`❌ ${result.status} ${result.error?.message || 'Unknown error'} (${result.responseTime}ms)`);
      testResults.api.stats.failed++;
      
      // Analyze client-specific issues
      const clientIssues = analyzeClientSpecificIssues(result);
      testResults.client_specific_issues.push(...clientIssues);
    }
    
    testResults.api.tests.push({
      ...result,
      passed
    });
    testResults.api.stats.total++;
    
    // Delay between tests (100ms like test-app)
    await sleep(100);
  }
}

function generateReport() {
  testResults.summary.endTime = new Date().toISOString();
  testResults.summary.total = testResults.authentication.stats.total + testResults.api.stats.total;
  testResults.summary.passed = testResults.authentication.stats.passed + testResults.api.stats.passed;
  testResults.summary.failed = testResults.authentication.stats.failed + testResults.api.stats.failed;
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `supabase-client-test-results-${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(testResults, null, 2));
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUPABASE CLIENT TEST RESULTS');
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
  
  if (testResults.client_specific_issues.length > 0) {
    console.log(`⚠️  Client-Specific Issues Found: ${testResults.client_specific_issues.length}`);
    
    const highSeverity = testResults.client_specific_issues.filter(i => i.severity === 'high');
    const mediumSeverity = testResults.client_specific_issues.filter(i => i.severity === 'medium');
    
    if (highSeverity.length > 0) {
      console.log(`   🔴 High Severity: ${highSeverity.length}`);
    }
    if (mediumSeverity.length > 0) {
      console.log(`   🟡 Medium Severity: ${mediumSeverity.length}`);
    }
    
    console.log('\n⚠️  Top Client Issues:');
    testResults.client_specific_issues.slice(0, 5).forEach((issue, index) => {
      console.log(`   ${index + 1}. [${issue.testId}] ${issue.description}`);
    });
    
    if (testResults.client_specific_issues.length > 5) {
      console.log(`   ... and ${testResults.client_specific_issues.length - 5} more issues`);
    }
  } else {
    console.log('✅ No client-specific issues detected!');
  }
  
  console.log('');
  console.log(`💾 Detailed results saved to: ${filename}`);
  console.log('');
  console.log('💡 Next Steps:');
  console.log('   1. Compare with curl-test-runner.js results');
  console.log('   2. Identify discrepancies between HTTP and client library behavior');
  console.log('   3. Fix compatibility issues in Supabase Lite implementation');
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
  
  // Test Supabase client connectivity
  process.stdout.write('  ⏳ Client Library Check: ');
  try {
    const clientStart = Date.now();
    
    // Try a simple query using Supabase client
    const { data, error } = await supabase.from('products').select('product_name').limit(1);
    
    const clientTime = Date.now() - clientStart;
    
    if (error) {
      console.log(`❌ Client error (${error.message})`);
      return {
        success: false,
        error: `Supabase client check failed: ${error.message}`
      };
    }
    
    if (!data || data.length === 0) {
      console.log('❌ No data returned');
      return {
        success: false,
        error: 'Client check failed: No products found via Supabase client'
      };
    }
    
    console.log(`✅ Supabase client working (${clientTime}ms)`);
  } catch (error) {
    console.log(`❌ Failed (${error.message})`);
    return {
      success: false,
      error: `Client check failed: ${error.message}`
    };
  }
  
  console.log('  ✅ Environment Ready!\n');
  return { success: true };
}

// Main execution
async function main() {
  console.log('🚀 Supabase Lite Compatibility Test Runner (Supabase Client)');
  console.log(`🌐 Testing against: ${BASE_URL}`);
  console.log(`📧 Test credentials: ${TEST_CREDENTIALS.email}`);
  console.log(`🔑 API Key: ${ANON_KEY}`);
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
      console.log('  4. REST API endpoints and Supabase client are working');
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

export { main, executeAuthTest, executeAPITest, authTestDefinitions, apiTestDefinitions };