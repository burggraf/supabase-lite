import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthManager } from '../AuthManager'

describe('Simple Auth Test - Parameter Binding', () => {
  let mockDbManager: any

  beforeEach(() => {
    // Create a simple mock for DatabaseManager
    mockDbManager = {
      query: vi.fn(),
      initialize: vi.fn(),
      isConnected: vi.fn(() => true)
    }
    
    // Mock DatabaseManager.getInstance to return our mock
    vi.doMock('../../../database/connection', () => ({
      DatabaseManager: {
        getInstance: () => mockDbManager
      }
    }))
  })

  it('should call database query with correct parameters for getUserByEmail', async () => {
    // Mock successful database response
    mockDbManager.query.mockResolvedValue({
      rows: [{
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        phone_confirmed_at: null,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        role: 'authenticated',
        raw_app_meta_data: '{"provider": "email"}',
        raw_user_meta_data: '{}',
        is_anonymous: false
      }]
    })

    const authManager = new (AuthManager as any)()
    authManager['dbManager'] = mockDbManager
    authManager['jwtService'] = { initialize: vi.fn() }
    authManager['sessionManager'] = { initialize: vi.fn() }

    // Call the private getUserByEmail method
    const result = await authManager['getUserByEmail']('test@example.com')

    // Verify the query was called with correct SQL and parameters
    expect(mockDbManager.query).toHaveBeenCalledWith(
      'SELECT * FROM auth.users WHERE email = $1',
      ['test@example.com']
    )

    // Verify the result is properly returned and mapped
    expect(result).toBeDefined()
    expect(result.email).toBe('test@example.com')
    expect(result.email_verified).toBe(true) // Should be converted from timestamp
  })

  it('should return null when user is not found', async () => {
    // Mock empty database response
    mockDbManager.query.mockResolvedValue({
      rows: []
    })

    const authManager = new (AuthManager as any)()
    authManager['dbManager'] = mockDbManager

    const result = await authManager['getUserByEmail']('nonexistent@example.com')

    expect(mockDbManager.query).toHaveBeenCalledWith(
      'SELECT * FROM auth.users WHERE email = $1',
      ['nonexistent@example.com']
    )
    expect(result).toBeNull()
  })
})