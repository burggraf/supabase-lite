import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from '../Sidebar'

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  LayoutDashboard: () => <div data-testid="layout-dashboard-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
  Table: () => <div data-testid="table-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
  FolderOpen: () => <div data-testid="folder-open-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  Code: () => <div data-testid="code-icon" />,
  BookOpen: () => <div data-testid="book-open-icon" />,
  Database: () => <div data-testid="database-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
}))

describe('Sidebar', () => {
  const mockOnPageChange = vi.fn()
  const defaultProps = {
    currentPage: 'dashboard',
    onPageChange: mockOnPageChange,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Header', () => {
    it('should render the header with logo and title', () => {
      render(<Sidebar {...defaultProps} />)
      
      expect(screen.getByTestId('database-icon')).toBeInTheDocument()
      expect(screen.getByText('Supabase Lite')).toBeInTheDocument()
      expect(screen.getByText('Local Development')).toBeInTheDocument()
    })
  })

  describe('Navigation Items', () => {
    it('should render all navigation items', () => {
      render(<Sidebar {...defaultProps} />)
      
      // Main navigation items
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('SQL Editor')).toBeInTheDocument()
      expect(screen.getByText('Table Editor')).toBeInTheDocument()
      
      // Services section
      expect(screen.getByText('Services')).toBeInTheDocument()
      expect(screen.getByText('Authentication')).toBeInTheDocument()
      expect(screen.getByText('Storage')).toBeInTheDocument()
      expect(screen.getByText('Realtime')).toBeInTheDocument()
      expect(screen.getByText('Edge Functions')).toBeInTheDocument()
      
      // Tools section
      expect(screen.getByText('Tools')).toBeInTheDocument()
      expect(screen.getByText('API Docs')).toBeInTheDocument()
    })

    it('should render correct icons for navigation items', () => {
      render(<Sidebar {...defaultProps} />)
      
      expect(screen.getByTestId('layout-dashboard-icon')).toBeInTheDocument()
      expect(screen.getByTestId('file-text-icon')).toBeInTheDocument()
      expect(screen.getByTestId('table-icon')).toBeInTheDocument()
      expect(screen.getByTestId('shield-icon')).toBeInTheDocument()
      expect(screen.getByTestId('folder-open-icon')).toBeInTheDocument()
      expect(screen.getByTestId('zap-icon')).toBeInTheDocument()
      expect(screen.getByTestId('code-icon')).toBeInTheDocument()
      expect(screen.getByTestId('book-open-icon')).toBeInTheDocument()
    })

    it('should show "Coming Soon" badges for disabled items', () => {
      render(<Sidebar {...defaultProps} />)
      
      const comingSoonBadges = screen.getAllByText('Coming Soon')
      expect(comingSoonBadges).toHaveLength(6) // table-editor, auth, storage, realtime, edge-functions, api
    })
  })

  describe('Active State', () => {
    it('should highlight the current active page', () => {
      render(<Sidebar {...defaultProps} currentPage="dashboard" />)
      
      const dashboardButton = screen.getByRole('button', { name: /dashboard/i })
      expect(dashboardButton).toHaveClass('bg-primary', 'text-primary-foreground')
    })

    it('should not highlight inactive pages', () => {
      render(<Sidebar {...defaultProps} currentPage="dashboard" />)
      
      const sqlEditorButton = screen.getByRole('button', { name: /sql editor/i })
      expect(sqlEditorButton).not.toHaveClass('bg-primary')
      expect(sqlEditorButton).toHaveClass('text-muted-foreground')
    })

    it('should update active page when different page is selected', () => {
      render(<Sidebar {...defaultProps} currentPage="sql-editor" />)
      
      const sqlEditorButton = screen.getByRole('button', { name: /sql editor/i })
      expect(sqlEditorButton).toHaveClass('bg-primary', 'text-primary-foreground')
      
      const dashboardButton = screen.getByRole('button', { name: /dashboard/i })
      expect(dashboardButton).not.toHaveClass('bg-primary')
    })
  })

  describe('Click Interactions', () => {
    it('should call onPageChange when clicking enabled navigation items', () => {
      render(<Sidebar {...defaultProps} />)
      
      const dashboardButton = screen.getByRole('button', { name: /dashboard/i })
      fireEvent.click(dashboardButton)
      
      expect(mockOnPageChange).toHaveBeenCalledWith('dashboard')
    })

    it('should call onPageChange when clicking SQL Editor', () => {
      render(<Sidebar {...defaultProps} />)
      
      const sqlEditorButton = screen.getByRole('button', { name: /sql editor/i })
      fireEvent.click(sqlEditorButton)
      
      expect(mockOnPageChange).toHaveBeenCalledWith('sql-editor')
    })

    it('should not call onPageChange when clicking disabled items', () => {
      render(<Sidebar {...defaultProps} />)
      
      const tableEditorButton = screen.getByRole('button', { name: /table editor/i })
      fireEvent.click(tableEditorButton)
      
      expect(mockOnPageChange).not.toHaveBeenCalled()
    })

    it('should not call onPageChange when clicking coming soon items', () => {
      render(<Sidebar {...defaultProps} />)
      
      const authButton = screen.getByRole('button', { name: /authentication/i })
      fireEvent.click(authButton)
      
      expect(mockOnPageChange).not.toHaveBeenCalled()
    })
  })

  describe('Disabled State', () => {
    it('should disable buttons with "Coming Soon" badge', () => {
      render(<Sidebar {...defaultProps} />)
      
      const tableEditorButton = screen.getByRole('button', { name: /table editor/i })
      const authButton = screen.getByRole('button', { name: /authentication/i })
      const storageButton = screen.getByRole('button', { name: /storage/i })
      
      expect(tableEditorButton).toBeDisabled()
      expect(authButton).toBeDisabled()
      expect(storageButton).toBeDisabled()
    })

    it('should apply disabled styling to coming soon items', () => {
      render(<Sidebar {...defaultProps} />)
      
      const tableEditorButton = screen.getByRole('button', { name: /table editor/i })
      expect(tableEditorButton).toHaveClass('opacity-50', 'cursor-not-allowed')
    })

    it('should not disable enabled items', () => {
      render(<Sidebar {...defaultProps} />)
      
      const dashboardButton = screen.getByRole('button', { name: /dashboard/i })
      const sqlEditorButton = screen.getByRole('button', { name: /sql editor/i })
      
      expect(dashboardButton).not.toBeDisabled()
      expect(sqlEditorButton).not.toBeDisabled()
    })
  })

  describe('Section Headers', () => {
    it('should render section headers', () => {
      render(<Sidebar {...defaultProps} />)
      
      expect(screen.getByText('Services')).toBeInTheDocument()
      expect(screen.getByText('Tools')).toBeInTheDocument()
    })

    it('should style section headers correctly', () => {
      render(<Sidebar {...defaultProps} />)
      
      const servicesHeader = screen.getByText('Services')
      const toolsHeader = screen.getByText('Tools')
      
      expect(servicesHeader).toHaveClass('text-xs', 'font-medium', 'text-muted-foreground', 'uppercase', 'tracking-wider')
      expect(toolsHeader).toHaveClass('text-xs', 'font-medium', 'text-muted-foreground', 'uppercase', 'tracking-wider')
    })
  })

  describe('Footer', () => {
    it('should render connection status in footer', () => {
      render(<Sidebar {...defaultProps} />)
      
      expect(screen.getByText('Connected to PGlite')).toBeInTheDocument()
    })

    it('should show green indicator in footer', () => {
      const { container } = render(<Sidebar {...defaultProps} />)
      
      // Find the green indicator by its classes
      const greenIndicator = container.querySelector('.bg-green-500.rounded-full')
      expect(greenIndicator).toBeInTheDocument()
      expect(greenIndicator).toHaveClass('h-2', 'w-2', 'bg-green-500', 'rounded-full')
    })
  })

  describe('Layout Structure', () => {
    it('should have proper layout classes', () => {
      const { container } = render(<Sidebar {...defaultProps} />)
      
      const sidebar = container.firstChild as HTMLElement
      expect(sidebar).toHaveClass('flex', 'flex-col', 'h-full', 'bg-card', 'border-r')
    })

    it('should have proper navigation structure', () => {
      render(<Sidebar {...defaultProps} />)
      
      const nav = screen.getByRole('navigation')
      expect(nav).toHaveClass('flex-1', 'p-4', 'space-y-1')
    })
  })
})