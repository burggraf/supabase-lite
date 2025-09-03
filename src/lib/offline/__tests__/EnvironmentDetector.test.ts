import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('EnvironmentDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Environment Detection', () => {
    it('should detect production environment', async () => {
      const { EnvironmentDetector } = await import('../EnvironmentDetector');
      const detector = new EnvironmentDetector({
        PROD: true,
        DEV: false,
        MODE: 'production'
      });
      
      expect(detector.isProduction()).toBe(true);
      expect(detector.isDevelopment()).toBe(false);
      expect(detector.getMode()).toBe('production');
    });

    it('should detect development environment', async () => {
      const { EnvironmentDetector } = await import('../EnvironmentDetector');
      const detector = new EnvironmentDetector({
        PROD: false,
        DEV: true,
        MODE: 'development'
      });
      
      expect(detector.isProduction()).toBe(false);
      expect(detector.isDevelopment()).toBe(true);
      expect(detector.getMode()).toBe('development');
    });
  });

  describe('Development Server Detection', () => {
    it('should detect Vite dev server by port', async () => {
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: {
          port: '5173',
          hostname: 'localhost',
          protocol: 'http:'
        },
        writable: true
      });

      const { EnvironmentDetector } = await import('../EnvironmentDetector');
      const detector = new EnvironmentDetector();
      
      expect(detector.isViteDevServer()).toBe(true);
    });

    it('should detect dev server by hostname patterns', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          port: '3000',
          hostname: 'localhost',
          protocol: 'http:'
        },
        writable: true
      });

      const { EnvironmentDetector } = await import('../EnvironmentDetector');
      const detector = new EnvironmentDetector();
      
      expect(detector.isDevServer()).toBe(true);
    });

    it('should not detect dev server in production domains', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          port: '443',
          hostname: 'myapp.com',
          protocol: 'https:'
        },
        writable: true
      });

      const { EnvironmentDetector } = await import('../EnvironmentDetector');
      const detector = new EnvironmentDetector();
      
      expect(detector.isDevServer()).toBe(false);
      expect(detector.isViteDevServer()).toBe(false);
    });
  });

  describe('HMR Detection', () => {
    it('should detect HMR-related requests', async () => {
      const { EnvironmentDetector } = await import('../EnvironmentDetector');
      const detector = new EnvironmentDetector();
      
      const hmrUrls = [
        '/@vite/client',
        '/@fs/path/to/file',
        '/node_modules/.vite/',
        '/__vite_ping'
      ];

      hmrUrls.forEach(url => {
        expect(detector.isHMRRequest(url)).toBe(true);
      });
    });

    it('should not detect regular requests as HMR', async () => {
      const { EnvironmentDetector } = await import('../EnvironmentDetector');
      const detector = new EnvironmentDetector();
      
      const regularUrls = [
        '/assets/app.js',
        '/api/users',
        '/index.html',
        '/components/Button.tsx'
      ];

      regularUrls.forEach(url => {
        expect(detector.isHMRRequest(url)).toBe(false);
      });
    });
  });

  describe('Caching Strategy Selection', () => {
    it('should recommend cache-first for production', async () => {
      const { EnvironmentDetector } = await import('../EnvironmentDetector');
      const detector = new EnvironmentDetector();
      
      // Mock production environment
      vi.spyOn(detector, 'isProduction').mockReturnValue(true);
      
      const strategy = detector.getAssetCachingStrategy();
      
      expect(strategy).toBe('cache-first');
    });

    it('should recommend network-first for development', async () => {
      const { EnvironmentDetector } = await import('../EnvironmentDetector');
      const detector = new EnvironmentDetector();
      
      // Mock development environment
      vi.spyOn(detector, 'isProduction').mockReturnValue(false);
      vi.spyOn(detector, 'isDevelopment').mockReturnValue(true);
      
      const strategy = detector.getAssetCachingStrategy();
      
      expect(strategy).toBe('network-first');
    });

    it('should always recommend cache-first for Monaco Editor', async () => {
      const { EnvironmentDetector } = await import('../EnvironmentDetector');
      const detector = new EnvironmentDetector();
      
      // Test both environments
      vi.spyOn(detector, 'isProduction').mockReturnValue(true);
      expect(detector.getMonacoCachingStrategy()).toBe('cache-first');
      
      vi.spyOn(detector, 'isProduction').mockReturnValue(false);
      expect(detector.getMonacoCachingStrategy()).toBe('cache-first');
    });
  });

  describe('Feature Detection', () => {
    it('should detect if Service Worker registration should be automatic', async () => {
      const { EnvironmentDetector } = await import('../EnvironmentDetector');
      const detector = new EnvironmentDetector();
      
      // Mock production environment
      vi.spyOn(detector, 'isProduction').mockReturnValue(true);
      
      expect(detector.shouldAutoRegisterServiceWorker()).toBe(true);
    });

    it('should not auto-register Service Worker in development', async () => {
      const { EnvironmentDetector } = await import('../EnvironmentDetector');
      const detector = new EnvironmentDetector();
      
      // Mock development environment
      vi.spyOn(detector, 'isProduction').mockReturnValue(false);
      vi.spyOn(detector, 'isDevelopment').mockReturnValue(true);
      
      expect(detector.shouldAutoRegisterServiceWorker()).toBe(false);
    });

    it('should detect caching requirements', async () => {
      const { EnvironmentDetector } = await import('../EnvironmentDetector');
      const detector = new EnvironmentDetector();
      
      const assetUrls = [
        '/assets/app.js',
        '/assets/style.css',
        '/assets/monaco-editor.js',
        '/fonts/inter.woff2',
        '/icons/logo.svg'
      ];

      assetUrls.forEach(url => {
        expect(detector.shouldCacheAsset(url)).toBe(true);
      });

      const nonCacheableUrls = [
        '/@vite/client',
        '/api/users',
        '/debug/sql'
      ];

      nonCacheableUrls.forEach(url => {
        expect(detector.shouldCacheAsset(url)).toBe(false);
      });
    });
  });
});