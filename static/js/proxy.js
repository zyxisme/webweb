// js/proxy.js
const ProxyManager = {
  // Initialize proxy - register Service Worker
  async init() {
    App.log('Initializing proxy manager...');

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      try {
        // Get base path for GitHub Pages compatibility
        const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');
        const swPath = basePath + 'sw.js';
        App.log('Registering Service Worker from:', swPath);
        App.log('Current location:', window.location.href);

        const registration = await navigator.serviceWorker.register(swPath);
        App.log('Service Worker registered, scope:', registration.scope);
        App.log('Registration active:', !!registration.active);
        App.log('Registration installing:', !!registration.installing);
        App.log('Registration waiting:', !!registration.waiting);

        // Wait for Service Worker to be active
        if (registration.installing) {
          App.log('Service Worker installing...');
          await new Promise((resolve) => {
            registration.installing.addEventListener('statechange', (e) => {
              App.log('SW state changed to:', e.target.state);
              if (e.target.state === 'activated') {
                App.log('Service Worker activated');
                resolve();
              }
            });
          });
        } else if (registration.waiting) {
          App.log('Service Worker waiting...');
          await new Promise((resolve) => {
            registration.waiting.addEventListener('statechange', (e) => {
              App.log('SW state changed to:', e.target.state);
              if (e.target.state === 'activated') {
                App.log('Service Worker activated');
                resolve();
              }
            });
          });
        }

        // Verify Service Worker is controlling the page
        App.log('Navigator service worker controller:', !!navigator.serviceWorker.controller);
        if (navigator.serviceWorker.controller) {
          App.log('Controller script URL:', navigator.serviceWorker.controller.scriptURL);
        }

        App.log('✓ Service Worker ready');
        return true;
      } catch (error) {
        App.log('[ERROR] Service Worker registration failed:', error.message);
        return false;
      }
    } else {
      App.log('[WARN] Service Workers not supported');
      return false;
    }
  },

  // Build proxy URL for a given URL
  buildProxyUrl(url) {
    const origin = window.location.origin;
    return `${origin}/proxy?url=${encodeURIComponent(url)}`;
  },

  // Load a page into an iframe
  async loadPage(iframe, url) {
    try {
      App.log('Loading page:', url);

      // Build proxy URL
      const proxyUrl = this.buildProxyUrl(url);
      App.log('Proxy URL:', proxyUrl);

      // Set iframe src instead of srcdoc
      iframe.src = proxyUrl;

      // Extract domain as title (will be updated when page loads)
      const title = this.extractDomain(url);

      App.log('✓ Page loading:', url);
      return { success: true, title };
    } catch (error) {
      App.log('[ERROR] Failed to load page:', error.message);

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
