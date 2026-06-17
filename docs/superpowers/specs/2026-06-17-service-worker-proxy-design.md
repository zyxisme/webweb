# Service Worker Proxy Design

**Date:** 2026-06-17
**Status:** Draft
**Author:** Claude (Brainstorming)

## Overview

Replace the current proxy mechanism (Node.js server + external proxies) with a client-side Service Worker that intercepts iframe requests and strips CORS/security headers.

## Goals

1. **Eliminate Node.js dependency** - No need to run `node server.js`
2. **Remove external proxy dependency** - No reliance on corsproxy.io or allorigins.win
3. **Strip security headers** - Remove X-Frame-Options, CSP, etc.
4. **Add CORS headers** - Ensure cross-origin requests work
5. **Maintain simplicity** - Pure client-side solution

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Main Page (index.html)                                  │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  ProxyManager                                        │ │
│  │  - Register Service Worker                           │ │
│  │  - Build proxy URL                                   │ │
│  │  - Use iframe.src instead of srcdoc                  │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Service Worker (sw.js)                                  │
│  - Intercept all fetch requests                          │ │
│  - Strip security headers: X-Frame-Options, CSP, etc.   │ │
│  - Add CORS headers: Access-Control-Allow-Origin: *      │ │
│  - Only process requests with proxy URL prefix           │ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  iframe                                                  │
│  - src = proxyPrefix + encodedUrl                        │ │
│  - All resource requests go through Service Worker       │ │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. Service Worker (sw.js)

**Location:** `/vol1/1000/webweb/sw.js`

**Responsibilities:**
- Register as Service Worker for the application
- Intercept all fetch events
- Detect proxy URLs by checking for proxy prefix
- Forward requests to actual URLs
- Modify response headers before returning

**Headers to Strip:**
- `X-Frame-Options`
- `Content-Security-Policy`
- `Content-Security-Policy-Report-Only`
- `X-Content-Type-Options`
- `X-XSS-Protection`
- `X-Permitted-Cross-Domain-Policies`
- `Cross-Origin-Embedder-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`

**Headers to Add:**
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: *`
- `Access-Control-Expose-Headers: *`
- `Access-Control-Max-Age: 86400`

**Proxy URL Detection:**
```javascript
const PROXY_PREFIX = '/proxy/';

function isProxyUrl(url) {
  return url.includes(PROXY_PREFIX);
}

