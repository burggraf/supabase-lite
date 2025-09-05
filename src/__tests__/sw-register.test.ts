import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
// ServiceWorkerManager and EnvironmentDetector imports are used in the test setup via dynamic imports

// Mock the dependencies
vi.mock('../lib/offline/ServiceWorkerManager');
vi.mock('../lib/offline/EnvironmentDetector');

describe('Service Worker Registration', () => {
  let mockServiceWorkerManager: {
    register: ReturnType<typeof vi.fn>;
    unregister: ReturnType<typeof vi.fn>;
    isRegistered: ReturnType<typeof vi.fn>;
    onUpdateAvailable: ReturnType<typeof vi.fn>;
    skipWaiting: ReturnType<typeof vi.fn>;
  };

  let mockEnvironmentDetector: {
    shouldAutoRegisterServiceWorker: ReturnType<typeof vi.fn>;
    isProduction: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset modules to ensure clean imports
    vi.resetModules();

    // Mock ServiceWorkerManager
    mockServiceWorkerManager = {
      register: vi.fn().mockResolvedValue(undefined),
      unregister: vi.fn().mockResolvedValue(undefined),
      isRegistered: vi.fn().mockResolvedValue(true),
      onUpdateAvailable: vi.fn(),
      skipWaiting: vi.fn().mockResolvedValue(undefined)
    };

    // Mock EnvironmentDetector
    mockEnvironmentDetector = {
      shouldAutoRegisterServiceWorker: vi.fn().mockReturnValue(true),
      isProduction: vi.fn().mockReturnValue(true)
    };

    // Setup mocks
    const { ServiceWorkerManager } = await import('../lib/offline/ServiceWorkerManager');
    const { EnvironmentDetector } = await import('../lib/offline/EnvironmentDetector');

    vi.mocked(ServiceWorkerManager).mockImplementation(() => mockServiceWorkerManager as unknown as InstanceType<typeof ServiceWorkerManager>);
    vi.mocked(EnvironmentDetector).mockImplementation(() => mockEnvironmentDetector as unknown as InstanceType<typeof EnvironmentDetector>);

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn(),
        ready: Promise.resolve({}),
        controller: null
      },
      writable: true,
      configurable: true
    });

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerServiceWorker', () => {
    it('should register service worker in production environment', async () => {
      const { registerServiceWorker } = await import('../sw-register');
      
      await registerServiceWorker();
      
      expect(mockServiceWorkerManager.register).toHaveBeenCalledWith(true, false);
      expect(console.log).toHaveBeenCalledWith('✅ Service Worker registered successfully');
    });

    it('should skip registration in development by default', async () => {
      mockEnvironmentDetector.shouldAutoRegisterServiceWorker.mockReturnValue(false);
      
      const { registerServiceWorker } = await import('../sw-register');
      
      await registerServiceWorker();
      
      expect(mockServiceWorkerManager.register).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Service Worker registration skipped in development environment');
    });

    it('should force registration in development when requested', async () => {
      mockEnvironmentDetector.shouldAutoRegisterServiceWorker.mockReturnValue(false);
      mockEnvironmentDetector.isProduction.mockReturnValue(false);
      
      const { registerServiceWorker } = await import('../sw-register');
      
      await registerServiceWorker(true); // forceRegister = true
      
      expect(mockServiceWorkerManager.register).toHaveBeenCalledWith(false, true);
    });

    it('should handle registration failures gracefully', async () => {
      const error = new Error('Registration failed');
      mockServiceWorkerManager.register.mockRejectedValue(error);
      
      const { registerServiceWorker } = await import('../sw-register');
      
      await registerServiceWorker();
      
      expect(console.error).toHaveBeenCalledWith('❌ Service Worker registration failed:', error);
    });

    it('should skip registration when service workers are not supported', async () => {
      // Remove service worker support
      delete (navigator as Record<string, unknown>).serviceWorker;
      
      const { registerServiceWorker } = await import('../sw-register');
      
      await registerServiceWorker();
      
      expect(mockServiceWorkerManager.register).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Service Workers are not supported in this browser');
    });

    it('should set up update notifications', async () => {
      const { registerServiceWorker } = await import('../sw-register');
      
      await registerServiceWorker();
      
      expect(mockServiceWorkerManager.onUpdateAvailable).toHaveBeenCalled();
      
      // Test the update callback
      const updateCallback = mockServiceWorkerManager.onUpdateAvailable.mock.calls[0][0];
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
      
      updateCallback();
      
      expect(dispatchEventSpy).toHaveBeenCalled();
      const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('sw-update-available');
      expect(event.detail.message).toBe('A new version is available. Refresh to update.');
      expect(typeof event.detail.skipWaiting).toBe('function');
    });
  });

  describe('unregisterServiceWorker', () => {
    it('should unregister service worker when manager exists', async () => {
      const { registerServiceWorker, unregisterServiceWorker } = await import('../sw-register');
      
      // First register
      await registerServiceWorker();
      
      // Then unregister
      await unregisterServiceWorker();
      
      expect(mockServiceWorkerManager.unregister).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Service Worker unregistered');
    });

    it('should handle unregistration when no manager exists', async () => {
      const { unregisterServiceWorker } = await import('../sw-register');
      
      await unregisterServiceWorker();
      
      // Should not crash and not call unregister
      expect(mockServiceWorkerManager.unregister).not.toHaveBeenCalled();
    });
  });

  describe('isServiceWorkerRegistered', () => {
    it('should return registration status when manager exists', async () => {
      const { registerServiceWorker, isServiceWorkerRegistered } = await import('../sw-register');
      
      await registerServiceWorker();
      const isRegistered = await isServiceWorkerRegistered();
      
      expect(mockServiceWorkerManager.isRegistered).toHaveBeenCalled();
      expect(isRegistered).toBe(true);
    });

    it('should return false when no manager exists', async () => {
      const { isServiceWorkerRegistered } = await import('../sw-register');
      
      const isRegistered = await isServiceWorkerRegistered();
      
      expect(isRegistered).toBe(false);
    });
  });

  describe('getServiceWorkerManager', () => {
    it('should return manager instance after registration', async () => {
      const { registerServiceWorker, getServiceWorkerManager } = await import('../sw-register');
      
      await registerServiceWorker();
      const manager = getServiceWorkerManager();
      
      expect(manager).not.toBeNull();
    });

    it('should return null when no registration has occurred', async () => {
      const { getServiceWorkerManager } = await import('../sw-register');
      
      const manager = getServiceWorkerManager();
      
      expect(manager).toBeNull();
    });
  });
});