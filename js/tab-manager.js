// js/tab-manager.js
const TabManager = {
  // Generate unique ID
  generateId() {
    return 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  // Create new tab
  createTab(url = 'about:blank') {
    const state = StorageManager.getState();
    const newTab = {
      id: this.generateId(),
      title: '新标签页',
      url: url,
      zoom: 1.0
    };

    state.tabs.push(newTab);
    state.activeTabId = newTab.id;
    StorageManager.setState(state);

    this.renderTabs();
    this.createIframe(newTab);
    this.switchTab(newTab.id);

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

    // Update address bar
    const urlInput = document.getElementById('url-input');
    if (urlInput) {
      urlInput.value = tab.url === 'about:blank' ? '' : tab.url;
    }

    // Update zoom display
    if (typeof ZoomManager !== 'undefined') {
      ZoomManager.updateZoomDisplay(tab.zoom);
    }

    return true;
  },

  // Update tab URL
  updateTabUrl(tabId, url) {
    const state = StorageManager.getState();
    const tab = state.tabs.find(t => t.id === tabId);

    if (!tab) return false;

    tab.url = url;
    StorageManager.setState(state);

    // Update iframe src
    const iframe = document.getElementById('iframe-' + tabId);
    if (iframe) {
      iframe.src = url;
    }

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
    iframe.src = tab.url;
    iframe.style.display = 'none';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.setAttribute('allow', 'camera; microphone; fullscreen; geolocation');

    contentArea.appendChild(iframe);

    // Listen for iframe load to get title
    iframe.addEventListener('load', () => {
      try {
        const title = iframe.contentDocument?.title;
        if (title) {
          this.updateTabTitle(tab.id, title);
        }
      } catch (e) {
        // Cross-origin restriction, cannot get title
      }
    });

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
