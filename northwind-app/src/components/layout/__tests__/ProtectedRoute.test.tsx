import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '../ProtectedRoute'
import { AuthContext } from '@/hooks/useAuth'
import type { User } from '@/types/auth'

const mockUser: User = {
  id: '1',
  email: 'test@example.com',
  role: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  user_metadata: {},
  app_metadata: {},
}

const renderProtectedRoute = (authContextValue: any) => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={authContextValue}>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </AuthContext.Provider>
    </BrowserRouter>
  )
}

describe('ProtectedRoute', () => {
  it('should show loading when auth is loading', () => {
    const authContextValue = {
      user: null,
      session: null,
      loading: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    }

    renderProtectedRoute(authContextValue)
    
    // The Loader2 icon is mocked as null, so just check for the loading text
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should render children when user is authenticated', () => {
    const authContextValue = {
      user: mockUser,
      session: { user: mockUser } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    }

    renderProtectedRoute(authContextValue)
    
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('should redirect to login when user is not authenticated', () => {
    const authContextValue = {
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    }

    renderProtectedRoute(authContextValue)
    
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})