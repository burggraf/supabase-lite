import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('useOnlineStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true
    });
    
    // Mock window.addEventListener and removeEventListener
    vi.spyOn(window, 'addEventListener');
    vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should return online status initially', async () => {
      const { useOnlineStatus } = await import('../useOnlineStatus');
      const { result } = renderHook(() => useOnlineStatus());
      
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });

    it('should return offline status when navigator.onLine is false', async () => {
      // Set navigator.onLine to false
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      const { useOnlineStatus } = await import('../useOnlineStatus');
      const { result } = renderHook(() => useOnlineStatus());
      
      expect(result.current.isOnline).toBe(false);
      expect(result.current.isOffline).toBe(true);
    });
  });

  describe('Event Listeners', () => {
    it('should set up event listeners on mount', async () => {
      const { useOnlineStatus } = await import('../useOnlineStatus');
      renderHook(() => useOnlineStatus());
      
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should clean up event listeners on unmount', async () => {
      const { useOnlineStatus } = await import('../useOnlineStatus');
      const { unmount } = renderHook(() => useOnlineStatus());
      
      unmount();
      
      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Status Updates', () => {
    it('should update to offline when offline event is fired', async () => {
      const { useOnlineStatus } = await import('../useOnlineStatus');
      const { result } = renderHook(() => useOnlineStatus());
      
      expect(result.current.isOnline).toBe(true);
      
      // Simulate going offline
      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          value: false,
          writable: true,
          configurable: true
        });
        window.dispatchEvent(new Event('offline'));
      });
      
      expect(result.current.isOnline).toBe(false);
      expect(result.current.isOffline).toBe(true);
    });

    it('should update to online when online event is fired', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true
      });

      const { useOnlineStatus } = await import('../useOnlineStatus');
      const { result } = renderHook(() => useOnlineStatus());
      
      expect(result.current.isOnline).toBe(false);
      
      // Simulate going online
      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          value: true,
          writable: true,
          configurable: true
        });
        window.dispatchEvent(new Event('online'));
      });
      
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });
  });

  describe('Connection Quality', () => {
    it('should return connection info when available', async () => {
      // Mock connection API
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '4g',
          downlink: 10,
          rtt: 100,
          saveData: false
        },
        writable: true,
        configurable: true
      });

      const { useOnlineStatus } = await import('../useOnlineStatus');
      const { result } = renderHook(() => useOnlineStatus());
      
      expect(result.current.connectionType).toBe('4g');
      expect(result.current.downlink).toBe(10);
      expect(result.current.rtt).toBe(100);
      expect(result.current.saveData).toBe(false);
    });

    it('should handle missing connection API gracefully', async () => {
      // Remove connection API
      Object.defineProperty(navigator, 'connection', {
        value: undefined,
        writable: true,
        configurable: true
      });

      const { useOnlineStatus } = await import('../useOnlineStatus');
      const { result } = renderHook(() => useOnlineStatus());
      
      expect(result.current.connectionType).toBeUndefined();
      expect(result.current.downlink).toBeUndefined();
      expect(result.current.rtt).toBeUndefined();
      expect(result.current.saveData).toBeUndefined();
    });
  });

  describe('Service Worker Status', () => {
    it('should detect service worker support', async () => {
      // Mock service worker support
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({}),
          controller: { state: 'activated' }
        },
        writable: true,
        configurable: true
      });

      const { useOnlineStatus } = await import('../useOnlineStatus');
      const { result } = renderHook(() => useOnlineStatus());
      
      expect(result.current.hasServiceWorker).toBe(true);
    });

    it('should handle missing service worker support', async () => {
      // Remove service worker support
      delete (navigator as any).serviceWorker;

      const { useOnlineStatus } = await import('../useOnlineStatus');
      const { result } = renderHook(() => useOnlineStatus());
      
      expect(result.current.hasServiceWorker).toBe(false);
    });
  });

  describe('Last Updated Timestamp', () => {
    it('should track when status was last updated', async () => {
      const { useOnlineStatus } = await import('../useOnlineStatus');
      const { result } = renderHook(() => useOnlineStatus());
      
      const initialTimestamp = result.current.lastUpdated;
      expect(initialTimestamp).toBeInstanceOf(Date);
      
      // Wait a bit and trigger a status change
      await new Promise(resolve => setTimeout(resolve, 10));
      
      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          value: false,
          writable: true,
          configurable: true
        });
        window.dispatchEvent(new Event('offline'));
      });
      
      expect(result.current.lastUpdated).not.toEqual(initialTimestamp);
      expect(result.current.lastUpdated.getTime()).toBeGreaterThan(initialTimestamp.getTime());
    });
  });
});