import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Dashboard } from '../Dashboard'

// Mock the useDatabase hook
const mockUseDatabase = vi.fn()

vi.mock('@/hooks/useDatabase', () => ({
  useDatabase: () => mockUseDatabase(),
}))

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Database: () => <div data-testid="database-icon" />,
  Users: () => <div data-testid="users-icon" />,
  Table: () => <div data-testid="table-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
}))

describe('Dashboard', () => {
  const mockConnectionInfo = {
    id: 'test-db-id',
    name: 'Test Database',
    createdAt: new Date('2023-01-01T10:00:00Z'),
    lastAccessed: new Date('2023-01-01T12:00:00Z'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Connected State', () => {
    beforeEach(() => {
      mockUseDatabase.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        error: null,
        getConnectionInfo: () => mockConnectionInfo,
      })
    })

    it('should render dashboard header', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Welcome to Supabase Lite - Your local PostgreSQL development environment')).toBeInTheDocument()
    })

    it('should display connected status in stats', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('Database Status')).toBeInTheDocument()
      expect(screen.getByText('Connected')).toBeInTheDocument()
      expect(screen.getByText('success')).toBeInTheDocument()
    })

    it('should display table count stat', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('Tables')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('should display users count stat', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('Sample Users')).toBeInTheDocument()
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('should display last access time', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('Last Access')).toBeInTheDocument()
      // The exact time format depends on locale, so just check it exists
      expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument()
    })

    it('should show connected status in quick start section', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('✅ Database Connected')).toBeInTheDocument()
      expect(screen.getByText('PGlite is running in your browser with IndexedDB persistence')).toBeInTheDocument()
    })

    it('should display database connection info', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('Database Info')).toBeInTheDocument()
      expect(screen.getByText('Test Database')).toBeInTheDocument()
      expect(screen.getByText('test-db-id')).toBeInTheDocument()
      expect(screen.getByText('1/1/2023')).toBeInTheDocument() // Created date
      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('should display all stats cards with correct icons', () => {
      render(<Dashboard />)
      
      expect(screen.getByTestId('database-icon')).toBeInTheDocument()
      expect(screen.getByTestId('table-icon')).toBeInTheDocument()
      expect(screen.getByTestId('users-icon')).toBeInTheDocument()
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument()
    })
  })

  describe('Disconnected State', () => {
    beforeEach(() => {
      mockUseDatabase.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        error: null,
        getConnectionInfo: () => null,
      })
    })

    it('should display disconnected status', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('Disconnected')).toBeInTheDocument()
      expect(screen.getByText('destructive')).toBeInTheDocument()
    })

    it('should show disconnected status in quick start section', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('❌ Database Disconnected')).toBeInTheDocument()
      expect(screen.getByText('Database connection failed - check console for errors')).toBeInTheDocument()
    })

    it('should show no connection info message', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('No connection info available')).toBeInTheDocument()
    })

    it('should display "Never" for last access when no connection', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('Never')).toBeInTheDocument()
    })
  })

  describe('Connecting State', () => {
    beforeEach(() => {
      mockUseDatabase.mockReturnValue({
        isConnected: false,
        isConnecting: true,
        error: null,
        getConnectionInfo: () => null,
      })
    })

    it('should show connecting message', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('Connecting to database...')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    beforeEach(() => {
      mockUseDatabase.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        error: 'Failed to connect to database',
        getConnectionInfo: () => null,
      })
    })

    it('should show error message', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('Database connection failed: Failed to connect to database')).toBeInTheDocument()
    })
  })

  describe('Quick Start Section', () => {
    beforeEach(() => {
      mockUseDatabase.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        error: null,
        getConnectionInfo: () => mockConnectionInfo,
      })
    })

    it('should display all quick start items', () => {
      render(<Dashboard />)
      
      expect(screen.getByText('Quick Start')).toBeInTheDocument()
      expect(screen.getByText('📝 Try the SQL Editor')).toBeInTheDocument()
      expect(screen.getByText('Write and execute SQL queries against your local PostgreSQL database')).toBeInTheDocument()
      expect(screen.getByText('🚀 More Features Coming')).toBeInTheDocument()
      expect(screen.getByText('Auth, Storage, Realtime, and Edge Functions are in development')).toBeInTheDocument()
    })
  })

  describe('Stats Grid', () => {
    beforeEach(() => {
      mockUseDatabase.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        error: null,
        getConnectionInfo: () => mockConnectionInfo,
      })
    })

    it('should render all 4 stat cards', () => {
      render(<Dashboard />)
      
      screen.getAllByRole('generic').filter(el => 
        el.textContent?.includes('Database Status') ||
        el.textContent?.includes('Tables') ||
        el.textContent?.includes('Sample Users') ||
        el.textContent?.includes('Last Access')
      )
      
      // Should find at least the stat titles
      expect(screen.getByText('Database Status')).toBeInTheDocument()
      expect(screen.getByText('Tables')).toBeInTheDocument()
      expect(screen.getByText('Sample Users')).toBeInTheDocument()
      expect(screen.getByText('Last Access')).toBeInTheDocument()
    })
  })
})