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
