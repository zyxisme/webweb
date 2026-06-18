// sw.js - Minimal Service Worker
// Only rewrites URLs to proxy format, all proxy logic handled by Rust backend

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip proxy requests (already rewritten)
  if (url.pathname === '/proxy') {
    return;
  }

  // Skip non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip requests to the same origin (static files)
  if (url.origin === self.location.origin) {
    return;
  }

  // Rewrite external requests to proxy format
  const proxyUrl = `/proxy?url=${encodeURIComponent(url.href)}`;

  event.respondWith(fetch(proxyUrl, {
    method: event.request.method,
    headers: event.request.headers,
    body: event.request.body
  }));
});
