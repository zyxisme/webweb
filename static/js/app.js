import { WsClient } from './ws-client.js';
import { CanvasRenderer } from './canvas-renderer.js';
import { StorageManager } from './storage.js';
import { TabManager } from './tab-manager.js';
import { ZoomManager } from './zoom.js';

class App {
    constructor() {
        this.ws = new WsClient();
        this.renderer = new CanvasRenderer('browser-canvas');
        this.storage = StorageManager;
        this.tabManager = TabManager;
        this.zoomManager = ZoomManager;

        this.activeTabId = null;
        this.tabs = new Map();
        this.logMessages = [];

        this.init();
    }

    async init() {
        // Connect WebSocket
        try {
            await this.ws.connect();
            this.log('WebSocket connected');
        } catch (e) {
            this.log('[ERROR] Failed to connect WebSocket: ' + e.message);
        }

        // Bind events
        this.bindEvents();

        // Setup WebSocket handlers
        this.setupWsHandlers();

        // Create initial tab
        this.createTab();
    }

    log(message) {
        console.log(message);
        this.logMessages.push(message);
        const logOutput = document.getElementById('log-output');
        if (logOutput) {
            logOutput.textContent = this.logMessages.join('\n');
            logOutput.scrollTop = logOutput.scrollHeight;
        }
    }

