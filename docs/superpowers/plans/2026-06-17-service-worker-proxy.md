# Service Worker Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current proxy mechanism (Node.js server + external proxies) with a client-side Service Worker that intercepts iframe requests and strips CORS/security headers.

**Architecture:** Service Worker intercepts fetch requests to proxy URLs, strips security headers (X-Frame-Options, CSP, etc.), adds CORS headers, and returns modified responses to iframes. ProxyManager modified to register Service Worker and use iframe.src instead of srcdoc.

**Tech Stack:** Service Worker API, Fetch API, vanilla JavaScript

## Global Constraints

- Pure client-side solution, no Node.js dependency
- Service Worker requires HTTPS or localhost
- Only intercept requests with `/proxy/` URL prefix
- Strip all security-related headers that prevent iframe embedding
- Add CORS headers to all proxied responses

---

### Task 1: Create Service Worker (sw.js)

**Files:**
- Create: `sw.js`
- Test: Manual testing in browser

**Interfaces:**
- Produces: Service Worker that intercepts fetch requests
- Provides: Header stripping and CORS header addition

- [ ] **Step 1: Create sw.js file**

Create `/vol1/1000/webweb/sw.js`:

```javascript
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
```

- [ ] **Step 2: Verify file creation**

Run: `ls -la /vol1/1000/webweb/sw.js`
Expected: File exists with correct permissions

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "feat: add Service Worker for proxy interception"
```

---

### Task 2: Modify ProxyManager - Register Service Worker

**Files:**
- Modify: `js/proxy.js:62-91` (init method)

**Interfaces:**
- Consumes: Service Worker registration API
- Produces: Registered Service Worker

- [ ] **Step 1: Add Service Worker registration to init()**

Modify `/vol1/1000/webweb/js/proxy.js`, replace lines 62-91 with:

```javascript
  // Initialize proxy - register Service Worker
  async init() {
    console.log('[WebWeb] Initializing proxy manager...');

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[WebWeb] Service Worker registered:', registration.scope);

        // Wait for Service Worker to be active
        if (registration.installing) {
          console.log('[WebWeb] Service Worker installing...');
          await new Promise((resolve) => {
            registration.installing.addEventListener('statechange', (e) => {
              if (e.target.state === 'activated') {
                console.log('[WebWeb] Service Worker activated');
                resolve();
              }
            });
          });
        } else if (registration.waiting) {
          console.log('[WebWeb] Service Worker waiting...');
          await new Promise((resolve) => {
            registration.waiting.addEventListener('statechange', (e) => {
              if (e.target.state === 'activated') {
                console.log('[WebWeb] Service Worker activated');
                resolve();
              }
            });
          });
        }

        console.log('[WebWeb] ✓ Service Worker ready');
        return true;
      } catch (error) {
        console.error('[WebWeb] Service Worker registration failed:', error);
        return false;
      }
    } else {
      console.warn('[WebWeb] Service Workers not supported');
      return false;
    }
  },
```

- [ ] **Step 2: Test Service Worker registration**

Open browser console and check for:
- `[WebWeb] Initializing proxy manager...`
- `[WebWeb] Service Worker registered: ...`
- `[WebWeb] ✓ Service Worker ready`

- [ ] **Step 3: Commit**

```bash
git add js/proxy.js
git commit -m "feat: add Service Worker registration to ProxyManager"
```

---

### Task 3: Add buildProxyUrl Method

**Files:**
- Modify: `js/proxy.js` (add new method after init)

**Interfaces:**
- Consumes: URL string
- Produces: Proxy URL string

- [ ] **Step 1: Add buildProxyUrl method**

Add after the `init()` method in `/vol1/1000/webweb/js/proxy.js`:

```javascript
  // Build proxy URL for a given URL
  buildProxyUrl(url) {
    const origin = window.location.origin;
    return `${origin}/proxy/${encodeURIComponent(url)}`;
  },
