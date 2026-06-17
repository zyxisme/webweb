// js/tab-manager.js
const TabManager = {
  // Generate unique ID
  generateId() {
    return 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  // Get favicon URL for a given page URL
  getFaviconUrl(url) {
    if (!url || url === 'about:blank') return null;
    try {
      const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
      return 'https://www.google.com/s2/favicons?domain=' + urlObj.hostname + '&sz=32';
    } catch (e) {
      return null;
    }
  },

  // Update tab favicon in state and UI
  updateTabFavicon(tabId, url) {
    const state = StorageManager.getState();
    const tab = state.tabs.find(t => t.id === tabId);
    if (!tab) return;

    const faviconUrl = this.getFaviconUrl(url);
    if (faviconUrl) {
      tab.favicon = faviconUrl;
      StorageManager.setState(state);

      // Update UI
      const tabEl = document.querySelector(`.tab[data-id="${tabId}"]`);
      if (tabEl) {
        const existingFavicon = tabEl.querySelector('.tab-favicon, .tab-favicon-fallback');
        if (existingFavicon) existingFavicon.remove();

        const faviconEl = document.createElement('img');
        faviconEl.className = 'tab-favicon';
        faviconEl.src = faviconUrl;
        faviconEl.onerror = () => {
          const fallback = document.createElement('div');
          fallback.className = 'tab-favicon-fallback';
          fallback.textContent = '🌐';
          faviconEl.replaceWith(fallback);
        };
        tabEl.prepend(faviconEl);
      }
    }
  },

  // Create new tab
  createTab(url = 'about:blank') {
    const state = StorageManager.getState();
    const newTab = {
      id: this.generateId(),
      title: '新标签页',
      url: url,
      zoom: 1.0,
      favicon: null
    };

    state.tabs.push(newTab);
    state.activeTabId = newTab.id;
    StorageManager.setState(state);

    this.renderTabs();
    this.createIframe(newTab);
    this.switchTab(newTab.id);

    // Update favicon
    if (url !== 'about:blank') {
      this.updateTabFavicon(newTab.id, url);
    }

    return newTab;
  },

  // Close tab
  closeTab(tabId) {
    const state = StorageManager.getState();
    const tabIndex = state.tabs.findIndex(t => t.id === tabId);

    if (tabIndex === -1) return false;

    // Don't allow closing the last tab
    if (state.tabs.length <= 1) {
      return false;
    }

    // Remove iframe
    const iframe = document.getElementById('iframe-' + tabId);
    if (iframe) {
      iframe.remove();
    }

    // Remove tab data
    state.tabs.splice(tabIndex, 1);

    // If closing the active tab, switch to adjacent tab
    if (state.activeTabId === tabId) {
      const newIndex = Math.min(tabIndex, state.tabs.length - 1);
      state.activeTabId = state.tabs[newIndex].id;
    }

    StorageManager.setState(state);
    this.renderTabs();
    this.switchTab(state.activeTabId);

    return true;
  },

  // Switch to tab
  switchTab(tabId) {
    const state = StorageManager.getState();
    const tab = state.tabs.find(t => t.id === tabId);

    if (!tab) return false;

    state.activeTabId = tabId;
    StorageManager.setState(state);

    // Hide all iframes, show target
    document.querySelectorAll('#content-area iframe').forEach(iframe => {
      iframe.style.display = 'none';
    });

    const targetIframe = document.getElementById('iframe-' + tabId);
    if (targetIframe) {
      targetIframe.style.display = 'block';
    }

    // Update tab styles
    document.querySelectorAll('.tab').forEach(tabEl => {
      tabEl.classList.remove('active');
    });
    const activeTabEl = document.querySelector(`.tab[data-id="${tabId}"]`);
    if (activeTabEl) {
      activeTabEl.classList.add('active');
    }

    // Update address bar with actual URL
    this.updateAddressBar(tab);

    // Update browser title and favicon
    this.updateBrowserChrome(tab);

    // Update zoom display
    if (typeof ZoomManager !== 'undefined') {
      ZoomManager.updateZoomDisplay(tab.zoom);
    }

    return true;
  },

  // Update address bar to show current tab's URL
  updateAddressBar(tab) {
    const urlInput = document.getElementById('url-input');
    if (urlInput) {
      const displayUrl = (tab.url === 'about:blank') ? '' : tab.url;
      urlInput.value = displayUrl;
    }
  },

  // Update browser chrome (title + favicon) to match active tab
  updateBrowserChrome(tab) {
    if (!tab) return;

    // Update document title
    const displayTitle = (tab.title && tab.title !== '新标签页')
      ? tab.title + ' — WebWeb'
      : 'WebWeb Browser';
    document.title = displayTitle;

    // Update favicon
    const faviconEl = document.getElementById('favicon');
    if (faviconEl) {
      if (tab.favicon) {
        faviconEl.href = tab.favicon;
      } else if (tab.url && tab.url !== 'about:blank') {
        const faviconUrl = this.getFaviconUrl(tab.url);
        if (faviconUrl) faviconEl.href = faviconUrl;
      }
    }
  },

  // Update tab URL
  async updateTabUrl(tabId, url) {
    const state = StorageManager.getState();
    const tab = state.tabs.find(t => t.id === tabId);

    if (!tab) return false;

    tab.url = url;
    StorageManager.setState(state);

    // Load through proxy
    const iframe = document.getElementById('iframe-' + tabId);
    if (iframe) {
      const result = await ProxyManager.loadPage(iframe, url);
      if (result.title) {
        this.updateTabTitle(tabId, result.title);
      }
    }

    // Update favicon
    this.updateTabFavicon(tabId, url);

    return true;
  },

  // Update tab title
  updateTabTitle(tabId, title) {
    const state = StorageManager.getState();
    const tab = state.tabs.find(t => t.id === tabId);

    if (!tab) return false;

    tab.title = title;
    StorageManager.setState(state);

    // Update tab display
    const tabEl = document.querySelector(`.tab[data-id="${tabId}"] .tab-title`);
    if (tabEl) {
      tabEl.textContent = title;
    }

    // Update browser chrome if this is the active tab
    if (state.activeTabId === tabId) {
      this.updateBrowserChrome(tab);
    }

    return true;
  },

  // Get active tab
  getActiveTab() {
    const state = StorageManager.getState();
    return state.tabs.find(t => t.id === state.activeTabId) || null;
  },

  // Get all tabs
  getAllTabs() {
    return StorageManager.getState().tabs;
  },

  // Create iframe for tab
  createIframe(tab) {
    const contentArea = document.getElementById('content-area');
    const iframe = document.createElement('iframe');
    iframe.id = 'iframe-' + tab.id;
    iframe.style.display = 'none';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.setAttribute('allow', 'camera; microphone; fullscreen; geolocation');

    contentArea.appendChild(iframe);

    // Track navigation within the iframe to sync address bar
    iframe.addEventListener('load', () => {
      try {
        const iframeUrl = iframe.contentWindow.location.href;
        // Check if it's a proxy URL
        const proxyMatch = iframeUrl.match(/\/proxy\/(.+)/);
        if (proxyMatch) {
          const originalUrl = decodeURIComponent(proxyMatch[1]);
          if (originalUrl !== tab.url) {
            console.log(`[WebWeb] Navigation detected: ${tab.url} -> ${originalUrl}`);
            // Update tab URL in state
            const state = StorageManager.getState();
            const stateTab = state.tabs.find(t => t.id === tab.id);
            if (stateTab) {
              stateTab.url = originalUrl;
              StorageManager.setState(state);
            }
            // Update address bar if this is the active tab
            if (state.activeTabId === tab.id) {
              document.getElementById('url-input').value = originalUrl;
            }
            // Update favicon and browser chrome
            this.updateTabFavicon(tab.id, originalUrl);
            this.updateBrowserChrome(stateTab || tab);
          }
        }
      } catch (e) {
        // Cross-origin or other access error - ignore
      }
    });

    // Load through proxy if it's a real URL
    if (tab.url && tab.url !== 'about:blank') {
      ProxyManager.loadPage(iframe, tab.url).then(result => {
        if (result.title) {
          this.updateTabTitle(tab.id, result.title);
        } else {
          // Use hostname as fallback title
          try {
            const urlObj = new URL(tab.url.startsWith('http') ? tab.url : 'https://' + tab.url);
            this.updateTabTitle(tab.id, urlObj.hostname);
          } catch (e) {
            // Invalid URL
          }
        }
        this.updateBrowserChrome(tab);
      });
    }

    return iframe;
  },

  // Render tab UI
  renderTabs() {
    const state = StorageManager.getState();
    const container = document.getElementById('tabs-container');
    container.innerHTML = '';

    state.tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab' + (tab.id === state.activeTabId ? ' active' : '');
      tabEl.dataset.id = tab.id;

      // Favicon
      if (tab.favicon) {
        const faviconEl = document.createElement('img');
        faviconEl.className = 'tab-favicon';
        faviconEl.src = tab.favicon;
        faviconEl.onerror = () => {
          const fallback = document.createElement('div');
          fallback.className = 'tab-favicon-fallback';
          fallback.textContent = '🌐';
          faviconEl.replaceWith(fallback);
        };
        tabEl.appendChild(faviconEl);
      } else if (tab.url && tab.url !== 'about:blank') {
        const faviconUrl = this.getFaviconUrl(tab.url);
        if (faviconUrl) {
          const faviconEl = document.createElement('img');
          faviconEl.className = 'tab-favicon';
          faviconEl.src = faviconUrl;
          faviconEl.onerror = () => {
            const fallback = document.createElement('div');
            fallback.className = 'tab-favicon-fallback';
            fallback.textContent = '🌐';
            faviconEl.replaceWith(fallback);
          };
          tabEl.appendChild(faviconEl);
        }
      }

      const titleEl = document.createElement('span');
      titleEl.className = 'tab-title';
      titleEl.textContent = tab.title;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close';
      closeBtn.textContent = '×';
      closeBtn.title = '关闭标签页';

      tabEl.appendChild(titleEl);
      tabEl.appendChild(closeBtn);

      // Click to switch tab
      tabEl.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-close')) {
          this.switchTab(tab.id);
        }
      });

      // Close button click
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
      });

      // Double-click to edit URL
      tabEl.addEventListener('dblclick', (e) => {
        if (!e.target.classList.contains('tab-close')) {
          const newUrl = prompt('输入新的URL:', tab.url);
          if (newUrl !== null) {
            this.updateTabUrl(tab.id, newUrl);
          }
        }
      });

      container.appendChild(tabEl);
    });
  },

  // Initialize
  init() {
    const state = StorageManager.getState();

    // If no tabs, create default tab
    if (state.tabs.length === 0) {
      this.createTab();
    } else {
      // Restore existing tabs
      state.tabs.forEach(tab => {
        this.createIframe(tab);
      });
      this.renderTabs();
      this.switchTab(state.activeTabId);
    }
  }
};
