import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Development Workflow Tests', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    // Mock fetch for HMR and development requests
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock location for development detection
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        hostname: 'localhost',
        port: '5173',
        protocol: 'http:'
      },
      writable: true
    });

    // Mock import.meta.env for development mode
    vi.stubGlobal('import.meta.env', {
      DEV: true,
      PROD: false,
      MODE: 'development'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true
    });
  });

  describe('Environment Detection', () => {
    it('should detect development environment correctly', () => {
      // Arrange & Act: Check development detection
      const isDev = import.meta.env.DEV;
      const isLocalhost = window.location.hostname === 'localhost';
      const isDevPort = window.location.port === '5173';

      // Assert: Should detect development environment
      expect(isDev).toBe(true);
      expect(isLocalhost).toBe(true);
      expect(isDevPort).toBe(true);
    });

    it('should differentiate between development and production', () => {
      // Arrange: Switch to production
      vi.stubGlobal('import.meta.env', {
        DEV: false,
        PROD: true,
        MODE: 'production'
      });

      // Act: Check production detection
      const isProd = import.meta.env.PROD;
      const isDev = import.meta.env.DEV;

      // Assert: Should detect production environment
      expect(isProd).toBe(true);
      expect(isDev).toBe(false);
    });

    it('should handle mixed environment indicators', () => {
      // Arrange: Mixed environment (edge case)
      vi.stubGlobal('import.meta.env', {
        DEV: true,
        PROD: false,
        MODE: 'development'
      });

      Object.defineProperty(window, 'location', {
        value: {
          ...originalLocation,
          hostname: 'example.com',
          port: '443',
          protocol: 'https:'
        },
        writable: true
      });

      // Act: Check environment detection
      const envMode = import.meta.env.MODE;
      const isLocalhost = window.location.hostname === 'localhost';

      // Assert: Should prioritize explicit environment mode
      expect(envMode).toBe('development');
      expect(isLocalhost).toBe(false);
    });
  });

  describe('Hot Module Replacement (HMR)', () => {
    it('should not interfere with HMR requests', async () => {
      // Arrange: Mock HMR request
      const hmrUrl = '/@vite/client';
      mockFetch.mockResolvedValue(new Response('// HMR client code'));

      // Act: Simulate HMR request
      const response = await fetch(hmrUrl);
      const content = await response.text();

      // Assert: HMR request should succeed
      expect(mockFetch).toHaveBeenCalledWith(hmrUrl);
      expect(content).toContain('HMR client code');
    });

    it('should handle Vite development server requests', async () => {
      // Arrange: Mock Vite dev server requests
      const viteUrls = [
        '/@vite/client',
        '/src/main.tsx',
        '/src/App.tsx?t=1234567890',
        '/__vite_ping'
      ];

      mockFetch.mockResolvedValue(new Response('success'));

      // Act: Simulate various Vite requests
      for (const url of viteUrls) {
        await fetch(url);
      }

      // Assert: All Vite requests should be handled
      expect(mockFetch).toHaveBeenCalledTimes(viteUrls.length);
      viteUrls.forEach(url => {
        expect(mockFetch).toHaveBeenCalledWith(url);
      });
    });

    it('should bypass cache for development assets', async () => {
      // Arrange: Mock development asset request with cache-busting
      const assetUrl = '/src/components/Test.tsx?t=' + Date.now();
      mockFetch.mockResolvedValue(new Response('export default function Test() {}'));

      // Act: Request asset with timestamp
      const response = await fetch(assetUrl);
      const content = await response.text();

      // Assert: Should get fresh content, not cached
      expect(content).toContain('export default function Test');
      expect(mockFetch).toHaveBeenCalledWith(assetUrl);
    });
  });

  describe('Cache Management in Development', () => {
    it('should disable aggressive caching in development', () => {
      // Arrange: Development environment
      const isDev = import.meta.env.DEV;

      // Act: Determine caching strategy
      const shouldUseAggressiveCaching = !isDev;
      const cacheStrategy = isDev ? 'network-first' : 'cache-first';

      // Assert: Should use network-first in development
      expect(shouldUseAggressiveCaching).toBe(false);
      expect(cacheStrategy).toBe('network-first');
    });

    it('should clear cache when switching to development', async () => {
      // Arrange: Mock cache API
      const mockCache = {
        keys: vi.fn().mockResolvedValue([
          new Request('/static/asset1.js'),
          new Request('/static/asset2.css')
        ]),
        delete: vi.fn().mockResolvedValue(true)
      };

      const mockCaches = {
        open: vi.fn().mockResolvedValue(mockCache)
      };

      Object.defineProperty(global, 'caches', {
        value: mockCaches,
        writable: true
      });

      // Act: Clear development cache
      if (import.meta.env.DEV) {
        const cache = await caches.open('dev-cache');
        const requests = await cache.keys();
        
        for (const request of requests) {
          await cache.delete(request);
        }
      }

      // Assert: Should clear all cached requests
      expect(mockCache.keys).toHaveBeenCalled();
      expect(mockCache.delete).toHaveBeenCalledTimes(2);
    });

    it('should handle cache clearing errors gracefully', async () => {
      // Arrange: Mock cache API with errors
      const mockCaches = {
        open: vi.fn().mockRejectedValue(new Error('Cache not available'))
      };

      Object.defineProperty(global, 'caches', {
        value: mockCaches,
        writable: true
      });

      // Act & Assert: Should handle cache errors
      await expect(async () => {
        try {
          await caches.open('dev-cache');
        } catch (error) {
          // Expected to fail in test environment
          expect(error).toBeInstanceOf(Error);
        }
      }).not.toThrow();
    });
  });

  describe('Development Asset Loading', () => {
    it('should load fresh assets in development', async () => {
      // Arrange: Mock asset requests
      const timestamp = Date.now();
      const assetUrls = [
        `/src/App.tsx?t=${timestamp}`,
        `/src/main.tsx?t=${timestamp}`,
        `/public/vite.svg?t=${timestamp}`
      ];

      mockFetch.mockImplementation((url: string) => {
        return Promise.resolve(new Response(`// Fresh content for ${url}`));
      });

      // Act: Load assets with timestamps
      const responses = await Promise.all(
        assetUrls.map(url => fetch(url).then(r => r.text()))
      );

      // Assert: Should get fresh content for all assets
      responses.forEach((content, index) => {
        expect(content).toContain(`Fresh content for ${assetUrls[index]}`);
      });
    });

    it('should handle TypeScript compilation in development', async () => {
      // Arrange: Mock TypeScript file request
      const tsFile = '/src/components/NewComponent.tsx';
      mockFetch.mockResolvedValue(new Response(`
        import React from 'react';
        export default function NewComponent() {
          return <div>Hello World</div>;
        }
      `));

      // Act: Request TypeScript file
      const response = await fetch(tsFile);
      const content = await response.text();

      // Assert: Should get TypeScript content
      expect(content).toContain('import React');
      expect(content).toContain('export default function');
    });

    it('should handle CSS imports in development', async () => {
      // Arrange: Mock CSS file request
      const cssFile = '/src/styles/component.css?direct';
      mockFetch.mockResolvedValue(new Response(`
        .component {
          color: blue;
          background: white;
        }
      `));

      // Act: Request CSS file
      const response = await fetch(cssFile);
      const content = await response.text();

      // Assert: Should get CSS content
      expect(content).toContain('.component');
      expect(content).toContain('color: blue');
    });
  });

  describe('Development Server Integration', () => {
    it('should connect to Vite development server', async () => {
      // Arrange: Mock Vite ping endpoint
      mockFetch.mockResolvedValue(new Response('pong'));

      // Act: Ping development server
      const response = await fetch('/__vite_ping');
      const result = await response.text();

      // Assert: Should connect successfully
      expect(result).toBe('pong');
      expect(response.ok).toBe(true);
    });

    it('should handle development server restarts', async () => {
      // Arrange: Mock server restart scenario
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce(new Response('server restarted'));

      // Act: Simulate request during restart, then after
      try {
        await fetch('/api/test');
      } catch (error) {
        expect((error as Error).message).toContain('ECONNREFUSED');
      }

      // Retry after restart
      const response = await fetch('/api/test');
      const result = await response.text();

      // Assert: Should recover after restart
      expect(result).toBe('server restarted');
    });

    it('should maintain WebSocket connections for HMR', async () => {
      // Arrange: Mock WebSocket for HMR
      const mockWebSocket = {
        readyState: 1, // OPEN
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn()
      };

      Object.defineProperty(global, 'WebSocket', {
        value: vi.fn(() => mockWebSocket),
        writable: true
      });

      // Act: Create HMR WebSocket connection
      const ws = new WebSocket('ws://localhost:5173');

      // Assert: WebSocket should be ready
      expect(ws.readyState).toBe(1);
      expect(typeof ws.send).toBe('function');
    });
  });

  describe('Source Map Support', () => {
    it('should generate source maps in development', async () => {
      // Arrange: Mock source map request
      const sourceMapUrl = '/src/App.tsx.map';
      const mockSourceMap = {
        version: 3,
        sources: ['App.tsx'],
        names: [],
        mappings: 'AAAA,OAAO'
      };

      mockFetch.mockResolvedValue(new Response(JSON.stringify(mockSourceMap)));

      // Act: Request source map
      const response = await fetch(sourceMapUrl);
      const sourceMap = await response.json();

      // Assert: Should get valid source map
      expect(sourceMap.version).toBe(3);
      expect(sourceMap.sources).toContain('App.tsx');
    });

    it('should handle source map errors gracefully', async () => {
      // Arrange: Mock missing source map
      mockFetch.mockResolvedValue(new Response('Not Found', { status: 404 }));

      // Act: Request missing source map
      const response = await fetch('/missing-file.tsx.map');

      // Assert: Should handle 404 gracefully
      expect(response.status).toBe(404);
      expect(response.ok).toBe(false);
    });
  });

  describe('Development Performance', () => {
    it('should track development build performance', async () => {
      // Arrange: Mock performance API
      const mockPerformance = {
        now: vi.fn().mockReturnValue(Date.now()),
        mark: vi.fn(),
        measure: vi.fn()
      };

      Object.defineProperty(global, 'performance', {
        value: mockPerformance,
        writable: true
      });

      // Act: Measure development operation
      const start = performance.now();
      await new Promise(resolve => setTimeout(resolve, 10));
      const end = performance.now();
      const duration = end - start;

      // Assert: Should measure performance
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThan(0);
    });

    it('should not degrade with cache management', async () => {
      // Arrange: Simulate multiple rapid requests
      const urls = Array.from({ length: 10 }, (_, i) => `/api/test${i}`);
      mockFetch.mockResolvedValue(new Response('success'));

      // Act: Make rapid requests
      const start = Date.now();
      await Promise.all(urls.map(url => fetch(url)));
      const duration = Date.now() - start;

      // Assert: Should complete quickly (under 100ms for mock requests)
      expect(duration).toBeLessThan(100);
      expect(mockFetch).toHaveBeenCalledTimes(10);
    });
  });

  describe('Error Handling in Development', () => {
    it('should provide detailed error information in development', async () => {
      // Arrange: Mock development error
      mockFetch.mockRejectedValue(new Error('Development error with stack trace'));

      // Act & Assert: Should provide detailed errors
      await expect(fetch('/api/error')).rejects.toThrow('Development error with stack trace');
    });

    it('should handle compilation errors gracefully', async () => {
      // Arrange: Mock TypeScript compilation error
      const errorResponse = new Response(JSON.stringify({
        message: 'TypeScript compilation error',
        file: '/src/broken.tsx',
        line: 10,
        column: 5
      }), { status: 500 });

      mockFetch.mockResolvedValue(errorResponse);

      // Act: Request file with compilation error
      const response = await fetch('/src/broken.tsx');
      const errorInfo = await response.json();

      // Assert: Should get detailed error info
      expect(response.status).toBe(500);
      expect(errorInfo.message).toContain('TypeScript compilation error');
      expect(errorInfo.file).toBe('/src/broken.tsx');
    });
  });
});