```

- [ ] **Step 2: Test buildProxyUrl**

In browser console:
```javascript
ProxyManager.buildProxyUrl('https://example.com')
// Expected: "http://localhost:8080/proxy/https%3A%2F%2Fexample.com"
```

- [ ] **Step 3: Commit**

```bash
git add js/proxy.js
git commit -m "feat: add buildProxyUrl method to ProxyManager"
```

---

### Task 4: Modify loadPage to Use iframe.src

**Files:**
- Modify: `js/proxy.js:432-463` (loadPage method)

**Interfaces:**
- Consumes: iframe element, URL string
- Produces: Updated iframe with src attribute

- [ ] **Step 1: Modify loadPage method**

Replace `/vol1/1000/webweb/js/proxy.js` lines 432-463 with:

```javascript
  // Load a page into an iframe
  async loadPage(iframe, url) {
    try {
      console.log(`[WebWeb] Loading page: ${url}`);

      // Build proxy URL
      const proxyUrl = this.buildProxyUrl(url);

      // Set iframe src instead of srcdoc
      iframe.src = proxyUrl;

      // Extract domain as title (will be updated when page loads)
      const title = this.extractDomain(url);

      console.log(`[WebWeb] ✓ Page loading: ${url}`);
      return { success: true, title };
    } catch (error) {
      console.error('[WebWeb] Failed to load page:', error);

      // Provide helpful error message
      iframe.srcdoc = `
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1 style="color: #d32f2f;">加载失败</h1>
            <p style="color: #666;">${error.message}</p>
            <p style="color: #999; margin-top: 20px;">URL: ${url}</p>
            <hr style="margin: 30px auto; max-width: 400px;">
            <p style="color: #1a73e8;">💡 请检查 Service Worker 是否正常运行</p>
          </body>
        </html>
      `;
      return { success: false, error: error.message };
    }
  },

  // Extract domain from URL
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  },
```

- [ ] **Step 2: Test loadPage**

Enter a URL in the address bar and press Enter. Check:
- iframe.src is set to proxy URL
- Page loads (may have CORS issues initially)
- Console shows Service Worker logs

- [ ] **Step 3: Commit**

```bash
git add js/proxy.js
git commit -m "feat: modify loadPage to use iframe.src with Service Worker"
```

---

### Task 5: Remove Old Proxy Methods

**Files:**
- Modify: `js/proxy.js` (remove fetchPage, rewriteHtml, injectNavigationScript)

**Interfaces:**
- Removes: fetchPage(), rewriteHtml(), injectNavigationScript()
- Keeps: buildProxyUrl(), loadPage(), extractDomain()

- [ ] **Step 1: Remove fetchPage method**

Delete the `fetchPage` method (lines 107-142) from `/vol1/1000/webweb/js/proxy.js`.

- [ ] **Step 2: Remove rewriteHtml method**

Delete the `rewriteHtml` method (lines 159-244) from `/vol1/1000/webweb/js/proxy.js`.

- [ ] **Step 3: Remove injectNavigationScript method**

Delete the `injectNavigationScript` method (lines 247-423) from `/vol1/1000/webweb/js/proxy.js`.

- [ ] **Step 4: Remove extractTitle method**

Delete the `extractTitle` method (lines 426-430) from `/vol1/1000/webweb/js/proxy.js`.

- [ ] **Step 5: Verify code still works**

Open browser and test:
- Service Worker registers
- Pages load (with proxy)
- No JavaScript errors

- [ ] **Step 6: Commit**

```bash
git add js/proxy.js
git commit -m "refactor: remove old proxy methods (fetchPage, rewriteHtml, etc.)"
```

---

### Task 6: Update Settings UI

**Files:**
- Modify: `index.html:28-56` (settings modal)
- Modify: `js/app.js` (settings handlers)

**Interfaces:**
- Removes: Proxy URL input, test proxy button
- Keeps: Proxy enabled checkbox (optional)

- [ ] **Step 1: Simplify settings modal**

Replace `/vol1/1000/webweb/index.html` lines 28-56 with:

```html
    <!-- Settings Modal -->
    <div id="settings-modal" class="modal hidden">
      <div class="modal-content">
        <div class="modal-header">
          <h2>设置</h2>
          <button id="close-settings-btn" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="settings-section">
            <h3>代理设置</h3>
            <div class="setting-item">
              <p class="setting-hint">Service Worker 代理已启用，无需额外配置</p>
            </div>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Remove proxy settings handlers from app.js**

