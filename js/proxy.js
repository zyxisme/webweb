// js/proxy.js
const ProxyManager = {
  // Log helper - checks App.verboseLogging if available
  log(...args) {
    if (typeof App !== 'undefined' && App.verboseLogging) {
      console.log('[WebWeb]', ...args);
    }
  },

  // Initialize proxy - register Service Worker
  async init() {
    this.log('Initializing proxy manager...');

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        this.log('Service Worker registered:', registration.scope);

        // Wait for Service Worker to be active
        if (registration.installing) {
          this.log('Service Worker installing...');
          await new Promise((resolve) => {
            registration.installing.addEventListener('statechange', (e) => {
              if (e.target.state === 'activated') {
                this.log('Service Worker activated');
                resolve();
              }
            });
          });
        } else if (registration.waiting) {
          this.log('Service Worker waiting...');
          await new Promise((resolve) => {
            registration.waiting.addEventListener('statechange', (e) => {
              if (e.target.state === 'activated') {
                this.log('Service Worker activated');
                resolve();
              }
            });
          });
        }

        this.log('✓ Service Worker ready');
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
      this.log('Loading page:', url);

      // Build proxy URL
      const proxyUrl = this.buildProxyUrl(url);
      this.log('Proxy URL:', proxyUrl);

      // Set iframe src instead of srcdoc
      iframe.src = proxyUrl;

      // Extract domain as title (will be updated when page loads)
      const title = this.extractDomain(url);

      this.log('✓ Page loading:', url);
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
