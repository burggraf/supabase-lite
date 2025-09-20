const CACHE_NAME = 'supabase-lite-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/index.js',
  '/assets/index.css',
  '/assets/monaco-editor.js'
];

function applyCrossOriginIsolationHeaders(response) {
  if (!response) return response;
  if (response.status === 0 || response.type === 'opaque') {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

  if (response.redirected) {
    headers.set('Location', response.url);
    return new Response(null, {
      headers,
      status: 301,
      statusText: 'Moved Permanently',
    });
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function isHMRRequest(url) {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname;
    const isDevHost = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.');
    if (!isDevHost) return false;

    const vitePatterns = ['/@vite/client', '/@vite/hmr-update', '/@id/', '/@fs/', '/@react-refresh'];
    const hasPattern = vitePatterns.some((pattern) => parsedUrl.pathname.includes(pattern));
    const hasTimestamp = parsedUrl.searchParams.has('t') || parsedUrl.searchParams.has('import');
    const isHotUpdate = parsedUrl.searchParams.has('hot');

    return hasPattern || hasTimestamp || isHotUpdate;
  } catch (_error) {
    return false;
  }
}

function shouldBypassServiceWorker(request) {
  if (isHMRRequest(request.url)) {
    return true;
  }

  const url = new URL(request.url);
  return (
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@fs/') ||
    url.pathname.startsWith('/node_modules/.vite/') ||
    url.pathname.includes('__vite') ||
    url.pathname === '/__vite_ping'
  );
}

async function handleAssetRequest(request, isProduction) {
  if (!isProduction && isHMRRequest(request.url)) {
    const networkResponse = await fetch(request);
    return applyCrossOriginIsolationHeaders(networkResponse.clone());
  }

  const cache = await caches.open(CACHE_NAME);

  if (isProduction) {
    const cached = await cache.match(request);
    if (cached) {
      return applyCrossOriginIsolationHeaders(cached.clone());
    }

    try {
      const networkResponse = await fetch(request);
      const isolated = applyCrossOriginIsolationHeaders(networkResponse.clone());
      if (networkResponse.ok) {
        await cache.put(request, isolated.clone());
      }
      return isolated;
    } catch (error) {
      const fallback = await cache.match(request);
      if (fallback) {
        return applyCrossOriginIsolationHeaders(fallback.clone());
      }
      throw error;
    }
  }

  try {
    const networkResponse = await fetch(request);
    return applyCrossOriginIsolationHeaders(networkResponse.clone());
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return applyCrossOriginIsolationHeaders(cached.clone());
    }
    throw error;
  }
}

async function handleMonacoRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return applyCrossOriginIsolationHeaders(cached.clone());
  }

  try {
    const networkResponse = await fetch(request);
    const isolated = applyCrossOriginIsolationHeaders(networkResponse.clone());
    if (networkResponse.ok) {
      await cache.put(request, isolated.clone());
    }
    return isolated;
  } catch (error) {
    const fallback = await cache.match(request);
    if (fallback) {
      return applyCrossOriginIsolationHeaders(fallback.clone());
    }
    throw error;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith('supabase-lite-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    (async () => {
      const request = event.request;

      const forwardRequest = async () => {
        const networkResponse = await fetch(request);
        return applyCrossOriginIsolationHeaders(networkResponse.clone());
      };

      if (request.method !== 'GET') {
        return forwardRequest();
      }

      if (shouldBypassServiceWorker(request)) {
        return forwardRequest();
      }

      if (request.url.includes('monaco-editor')) {
        return handleMonacoRequest(request);
      }

      const isProduction = true;

      if (
        request.destination === 'script' ||
        request.destination === 'style' ||
        request.destination === 'font' ||
        request.destination === 'image'
      ) {
        return handleAssetRequest(request, isProduction);
      }

      return forwardRequest();
    })()
  );
});
