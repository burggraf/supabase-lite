/**
 * Environment detection utility for Supabase Lite offline functionality
 * Detects development vs production environments and provides caching strategies
 */

interface Environment {
  PROD: boolean;
  DEV: boolean;
  MODE: string;
}

export class EnvironmentDetector {
  private env: Environment;

  constructor(customEnv?: Environment) {
    this.env = customEnv || {
      PROD: import.meta.env.PROD === true,
      DEV: import.meta.env.DEV === true,
      MODE: import.meta.env.MODE || 'production'
    };
  }

  /**
   * Check if running in production environment
   */
  isProduction(): boolean {
    return this.env.PROD === true;
  }

  /**
   * Check if running in development environment
   */
  isDevelopment(): boolean {
    return this.env.DEV === true;
  }

  /**
   * Get the current environment mode
   */
  getMode(): string {
    return this.env.MODE;
  }

  /**
   * Check if running on Vite dev server (port 5173)
   */
  isViteDevServer(): boolean {
    if (typeof window === 'undefined') return false;
    return window.location.port === '5173' && window.location.hostname === 'localhost';
  }

  /**
   * Check if running on any development server
   */
  isDevServer(): boolean {
    if (typeof window === 'undefined') return false;
    
    const { hostname, port, protocol } = window.location;
    
    // Common development patterns
    const devHostnames = ['localhost', '127.0.0.1', '0.0.0.0'];
    const devPorts = ['3000', '3001', '5173', '8080', '8000'];
    
    return (
      protocol === 'http:' &&
      devHostnames.includes(hostname) &&
      (devPorts.includes(port) || port === '')
    );
  }

  /**
   * Check if a request is HMR-related
   */
  isHMRRequest(url: string): boolean {
    return (
      url.includes('/@vite/') ||
      url.includes('/@fs/') ||
      url.includes('/node_modules/.vite/') ||
      url.includes('__vite')
    );
  }

  /**
   * Get the appropriate caching strategy for assets
   */
  getAssetCachingStrategy(): 'cache-first' | 'network-first' {
    return this.isProduction() ? 'cache-first' : 'network-first';
  }

  /**
   * Get the caching strategy for Monaco Editor (always cache-first for performance)
   */
  getMonacoCachingStrategy(): 'cache-first' {
    return 'cache-first';
  }

  /**
   * Determine if Service Worker should be automatically registered
   */
  shouldAutoRegisterServiceWorker(): boolean {
    return this.isProduction();
  }

  /**
   * Check if an asset should be cached
   */
  shouldCacheAsset(url: string): boolean {
    // Don't cache HMR requests
    if (this.isHMRRequest(url)) {
      return false;
    }

    // Don't cache API requests
    if (url.includes('/api/') || url.includes('/debug/')) {
      return false;
    }

    // Cache static assets
    const staticAssetPattern = /\.(js|css|woff|woff2|ttf|svg|png|jpg|jpeg|gif|ico)$/i;
    return staticAssetPattern.test(url) || url.includes('/assets/');
  }
}