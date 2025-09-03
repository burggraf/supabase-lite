/// <reference lib="webworker" />

// Service Worker for Supabase Lite with environment-aware caching

const CACHE_NAME = 'supabase-lite-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/index.js',
  '/assets/index.css',
  '/assets/monaco-editor.js'
];

// Environment detection utility
export function isProductionEnvironment(env: { PROD: boolean; DEV: boolean }): boolean {
  return env.PROD === true;
}

// HMR Request Detection
export function isHMRRequest(url: string): boolean {
  const parsedUrl = new URL(url)
  
  // Check for localhost/127.0.0.1 development servers
  const isDevelopmentHost = parsedUrl.hostname === 'localhost' || 
                          parsedUrl.hostname === '127.0.0.1' ||
                          parsedUrl.hostname.startsWith('192.168.') ||
                          parsedUrl.hostname.startsWith('10.')

  if (!isDevelopmentHost) return false

  // Check for Vite-specific HMR patterns
  const vitePatterns = [
    '/@vite/client',
    '/@vite/hmr-update',
    '/@id/',
    '/@fs/',
    '/@react-refresh'
  ]

  const hasVitePattern = vitePatterns.some(pattern => parsedUrl.pathname.includes(pattern))
  const hasTimestamp = parsedUrl.searchParams.has('t') || parsedUrl.searchParams.has('import')
  const isHotUpdate = parsedUrl.searchParams.has('hot')

  return hasVitePattern || hasTimestamp || isHotUpdate
}

// HMR bypass detection
export function shouldBypassServiceWorker(request: Request): boolean {
  const url = new URL(request.url);
  
  // Use the comprehensive HMR detection
  if (isHMRRequest(request.url)) {
    return true;
  }
  
  // Additional Vite dev server patterns
  return (
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@fs/') ||
    url.pathname.startsWith('/node_modules/.vite/') ||
    url.pathname.includes('__vite') ||
    url.pathname === '/__vite_ping'
  );
}

// Asset request handler with environment-aware strategy
export async function handleAssetRequest(request: Request, isProduction: boolean): Promise<Response> {
  // Always bypass HMR requests directly to network in development
  if (!isProduction && isHMRRequest(request.url)) {
    return fetch(request);
  }
  
  const cache = await caches.open(CACHE_NAME);
  
  if (isProduction) {
    // Cache-first strategy for production
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fetch from network and cache
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        await cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      // Final fallback to cache even if network fails
      const fallbackCached = await cache.match(request);
      if (fallbackCached) {
        return fallbackCached;
      }
      throw new Error('Network request failed and no cache available');
    }
  } else {
    // Network-first strategy for development
    try {
      const networkResponse = await fetch(request);
      return networkResponse;
    } catch (error) {
      // Fallback to cache in development if network fails
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error;
    }
  }
}

// Monaco Editor specific handler (always cache-first)
export async function handleMonacoRequest(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Fetch from network and cache
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Final fallback to cache
    const fallbackCached = await cache.match(request);
    if (fallbackCached) {
      return fallbackCached;
    }
    throw error;
  }
}

// Install event handler
export async function handleInstall(): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(STATIC_ASSETS);
}

// Activate event handler
export async function handleActivate(currentCacheName: string): Promise<void> {
  const cacheNames = await caches.keys();
  
  await Promise.all(
    cacheNames
      .filter(cacheName => cacheName.startsWith('supabase-lite-') && cacheName !== currentCacheName)
      .map(cacheName => caches.delete(cacheName))
  );
}

// Service Worker event listeners
declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(handleInstall());
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(handleActivate(CACHE_NAME));
  self.clients.claim();
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const request = event.request;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Bypass HMR and dev server requests
  if (shouldBypassServiceWorker(request)) {
    return;
  }
  
  // Handle Monaco Editor assets
  if (request.url.includes('monaco-editor')) {
    event.respondWith(handleMonacoRequest(request));
    return;
  }
  
  // Handle static assets based on environment
  // Note: In a real implementation, we'd detect environment from build process
  // For now, we'll default to production behavior
  const isProduction = true; // This would be determined at build time
  
  if (request.destination === 'script' || request.destination === 'style' || 
      request.destination === 'font' || request.destination === 'image') {
    event.respondWith(handleAssetRequest(request, isProduction));
  }
});