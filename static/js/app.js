import { WsClient } from './ws-client.js';
import { CanvasRenderer } from './canvas-renderer.js';
import { StorageManager } from './storage.js';
import { TabManager } from './tab-manager.js';
import { ZoomManager } from './zoom.js';

class App {
    constructor() {
        this.ws = new WsClient();
        this.renderer = new CanvasRenderer('browser-canvas');
        this.storage = new StorageManager();
        this.tabManager = new TabManager(this.storage);
        this.zoomManager = new ZoomManager(this.storage);

        this.activeTabId = null;
        this.tabs = new Map();

        this.init();
    }

    async init() {
        // Connect WebSocket
        try {
            await this.ws.connect();
            console.log('WebSocket connected');
        } catch (e) {
            console.error('Failed to connect WebSocket:', e);
        }

        // Bind events
        this.bindEvents();

        // Setup WebSocket handlers
        this.setupWsHandlers();

        // Create initial tab
        this.createTab();
    }

    bindEvents() {
        // URL input
        const urlInput = document.getElementById('url-input');
        const goBtn = document.getElementById('btn-go');

        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.navigateToUrl(urlInput.value);
            }
        });

        goBtn.addEventListener('click', () => {
            this.navigateToUrl(urlInput.value);
        });

        // Navigation buttons
        document.getElementById('btn-back')?.addEventListener('click', () => {
            // TODO: Implement back navigation
        });

        document.getElementById('btn-forward')?.addEventListener('click', () => {
            // TODO: Implement forward navigation
        });

        document.getElementById('btn-refresh')?.addEventListener('click', () => {
            this.refreshCurrentTab();
        });

        // New tab button
        document.getElementById('btn-new-tab')?.addEventListener('click', () => {
            this.createTab();
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
            console.error('Server error:', msg.message);
        });

        this.ws.on('tab_created', (msg) => {
            console.log('Tab created:', msg.tab_id);
        });

        this.ws.on('tab_closed', (msg) => {
            console.log('Tab closed:', msg.tab_id);
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

        this.ws.send({
            type: 'keyboard',
            tab_id: this.activeTabId,
            key: event.key,
            code: event.code,
            event_type: event.type
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
