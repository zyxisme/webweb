// js/app.js
const App = {
  // Initialize application
  init() {
    // Initialize tab manager
    TabManager.init();

    // Initialize zoom manager
    ZoomManager.init();

    // Bind events
    this.bindEvents();

    // Restore layout
    this.restoreLayout();

    console.log('WebWeb Browser initialized');
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
      // State is already saved in each operation, cleanup can be done here
    });
  },

  // Navigate to URL
  navigateToUrl() {
    const urlInput = document.getElementById('url-input');
    let url = urlInput.value.trim();

    if (!url) return;

    // Auto-add https:// prefix
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      url = 'https://' + url;
    }

    const activeTab = TabManager.getActiveTab();
    if (activeTab) {
      TabManager.updateTabUrl(activeTab.id, url);
      TabManager.updateTabTitle(activeTab.id, url);
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
    browser.className = 'layout-' + layout;

    // Update layout toggle button icon
    const toggleBtn = document.getElementById('layout-toggle-btn');
    toggleBtn.textContent = layout === 'top' ? '⊟' : '⊞';
  },

  // Restore layout
  restoreLayout() {
    const state = StorageManager.getState();
    this.applyLayout(state.layout);
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
