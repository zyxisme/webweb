// js/storage.js
const StorageManager = {
  STORAGE_KEY: 'webweb_state',

  // Get default state
  getDefaultState() {
    return {
      tabs: [],
      activeTabId: null,
      layout: 'top',
      collapsed: false,
      globalZoom: 1.0
    };
  },

  // Get data from localStorage
  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Storage get error:', e);
      return null;
    }
  },

  // Save data to localStorage
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage set error:', e);
      return false;
    }
  },

  // Remove data from localStorage
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('Storage remove error:', e);
      return false;
    }
  },

  // Get full application state
  getState() {
    const state = this.get(this.STORAGE_KEY);
    if (!state) {
      return this.getDefaultState();
    }
    // Merge with default state to ensure all fields exist
    return { ...this.getDefaultState(), ...state };
  },

  // Save full application state
  setState(state) {
    return this.set(this.STORAGE_KEY, state);
  },

  // Clear all data
  clear() {
    return this.remove(this.STORAGE_KEY);
  }
};