Remove or comment out proxy-related event handlers in `/vol1/1000/webweb/js/app.js`:
- `openSettings()` - remove proxy URL population
- `closeSettings()` - remove proxy settings save
- `updateProxySettings()` - remove or simplify
- `testProxy()` - remove

- [ ] **Step 3: Test settings UI**

Open settings modal:
- Should show simplified proxy info
- No proxy URL input
- No test proxy button

- [ ] **Step 4: Commit**

```bash
git add index.html js/app.js
git commit -m "refactor: simplify settings UI for Service Worker proxy"
```

---

### Task 7: Handle Navigation in Service Worker

**Files:**
- Modify: `sw.js` (add navigation handling)

**Interfaces:**
- Consumes: Navigation requests
- Produces: Proxied navigation responses

- [ ] **Step 1: Add navigation handling to sw.js**

Add to `/vol1/1000/webweb/sw.js` after the main fetch handler:

```javascript
// Handle navigation requests (link clicks, form submissions)
self.addEventListener('fetch', (event) => {
  // Skip non-navigation requests (already handled above)
  if (event.request.mode !== 'navigate') {
    return;
  }

  const url = event.request.url;

  // If it's already a proxy URL, let it be handled by the main handler
  if (isProxyUrl(url)) {
    return;
  }

  // For navigation requests from within proxied pages,
  // we could intercept and proxy them
  // This is handled by the main fetch handler above
});
```

- [ ] **Step 2: Test navigation**

Click a link within a proxied page:
- Should navigate to new page
- New page should also be proxied
- Console shows Service Worker logs

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "feat: add navigation handling to Service Worker"
```

---

### Task 8: Add Error Handling and Fallback

**Files:**
- Modify: `sw.js` (improve error handling)
- Modify: `js/proxy.js` (add fallback)

**Interfaces:**
- Provides: Better error messages
- Provides: Fallback mechanism

- [ ] **Step 1: Improve error handling in sw.js**

Update the error handler in `/vol1/1000/webweb/sw.js`:

```javascript
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
```

- [ ] **Step 2: Test error handling**

Try loading a non-existent URL:
- Should show error page in iframe
- Error message should be user-friendly
- Console shows Service Worker error logs

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "feat: improve error handling in Service Worker"
```

---

### Task 9: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Updates: Project documentation

- [ ] **Step 1: Update README.md**

Add Service Worker proxy section to `/vol1/1000/webweb/README.md`:

```markdown
## 代理系统

WebWeb 使用 Service Worker 实现代理功能，无需启动额外的服务器。

### 工作原理

1. Service Worker 拦截 iframe 中的请求
2. 剔除安全限制头部（X-Frame-Options, CSP 等）
3. 添加 CORS 头部（Access-Control-Allow-Origin: *）
4. 返回修改后的响应

### 优势

- ✅ 纯客户端实现，无需 Node.js
- ✅ 无需外部代理服务
- ✅ 自动剔除跨域限制
- ✅ 现代浏览器原生支持

### 限制

- ⚠️ 需要 HTTPS 或 localhost
- ⚠️ 仅支持现代浏览器
```

- [ ] **Step 2: Update CLAUDE.md**

Update `/vol1/1000/webweb/CLAUDE.md` to reflect:
- Service Worker proxy replaces Node.js server
- Remove server.js references
- Update proxy URL format

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: update documentation for Service Worker proxy"
```

---

### Task 10: Final Testing and Cleanup

**Files:**
- Test: Manual testing
- Remove: `server.js` (optional)

**Interfaces:**
- Verifies: Complete functionality

- [ ] **Step 1: Test complete functionality**

Test the following scenarios:
1. Load a simple website (example.com)
2. Load a complex website (github.com)
3. Click links within proxied pages
4. Submit forms within proxied pages
5. Test error handling with invalid URLs
6. Test with JavaScript-heavy sites

- [ ] **Step 2: Remove server.js (optional)**

If Service Worker proxy works well, consider removing:
```bash
rm server.js
git add -A
git commit -m "chore: remove server.js (replaced by Service Worker)"
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Service Worker proxy implementation"
```

---

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
- [ ] Documentation updated
