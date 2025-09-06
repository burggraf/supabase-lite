import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsersList } from '../UsersList'
import { AuthManager } from '@/lib/auth/core/AuthManager'

// Mock AuthManager
vi.mock('@/lib/auth/core/AuthManager', () => ({
  AuthManager: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      getAllUsers: vi.fn(),
      getUserCount: vi.fn(),
      getUsersByProvider: vi.fn(),
      getProviders: vi.fn(),
      deleteUser: vi.fn()
    }))
  }
}))

// Mock useDatabase hook
vi.mock('@/hooks/useDatabase', () => ({
  useDatabase: vi.fn(() => ({
    initialize: vi.fn()
  }))
}))

// Mock ProjectManager
vi.mock('@/lib/projects/ProjectManager', () => ({
  projectManager: {
    getActiveProject: vi.fn(() => ({
      id: 'test-project',
      name: 'Test Project',
      databasePath: 'idb://test_project'
    })),
    getProjects: vi.fn(() => []),
    createProject: vi.fn(),
    switchToProject: vi.fn()
  }
}))

const mockUsers = [
  {
    id: 'user-1',
    email: 'user1@example.com',
    phone: null,
    email_verified: true,
    phone_verified: false,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    last_sign_in_at: '2023-01-02T00:00:00Z',
    role: 'authenticated',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { name: 'User One' },
    is_anonymous: false
  },
  {
    id: 'user-2',
    email: 'user2@example.com',
    phone: null,
    email_verified: true,
    phone_verified: false,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    last_sign_in_at: null,
    role: 'authenticated',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    is_anonymous: false
  }
]

const mockProviders = [
  { provider: 'email', count: 25 },
  { provider: 'phone', count: 7 }
]