    bindEvents() {
        // URL input
        const urlInput = document.getElementById('url-input');
        const goBtn = document.getElementById('go-btn');

        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.navigateToUrl(urlInput.value);
            }
        });

        goBtn.addEventListener('click', () => {
            this.navigateToUrl(urlInput.value);
        });

        // Navigation buttons
        document.getElementById('back-btn')?.addEventListener('click', () => {
            // TODO: Implement back navigation
        });

        document.getElementById('forward-btn')?.addEventListener('click', () => {
            // TODO: Implement forward navigation
        });

        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            this.refreshCurrentTab();
        });

        // New tab button
        document.getElementById('new-tab-btn')?.addEventListener('click', () => {
            this.createTab();
        });

        // Zoom controls
        document.getElementById('zoom-in-btn')?.addEventListener('click', () => {
            this.zoomManager.zoomIn();
            this.updateZoomLevel();
        });

        document.getElementById('zoom-out-btn')?.addEventListener('click', () => {
            this.zoomManager.zoomOut();
            this.updateZoomLevel();
        });

        // Layout toggle
        document.getElementById('layout-toggle-btn')?.addEventListener('click', () => {
            this.toggleLayout();
        });

        // Settings button
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.showSettings();
        });

        document.getElementById('close-settings-btn')?.addEventListener('click', () => {
            this.hideSettings();
        });

        // Settings modal close on background click
        document.getElementById('settings-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') {
                this.hideSettings();
            }
        });

        // Collapse button
        document.getElementById('collapse-btn')?.addEventListener('click', () => {
            this.toggleCollapse();
        });

        // Canvas events
        this.bindCanvasEvents();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.renderer.resize();
        });

        // Initialize zoom level display
        this.updateZoomLevel();

        // Initialize layout
        this.initializeLayout();
    }

    bindCanvasEvents() {
        const canvas = document.getElementById('browser-canvas');

        // Mouse events
        canvas.addEventListener('mousedown', (e) => this.handleMouse(e, 'mousedown'));
        canvas.addEventListener('mouseup', (e) => this.handleMouse(e, 'mouseup'));
        canvas.addEventListener('mousemove', (e) => this.handleMouse(e, 'mousemove'));
        canvas.addEventListener('click', (e) => this.handleMouse(e, 'click'));
        canvas.addEventListener('dblclick', (e) => this.handleMouse(e, 'dblclick'));
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleMouse(e, 'contextmenu');
        });

        // Scroll events
        canvas.addEventListener('wheel', (e) => this.handleScroll(e));
    }

    setupWsHandlers() {
        this.ws.on('dom_full', (msg) => {
            this.renderer.setDomTree(msg.dom);
        });

        this.ws.on('dom_diff', (msg) => {
            // TODO: Apply incremental DOM updates
        });

        this.ws.on('title', (msg) => {
            this.updateTabTitle(msg.tab_id, msg.title);
        });

        this.ws.on('url', (msg) => {
            this.updateTabUrl(msg.tab_id, msg.url);
        });

        this.ws.on('error', (msg) => {
            this.log('[ERROR] Server error: ' + msg.message);
        });

        this.ws.on('tab_created', (msg) => {
            this.log('Tab created: ' + msg.tab_id);
        });

        this.ws.on('tab_closed', (msg) => {
            this.log('Tab closed: ' + msg.tab_id);
        });

        this.ws.on('scroll_update', (msg) => {
            if (msg.tab_id === this.activeTabId) {
                this.renderer.updateScroll(msg.scroll_top, msg.scroll_left);
            }
        });
    }

    createTab(url = 'about:blank') {
        const tabId = this.tabManager.createTab(url);
        this.tabs.set(tabId, { url, title: '新标签页' });

        // Tell backend to create tab
        this.ws.send({
            type: 'tab_create',
            tab_id: tabId
        });

        // Switch to new tab
        this.switchTab(tabId);

        return tabId;
    }

    switchTab(tabId) {
        this.activeTabId = tabId;
        this.tabManager.switchTab(tabId);

        // Request DOM from backend
        this.ws.send({
            type: 'get_dom',
            tab_id: tabId
        });

        // Update address bar
        const tab = this.tabs.get(tabId);
        if (tab) {
            document.getElementById('url-input').value = tab.url;
            document.title = tab.title + ' - WebWeb';
        }
    }

    closeTab(tabId) {
        // Tell backend to close tab
        this.ws.send({
            type: 'tab_close',
            tab_id: tabId
        });

        // Remove from local state
        this.tabs.delete(tabId);
        this.tabManager.closeTab(tabId);

        // Switch to another tab if this was active
        if (this.activeTabId === tabId) {
            const remaining = Array.from(this.tabs.keys());
            if (remaining.length > 0) {
                this.switchTab(remaining[remaining.length - 1]);
            } else {
                this.createTab();
            }
        }
    }

    navigateToUrl(url) {
        if (!url) return;

        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url;
            } else {
                url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
            }
        }

        // Update local state
        if (this.tabs.has(this.activeTabId)) {
            this.tabs.get(this.activeTabId).url = url;
        }

        // Tell backend to navigate
        this.ws.send({
            type: 'navigate',
            tab_id: this.activeTabId,
            url: url
        });

        // Update address bar
        document.getElementById('url-input').value = url;
    }

    refreshCurrentTab() {
        const tab = this.tabs.get(this.activeTabId);
        if (tab && tab.url) {
            this.navigateToUrl(tab.url);
        }
    }

    updateTabTitle(tabId, title) {
        if (this.tabs.has(tabId)) {
            this.tabs.get(tabId).title = title;
            this.tabManager.updateTabTitle(tabId, title);

            if (tabId === this.activeTabId) {
                document.title = title + ' - WebWeb';
            }
        }
    }

    updateTabUrl(tabId, url) {
        if (this.tabs.has(tabId)) {
            this.tabs.get(tabId).url = url;

            if (tabId === this.activeTabId) {
                document.getElementById('url-input').value = url;
            }
        }
    }

    handleMouse(event, eventType) {
        if (!this.activeTabId) return;

        const rect = event.target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.ws.send({
            type: 'mouse',
            tab_id: this.activeTabId,
            x: x,
            y: y,
            event_type: eventType,
            button: event.button
        });
    }

    handleScroll(event) {
        if (!this.activeTabId) return;

        event.preventDefault();

        const rect = event.target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.ws.send({
            type: 'scroll',
            tab_id: this.activeTabId,
            x: x,
            y: y,
            delta_x: event.deltaX,
            delta_y: event.deltaY
        });
    }

    handleKeyboard(event) {
        if (!this.activeTabId) return;

        // Don't capture when typing in URL input
        if (event.target.id === 'url-input') return;

        // Handle keyboard shortcuts
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 't':
                case 'T':
                    event.preventDefault();
                    this.createTab();
                    return;
                case 'w':
                case 'W':
                    event.preventDefault();
                    if (this.activeTabId) {
                        this.closeTab(this.activeTabId);
                    }
                    return;
                case '=':
                case '+':
                    event.preventDefault();
                    this.zoomManager.zoomIn();
                    this.updateZoomLevel();
                    return;
                case '-':
                    event.preventDefault();
                    this.zoomManager.zoomOut();
                    this.updateZoomLevel();
                    return;
                case '0':
                    event.preventDefault();
                    this.zoomManager.resetZoom();
                    this.updateZoomLevel();
                    return;
            }
        }

        this.ws.send({
            type: 'keyboard',
            tab_id: this.activeTabId,
            key: event.key,
            code: event.code,
            event_type: event.type
        });
    }

    // Zoom methods
    updateZoomLevel() {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = Math.round(this.zoomManager.getZoom() * 100) + '%';
        }
    }

    // Layout methods
    initializeLayout() {
        const savedLayout = this.storage.get('layout') || 'top';
        const browser = document.getElementById('browser');
        browser.className = `layout-${savedLayout}`;

        if (savedLayout === 'left') {
            const collapsed = this.storage.get('sidebar-collapsed') === 'true';
            if (collapsed) {
                browser.classList.add('collapsed');
            }
        }
    }

    toggleLayout() {
        const browser = document.getElementById('browser');
        const isTop = browser.classList.contains('layout-top');

        if (isTop) {
            browser.classList.remove('layout-top');
            browser.classList.add('layout-left');
            this.storage.set('layout', 'left');
        } else {
            browser.classList.remove('layout-left', 'collapsed');
            browser.classList.add('layout-top');
            this.storage.set('layout', 'top');
        }

        // Resize canvas after layout change
        setTimeout(() => this.renderer.resize(), 300);
    }

    toggleCollapse() {
        const browser = document.getElementById('browser');
        if (!browser.classList.contains('layout-left')) return;

        browser.classList.toggle('collapsed');
        this.storage.set('sidebar-collapsed', browser.classList.contains('collapsed'));

        // Resize canvas after collapse animation
        setTimeout(() => this.renderer.resize(), 300);
    }

    // Settings methods
    showSettings() {
        document.getElementById('settings-modal').classList.remove('hidden');
    }

    hideSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
