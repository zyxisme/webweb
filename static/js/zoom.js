// js/zoom.js
const ZoomManager = {
  MIN_ZOOM: 0.3,
  MAX_ZOOM: 3.0,
  ZOOM_STEP: 0.1,

  // Zoom in
  zoomIn() {
    const currentZoom = this.getZoom();
    const newZoom = Math.min(currentZoom + this.ZOOM_STEP, this.MAX_ZOOM);
    this.setZoom(newZoom);
  },

  // Zoom out
  zoomOut() {
    const currentZoom = this.getZoom();
    const newZoom = Math.max(currentZoom - this.ZOOM_STEP, this.MIN_ZOOM);
    this.setZoom(newZoom);
  },

  // Reset zoom to default
  resetZoom() {
    this.setZoom(1.0);
  },

  // Set zoom level
  setZoom(level) {
    const state = StorageManager.getState();
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);

    if (!activeTab) return false;

    activeTab.zoom = level;
    StorageManager.setState(state);

    // Apply zoom to iframe
    const iframe = document.getElementById('iframe-' + activeTab.id);
    if (iframe) {
      iframe.style.transform = `scale(${level})`;
      iframe.style.transformOrigin = 'top left';
      iframe.style.width = `${100 / level}%`;
      iframe.style.height = `${100 / level}%`;
    }

    // Update display
    this.updateZoomDisplay(level);

    return true;
  },

  // Get current zoom level
  getZoom() {
    const state = StorageManager.getState();
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    return activeTab ? activeTab.zoom : 1.0;
  },

  // Update zoom display
  updateZoomDisplay(zoom) {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
      zoomLevel.textContent = Math.round(zoom * 100) + '%';
    }
  },

  // Initialize zoom manager
  init() {
    const zoom = this.getZoom();
    this.updateZoomDisplay(zoom);

    // Apply zoom for current active tab
    const state = StorageManager.getState();
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    if (activeTab) {
      const iframe = document.getElementById('iframe-' + activeTab.id);
      if (iframe) {
        iframe.style.transform = `scale(${activeTab.zoom})`;
        iframe.style.transformOrigin = 'top left';
        iframe.style.width = `${100 / activeTab.zoom}%`;
        iframe.style.height = `${100 / activeTab.zoom}%`;
      }
    }
  }
};

export { ZoomManager };
