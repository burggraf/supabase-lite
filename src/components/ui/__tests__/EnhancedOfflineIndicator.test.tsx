import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EnhancedOfflineIndicator } from '../EnhancedOfflineIndicator'

// Mock the useOnlineStatus hook using vi.hoisted
const mockUseOnlineStatus = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: mockUseOnlineStatus
}))

describe('EnhancedOfflineIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Online Status Display', () => {
    it('should display online status with good connection', () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      })

      render(<EnhancedOfflineIndicator />)
      
      expect(screen.getByText('Online')).toBeInTheDocument()
      expect(screen.getByTestId('connection-indicator')).toHaveClass('bg-green-500')
      expect(screen.getByText('Excellent Connection')).toBeInTheDocument()
    })

    it('should display online status with slow connection', () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'cellular',
        effectiveType: '2g',
        downlink: 0.5,
        rtt: 2000,
        saveData: true
      })

      render(<EnhancedOfflineIndicator />)
      
      expect(screen.getByText('Online')).toBeInTheDocument()
      expect(screen.getByTestId('connection-indicator')).toHaveClass('bg-yellow-500')
      expect(screen.getByText('Slow Connection')).toBeInTheDocument()
    })

    it('should display offline status', () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: false,
        connectionType: null,
        effectiveType: null,
        downlink: null,
        rtt: null,
        saveData: false
      })

      render(<EnhancedOfflineIndicator />)
      
      expect(screen.getByText('Offline')).toBeInTheDocument()
      expect(screen.getByTestId('connection-indicator')).toHaveClass('bg-red-500')
    })
  })

  describe('Connection Quality Assessment', () => {
    it('should show excellent quality for high-speed connections', () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 15,
        rtt: 30,
        saveData: false
      })

      render(<EnhancedOfflineIndicator />)
      expect(screen.getByText('Excellent Connection')).toBeInTheDocument()
    })

    it('should show good quality for moderate connections', () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '3g',
        downlink: 5,
        rtt: 100,
        saveData: false
      })

      render(<EnhancedOfflineIndicator />)
      expect(screen.getByText('Good Connection')).toBeInTheDocument()
    })

    it('should show poor quality for slow connections', () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'cellular',
        effectiveType: '2g',
        downlink: 0.3,
        rtt: 3000,
        saveData: true
      })

      render(<EnhancedOfflineIndicator />)
      expect(screen.getByText('Slow Connection')).toBeInTheDocument()
    })
  })

  describe('Interactive Features', () => {
    it('should show detailed connection info on click', async () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      })

      render(<EnhancedOfflineIndicator compact={false} showDetails />)
      
      const indicator = screen.getByTestId('connection-indicator')
      fireEvent.click(indicator)
      
      await waitFor(() => {
        expect(screen.getByText('Connection Details')).toBeInTheDocument()
        expect(screen.getByText((content, element) => {
          return element?.textContent === 'Type: wifi'
        })).toBeInTheDocument()
        expect(screen.getByText((content, element) => {
          return element?.textContent === 'Speed: 4g'
        })).toBeInTheDocument()
        expect(screen.getByText((content, element) => {
          return element?.textContent === 'Bandwidth: 10 Mbps'
        })).toBeInTheDocument()
        expect(screen.getByText((content, element) => {
          return element?.textContent === 'Latency: 50ms'
        })).toBeInTheDocument()
      })
    })

    it('should have offline mode toggle when enabled', () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      })

      render(<EnhancedOfflineIndicator compact={false} showOfflineToggle />)
      
      expect(screen.getByText('Simulate Offline')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /toggle offline/i })).toBeInTheDocument()
    })

    it('should trigger offline mode when toggle is clicked', () => {
      const mockToggleOffline = vi.fn()
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
        toggleOfflineMode: mockToggleOffline
      })

      render(<EnhancedOfflineIndicator compact={false} showOfflineToggle />)
      
      const toggleButton = screen.getByRole('button', { name: /toggle offline/i })
      fireEvent.click(toggleButton)
      
      expect(mockToggleOffline).toHaveBeenCalledOnce()
    })
  })

  describe('Visual Styling', () => {
    it('should apply correct styling for compact mode', () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      })

      render(<EnhancedOfflineIndicator compact />)
      
      const container = screen.getByTestId('enhanced-offline-indicator')
      expect(container).toHaveClass('compact')
    })

    it('should apply correct styling for full mode', () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      })

      render(<EnhancedOfflineIndicator compact={false} />)
      
      const container = screen.getByTestId('enhanced-offline-indicator')
      expect(container).not.toHaveClass('compact')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      })

      render(<EnhancedOfflineIndicator />)
      
      const indicator = screen.getByTestId('connection-indicator')
      expect(indicator).toHaveAttribute('role', 'status')
      expect(indicator).toHaveAttribute('aria-label', 'Connection status: Online, Excellent Connection')
    })

    it('should update ARIA label for offline status', () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: false,
        connectionType: null,
        effectiveType: null,
        downlink: null,
        rtt: null,
        saveData: false
      })

      render(<EnhancedOfflineIndicator />)
      
      const indicator = screen.getByTestId('connection-indicator')
      expect(indicator).toHaveAttribute('aria-label', 'Connection status: Offline')
    })
  })
})