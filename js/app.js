// js/app.js
const App = {
  // Initialize application
  async init() {
    // Initialize proxy manager first (detect best proxy)
    await ProxyManager.init();

    // Initialize tab manager
    TabManager.init();

    // Initialize zoom manager
    ZoomManager.init();

    // Bind events
    this.bindEvents();

    // Restore layout
    this.restoreLayout();

    // Restore collapsed state
    this.restoreCollapsed();

    // Show proxy status in console
    this.showProxyStatus();

    console.log('WebWeb Browser initialized');
  },

  // Show current proxy status
  showProxyStatus() {
    if (!ProxyManager.isProxyEnabled) {
      console.log('[WebWeb] 代理已禁用');
    } else {
      console.log(`[WebWeb] 当前代理: ${ProxyManager.corsProxy}`);
    }
  },

  // Bind all events
  bindEvents() {
    // New tab button
    document.getElementById('new-tab-btn').addEventListener('click', () => {
      TabManager.createTab();
      document.getElementById('url-input').focus();
    });

    // URL input enter navigation
    document.getElementById('url-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.navigateToUrl();
      }
    });

    // Go button
    document.getElementById('go-btn').addEventListener('click', () => {
      this.navigateToUrl();
    });

    // Zoom buttons
    document.getElementById('zoom-in-btn').addEventListener('click', () => {
      ZoomManager.zoomIn();
    });

    document.getElementById('zoom-out-btn').addEventListener('click', () => {
      ZoomManager.zoomOut();
    });

    // Layout toggle button
    document.getElementById('layout-toggle-btn').addEventListener('click', () => {
      this.toggleLayout();
    });

    // Collapse button
    document.getElementById('collapse-btn').addEventListener('click', () => {
      this.toggleCollapsed();
    });

    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => {
      this.openSettings();
    });

    // Close settings button
    document.getElementById('close-settings-btn').addEventListener('click', () => {
      this.closeSettings();
    });

    // Settings modal background click
    document.getElementById('settings-modal').addEventListener('click', (e) => {
      if (e.target.id === 'settings-modal') {
        this.closeSettings();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+T: New tab
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        TabManager.createTab();
        document.getElementById('url-input').focus();
      }

      // Ctrl+W: Close tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        const activeTab = TabManager.getActiveTab();
        if (activeTab) {
          TabManager.closeTab(activeTab.id);
        }
      }

      // Ctrl+Plus: Zoom in
      if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        ZoomManager.zoomIn();
      }

      // Ctrl+Minus: Zoom out
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        ZoomManager.zoomOut();
      }

      // Ctrl+0: Reset zoom
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        ZoomManager.resetZoom();
      }
    });

    // Save state before page unload
    window.addEventListener('beforeunload', () => {
      // State is already saved in each operation
    });
  },

  // Navigate to URL
  async navigateToUrl() {
    const urlInput = document.getElementById('url-input');
    let url = urlInput.value.trim();

    if (!url) return;

    // Auto-add https:// prefix
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      url = 'https://' + url;
    }

    const activeTab = TabManager.getActiveTab();
    if (activeTab) {
      const iframe = document.getElementById('iframe-' + activeTab.id);
      if (iframe) {
        // Update tab state
        const state = StorageManager.getState();
        const tab = state.tabs.find(t => t.id === activeTab.id);
        if (tab) {
          tab.url = url;
          StorageManager.setState(state);
        }

        // Load through proxy
        const result = await ProxyManager.loadPage(iframe, url);

        // Update title and favicon
        if (result.title) {
          TabManager.updateTabTitle(activeTab.id, result.title);
        } else {
          TabManager.updateTabTitle(activeTab.id, url);
        }
        TabManager.updateTabFavicon(activeTab.id, url);
        if (tab) TabManager.updateBrowserChrome(tab);
      }
    }
  },

  // Toggle layout
  toggleLayout() {
    const state = StorageManager.getState();
    const newLayout = state.layout === 'top' ? 'left' : 'top';
    state.layout = newLayout;
    StorageManager.setState(state);

    this.applyLayout(newLayout);
  },

  // Apply layout
  applyLayout(layout) {
    const browser = document.getElementById('browser');

    // Clear layout classes
    browser.classList.remove('layout-top', 'layout-left');
    browser.classList.add('layout-' + layout);

    // Update layout toggle button icon
    const toggleBtn = document.getElementById('layout-toggle-btn');
    toggleBtn.textContent = layout === 'top' ? '⊟' : '⊞';

    // Show/hide collapse button based on layout
    const collapseBtn = document.getElementById('collapse-btn');
    collapseBtn.style.display = layout === 'left' ? 'flex' : 'none';

    // Restore collapsed state for left layout
    if (layout === 'left') {
      const state = StorageManager.getState();
      if (state.collapsed) {
        browser.classList.add('collapsed');
      }
    }
  },

  // Toggle collapsed state (only for left layout)
  toggleCollapsed() {
    const state = StorageManager.getState();
    const browser = document.getElementById('browser');

    state.collapsed = !state.collapsed;
    StorageManager.setState(state);

    if (state.collapsed) {
      browser.classList.add('collapsed');
    } else {
      browser.classList.remove('collapsed');
    }
  },

  // Restore collapsed state
  restoreCollapsed() {
    const state = StorageManager.getState();
    if (state.layout === 'left' && state.collapsed) {
      document.getElementById('browser').classList.add('collapsed');
    }
  },

  // Restore layout
  restoreLayout() {
    const state = StorageManager.getState();
    this.applyLayout(state.layout);
  },

  // Open settings modal
  openSettings() {
    document.getElementById('settings-modal').classList.remove('hidden');
  },

  // Close settings modal
  closeSettings() {
    document.getElementById('settings-modal').classList.add('hidden');
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
