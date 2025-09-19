self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

async function addIsolationHeaders(response) {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
  newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  return new Response(await response.text(), {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only handle top-level navigation requests
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const preloadResponse = await event.preloadResponse;
      if (preloadResponse) {
        return addIsolationHeaders(preloadResponse);
      }
      const networkResponse = await fetch(request);
      return addIsolationHeaders(networkResponse);
    })());
  }
});