describe('UsersList', () => {
  let mockAuthManager: ReturnType<typeof AuthManager.getInstance>

  beforeEach(() => {
    mockAuthManager = AuthManager.getInstance()
    
    // Set up default mock return values
    mockAuthManager.initialize.mockResolvedValue(undefined)
    
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render loading state initially', async () => {
      mockAuthManager.getAllUsers.mockReturnValue(new Promise(() => {})) // Never resolves
      mockAuthManager.getUserCount.mockReturnValue(new Promise(() => {}))
      mockAuthManager.getProviders.mockReturnValue(new Promise(() => {}))

      render(<UsersList />)

      expect(screen.getByText('Loading users...')).toBeInTheDocument()
    })

    it('should render users list after loading', async () => {
      mockAuthManager.getAllUsers.mockResolvedValue(mockUsers)
      mockAuthManager.getUserCount.mockResolvedValue(32)
      mockAuthManager.getProviders.mockResolvedValue(mockProviders)

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('Total: 32 users')).toBeInTheDocument()
      })

      expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      expect(screen.getByText('user2@example.com')).toBeInTheDocument()
    })

    it('should render empty state when no users exist', async () => {
      mockAuthManager.getAllUsers.mockResolvedValue([])
      mockAuthManager.getUserCount.mockResolvedValue(0)
      mockAuthManager.getProviders.mockResolvedValue([])

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument()
      })
    })

    it('should render error state on API failure', async () => {
      mockAuthManager.getAllUsers.mockRejectedValue(new Error('API Error'))
      mockAuthManager.getUserCount.mockRejectedValue(new Error('API Error'))
      mockAuthManager.getProviders.mockRejectedValue(new Error('API Error'))

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('Error loading users: API Error')).toBeInTheDocument()
      })
    })
  })

  describe('Provider Filtering', () => {
    it('should show provider filter dropdown', async () => {
      mockAuthManager.getAllUsers.mockResolvedValue(mockUsers)
      mockAuthManager.getUserCount.mockResolvedValue(32)
      mockAuthManager.getProviders.mockResolvedValue(mockProviders)

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('All providers')).toBeInTheDocument()
      })

      // Click dropdown to see options
      await userEvent.click(screen.getByText('All providers'))
      
      expect(screen.getByText('email (25)')).toBeInTheDocument()
      expect(screen.getByText('phone (7)')).toBeInTheDocument()
    })

    it('should filter users by provider when selected', async () => {
      const filteredUsers = [mockUsers[0]] // Only email users
      
      mockAuthManager.getAllUsers.mockResolvedValue(mockUsers)
      mockAuthManager.getUserCount.mockResolvedValue(32)
      mockAuthManager.getProviders.mockResolvedValue(mockProviders)
      mockAuthManager.getUsersByProvider.mockResolvedValue(filteredUsers)

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('All providers')).toBeInTheDocument()
      })

      // Select email provider
      await userEvent.click(screen.getByText('All providers'))
      await userEvent.click(screen.getByText('email (25)'))

      await waitFor(() => {
        expect(mockAuthManager.getUsersByProvider).toHaveBeenCalledWith('email')
      })
    })

    it('should show "All providers" when no filter is selected', async () => {
      mockAuthManager.getAllUsers.mockResolvedValue(mockUsers)
      mockAuthManager.getUserCount.mockResolvedValue(32)
      mockAuthManager.getProviders.mockResolvedValue(mockProviders)

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('All providers')).toBeInTheDocument()
      })
    })
  })

  describe('User Actions', () => {
    it('should show delete confirmation dialog when delete is clicked', async () => {
      mockAuthManager.getAllUsers.mockResolvedValue(mockUsers)
      mockAuthManager.getUserCount.mockResolvedValue(32)
      mockAuthManager.getProviders.mockResolvedValue(mockProviders)

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      })

      // Find and click dropdown menu for first user
      const menuButtons = screen.getAllByRole('button', { name: /open menu/i })
      await userEvent.click(menuButtons[0])
      
      // Click delete option
      const deleteOption = screen.getByText('Delete user')
      await userEvent.click(deleteOption)

      expect(screen.getByText('Confirm Delete')).toBeInTheDocument()
      expect(screen.getByText('Are you sure you want to delete this user?')).toBeInTheDocument()
    })

    it('should delete user when confirmed', async () => {
      mockAuthManager.getAllUsers.mockResolvedValue(mockUsers)
      mockAuthManager.getUserCount.mockResolvedValue(32)
      mockAuthManager.getProviders.mockResolvedValue(mockProviders)
      mockAuthManager.deleteUser.mockResolvedValue(undefined)

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      })

      // Click delete and confirm
      const menuButtons = screen.getAllByRole('button', { name: /open menu/i })
      await userEvent.click(menuButtons[0])
      await userEvent.click(screen.getByText('Delete user'))
      
      const confirmButton = screen.getByText('Delete User')
      await userEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockAuthManager.deleteUser).toHaveBeenCalledWith('user-1')
      })
    })

    it('should refresh users list after successful deletion', async () => {
      mockAuthManager.getAllUsers.mockResolvedValue(mockUsers)
      mockAuthManager.getUserCount.mockResolvedValue(32)
      mockAuthManager.getProviders.mockResolvedValue(mockProviders)
      mockAuthManager.deleteUser.mockResolvedValue(undefined)

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      })

      // Reset mocks to track refresh calls
      mockAuthManager.getAllUsers.mockClear()
      mockAuthManager.getUserCount.mockClear()
      mockAuthManager.getProviders.mockClear()

      // Delete user
      const menuButtons = screen.getAllByRole('button', { name: /open menu/i })
      await userEvent.click(menuButtons[0])
      await userEvent.click(screen.getByText('Delete user'))
      await userEvent.click(screen.getByText('Delete User'))

      // Check refresh was called
      await waitFor(() => {
        expect(mockAuthManager.getAllUsers).toHaveBeenCalledTimes(1)
        expect(mockAuthManager.getUserCount).toHaveBeenCalledTimes(1)
        expect(mockAuthManager.getProviders).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Data Display', () => {
    it('should display user information correctly', async () => {
      mockAuthManager.getAllUsers.mockResolvedValue(mockUsers)
      mockAuthManager.getUserCount.mockResolvedValue(32)
      mockAuthManager.getProviders.mockResolvedValue(mockProviders)

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      })

      // Check user details are displayed
      expect(screen.getByText('user-1')).toBeInTheDocument()
      expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      expect(screen.getByText('user2@example.com')).toBeInTheDocument()
      
      // Check provider icons/badges are shown
      const emailBadges = screen.getAllByText('Email')
      expect(emailBadges.length).toBeGreaterThan(0)
    })

    it('should show correct user count', async () => {
      mockAuthManager.getAllUsers.mockResolvedValue(mockUsers)
      mockAuthManager.getUserCount.mockResolvedValue(42)
      mockAuthManager.getProviders.mockResolvedValue(mockProviders)

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('Total: 42 users')).toBeInTheDocument()
      })
    })

    it('should handle null/undefined user fields gracefully', async () => {
      const usersWithNulls = [{
        ...mockUsers[0],
        phone: null,
        last_sign_in_at: null,
        user_metadata: {}
      }]

      mockAuthManager.getAllUsers.mockResolvedValue(usersWithNulls)
      mockAuthManager.getUserCount.mockResolvedValue(1)
      mockAuthManager.getProviders.mockResolvedValue(mockProviders)

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      })

      // Should not crash and should display available information
      expect(screen.getByText('user-1')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for interactive elements', async () => {
      mockAuthManager.getAllUsers.mockResolvedValue(mockUsers)
      mockAuthManager.getUserCount.mockResolvedValue(32)
      mockAuthManager.getProviders.mockResolvedValue(mockProviders)

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      })

      // Check filter dropdown has proper labeling
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      
      // Check menu buttons for user actions
      const menuButtons = screen.getAllByRole('button', { name: /open menu/i })
      expect(menuButtons.length).toBeGreaterThan(0)
    })

    it('should be keyboard navigable', async () => {
      mockAuthManager.getAllUsers.mockResolvedValue(mockUsers)
      mockAuthManager.getUserCount.mockResolvedValue(32)
      mockAuthManager.getProviders.mockResolvedValue(mockProviders)

      render(<UsersList />)

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      })

      // Tab through interactive elements
      await userEvent.tab()
      expect(screen.getByRole('combobox')).toHaveFocus()

      await userEvent.tab()
      const firstMenuButton = screen.getAllByRole('button', { name: /open menu/i })[0]
      expect(firstMenuButton).toHaveFocus()
    })
  })
})