function getOriginalUrl(url) {
  const proxyIndex = url.indexOf(PROXY_PREFIX);
  if (proxyIndex === -1) return url;
  return decodeURIComponent(url.substring(proxyIndex + PROXY_PREFIX.length));
}
```

**Fetch Handler:**
```javascript
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (!isProxyUrl(url)) {
    // Not a proxy request, pass through
    return;
  }

  const originalUrl = getOriginalUrl(url);

  event.respondWith(
    fetch(originalUrl, {
      method: event.request.method,
      headers: event.request.headers,
      body: event.request.body
    }).then(response => {
      // Clone response to modify headers
      const newHeaders = new Headers(response.headers);

      // Strip security headers
      const headersToStrip = [
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

      headersToStrip.forEach(header => newHeaders.delete(header));

      // Add CORS headers
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      newHeaders.set('Access-Control-Allow-Headers', '*');
      newHeaders.set('Access-Control-Expose-Headers', '*');
      newHeaders.set('Access-Control-Max-Age', '86400');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    })
  );
});
```

### 2. ProxyManager (Modified)

**File:** `/vol1/1000/webweb/js/proxy.js`

**Changes:**

#### 2.1 init() - Register Service Worker
```javascript
async init() {
  console.log('[WebWeb] Initializing proxy manager...');

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[WebWeb] Service Worker registered:', registration.scope);
    } catch (error) {
      console.error('[WebWeb] Service Worker registration failed:', error);
    }
  }

  // ... rest of init
}
```

#### 2.2 loadPage() - Use iframe.src
```javascript
async loadPage(iframe, url) {
  try {
    // Build proxy URL
    const proxyUrl = this.buildProxyUrl(url);

    // Set iframe src instead of srcdoc
    iframe.src = proxyUrl;

    // Extract title from URL (or wait for load event)
    const title = this.extractDomain(url);

    return { success: true, title };
  } catch (error) {
    console.error('Failed to load page:', error);
    // ... error handling
  }
}
```

#### 2.3 buildProxyUrl() - New Method
```javascript
buildProxyUrl(url) {
  // Use same origin as proxy
  const origin = window.location.origin;
  return `${origin}/proxy/${encodeURIComponent(url)}`;
}
```

#### 2.4 Remove/Simplify Methods
- `fetchPage()` - Remove or simplify (Service Worker handles fetching)
- `rewriteHtml()` - Remove or simplify (only keep `<base>` tag injection if needed)
- `injectNavigationScript()` - Remove (Service Worker handles interception)

### 3. Navigation Handling

**Problem:** With srcdoc, we injected scripts to intercept link clicks. With src, links will navigate directly.

**Solution:** Service Worker can intercept navigation requests.

```javascript
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    // This is a navigation request
    // Could redirect to proxy URL or handle differently
  }
});
```

**Alternative:** Keep injecting a minimal script for link interception that posts messages to parent.

## Data Flow

1. User enters URL and presses Enter
2. `ProxyManager.loadPage(iframe, url)` called
3. Build proxy URL: `http://localhost:8080/proxy/https%3A%2F%2Fexample.com`
4. Set `iframe.src = proxyUrl`
5. Browser fetches the proxy URL
6. Service Worker intercepts the fetch
7. Service Worker extracts original URL from proxy URL
8. Service Worker fetches original URL
9. Service Worker strips security headers and adds CORS headers
10. Response returned to iframe
11. iframe loads the page with modified headers

## Implementation Steps

### Phase 1: Create Service Worker
1. Create `sw.js` with fetch handler
2. Implement header stripping logic
3. Implement CORS header addition
4. Test with simple proxy URL

### Phase 2: Modify ProxyManager
1. Add Service Worker registration in `init()`
2. Add `buildProxyUrl()` method
3. Modify `loadPage()` to use `iframe.src`
4. Remove/simplify `fetchPage()`, `rewriteHtml()`, `injectNavigationScript()`

### Phase 3: Handle Navigation
1. Implement navigation interception in Service Worker
2. Handle link clicks within iframe
3. Handle form submissions

### Phase 4: Testing & Cleanup
1. Test with various websites
2. Test navigation within iframe
3. Remove old proxy code (server.js, external proxies)
4. Update settings UI

## Configuration

### Proxy URL Format
```
http://localhost:8080/proxy/ENCODED_URL
```

Where `ENCODED_URL` is `encodeURIComponent(originalUrl)`.

### Service Worker Scope
- Scope: `/` (same as application)
- Controls all requests from the application

## Limitations

1. **Service Worker requires HTTPS** (or localhost)
2. **Service Worker only works in modern browsers**
3. **Some sites may detect proxy and block**
4. **Cookies/sessions may not work** (different origin)

## Future Enhancements

1. **Cache support** - Cache proxied responses
2. **Offline support** - Service Worker for offline access
3. **Request modification** - Modify requests before forwarding
4. **Response transformation** - Transform HTML/CSS/JS

## Migration Plan

### Phase 1: Add Service Worker (Parallel)
- Add sw.js
- Modify ProxyManager to use Service Worker
- Keep old proxy code as fallback

### Phase 2: Remove Old Code
- Remove server.js dependency
- Remove external proxy fallbacks
- Clean up settings UI

### Phase 3: Documentation
- Update README.md
- Update CLAUDE.md
- Add usage instructions

## Testing Checklist

- [ ] Service Worker registers successfully
- [ ] Proxy URLs are intercepted
- [ ] Security headers are stripped
- [ ] CORS headers are added
- [ ] iframe loads pages correctly
- [ ] Navigation within iframe works
- [ ] Form submissions work
- [ ] JavaScript-heavy sites work
- [ ] Error handling works
- [ ] Settings UI updated

## References

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
