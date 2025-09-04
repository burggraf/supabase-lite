/**
 * WebVM Status Component Tests
 * 
 * Tests for the WebVM status and control UI component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { WebVMStatus } from '../WebVMStatus'
import { WebVMManager } from '../../../lib/webvm/WebVMManager'

// Mock the WebVMManager
vi.mock('../../../lib/webvm/WebVMManager', () => ({
  WebVMManager: {
    getInstance: vi.fn()
  }
}))

describe('WebVMStatus', () => {
  let mockWebVMManager: any
  
  beforeEach(() => {
    // Create mock WebVM manager
    mockWebVMManager = {
      getStatus: vi.fn(),
      getConfig: vi.fn(),
      configure: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      restart: vi.fn(),
      getMetrics: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    }
    
    // Setup default mock return values
    mockWebVMManager.getStatus.mockReturnValue({
      state: 'stopped',
      ready: false,
      error: null,
      uptime: 0,
      deno: { available: false, version: null },
      network: { connected: false, tailscaleStatus: 'disconnected' },
      functions: { deployed: [], active: 0, total: 0 },
      resources: {
        memory: { used: '0M', total: '0M', limit: '1G' },
        cpu: { usage: 0, cores: 0 },
        storage: { used: '0M', total: '0M' }
      }
    })
    
    mockWebVMManager.getConfig.mockReturnValue({
      memory: '1G',
      cpu: 1,
      networking: { enabled: true, tailscale: { authKey: 'test-key' } },
      storage: { persistent: true, size: '1G' }
    })
    
    mockWebVMManager.getMetrics.mockResolvedValue({
      memory: { used: 0, total: 1073741824, available: 1073741824 },
      cpu: { usage: 0, cores: 1, load: [0, 0, 0] },
      network: { bytesIn: 0, bytesOut: 0, connectionsActive: 0 },
      functions: { totalExecutions: 0, averageExecutionTime: 0, errorRate: 0 }
    })
    
    // Mock WebVMManager.getInstance to return our mock
    vi.mocked(WebVMManager.getInstance).mockReturnValue(mockWebVMManager)
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render WebVM status panel', () => {
      render(<WebVMStatus />)
      
      expect(screen.getByText('WebVM Status')).toBeInTheDocument()
      expect(screen.getByText('Stopped')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /start webvm/i })).toBeInTheDocument()
    })

    it('should display correct status badge for stopped state', () => {
      render(<WebVMStatus />)
      
      const statusBadge = screen.getByText('Stopped')
      expect(statusBadge).toHaveClass('bg-gray-500')
    })

    it('should display correct status badge for running state', () => {
      mockWebVMManager.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null,
        uptime: 30000,
        deno: { available: true, version: '1.40.0' },
        network: { connected: true, tailscaleStatus: 'connected' },
        functions: { deployed: ['test-func'], active: 0, total: 1 },
        resources: {
          memory: { used: '256M', total: '1G', limit: '1G' },
          cpu: { usage: 0.25, cores: 1 },
          storage: { used: '100M', total: '1G' }
        }
      })
      
      render(<WebVMStatus />)
      
      const statusBadge = screen.getByText('Running')
      expect(statusBadge).toHaveClass('bg-green-500')
    })

    it('should display error state correctly', () => {
      mockWebVMManager.getStatus.mockReturnValue({
        state: 'error',
        ready: false,
        error: 'WebVM failed to initialize',
        uptime: 0,
        deno: { available: false, version: null },
        network: { connected: false, tailscaleStatus: 'disconnected' },
        functions: { deployed: [], active: 0, total: 0 },
        resources: {
          memory: { used: '0M', total: '0M', limit: '1G' },
          cpu: { usage: 0, cores: 0 },
          storage: { used: '0M', total: '0M' }
        }
      })
      
      render(<WebVMStatus />)
      
      const statusBadge = screen.getByText('Error')
      expect(statusBadge).toHaveClass('bg-red-500')
      expect(screen.getByText('WebVM failed to initialize')).toBeInTheDocument()
    })
  })

  describe('Control Actions', () => {
    it('should call start when start button is clicked', async () => {
      mockWebVMManager.start.mockResolvedValue()
      
      render(<WebVMStatus />)
      
      const startButton = screen.getByRole('button', { name: /start webvm/i })
      fireEvent.click(startButton)
      
      await waitFor(() => {
        expect(mockWebVMManager.start).toHaveBeenCalledTimes(1)
      })
    })

    it('should show stop button when WebVM is running', () => {
      mockWebVMManager.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null,
        uptime: 30000,
        deno: { available: true, version: '1.40.0' },
        network: { connected: true, tailscaleStatus: 'connected' },
        functions: { deployed: [], active: 0, total: 0 },
        resources: {
          memory: { used: '256M', total: '1G', limit: '1G' },
          cpu: { usage: 0.25, cores: 1 },
          storage: { used: '100M', total: '1G' }
        }
      })
      
      render(<WebVMStatus />)
      
      expect(screen.getByRole('button', { name: /stop webvm/i })).toBeInTheDocument()
    })

    it('should call stop when stop button is clicked', async () => {
      mockWebVMManager.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null,
        uptime: 30000,
        deno: { available: true, version: '1.40.0' },
        network: { connected: true, tailscaleStatus: 'connected' },
        functions: { deployed: [], active: 0, total: 0 },
        resources: {
          memory: { used: '256M', total: '1G', limit: '1G' },
          cpu: { usage: 0.25, cores: 1 },
          storage: { used: '100M', total: '1G' }
        }
      })
      
      mockWebVMManager.stop.mockResolvedValue()
      
      render(<WebVMStatus />)
      
      const stopButton = screen.getByRole('button', { name: /stop webvm/i })
      fireEvent.click(stopButton)
      
      await waitFor(() => {
        expect(mockWebVMManager.stop).toHaveBeenCalledTimes(1)
      })
    })

    it('should show restart button when WebVM is running', () => {
      mockWebVMManager.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null,
        uptime: 30000,
        deno: { available: true, version: '1.40.0' },
        network: { connected: true, tailscaleStatus: 'connected' },
        functions: { deployed: [], active: 0, total: 0 },
        resources: {
          memory: { used: '256M', total: '1G', limit: '1G' },
          cpu: { usage: 0.25, cores: 1 },
          storage: { used: '100M', total: '1G' }
        }
      })
      
      render(<WebVMStatus />)
      
      expect(screen.getByRole('button', { name: /restart webvm/i })).toBeInTheDocument()
    })

    it('should call restart when restart button is clicked', async () => {
      mockWebVMManager.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null,
        uptime: 30000,
        deno: { available: true, version: '1.40.0' },
        network: { connected: true, tailscaleStatus: 'connected' },
        functions: { deployed: [], active: 0, total: 0 },
        resources: {
          memory: { used: '256M', total: '1G', limit: '1G' },
          cpu: { usage: 0.25, cores: 1 },
          storage: { used: '100M', total: '1G' }
        }
      })
      
      mockWebVMManager.restart.mockResolvedValue()
      
      render(<WebVMStatus />)
      
      const restartButton = screen.getByRole('button', { name: /restart webvm/i })
      fireEvent.click(restartButton)
      
      await waitFor(() => {
        expect(mockWebVMManager.restart).toHaveBeenCalledTimes(1)
      })
    })

    it('should disable buttons during state transitions', () => {
      mockWebVMManager.getStatus.mockReturnValue({
        state: 'starting',
        ready: false,
        error: null,
        uptime: 0,
        deno: { available: false, version: null },
        network: { connected: false, tailscaleStatus: 'connecting' },
        functions: { deployed: [], active: 0, total: 0 },
        resources: {
          memory: { used: '0M', total: '0M', limit: '1G' },
          cpu: { usage: 0, cores: 0 },
          storage: { used: '0M', total: '0M' }
        }
      })
      
      render(<WebVMStatus />)
      
      const startButton = screen.getByRole('button', { name: /starting.../i })
      expect(startButton).toBeDisabled()
    })
  })

  describe('Resource Information', () => {
    it('should display Deno runtime information when available', () => {
      mockWebVMManager.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null,
        uptime: 30000,
        deno: { available: true, version: '1.40.0' },
        network: { connected: true, tailscaleStatus: 'connected' },
        functions: { deployed: ['func1', 'func2'], active: 1, total: 2 },
        resources: {
          memory: { used: '256M', total: '1G', limit: '1G' },
          cpu: { usage: 0.25, cores: 1 },
          storage: { used: '100M', total: '1G' }
        }
      })
      
      render(<WebVMStatus />)
      
      expect(screen.getByText('Deno 1.40.0')).toBeInTheDocument()
      expect(screen.getByText('2 functions deployed')).toBeInTheDocument()
      expect(screen.getByText('1 active')).toBeInTheDocument()
    })

    it('should display resource usage information', () => {
      mockWebVMManager.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null,
        uptime: 30000,
        deno: { available: true, version: '1.40.0' },
        network: { connected: true, tailscaleStatus: 'connected' },
        functions: { deployed: [], active: 0, total: 0 },
        resources: {
          memory: { used: '256M', total: '1G', limit: '1G' },
          cpu: { usage: 0.25, cores: 1 },
          storage: { used: '100M', total: '1G' }
        }
      })
      
      render(<WebVMStatus />)
      
      expect(screen.getByText('Memory: 256M / 1G')).toBeInTheDocument()
      expect(screen.getByText('CPU: 25%')).toBeInTheDocument()
      expect(screen.getByText('Storage: 100M / 1G')).toBeInTheDocument()
    })

    it('should display uptime when WebVM is running', () => {
      mockWebVMManager.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null,
        uptime: 125000, // ~2 minutes
        deno: { available: true, version: '1.40.0' },
        network: { connected: true, tailscaleStatus: 'connected' },
        functions: { deployed: [], active: 0, total: 0 },
        resources: {
          memory: { used: '256M', total: '1G', limit: '1G' },
          cpu: { usage: 0.25, cores: 1 },
          storage: { used: '100M', total: '1G' }
        }
      })
      
      render(<WebVMStatus />)
      
      expect(screen.getByText(/Uptime: 2m/)).toBeInTheDocument()
    })

    it('should display network status', () => {
      mockWebVMManager.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null,
        uptime: 30000,
        deno: { available: true, version: '1.40.0' },
        network: { connected: true, tailscaleStatus: 'connected' },
        functions: { deployed: [], active: 0, total: 0 },
        resources: {
          memory: { used: '256M', total: '1G', limit: '1G' },
          cpu: { usage: 0.25, cores: 1 },
          storage: { used: '100M', total: '1G' }
        }
      })
      
      render(<WebVMStatus />)
      
      expect(screen.getByText('Network: Connected')).toBeInTheDocument()
    })
  })

  describe('Real-time Updates', () => {
    it('should register for WebVM events on mount', () => {
      render(<WebVMStatus />)
      
      expect(mockWebVMManager.on).toHaveBeenCalledWith('started', expect.any(Function))
      expect(mockWebVMManager.on).toHaveBeenCalledWith('stopped', expect.any(Function))
      expect(mockWebVMManager.on).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('should unregister events on unmount', () => {
      const { unmount } = render(<WebVMStatus />)
      
      unmount()
      
      expect(mockWebVMManager.off).toHaveBeenCalledWith('started', expect.any(Function))
      expect(mockWebVMManager.off).toHaveBeenCalledWith('stopped', expect.any(Function))
      expect(mockWebVMManager.off).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('should update status when WebVM events are emitted', async () => {
      let startedCallback: Function
      
      mockWebVMManager.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'started') {
          startedCallback = callback
        }
      })
      
      render(<WebVMStatus />)
      
      // Simulate WebVM started event
      mockWebVMManager.getStatus.mockReturnValue({
        state: 'running',
        ready: true,
        error: null,
        uptime: 1000,
        deno: { available: true, version: '1.40.0' },
        network: { connected: true, tailscaleStatus: 'connected' },
        functions: { deployed: [], active: 0, total: 0 },
        resources: {
          memory: { used: '128M', total: '1G', limit: '1G' },
          cpu: { usage: 0.1, cores: 1 },
          storage: { used: '50M', total: '1G' }
        }
      })
      
      act(() => {
        startedCallback!()
      })
      
      await waitFor(() => {
        expect(screen.getByText('Running')).toBeInTheDocument()
      })
    })
  })

  describe('Configuration Display', () => {
    it('should display configuration information', () => {
      mockWebVMManager.getConfig.mockReturnValue({
        memory: '2G',
        cpu: 4,
        networking: { enabled: true, tailscale: { authKey: 'test-key' } },
        storage: { persistent: true, size: '5G' }
      })
      
      render(<WebVMStatus />)
      
      expect(screen.getByText('Memory Limit: 2G')).toBeInTheDocument()
      expect(screen.getByText('CPU Cores: 4')).toBeInTheDocument()
      expect(screen.getByText('Storage Size: 5G')).toBeInTheDocument()
    })

    it('should indicate when networking is disabled', () => {
      mockWebVMManager.getConfig.mockReturnValue({
        memory: '1G',
        cpu: 1,
        networking: { enabled: false, tailscale: { authKey: 'test-key' } },
        storage: { persistent: true, size: '1G' }
      })
      
      render(<WebVMStatus />)
      
      expect(screen.getByText('Networking: Disabled')).toBeInTheDocument()
    })
  })
})