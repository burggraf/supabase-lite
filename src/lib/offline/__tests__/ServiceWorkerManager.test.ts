import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ServiceWorkerManager } from '../ServiceWorkerManager';

// Mock navigator.serviceWorker
const mockServiceWorker = {
  register: vi.fn(),
  getRegistration: vi.fn(),
  ready: Promise.resolve({
    active: { state: 'activated' },
    waiting: null,
    installing: null,
    update: vi.fn()
  }),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

Object.defineProperty(global, 'navigator', {
  value: {
    serviceWorker: mockServiceWorker
  },
  writable: true
});

describe('ServiceWorkerManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset module cache to get fresh imports
    vi.resetModules();
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Registration', () => {
    it('should register service worker in production environment', async () => {
      mockServiceWorker.register.mockResolvedValue({
        installing: null,
        waiting: null,
        active: { state: 'activated' },
        addEventListener: vi.fn()
      });

      const { ServiceWorkerManager } = await import('../ServiceWorkerManager');
      const manager = new ServiceWorkerManager();
      
      await manager.register(true); // isProduction = true
      
      expect(mockServiceWorker.register).toHaveBeenCalledWith('/service-worker.js', {
        scope: '/'
      });
    });

    it('should not register service worker in development environment by default', async () => {
      const { ServiceWorkerManager } = await import('../ServiceWorkerManager');
      const manager = new ServiceWorkerManager();
      
      await manager.register(false); // isProduction = false
      
      expect(mockServiceWorker.register).not.toHaveBeenCalled();
    });

    it('should allow forced registration in development', async () => {
      mockServiceWorker.register.mockResolvedValue({
        installing: null,
        waiting: null,
        active: { state: 'activated' },
        addEventListener: vi.fn()
      });

      const { ServiceWorkerManager } = await import('../ServiceWorkerManager');
      const manager = new ServiceWorkerManager();
      
      await manager.register(false, true); // isProduction = false, force = true
      
      expect(mockServiceWorker.register).toHaveBeenCalledWith('/service-worker.js', {
        scope: '/'
      });
    });

    it('should handle registration failure gracefully', async () => {
      const registrationError = new Error('Registration failed');
      mockServiceWorker.register.mockRejectedValue(registrationError);

      const { ServiceWorkerManager } = await import('../ServiceWorkerManager');
      const manager = new ServiceWorkerManager();
      
      await expect(manager.register(true)).rejects.toThrow('Registration failed');
      expect(console.error).toHaveBeenCalledWith(
        'Service Worker registration failed:',
        registrationError
      );
    });
  });

  describe('Update Handling', () => {
    it('should detect and handle service worker updates', async () => {
      const mockRegistration = {
        installing: null,
        waiting: { state: 'installed' },
        active: { state: 'activated' },
        addEventListener: vi.fn(),
        update: vi.fn()
      };

      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      const { ServiceWorkerManager } = await import('../ServiceWorkerManager');
      const manager = new ServiceWorkerManager();
      
      const updateCallback = vi.fn();
      manager.onUpdateAvailable(updateCallback);
      
      await manager.register(true);
      
      // Simulate update available event
      const updateEvent = { type: 'updatefound' };
      const eventHandler = mockRegistration.addEventListener.mock.calls
        .find(([event]) => event === 'updatefound')?.[1];
      
      if (eventHandler) {
        eventHandler(updateEvent);
      }
      
      expect(updateCallback).toHaveBeenCalled();
    });

    it('should skip waiting when update is applied', async () => {
      const mockWaitingSW = {
        state: 'installed',
        postMessage: vi.fn()
      };

      const mockRegistration = {
        installing: null,
        waiting: mockWaitingSW,
        active: { state: 'activated' },
        addEventListener: vi.fn()
      };

      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      const { ServiceWorkerManager } = await import('../ServiceWorkerManager');
      const manager = new ServiceWorkerManager();
      
      await manager.register(true);
      await manager.skipWaiting();
      
      expect(mockWaitingSW.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    });
  });

  describe('Status Checking', () => {
    it('should correctly identify if service worker is supported', async () => {
      const { ServiceWorkerManager } = await import('../ServiceWorkerManager');
      const manager = new ServiceWorkerManager();
      
      expect(manager.isSupported()).toBe(true);
    });

    it('should return false when service worker is not supported', async () => {
      // Temporarily remove serviceWorker support
      const originalServiceWorker = navigator.serviceWorker;
      delete (navigator as any).serviceWorker;

      const { ServiceWorkerManager } = await import('../ServiceWorkerManager');
      const manager = new ServiceWorkerManager();
      
      expect(manager.isSupported()).toBe(false);
      
      // Restore serviceWorker
      (navigator as any).serviceWorker = originalServiceWorker;
    });

    it('should check if service worker is registered', async () => {
      mockServiceWorker.getRegistration.mockResolvedValue({
        active: { state: 'activated' }
      });

      const { ServiceWorkerManager } = await import('../ServiceWorkerManager');
      const manager = new ServiceWorkerManager();
      
      const isRegistered = await manager.isRegistered();
      
      expect(isRegistered).toBe(true);
      expect(mockServiceWorker.getRegistration).toHaveBeenCalled();
    });

    it('should return false when service worker is not registered', async () => {
      mockServiceWorker.getRegistration.mockResolvedValue(null);

      const { ServiceWorkerManager } = await import('../ServiceWorkerManager');
      const manager = new ServiceWorkerManager();
      
      const isRegistered = await manager.isRegistered();
      
      expect(isRegistered).toBe(false);
    });
  });

  describe('Unregistration', () => {
    it('should unregister service worker', async () => {
      const mockUnregister = vi.fn().mockResolvedValue(true);
      mockServiceWorker.getRegistration.mockResolvedValue({
        unregister: mockUnregister,
        active: { state: 'activated' }
      });

      const { ServiceWorkerManager } = await import('../ServiceWorkerManager');
      const manager = new ServiceWorkerManager();
      
      await manager.unregister();
      
      expect(mockUnregister).toHaveBeenCalled();
    });

    it('should handle unregistration when no service worker is registered', async () => {
      mockServiceWorker.getRegistration.mockResolvedValue(null);

      const { ServiceWorkerManager } = await import('../ServiceWorkerManager');
      const manager = new ServiceWorkerManager();
      
      await expect(manager.unregister()).resolves.not.toThrow();
      expect(console.log).toHaveBeenCalledWith('No Service Worker to unregister');
    });
  });
});