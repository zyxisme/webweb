// js/proxy.js
const ProxyManager = {
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
    return `${origin}/?url=${encodeURIComponent(url)}`;
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
