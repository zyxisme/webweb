// sw.js - Service Worker for WebWeb Browser Proxy

const PROXY_PREFIX = '/proxy/';

// Headers to strip from responses
const HEADERS_TO_STRIP = [
  'X-Frame-Options',
  'Content-Security-Policy',
  'Content-Security-Policy-Report-Only',
  'X-Content-Type-Options',
  'X-XSS-Protection',
  'X-Permitted-Cross-Domain-Policies',
  'Cross-Origin-Embedder-Policy',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy'
];

// CORS headers to add
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
  'Access-Control-Max-Age': '86400'
};

/**
 * Check if a URL is a proxy request
 */
function isProxyUrl(url) {
  return url.includes(PROXY_PREFIX);
}

/**
 * Extract original URL from proxy URL
 */
function getOriginalUrl(url) {
  const proxyIndex = url.indexOf(PROXY_PREFIX);
  if (proxyIndex === -1) return url;
  return decodeURIComponent(url.substring(proxyIndex + PROXY_PREFIX.length));
}

/**
 * Strip security headers and add CORS headers
 */
function modifyHeaders(originalHeaders) {
  const newHeaders = new Headers(originalHeaders);

  // Strip security headers
  HEADERS_TO_STRIP.forEach(header => newHeaders.delete(header));

  // Add CORS headers
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return newHeaders;
}

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  event.waitUntil(clients.claim());
});

// Fetch event - main interception logic
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only intercept proxy requests
  if (!isProxyUrl(url)) {
    return;
  }

  const originalUrl = getOriginalUrl(url);
  console.log(`[SW] Proxying: ${originalUrl}`);

  event.respondWith(
    fetch(originalUrl, {
      method: event.request.method,
      headers: event.request.headers,
      body: event.request.body,
      mode: 'cors',
      credentials: 'omit'
    })
    .then(response => {
      // Clone response to modify headers
      const newHeaders = modifyHeaders(response.headers);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    })
    .catch(error => {
      console.error(`[SW] Proxy error for ${originalUrl}:`, error);
      return new Response(JSON.stringify({
        error: 'Proxy fetch failed',
        message: error.message,
        url: originalUrl
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        }
      });
    })
  );
});
