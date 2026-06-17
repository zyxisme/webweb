// sw.js - Service Worker for WebWeb Browser Proxy

const PROXY_PARAM = 'url';

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
 * Check if a URL is a proxy request (has ?url= parameter)
 */
function isProxyUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.has(PROXY_PARAM);
  } catch { return false; }
}

/**
 * Extract original URL from proxy URL
 */
function getOriginalUrl(url) {
  const parsed = new URL(url);
  const originalUrl = parsed.searchParams.get(PROXY_PARAM);
  return originalUrl || url;
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

  // Handle navigation requests (link clicks, form submissions)
  if (event.request.mode === 'navigate') {
    // If it's already a proxy URL, let it be handled below
    if (isProxyUrl(url)) {
      // Fall through to proxy handler
    } else {
      // For non-proxy navigation requests, check if they come from a proxied page
      // by examining the referrer header
      const referrer = event.request.referrer;
      if (referrer && isProxyUrl(referrer)) {
        // The navigation came from within a proxied page
        // Try to navigate the iframe to the new URL through the proxy
        // This handles link clicks and form submissions within proxied content
        const referrerOriginal = getOriginalUrl(referrer);

        // Resolve relative URLs against the referrer's original URL
        let targetUrl;
        try {
          targetUrl = new URL(url, referrerOriginal).href;
        } catch {
          targetUrl = url;
        }

        console.log(`[SW] Navigation from proxied page: ${url} -> ${targetUrl}`);

        // Get base path from the referrer URL (works for GitHub Pages)
        const referrerUrl = new URL(referrer);
        const basePath = referrerUrl.pathname.replace(/\/[^\/]*$/, '/');
        const proxyUrl = `${self.location.origin}${basePath}?url=${encodeURIComponent(targetUrl)}`;
        return event.respondWith(Response.redirect(proxyUrl, 302));
      }

      // Not from a proxied page, let the browser handle it normally
      return;
    }
  }

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
      body: event.request.body
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

      // Return user-friendly error page
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Proxy Error</title></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1 style="color: #d32f2f;">代理错误</h1>
          <p style="color: #666;">无法加载页面: ${originalUrl}</p>
          <p style="color: #999;">错误: ${error.message}</p>
          <hr style="margin: 30px auto; max-width: 400px;">
          <p style="color: #1a73e8;">💡 请检查网络连接或尝试其他网站</p>
        </body>
        </html>
      `;

      return new Response(errorHtml, {
        status: 502,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          ...CORS_HEADERS
        }
      });
    })
  );
});
