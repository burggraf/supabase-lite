import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Service Worker', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset global objects
    delete (globalThis as any).importScripts;
    delete (globalThis as any).self;
    delete (globalThis as any).caches;
    
    // Mock service worker global scope
    (globalThis as any).self = {
      addEventListener: vi.fn(),
      skipWaiting: vi.fn(),
      clients: {
        claim: vi.fn()
      }
    };
    
    // Mock Cache API
    const mockCache = {
      match: vi.fn(),
      put: vi.fn(),
      addAll: vi.fn(),
      delete: vi.fn(),
      keys: vi.fn()
    };
    
    (globalThis as any).caches = {
      open: vi.fn().mockResolvedValue(mockCache),
      match: vi.fn(),
      delete: vi.fn(),
      keys: vi.fn()
    };
  });

  describe('Environment Detection', () => {
    it('should detect production environment correctly', async () => {
      // Mock production environment
      const mockEnv = { PROD: true, DEV: false };
      
      // This will be implemented in the service worker
      const { isProductionEnvironment } = await import('../../service-worker');
      
      expect(isProductionEnvironment(mockEnv)).toBe(true);
    });

    it('should detect development environment correctly', async () => {
      // Mock development environment
      const mockEnv = { PROD: false, DEV: true };
      
      const { isProductionEnvironment } = await import('../../service-worker');
      
      expect(isProductionEnvironment(mockEnv)).toBe(false);
    });
  });

  describe('Caching Strategies', () => {
    it('should use cache-first strategy for production assets', async () => {
      const mockRequest = new Request('http://localhost:5173/assets/app.js');
      const mockResponse = new Response('console.log("test")');
      
      // Mock cache instance and its methods
      const mockCache = {
        match: vi.fn().mockResolvedValue(mockResponse),
        put: vi.fn(),
        addAll: vi.fn(),
        delete: vi.fn(),
        keys: vi.fn()
      };
      
      (globalThis as any).caches.open.mockResolvedValue(mockCache);
      
      const { handleAssetRequest } = await import('../../service-worker');
      
      const result = await handleAssetRequest(mockRequest, true); // production = true
      
      expect(result).toBe(mockResponse);
      expect(mockCache.match).toHaveBeenCalledWith(mockRequest);
    });

    it('should use network-first strategy for development assets', async () => {
      const mockRequest = new Request('http://localhost:5173/assets/app.js');
      const mockNetworkResponse = new Response('console.log("development")');
      
      // Mock successful network request
      global.fetch = vi.fn().mockResolvedValue(mockNetworkResponse);
      
      const { handleAssetRequest } = await import('../../service-worker');
      
      const result = await handleAssetRequest(mockRequest, false); // production = false
      
      expect(result).toBe(mockNetworkResponse);
      expect(global.fetch).toHaveBeenCalledWith(mockRequest);
    });

    it('should fallback to cache when network fails in development', async () => {
      const mockRequest = new Request('http://localhost:5173/assets/app.js');
      const mockCachedResponse = new Response('console.log("cached")');
      
      // Mock network failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      // Mock cache instance
      const mockCache = {
        match: vi.fn().mockResolvedValue(mockCachedResponse),
        put: vi.fn(),
        addAll: vi.fn(),
        delete: vi.fn(),
        keys: vi.fn()
      };
      
      (globalThis as any).caches.open.mockResolvedValue(mockCache);
      
      const { handleAssetRequest } = await import('../../service-worker');
      
      const result = await handleAssetRequest(mockRequest, false);
      
      expect(result).toBe(mockCachedResponse);
      expect(mockCache.match).toHaveBeenCalledWith(mockRequest);
    });
  });

  describe('Monaco Editor Assets', () => {
    it('should cache Monaco Editor assets with cache-first strategy', async () => {
      const mockRequest = new Request('http://localhost:5173/assets/monaco-editor.js');
      const mockResponse = new Response('monaco editor code');
      
      // Mock cache instance
      const mockCache = {
        match: vi.fn().mockResolvedValue(mockResponse),
        put: vi.fn(),
        addAll: vi.fn(),
        delete: vi.fn(),
        keys: vi.fn()
      };
      
      (globalThis as any).caches.open.mockResolvedValue(mockCache);
      
      const { handleMonacoRequest } = await import('../../service-worker');
      
      const result = await handleMonacoRequest(mockRequest);
      
      expect(result).toBe(mockResponse);
      expect(mockCache.match).toHaveBeenCalledWith(mockRequest);
    });
  });

  describe('HMR Bypass', () => {
    it('should bypass service worker for HMR requests', async () => {
      const mockRequest = new Request('http://localhost:5173/@vite/client');
      
      const { shouldBypassServiceWorker } = await import('../../service-worker');
      
      const result = shouldBypassServiceWorker(mockRequest);
      
      expect(result).toBe(true);
    });

    it('should bypass service worker for Vite dev server requests', async () => {
      const mockRequest = new Request('http://localhost:5173/@fs/path/to/file');
      
      const { shouldBypassServiceWorker } = await import('../../service-worker');
      
      const result = shouldBypassServiceWorker(mockRequest);
      
      expect(result).toBe(true);
    });

    it('should not bypass service worker for regular asset requests', async () => {
      const mockRequest = new Request('http://localhost:5173/assets/app.js');
      
      const { shouldBypassServiceWorker } = await import('../../service-worker');
      
      const result = shouldBypassServiceWorker(mockRequest);
      
      expect(result).toBe(false);
    });
  });

  describe('Install Event', () => {
    it('should cache essential assets during install', async () => {
      const mockCache = {
        addAll: vi.fn().mockResolvedValue(undefined)
      };
      
      (globalThis as any).caches.open.mockResolvedValue(mockCache);
      
      const { handleInstall } = await import('../../service-worker');
      
      await handleInstall();
      
      expect((globalThis as any).caches.open).toHaveBeenCalledWith(expect.stringMatching(/supabase-lite-v\d+/));
      expect(mockCache.addAll).toHaveBeenCalledWith(expect.arrayContaining([
        '/',
        '/index.html',
        expect.stringMatching(/\/assets\/.*\.js$/),
        expect.stringMatching(/\/assets\/.*\.css$/)
      ]));
    });
  });

  describe('Activate Event', () => {
    it('should clean up old caches during activate', async () => {
      const oldCacheNames = ['supabase-lite-v1', 'supabase-lite-v2'];
      const currentCacheName = 'supabase-lite-v3';
      
      (globalThis as any).caches.keys.mockResolvedValue([
        ...oldCacheNames,
        currentCacheName
      ]);
      
      (globalThis as any).caches.delete.mockResolvedValue(true);
      
      const { handleActivate } = await import('../../service-worker');
      
      await handleActivate(currentCacheName);
      
      expect((globalThis as any).caches.delete).toHaveBeenCalledTimes(2);
      expect((globalThis as any).caches.delete).toHaveBeenCalledWith('supabase-lite-v1');
      expect((globalThis as any).caches.delete).toHaveBeenCalledWith('supabase-lite-v2');
      expect((globalThis as any).caches.delete).not.toHaveBeenCalledWith(currentCacheName);
    });
  });
});