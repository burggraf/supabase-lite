import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { Dashboard } from '../Dashboard'
import { AuthContext } from '@/hooks/useAuth'
import type { User } from '@/types/auth'

const mockUser: User = {
  id: '1',
  email: 'john.doe@example.com',
  role: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  user_metadata: { full_name: 'John Doe' },
  app_metadata: {},
}

const mockAuthContextValue = {
  user: mockUser,
  session: null,
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  refreshSession: vi.fn(),
}

const renderDashboard = () => {
  return render(
    <AuthContext.Provider value={mockAuthContextValue}>
      <Dashboard />
    </AuthContext.Provider>
  )
}

describe('Dashboard', () => {
  it('should render welcome message with user name', () => {
    renderDashboard()
    
    expect(screen.getByText('Welcome back, John Doe')).toBeInTheDocument()
  })

  it('should render stats cards', () => {
    renderDashboard()
    
    expect(screen.getByText('Total Customers')).toBeInTheDocument()
    expect(screen.getByText('Total Orders')).toBeInTheDocument()
    expect(screen.getByText('Products')).toBeInTheDocument()
    expect(screen.getByText('Revenue')).toBeInTheDocument()
  })

  it('should render recent activity section', () => {
    renderDashboard()
    
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    expect(screen.getByText(/New order #10249/)).toBeInTheDocument()
  })

  it('should render low stock alerts', () => {
    renderDashboard()
    
    expect(screen.getByText('Low Stock Alerts')).toBeInTheDocument()
    expect(screen.getByText('Chai')).toBeInTheDocument()
    expect(screen.getByText('5 units')).toBeInTheDocument()
  })

  it('should render quick actions section', () => {
    renderDashboard()
    
    expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    expect(screen.getByText('Add New Customer')).toBeInTheDocument()
    expect(screen.getByText('Create Order')).toBeInTheDocument()
    expect(screen.getByText('Add Product')).toBeInTheDocument()
  })

  it('should fallback to email username when full_name is not available', () => {
    const userWithoutFullName = { ...mockUser, user_metadata: {} }
    const contextValue = { ...mockAuthContextValue, user: userWithoutFullName }
    
    render(
      <AuthContext.Provider value={contextValue}>
        <Dashboard />
      </AuthContext.Provider>
    )
    
    expect(screen.getByText('Welcome back, john.doe')).toBeInTheDocument()
  })
})