import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { OnlineStatus } from '../../../hooks/useOnlineStatus';

// Mock the useOnlineStatus hook
const mockUseOnlineStatus = vi.fn();
vi.mock('../../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: mockUseOnlineStatus
}));

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOnlineStatus: OnlineStatus = {
    isOnline: true,
    isOffline: false,
    connectionType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false,
    hasServiceWorker: true,
    lastUpdated: new Date('2024-01-01T00:00:00Z')
  };

  describe('Online State', () => {
    it('should not render when online', async () => {
      mockUseOnlineStatus.mockReturnValue(mockOnlineStatus);
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      const { container } = render(<OfflineIndicator />);
      
      expect(container.firstChild).toBeNull();
    });

    it('should show online indicator when forced to show', async () => {
      mockUseOnlineStatus.mockReturnValue(mockOnlineStatus);
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator showWhenOnline />);
      
      expect(screen.getByText(/online/i)).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveClass('bg-green-500');
    });
  });

  describe('Offline State', () => {
    const offlineStatus: OnlineStatus = {
      ...mockOnlineStatus,
      isOnline: false,
      isOffline: true,
      connectionType: undefined
    };

    it('should render when offline', async () => {
      mockUseOnlineStatus.mockReturnValue(offlineStatus);
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator />);
      
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveClass('bg-red-500');
    });

    it('should show offline message in details view', async () => {
      mockUseOnlineStatus.mockReturnValue(offlineStatus);
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator showDetails />);
      
      expect(screen.getByText('Offline')).toBeInTheDocument();
      expect(screen.getByText(/working in offline mode/i)).toBeInTheDocument();
    });

    it('should show WiFi off icon when offline', async () => {
      mockUseOnlineStatus.mockReturnValue(offlineStatus);
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator />);
      
      // Check for WiFi off icon
      const icon = screen.getByTestId('wifi-off-icon');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Connection Quality Display', () => {
    it('should show connection type when online', async () => {
      const statusWith4G: OnlineStatus = {
        ...mockOnlineStatus,
        connectionType: '4g'
      };
      mockUseOnlineStatus.mockReturnValue(statusWith4G);
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator showWhenOnline />);
      
      expect(screen.getByText(/4g/i)).toBeInTheDocument();
    });

    it('should show slow connection warning', async () => {
      const slowStatus: OnlineStatus = {
        ...mockOnlineStatus,
        connectionType: 'slow-2g',
        downlink: 0.1
      };
      mockUseOnlineStatus.mockReturnValue(slowStatus);
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator showWhenOnline />);
      
      expect(screen.getByText(/slow connection/i)).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveClass('bg-yellow-500');
    });

    it('should show data saver mode indicator', async () => {
      const dataSaverStatus: OnlineStatus = {
        ...mockOnlineStatus,
        saveData: true
      };
      mockUseOnlineStatus.mockReturnValue(dataSaverStatus);
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator showWhenOnline />);
      
      expect(screen.getByText(/data saver/i)).toBeInTheDocument();
    });
  });

  describe('Service Worker Status', () => {
    it('should show service worker available when present', async () => {
      const swStatus: OnlineStatus = {
        ...mockOnlineStatus,
        hasServiceWorker: true
      };
      mockUseOnlineStatus.mockReturnValue(swStatus);
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator showWhenOnline showDetails />);
      
      expect(screen.getByText(/offline support enabled/i)).toBeInTheDocument();
    });

    it('should show service worker unavailable when missing', async () => {
      const noSwStatus: OnlineStatus = {
        ...mockOnlineStatus,
        hasServiceWorker: false
      };
      mockUseOnlineStatus.mockReturnValue(noSwStatus);
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator showWhenOnline showDetails />);
      
      expect(screen.getByText(/offline support disabled/i)).toBeInTheDocument();
    });
  });

  describe('Props and Customization', () => {
    it('should accept custom className', async () => {
      mockUseOnlineStatus.mockReturnValue({ ...mockOnlineStatus, isOffline: true, isOnline: false });
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator className="custom-class" />);
      
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('custom-class');
    });

    it('should show details when showDetails prop is true', async () => {
      mockUseOnlineStatus.mockReturnValue({ ...mockOnlineStatus, isOffline: true, isOnline: false });
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator showDetails />);
      
      expect(screen.getByText(/last updated/i)).toBeInTheDocument();
    });

    it('should be compact by default', async () => {
      mockUseOnlineStatus.mockReturnValue({ ...mockOnlineStatus, isOffline: true, isOnline: false });
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator />);
      
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('px-3', 'py-1'); // Compact padding
    });

    it('should be expandable when showDetails is true', async () => {
      mockUseOnlineStatus.mockReturnValue({ ...mockOnlineStatus, isOffline: true, isOnline: false });
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator showDetails />);
      
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('px-4', 'py-2'); // Expanded padding
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      mockUseOnlineStatus.mockReturnValue({ ...mockOnlineStatus, isOffline: true, isOnline: false });
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator />);
      
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-live', 'polite');
      expect(indicator).toHaveAttribute('aria-label', expect.stringContaining('offline'));
    });

    it('should announce status changes to screen readers', async () => {
      mockUseOnlineStatus.mockReturnValue(mockOnlineStatus);
      
      const { OfflineIndicator } = await import('../OfflineIndicator');
      render(<OfflineIndicator showWhenOnline />);
      
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-live', 'polite');
      expect(indicator).toHaveAttribute('aria-label', expect.stringContaining('online'));
    });
  });
});