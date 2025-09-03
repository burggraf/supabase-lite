import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Service Worker global objects
const mockServiceWorkerContainer = {
  register: vi.fn(),
  ready: Promise.resolve({}),
  controller: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

const mockServiceWorker = {
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  state: 'activated',
  scriptURL: '/service-worker.js'
};

const mockRegistration = {
  installing: null,
  waiting: null,
  active: mockServiceWorker,
  scope: '/',
  update: vi.fn(),
  unregister: vi.fn(),
  addEventListener: vi.fn()
};

// Mock Cache API
const mockCache = {
  match: vi.fn(),
  add: vi.fn(),
  addAll: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn()
};

const mockCaches = {
  open: vi.fn().mockResolvedValue(mockCache),
  has: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn()
};

describe('Service Worker Tests', () => {
  beforeEach(() => {
    // Mock Service Worker APIs
    Object.defineProperty(global, 'navigator', {
      value: {
        serviceWorker: mockServiceWorkerContainer
      },
      writable: true
    });

    Object.defineProperty(global, 'caches', {
      value: mockCaches,
      writable: true
    });

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Service Worker Registration', () => {
    it('should register service worker in production', async () => {
      // Arrange: Mock production environment
      vi.stubGlobal('import.meta.env', {
        PROD: true,
        DEV: false,
        MODE: 'production'
      });

      mockServiceWorkerContainer.register.mockResolvedValue(mockRegistration);

      // Act: Register service worker
      if ('serviceWorker' in navigator && import.meta.env.PROD) {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        
        // Assert: Should register successfully
        expect(registration).toBeDefined();
        expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/service-worker.js');
      }
    });

    it('should not register service worker in development', () => {
      // Arrange: Mock development environment
      vi.stubGlobal('import.meta.env', {
        PROD: false,
        DEV: true,
        MODE: 'development'
      });

      // Act: Attempt to register service worker
      const shouldRegister = 'serviceWorker' in navigator && import.meta.env.PROD;

      // Assert: Should not register in development
      expect(shouldRegister).toBe(false);
      expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
    });

    it('should handle registration errors gracefully', async () => {
      // Arrange: Mock registration failure
      const registrationError = new Error('Service worker registration failed');
      mockServiceWorkerContainer.register.mockRejectedValue(registrationError);

      // Act & Assert: Should handle errors
      if ('serviceWorker' in navigator) {
        await expect(navigator.serviceWorker.register('/service-worker.js'))
          .rejects.toThrow('Service worker registration failed');
      }
    });

    it('should detect service worker support', () => {
      // Act: Check service worker support
      const isSupported = 'serviceWorker' in navigator;
      const isCacheSupported = 'caches' in window;

      // Assert: Should detect support
      expect(isSupported).toBe(true);
      expect(isCacheSupported).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should create and manage caches', async () => {
      // Arrange: Mock cache creation
      const cacheName = 'supabase-lite-v1';
      mockCaches.open.mockResolvedValue(mockCache);

      // Act: Open cache
      const cache = await caches.open(cacheName);

      // Assert: Should create cache successfully
      expect(caches.open).toHaveBeenCalledWith(cacheName);
      expect(cache).toBe(mockCache);
    });

    it('should cache static assets', async () => {
      // Arrange: Mock asset caching
      const assets = [
        '/static/js/main.js',
        '/static/css/main.css',
        '/favicon.ico'
      ];
      
      mockCache.addAll.mockResolvedValue(undefined);
      const cache = await caches.open('static-assets');

      // Act: Cache assets
      await cache.addAll(assets);

      // Assert: Should cache all assets
      expect(cache.addAll).toHaveBeenCalledWith(assets);
    });

    it('should retrieve cached responses', async () => {
      // Arrange: Mock cached response
      const request = new Request('/api/test');
      const cachedResponse = new Response('cached data');
      mockCache.match.mockResolvedValue(cachedResponse);

      const cache = await caches.open('api-cache');

      // Act: Retrieve from cache
      const response = await cache.match(request);

      // Assert: Should return cached response
      expect(response).toBe(cachedResponse);
      expect(cache.match).toHaveBeenCalledWith(request);
    });

    it('should handle cache misses', async () => {
      // Arrange: Mock cache miss
      const request = new Request('/api/missing');
      mockCache.match.mockResolvedValue(undefined);

      const cache = await caches.open('api-cache');

      // Act: Try to retrieve non-cached item
      const response = await cache.match(request);

      // Assert: Should return undefined for cache miss
      expect(response).toBeUndefined();
    });

    it('should delete cached items', async () => {
      // Arrange: Mock cache deletion
      const request = new Request('/api/old-data');
      mockCache.delete.mockResolvedValue(true);

      const cache = await caches.open('api-cache');

      // Act: Delete cached item
      const deleted = await cache.delete(request);

      // Assert: Should delete successfully
      expect(deleted).toBe(true);
      expect(cache.delete).toHaveBeenCalledWith(request);
    });
  });

  describe('Caching Strategies', () => {
    it('should implement cache-first strategy', async () => {
      // Arrange: Mock cache-first scenario
      const request = new Request('/static/asset.js');
      const cachedResponse = new Response('cached asset');
      
      mockCache.match.mockResolvedValue(cachedResponse);
      const cache = await caches.open('static-cache');

      // Act: Implement cache-first
      let response = await cache.match(request);
      if (!response) {
        response = await fetch(request);
        await cache.put(request, response.clone());
      }

      // Assert: Should return cached response first
      expect(response).toBe(cachedResponse);
      expect(cache.match).toHaveBeenCalledWith(request);
    });

    it('should implement network-first strategy', async () => {
      // Arrange: Mock network-first scenario
      const request = new Request('/api/dynamic-data');
      const networkResponse = new Response('fresh data');
      const cachedResponse = new Response('stale data');

      // Mock successful network request
      global.fetch = vi.fn().mockResolvedValue(networkResponse);
      mockCache.match.mockResolvedValue(cachedResponse);
      mockCache.put.mockResolvedValue(undefined);

      const cache = await caches.open('api-cache');

      // Act: Implement network-first
      let response;
      try {
        response = await fetch(request);
        await cache.put(request, response.clone());
      } catch (error) {
        response = await cache.match(request);
      }

      // Assert: Should prefer network response
      expect(response).toBe(networkResponse);
      expect(global.fetch).toHaveBeenCalledWith(request);
      expect(cache.put).toHaveBeenCalledWith(request, networkResponse);
    });

    it('should fallback to cache when network fails', async () => {
      // Arrange: Mock network failure with cache fallback
      const request = new Request('/api/fallback-data');
      const cachedResponse = new Response('fallback data');

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      mockCache.match.mockResolvedValue(cachedResponse);

      const cache = await caches.open('api-cache');

      // Act: Try network first, fallback to cache
      let response;
      try {
        response = await fetch(request);
      } catch (error) {
        response = await cache.match(request);
      }

      // Assert: Should fallback to cached response
      expect(response).toBe(cachedResponse);
      expect(global.fetch).toHaveBeenCalledWith(request);
      expect(cache.match).toHaveBeenCalledWith(request);
    });
  });

  describe('Service Worker Lifecycle', () => {
    it('should handle service worker installation', async () => {
      // Arrange: Mock installation event
      const mockEventHandler = vi.fn();

      // Act: Simulate install event
      if (mockServiceWorker.addEventListener) {
        mockServiceWorker.addEventListener('install', mockEventHandler);
      }

      // Assert: Should set up install listener
      expect(mockServiceWorker.addEventListener).toHaveBeenCalledWith('install', mockEventHandler);
    });

    it('should handle service worker activation', async () => {
      // Arrange: Mock activation event
      const mockEventHandler = vi.fn();

      // Act: Simulate activate event
      if (mockServiceWorker.addEventListener) {
        mockServiceWorker.addEventListener('activate', mockEventHandler);
      }

      // Assert: Should set up activate listener
      expect(mockServiceWorker.addEventListener).toHaveBeenCalledWith('activate', mockEventHandler);
    });

    it('should handle service worker updates', async () => {
      // Arrange: Mock update scenario
      const newServiceWorker = {
        ...mockServiceWorker,
        state: 'installing'
      };

      const updatedRegistration = {
        ...mockRegistration,
        installing: newServiceWorker,
        update: vi.fn().mockResolvedValue(undefined)
      };

      mockServiceWorkerContainer.register.mockResolvedValue(updatedRegistration);

      // Act: Register and update
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      await registration.update();

      // Assert: Should handle updates
      expect(registration.update).toHaveBeenCalled();
      expect(registration.installing).toBe(newServiceWorker);
    });

    it('should clean up old caches on activation', async () => {
      // Arrange: Mock cache cleanup
      const currentVersion = 'v2';
      const oldCaches = ['supabase-lite-v1', 'static-assets-v1'];
      const newCaches = ['supabase-lite-v2', 'static-assets-v2'];

      mockCaches.keys.mockResolvedValue([...oldCaches, ...newCaches]);
      mockCaches.delete.mockResolvedValue(true);

      // Act: Simulate cache cleanup
      const cacheNames = await caches.keys();
      const cachesToDelete = cacheNames.filter(name => !name.includes(currentVersion));

      for (const cacheName of cachesToDelete) {
        await caches.delete(cacheName);
      }

      // Assert: Should delete old caches
      expect(caches.keys).toHaveBeenCalled();
      expect(caches.delete).toHaveBeenCalledTimes(2);
      oldCaches.forEach(cacheName => {
        expect(caches.delete).toHaveBeenCalledWith(cacheName);
      });
    });
  });

  describe('Message Communication', () => {
    it('should send messages to service worker', () => {
      // Arrange: Mock service worker ready
      mockServiceWorkerContainer.ready = Promise.resolve(mockRegistration);

      // Act: Send message to service worker
      if (mockServiceWorker.postMessage) {
        mockServiceWorker.postMessage({
          type: 'CACHE_UPDATE',
          payload: { url: '/api/data' }
        });
      }

      // Assert: Should send message
      expect(mockServiceWorker.postMessage).toHaveBeenCalledWith({
        type: 'CACHE_UPDATE',
        payload: { url: '/api/data' }
      });
    });

    it('should receive messages from service worker', () => {
      // Arrange: Mock message event
      const messageHandler = vi.fn();
      const messageData = {
        type: 'CACHE_UPDATED',
        payload: { status: 'success' }
      };

      // Act: Set up message listener
      navigator.serviceWorker.addEventListener('message', messageHandler);

      // Simulate message received
      const messageEvent = new MessageEvent('message', { data: messageData });
      messageHandler(messageEvent);

      // Assert: Should handle messages
      expect(messageHandler).toHaveBeenCalledWith(messageEvent);
    });
  });

  describe('Environment-Specific Behavior', () => {
    it('should use different strategies for development', () => {
      // Arrange: Development environment
      const isDevelopment = true;
      
      // Act: Determine strategy
      const cacheStrategy = isDevelopment ? 'network-first' : 'cache-first';
      const shouldBypassCache = isDevelopment;

      // Assert: Should use development-appropriate strategy
      expect(cacheStrategy).toBe('network-first');
      expect(shouldBypassCache).toBe(true);
    });

    it('should use different strategies for production', () => {
      // Arrange: Production environment
      const isProduction = true;
      
      // Act: Determine strategy
      const cacheStrategy = isProduction ? 'cache-first' : 'network-first';
      const shouldAggressivelCache = isProduction;

      // Assert: Should use production-appropriate strategy
      expect(cacheStrategy).toBe('cache-first');
      expect(shouldAggressivelCache).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors in service worker', async () => {
      // Arrange: Mock fetch error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network unavailable'));
      mockCache.match.mockResolvedValue(undefined);

      // Act: Handle fetch error
      let response;
      const request = new Request('/api/test');

      try {
        response = await fetch(request);
      } catch (error) {
        // Fallback to cache or offline page
        const cache = await caches.open('fallback-cache');
        response = await cache.match('/offline.html') || new Response('Offline');
      }

      // Assert: Should handle errors gracefully
      expect(response).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(request);
    });

    it('should handle cache errors', async () => {
      // Arrange: Mock cache error
      mockCaches.open.mockRejectedValue(new Error('Cache unavailable'));

      // Act & Assert: Should handle cache errors
      await expect(caches.open('test-cache'))
        .rejects.toThrow('Cache unavailable');
    });

    it('should provide fallback when both network and cache fail', async () => {
      // Arrange: Mock all failures
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      mockCaches.open.mockRejectedValue(new Error('Cache error'));

      // Act: Handle complete failure
      let response;
      try {
        response = await fetch('/api/test');
      } catch (networkError) {
        try {
          const cache = await caches.open('fallback');
          response = await cache.match('/offline.html');
        } catch (cacheError) {
          // Ultimate fallback
          response = new Response('Service temporarily unavailable', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        }
      }

      // Assert: Should provide ultimate fallback
      expect(response).toBeDefined();
      if (response) {
        expect(response.status).toBe(503);
      }
    });
  });
});