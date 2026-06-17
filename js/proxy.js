// js/proxy.js
const ProxyManager = {
  // Fallback proxy URLs (used when no custom proxy is set)
  fallbackProxies: [
    'http://localhost:8088/?url=',
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url='
  ],

  // Current proxy index (for fallback)
  currentProxyIndex: 0,

  // Get current proxy URL from settings or fallback
  get corsProxy() {
    const state = StorageManager.getState();
    if (state.proxyUrl) {
      return state.proxyUrl;
    }
    return this.fallbackProxies[this.currentProxyIndex];
  },

  // Check if proxy is enabled
  get isProxyEnabled() {
    const state = StorageManager.getState();
    return state.proxyEnabled !== false;
  },

  // Check if a proxy URL is available
  async checkProxy(proxyUrl) {
    try {
      // For local proxy, check health endpoint
      if (proxyUrl.includes('localhost')) {
        const healthUrl = proxyUrl.split('?')[0] + '/health';
        const response = await fetch(healthUrl, {
          signal: AbortSignal.timeout(1000)
        });
        return response.ok;
      }
      // For external proxies, try fetching example.com
      const testUrl = proxyUrl + encodeURIComponent('https://example.com');
      const response = await fetch(testUrl, {
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  // Test current proxy and return result
  async testProxy() {
    const proxyUrl = this.corsProxy;
    const isAvailable = await this.checkProxy(proxyUrl);
    return {
      url: proxyUrl,
      available: isAvailable,
      enabled: this.isProxyEnabled
    };
  },

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

  // Build proxy URL for a given URL
  buildProxyUrl(url) {
    const origin = window.location.origin;
    return `${origin}/proxy/${encodeURIComponent(url)}`;
  },

  // Update proxy settings
  updateSettings(settings) {
    const state = StorageManager.getState();
    if (settings.proxyEnabled !== undefined) {
      state.proxyEnabled = settings.proxyEnabled;
    }
    if (settings.proxyUrl !== undefined) {
      state.proxyUrl = settings.proxyUrl;
    }
    StorageManager.setState(state);
    console.log('[WebWeb] Proxy settings updated:', settings);
  },

  // Fetch a page - through proxy if enabled, directly if not
  async fetchPage(url) {
    // If proxy is disabled, fetch directly
    if (!this.isProxyEnabled) {
      console.log(`[WebWeb] Direct fetch: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    }

    // Try proxy with fallback
    let lastError = null;
    const proxiesToTry = [this.corsProxy, ...this.fallbackProxies.filter(p => p !== this.corsProxy)];

    for (const proxyUrl of proxiesToTry) {
      const fullUrl = proxyUrl + encodeURIComponent(url);
      try {
        console.log(`[WebWeb] Trying proxy: ${proxyUrl}`);
        const response = await fetch(fullUrl);

        if (response.ok) {
          console.log(`[WebWeb] Proxy succeeded: ${proxyUrl}`);
          return await response.text();
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        console.warn(`[WebWeb] Proxy failed: ${lastError.message}`);
      } catch (error) {
        lastError = error;
        console.warn(`[WebWeb] Proxy error: ${error.message}`);
      }
    }

    throw new Error(`所有代理均失败: ${lastError?.message || '未知错误'}`);
  },

  // Resolve a URL relative to a base URL
  resolveUrl(url, baseUrl) {
    try {
      // Skip special URLs
      if (!url || url.startsWith('data:') || url.startsWith('javascript:') ||
          url.startsWith('mailto:') || url.startsWith('#') || url.startsWith('about:')) {
        return null;
      }
      return new URL(url, baseUrl).href;
    } catch (e) {
      return null;
    }
  },

  // Rewrite HTML to go through the proxy
  rewriteHtml(html, baseUrl) {
    // If proxy is disabled, only inject navigation tracking (no URL rewriting)
    if (!this.isProxyEnabled) {
      return this.injectNavigationScript(html, baseUrl, '');
    }

    const proxyPrefix = this.corsProxy;

    // Add base tag for relative URLs (more robust detection)
    if (!html.includes('<base')) {
      if (html.includes('<head>')) {
        html = html.replace(/<head>/i, `<head><base href="${baseUrl}">`);
      } else if (html.includes('<HEAD>')) {
        html = html.replace(/<HEAD>/i, `<HEAD><base href="${baseUrl}">`);
      } else if (html.includes('<html>')) {
        html = html.replace(/<html>/i, `<html><head><base href="${baseUrl}"></head>`);
      } else if (html.includes('<HTML>')) {
        html = html.replace(/<HTML>/i, `<HTML><head><base href="${baseUrl}"></head>`);
      } else {
        html = `<head><base href="${baseUrl}"></head>` + html;
      }
    }

    // Rewrite src, href, action attributes
    html = html.replace(/(src|href|action)=["']([^"']*?)["']/gi, (match, attr, url) => {
      const absoluteUrl = this.resolveUrl(url, baseUrl);
      if (absoluteUrl) {
        return `${attr}="${proxyPrefix}${encodeURIComponent(absoluteUrl)}"`;
      }
      return match;
    });

    // Rewrite srcset attribute (responsive images)
    html = html.replace(/srcset=["']([^"']*?)["']/gi, (match, srcset) => {
      const rewrittenSrcset = srcset.split(',').map(entry => {
        const parts = entry.trim().split(/\s+/);
        if (parts.length >= 1) {
          const url = parts[0];
          const absoluteUrl = this.resolveUrl(url, baseUrl);
          if (absoluteUrl) {
            parts[0] = `${proxyPrefix}${encodeURIComponent(absoluteUrl)}`;
            return parts.join(' ');
          }
        }
        return entry;
      }).join(', ');
      return `srcset="${rewrittenSrcset}"`;
    });

    // Rewrite poster attribute (video poster)
    html = html.replace(/poster=["']([^"']*?)["']/gi, (match, url) => {
      const absoluteUrl = this.resolveUrl(url, baseUrl);
      if (absoluteUrl) {
        return `poster="${proxyPrefix}${encodeURIComponent(absoluteUrl)}"`;
      }
      return match;
    });

    // Rewrite @import in CSS (handle multiple formats) - MUST be before CSS url() rewrite
    html = html.replace(/@import\s+url\(["']?([^"')]+?)["']?\)/gi, (match, url) => {
      const absoluteUrl = this.resolveUrl(url, baseUrl);
      if (absoluteUrl) {
        return `@import url("${proxyPrefix}${encodeURIComponent(absoluteUrl)}")`;
      }
      return match;
    });
    html = html.replace(/@import\s+["']([^"']+)["']/gi, (match, url) => {
      const absoluteUrl = this.resolveUrl(url, baseUrl);
      if (absoluteUrl) {
        return `@import url("${proxyPrefix}${encodeURIComponent(absoluteUrl)}")`;
      }
      return match;
    });

    // Rewrite CSS url() (excluding @import which was already handled)
    html = html.replace(/(?<!@import\s)url\(["']?([^"')]*?)["']?\)/gi, (match, url) => {
      const absoluteUrl = this.resolveUrl(url, baseUrl);
      if (absoluteUrl) {
        return `url("${proxyPrefix}${encodeURIComponent(absoluteUrl)}")`;
      }
      return match;
    });

    // Inject navigation tracking and API interception script
    return this.injectNavigationScript(html, baseUrl, proxyPrefix);
  },

  // Inject navigation tracking script into HTML
  injectNavigationScript(html, baseUrl, proxyPrefix) {
    const trackingScript = `
<script>
(function() {
  const proxyPrefix = '${proxyPrefix}';
  const baseUrl = '${baseUrl}';

  function getOriginalUrl(url) {
    if (proxyPrefix && url.startsWith(proxyPrefix)) {
      return decodeURIComponent(url.substring(proxyPrefix.length));
    }
    return url;
  }

  function resolveUrl(url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) {
      return url;
    }
    try {
      return new URL(url, baseUrl).href;
    } catch (e) {
      return url;
    }
  }

  function proxyUrl(url) {
    if (!proxyPrefix || !url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) {
      return url;
    }
    const absoluteUrl = resolveUrl(url);
    if (absoluteUrl) {
      return proxyPrefix + encodeURIComponent(absoluteUrl);
    }
    return url;
  }

  // Intercept link clicks
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link && link.href) {
      e.preventDefault();
      const originalUrl = getOriginalUrl(link.href);
      window.parent.postMessage({
        type: 'webweb-navigate',
        url: originalUrl
      }, '*');
    }
  }, true);

  // Intercept form submissions
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.action) {
      e.preventDefault();
      const formData = new FormData(form);
      const url = new URL(getOriginalUrl(form.action));
      formData.forEach((value, key) => url.searchParams.append(key, value));
      window.parent.postMessage({
        type: 'webweb-navigate',
        url: url.href
      }, '*');
    }
  }, true);

  // ===== JavaScript API Interception =====
  // Only intercept if proxy is enabled
  if (proxyPrefix) {
    // 1. Intercept fetch API
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      let url = input;
      if (typeof url === 'string') {
        url = proxyUrl(url);
      } else if (url instanceof Request) {
        url = new Request(proxyUrl(url.url), url);
      }
      return originalFetch.call(this, url, init);
    };

    // 2. Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
      return originalXHROpen.call(this, method, proxyUrl(url), async, user, password);
    };

    // 3. Intercept Image constructor
    const OriginalImage = window.Image;
    window.Image = function(width, height) {
      const img = new OriginalImage(width, height);
      const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      Object.defineProperty(img, 'src', {
        get: function() {
          return originalSrcDescriptor.get.call(this);
        },
        set: function(value) {
          originalSrcDescriptor.set.call(this, proxyUrl(value));
        }
      });
      return img;
    };
    window.Image.prototype = OriginalImage.prototype;

    // 4. Intercept document.createElement for script, link, img
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName, options) {
      const element = originalCreateElement(tagName, options);
      const lowerTagName = tagName.toLowerCase();

      if (['script', 'link', 'img', 'video', 'audio', 'source', 'iframe'].includes(lowerTagName)) {
        const originalSrcDescriptor = Object.getOwnPropertyDescriptor(
          lowerTagName === 'link' ? HTMLLinkElement.prototype :
          lowerTagName === 'script' ? HTMLScriptElement.prototype :
          HTMLMediaElement.prototype,
          lowerTagName === 'link' ? 'href' : 'src'
        );

        if (originalSrcDescriptor) {
          Object.defineProperty(element, lowerTagName === 'link' ? 'href' : 'src', {
            get: function() {
              return originalSrcDescriptor.get.call(this);
            },
            set: function(value) {
              originalSrcDescriptor.set.call(this, proxyUrl(value));
            }
          });
        }
      }

      return element;
    };

    // 5. Intercept dynamic style changes
    const originalStyleDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'style');
    Object.defineProperty(HTMLElement.prototype, 'style', {
      get: function() {
        return originalStyleDescriptor.get.call(this);
      },
      set: function(value) {
        if (typeof value === 'string' && value.includes('url(')) {
          value = value.replace(/url\\(["']?([^"')]*?)["']?/gi, function(match, url) {
            return 'url("' + proxyUrl(url);
          });
        }
        originalStyleDescriptor.set.call(this, value);
      }
    });

    // 6. Intercept CSSStyleSheet.insertRule
    if (window.CSSStyleSheet && CSSStyleSheet.prototype.insertRule) {
      const originalInsertRule = CSSStyleSheet.prototype.insertRule;
      CSSStyleSheet.prototype.insertRule = function(rule, index) {
        if (rule.includes('url(')) {
          rule = rule.replace(/url\\(["']?([^"')]*?)["']?/gi, function(match, url) {
            return 'url("' + proxyUrl(url);
          });
        }
        return originalInsertRule.call(this, rule, index);
      };
    }

    console.log('[WebWeb] API interception initialized for:', baseUrl);
  } else {
    console.log('[WebWeb] API interception disabled (proxy not enabled)');
  }
})();
</script>
`;

    // Inject before </head> or at the start
    if (html.includes('</head>')) {
      html = html.replace('</head>', trackingScript + '</head>');
    } else {
      html = trackingScript + html;
    }

    return html;
  },

  // Extract title from HTML
  extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return match ? match[1].trim() : null;
  },

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
  }
};
