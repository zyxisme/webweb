# WebWeb Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建一个基于iframe的浏览器标签页模拟系统，支持标签页增减、编辑、切换、状态持久化和网页缩放

**Architecture:** 纯HTML/CSS/JavaScript多文件分离结构，通过localStorage持久化状态，使用iframe嵌入网页内容，支持顶部/左侧两种标签栏布局

**Tech Stack:** HTML5, CSS3, ES6+ JavaScript, localStorage API

## Global Constraints

- 纯黑白配色，无圆角，无阴影
- 不使用sandbox属性，完全模拟浏览器行为
- 双击index.html直接打开，无需服务器
- 现代浏览器支持（Chrome 80+, Firefox 75+, Safari 13+, Edge 80+）

---

## File Structure

```
webweb/
├── index.html              # 主页面结构
├── css/
│   └── style.css           # 所有样式
├── js/
│   ├── storage.js          # localStorage封装
│   ├── tab-manager.js      # 标签页CRUD
│   ├── zoom.js             # 缩放控制
│   └── app.js              # 主应用逻辑
└── docs/
    ├── superpowers/
    │   ├── specs/           # 设计文档
    │   └── plans/           # 实现计划
```

---

### Task 1: 创建项目结构和HTML骨架

**Files:**
- Create: `index.html`
- Create: `css/style.css`（空文件占位）
- Create: `js/storage.js`（空文件占位）
- Create: `js/tab-manager.js`（空文件占位）
- Create: `js/zoom.js`（空文件占位）
- Create: `js/app.js`（空文件占位）

**Interfaces:**
- Produces: 基本HTML结构，所有JS/CSS文件引用

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p css js
```

- [ ] **Step 2: 创建空的JS和CSS文件**

```bash
touch css/style.css js/storage.js js/tab-manager.js js/zoom.js js/app.js
```

- [ ] **Step 3: 编写index.html骨架**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebWeb Browser</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="browser">
    <!-- 标签栏 -->
    <div id="tab-bar">
      <button id="new-tab-btn" title="新建标签页 (Ctrl+T)">+</button>
      <div id="tabs-container"></div>
      <div id="controls">
        <button id="layout-toggle-btn" title="切换布局">⊞</button>
        <div id="zoom-controls">
          <button id="zoom-out-btn" title="缩小">−</button>
          <span id="zoom-level">100%</span>
          <button id="zoom-in-btn" title="放大">+</button>
        </div>
      </div>
    </div>

    <!-- 地址栏 -->
    <div id="address-bar">
      <input type="text" id="url-input" placeholder="输入URL并按回车跳转...">
      <button id="go-btn" title="跳转">→</button>
    </div>

    <!-- 内容区域 -->
    <div id="content-area"></div>
  </div>

  <script src="js/storage.js"></script>
  <script src="js/tab-manager.js"></script>
  <script src="js/zoom.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: 验证文件结构**

```bash
ls -la
ls -la css/
ls -la js/
```

Expected: 看到index.html, css/, js/目录及所有文件

- [ ] **Step 5: 在浏览器中打开验证**

双击`index.html`打开，确认：
- 页面显示基本结构
- 控制台无JS错误（因为JS文件为空）
- 所有按钮可见

- [ ] **Step 6: 提交**

```bash
git add .
git commit -m "feat: create project structure and HTML skeleton"
```

---

### Task 2: 实现storage.js - localStorage管理

**Files:**
- Modify: `js/storage.js`

**Interfaces:**
- Produces:
  - `StorageManager.get(key)` - 获取数据
  - `StorageManager.set(key, value)` - 保存数据
  - `StorageManager.remove(key)` - 删除数据
  - `StorageManager.getState()` - 获取完整状态
  - `StorageManager.setState(state)` - 保存完整状态
  - `StorageManager.getDefaultState()` - 获取默认状态

- [ ] **Step 1: 编写StorageManager类**

```javascript
// js/storage.js
const StorageManager = {
  STORAGE_KEY: 'webweb_state',

  // 获取默认状态
  getDefaultState() {
    return {
      tabs: [],
      activeTabId: null,
      layout: 'top',
      globalZoom: 1.0
    };
  },

  // 获取localStorage中的数据
  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Storage get error:', e);
      return null;
    }
  },

  // 保存数据到localStorage
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage set error:', e);
      return false;
    }
  },

  // 删除localStorage中的数据
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('Storage remove error:', e);
      return false;
    }
  },

  // 获取完整应用状态
  getState() {
    const state = this.get(this.STORAGE_KEY);
    if (!state) {
      return this.getDefaultState();
    }
    // 合并默认状态，确保所有字段存在
    return { ...this.getDefaultState(), ...state };
  },

  // 保存完整应用状态
  setState(state) {
    return this.set(this.STORAGE_KEY, state);
  },

  // 清除所有数据
  clear() {
    return this.remove(this.STORAGE_KEY);
  }
};
```

- [ ] **Step 2: 在浏览器控制台测试**

打开`index.html`，在控制台执行：

```javascript
// 测试默认状态
console.log(StorageManager.getDefaultState());

// 测试保存和读取
StorageManager.set('test', { hello: 'world' });
console.log(StorageManager.get('test'));

// 测试状态管理
const state = StorageManager.getState();
console.log(state);

// 清理测试数据
StorageManager.remove('test');
```

Expected: 所有操作成功，无错误

- [ ] **Step 3: 提交**

```bash
git add js/storage.js
git commit -m "feat: implement StorageManager for localStorage"
```

---

### Task 3: 实现tab-manager.js - 标签页管理

**Files:**
- Modify: `js/tab-manager.js`

**Interfaces:**
- Consumes: `StorageManager.getState()`, `StorageManager.setState()`
- Produces:
  - `TabManager.createTab(url)` - 创建新标签页
  - `TabManager.closeTab(tabId)` - 关闭标签页
  - `TabManager.switchTab(tabId)` - 切换标签页
  - `TabManager.updateTabUrl(tabId, url)` - 更新标签URL
  - `TabManager.updateTabTitle(tabId, title)` - 更新标签标题
  - `TabManager.getActiveTab()` - 获取当前活跃标签
  - `TabManager.getAllTabs()` - 获取所有标签
  - `TabManager.renderTabs()` - 渲染标签UI

- [ ] **Step 1: 编写TabManager类**

```javascript
// js/tab-manager.js
const TabManager = {
  // 生成唯一ID
  generateId() {
    return 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  // 创建新标签页
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

  // 关闭标签页
  closeTab(tabId) {
    const state = StorageManager.getState();
    const tabIndex = state.tabs.findIndex(t => t.id === tabId);

    if (tabIndex === -1) return false;

    // 如果只有一个标签，不允许关闭
    if (state.tabs.length <= 1) {
      return false;
    }

    // 移除iframe
    const iframe = document.getElementById('iframe-' + tabId);
    if (iframe) {
      iframe.remove();
    }

    // 移除标签数据
    state.tabs.splice(tabIndex, 1);

    // 如果关闭的是当前活跃标签，切换到相邻标签
    if (state.activeTabId === tabId) {
      const newIndex = Math.min(tabIndex, state.tabs.length - 1);
      state.activeTabId = state.tabs[newIndex].id;
    }

    StorageManager.setState(state);
    this.renderTabs();
    this.switchTab(state.activeTabId);

    return true;
  },

  // 切换标签页
  switchTab(tabId) {
    const state = StorageManager.getState();
    const tab = state.tabs.find(t => t.id === tabId);

    if (!tab) return false;

    state.activeTabId = tabId;
    StorageManager.setState(state);

    // 隐藏所有iframe，显示目标iframe
    document.querySelectorAll('#content-area iframe').forEach(iframe => {
      iframe.style.display = 'none';
    });

    const targetIframe = document.getElementById('iframe-' + tabId);
    if (targetIframe) {
      targetIframe.style.display = 'block';
    }

    // 更新标签样式
    document.querySelectorAll('.tab').forEach(tabEl => {
      tabEl.classList.remove('active');
    });
    const activeTabEl = document.querySelector(`.tab[data-id="${tabId}"]`);
    if (activeTabEl) {
      activeTabEl.classList.add('active');
    }

    // 更新地址栏
    const urlInput = document.getElementById('url-input');
    if (urlInput) {
      urlInput.value = tab.url === 'about:blank' ? '' : tab.url;
    }

    // 更新缩放显示
    ZoomManager.updateZoomDisplay(tab.zoom);

    return true;
  },

  // 更新标签URL
  updateTabUrl(tabId, url) {
    const state = StorageManager.getState();
    const tab = state.tabs.find(t => t.id === tabId);

    if (!tab) return false;

    tab.url = url;
    StorageManager.setState(state);

    // 更新iframe src
    const iframe = document.getElementById('iframe-' + tabId);
    if (iframe) {
      iframe.src = url;
    }

    return true;
  },

  // 更新标签标题
  updateTabTitle(tabId, title) {
    const state = StorageManager.getState();
    const tab = state.tabs.find(t => t.id === tabId);

    if (!tab) return false;

    tab.title = title;
    StorageManager.setState(state);

    // 更新标签显示
    const tabEl = document.querySelector(`.tab[data-id="${tabId}"] .tab-title`);
    if (tabEl) {
      tabEl.textContent = title;
    }

    return true;
  },

  // 获取当前活跃标签
  getActiveTab() {
    const state = StorageManager.getState();
    return state.tabs.find(t => t.id === state.activeTabId) || null;
  },

  // 获取所有标签
  getAllTabs() {
    return StorageManager.getState().tabs;
  },

  // 创建iframe
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

    // 监听iframe加载完成，获取标题
    iframe.addEventListener('load', () => {
      try {
        const title = iframe.contentDocument?.title;
        if (title) {
          this.updateTabTitle(tab.id, title);
        }
      } catch (e) {
        // 跨域限制，无法获取标题
      }
    });

    return iframe;
  },

  // 渲染标签UI
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

      // 点击切换标签
      tabEl.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tab-close')) {
          this.switchTab(tab.id);
        }
      });

      // 点击关闭按钮
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
      });

      // 双击编辑URL
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

  // 初始化
  init() {
    const state = StorageManager.getState();

    // 如果没有标签，创建默认标签
    if (state.tabs.length === 0) {
      this.createTab();
    } else {
      // 恢复现有标签
      state.tabs.forEach(tab => {
        this.createIframe(tab);
      });
      this.renderTabs();
      this.switchTab(state.activeTabId);
    }
  }
};
```

- [ ] **Step 2: 在浏览器中测试**

打开`index.html`，在控制台执行：

```javascript
// 测试创建标签
TabManager.createTab('https://www.google.com');
TabManager.createTab('https://github.com');

// 测试获取标签
console.log(TabManager.getAllTabs());
console.log(TabManager.getActiveTab());

// 测试切换标签
TabManager.switchTab(TabManager.getAllTabs()[0].id);
```

Expected: 标签创建成功，切换正常，UI更新

- [ ] **Step 3: 提交**

```bash
git add js/tab-manager.js
git commit -m "feat: implement TabManager for tab CRUD operations"
```

---

### Task 4: 实现zoom.js - 缩放控制

**Files:**
- Modify: `js/zoom.js`

**Interfaces:**
- Consumes: `StorageManager.getState()`, `StorageManager.setState()`
- Produces:
  - `ZoomManager.zoomIn()` - 放大
  - `ZoomManager.zoomOut()` - 缩小
  - `ZoomManager.resetZoom()` - 重置缩放
  - `ZoomManager.setZoom(level)` - 设置缩放级别
  - `ZoomManager.getZoom()` - 获取当前缩放
  - `ZoomManager.updateZoomDisplay(zoom)` - 更新缩放显示

- [ ] **Step 1: 编写ZoomManager类**

```javascript
// js/zoom.js
const ZoomManager = {
  MIN_ZOOM: 0.3,
  MAX_ZOOM: 3.0,
  ZOOM_STEP: 0.1,

  // 放大
  zoomIn() {
    const currentZoom = this.getZoom();
    const newZoom = Math.min(currentZoom + this.ZOOM_STEP, this.MAX_ZOOM);
    this.setZoom(newZoom);
  },

  // 缩小
  zoomOut() {
    const currentZoom = this.getZoom();
    const newZoom = Math.max(currentZoom - this.ZOOM_STEP, this.MIN_ZOOM);
    this.setZoom(newZoom);
  },

  // 重置缩放
  resetZoom() {
    this.setZoom(1.0);
  },

  // 设置缩放级别
  setZoom(level) {
    const state = StorageManager.getState();
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);

    if (!activeTab) return false;

    activeTab.zoom = level;
    StorageManager.setState(state);

    // 应用缩放到iframe
    const iframe = document.getElementById('iframe-' + activeTab.id);
    if (iframe) {
      iframe.style.transform = `scale(${level})`;
      iframe.style.transformOrigin = 'top left';
      iframe.style.width = `${100 / level}%`;
      iframe.style.height = `${100 / level}%`;
    }

    // 更新显示
    this.updateZoomDisplay(level);

    return true;
  },

  // 获取当前缩放
  getZoom() {
    const state = StorageManager.getState();
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    return activeTab ? activeTab.zoom : 1.0;
  },

  // 更新缩放显示
  updateZoomDisplay(zoom) {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
      zoomLevel.textContent = Math.round(zoom * 100) + '%';
    }
  },

  // 初始化
  init() {
    const zoom = this.getZoom();
    this.updateZoomDisplay(zoom);

    // 应用当前活跃标签的缩放
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
```

- [ ] **Step 2: 在浏览器中测试**

打开`index.html`，在控制台执行：

```javascript
// 测试缩放
ZoomManager.zoomIn();
console.log(ZoomManager.getZoom());

ZoomManager.zoomOut();
console.log(ZoomManager.getZoom());

ZoomManager.resetZoom();
console.log(ZoomManager.getZoom());
```

Expected: 缩放级别变化，显示更新

- [ ] **Step 3: 提交**

```bash
git add js/zoom.js
git commit -m "feat: implement ZoomManager for iframe zoom control"
```

---

### Task 5: 实现app.js - 主应用逻辑

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `StorageManager`, `TabManager`, `ZoomManager`
- Produces: 应用初始化，事件绑定，布局切换

- [ ] **Step 1: 编写App类**

```javascript
// js/app.js
const App = {
  // 初始化应用
  init() {
    // 初始化标签管理器
    TabManager.init();

    // 初始化缩放管理器
    ZoomManager.init();

    // 绑定事件
    this.bindEvents();

    // 恢复布局
    this.restoreLayout();

    console.log('WebWeb Browser initialized');
  },

  // 绑定所有事件
  bindEvents() {
    // 新建标签按钮
    document.getElementById('new-tab-btn').addEventListener('click', () => {
      TabManager.createTab();
      document.getElementById('url-input').focus();
    });

    // 地址栏回车跳转
    document.getElementById('url-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.navigateToUrl();
      }
    });

    // 跳转按钮
    document.getElementById('go-btn').addEventListener('click', () => {
      this.navigateToUrl();
    });

    // 缩放按钮
    document.getElementById('zoom-in-btn').addEventListener('click', () => {
      ZoomManager.zoomIn();
    });

    document.getElementById('zoom-out-btn').addEventListener('click', () => {
      ZoomManager.zoomOut();
    });

    // 布局切换按钮
    document.getElementById('layout-toggle-btn').addEventListener('click', () => {
      this.toggleLayout();
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      // Ctrl+T: 新建标签
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        TabManager.createTab();
        document.getElementById('url-input').focus();
      }

      // Ctrl+W: 关闭标签
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        const activeTab = TabManager.getActiveTab();
        if (activeTab) {
          TabManager.closeTab(activeTab.id);
        }
      }

      // Ctrl+Plus: 放大
      if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        ZoomManager.zoomIn();
      }

      // Ctrl+Minus: 缩小
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        ZoomManager.zoomOut();
      }

      // Ctrl+0: 重置缩放
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        ZoomManager.resetZoom();
      }
    });

    // 页面关闭前保存状态
    window.addEventListener('beforeunload', () => {
      // 状态已经在各操作中保存，这里可以做清理工作
    });
  },

  // 导航到URL
  navigateToUrl() {
    const urlInput = document.getElementById('url-input');
    let url = urlInput.value.trim();

    if (!url) return;

    // 自动添加https://前缀
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      url = 'https://' + url;
    }

    const activeTab = TabManager.getActiveTab();
    if (activeTab) {
      TabManager.updateTabUrl(activeTab.id, url);
      TabManager.updateTabTitle(activeTab.id, url);
    }
  },

  // 切换布局
  toggleLayout() {
    const state = StorageManager.getState();
    const newLayout = state.layout === 'top' ? 'left' : 'top';
    state.layout = newLayout;
    StorageManager.setState(state);

    this.applyLayout(newLayout);
  },

  // 应用布局
  applyLayout(layout) {
    const browser = document.getElementById('browser');
    browser.className = 'layout-' + layout;

    // 更新布局切换按钮图标
    const toggleBtn = document.getElementById('layout-toggle-btn');
    toggleBtn.textContent = layout === 'top' ? '⊟' : '⊞';
  },

  // 恢复布局
  restoreLayout() {
    const state = StorageManager.getState();
    this.applyLayout(state.layout);
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
```

- [ ] **Step 2: 在浏览器中测试**

打开`index.html`，测试：
- 点击`[+]`新建标签
- 输入URL回车跳转
- 点击缩放按钮
- 点击布局切换按钮
- 使用键盘快捷键

Expected: 所有功能正常工作

- [ ] **Step 3: 提交**

```bash
git add js/app.js
git commit -m "feat: implement App main logic with events and layout"
```

---

### Task 6: 创建CSS样式

**Files:**
- Modify: `css/style.css`

**Interfaces:**
- Produces: 所有视觉样式，布局切换样式

- [ ] **Step 1: 编写完整CSS**

```css
/* css/style.css */

/* CSS变量 */
:root {
  --color-black: #000;
  --color-white: #fff;
  --color-light-gray: #f5f5f5;
  --color-gray: #ccc;
  --color-dark-gray: #333;
  --border: 1px solid var(--color-gray);
}

/* 重置样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--color-light-gray);
  height: 100vh;
  overflow: hidden;
}

/* 浏览器容器 */
#browser {
  display: flex;
  height: 100vh;
  background: var(--color-white);
}

/* 顶部布局 */
.layout-top {
  flex-direction: column;
}

.layout-top #tab-bar {
  display: flex;
  align-items: center;
  border-bottom: var(--border);
  background: var(--color-light-gray);
  padding: 4px;
  min-height: 36px;
}

.layout-top #tabs-container {
  display: flex;
  flex: 1;
  overflow-x: auto;
  gap: 2px;
}

.layout-top #address-bar {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border-bottom: var(--border);
  background: var(--color-white);
}

.layout-top #content-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* 左侧布局 */
.layout-left {
  flex-direction: row;
}

.layout-left #tab-bar {
  display: flex;
  flex-direction: column;
  width: 150px;
  border-right: var(--border);
  background: var(--color-light-gray);
  padding: 4px;
}

.layout-left #tabs-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  gap: 2px;
}

.layout-left #address-bar {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border-bottom: var(--border);
  background: var(--color-white);
}

.layout-left #content-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.layout-left .address-bar-wrapper {
  order: -1;
}

/* 新建标签按钮 */
#new-tab-btn {
  background: var(--color-white);
  border: var(--border);
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

#new-tab-btn:hover {
  background: var(--color-light-gray);
}

/* 标签样式 */
.tab {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background: var(--color-white);
  border: var(--border);
  cursor: pointer;
  min-width: 80px;
  max-width: 150px;
  height: 28px;
  flex-shrink: 0;
}

.tab:hover {
  background: var(--color-light-gray);
}

.tab.active {
  background: var(--color-white);
  border-bottom-color: var(--color-white);
}

.layout-top .tab.active {
  margin-bottom: -1px;
  padding-bottom: 5px;
}

.layout-left .tab.active {
  margin-right: -1px;
  padding-right: 9px;
}

.tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.tab-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 2px;
  font-size: 14px;
  color: var(--color-dark-gray);
  margin-left: 4px;
}

.tab-close:hover {
  color: var(--color-black);
}

/* 控制按钮区域 */
#controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding: 0 4px;
}

.layout-left #controls {
  margin-left: 0;
  margin-top: auto;
  flex-direction: column;
  padding: 4px;
}

/* 布局切换按钮 */
#layout-toggle-btn {
  background: var(--color-white);
  border: var(--border);
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#layout-toggle-btn:hover {
  background: var(--color-light-gray);
}

/* 缩放控制 */
#zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.layout-left #zoom-controls {
  flex-direction: column;
}

#zoom-out-btn,
#zoom-in-btn {
  background: var(--color-white);
  border: var(--border);
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

#zoom-out-btn:hover,
#zoom-in-btn:hover {
  background: var(--color-light-gray);
}

#zoom-level {
  font-size: 12px;
  min-width: 35px;
  text-align: center;
}

/* 地址栏 */
#url-input {
  flex: 1;
  border: var(--border);
  padding: 4px 8px;
  font-size: 13px;
  outline: none;
}

#url-input:focus {
  border-color: var(--color-dark-gray);
}

#go-btn {
  background: var(--color-white);
  border: var(--border);
  padding: 4px 12px;
  cursor: pointer;
  font-size: 14px;
  margin-left: 4px;
}

#go-btn:hover {
  background: var(--color-light-gray);
}

/* 内容区域 */
#content-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

#content-area iframe {
  position: absolute;
  top: 0;
  left: 0;
  border: none;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .layout-left #tab-bar {
    width: 100px;
  }

  .tab {
    min-width: 60px;
    max-width: 100px;
  }
}
```

- [ ] **Step 2: 在浏览器中测试**

打开`index.html`，确认：
- 黑白配色正确
- 无圆角、无阴影
- 顶部布局正常显示
- 点击布局切换按钮，左侧布局正常显示
- 标签页切换样式正确
- 地址栏和按钮样式正确

- [ ] **Step 3: 提交**

```bash
git add css/style.css
git commit -m "feat: implement CSS styles with top/left layouts"
```

---

### Task 7: 集成测试和最终验证

**Files:**
- 无新文件

**Interfaces:**
- 完整功能测试

- [ ] **Step 1: 测试标签页管理**

1. 打开`index.html`
2. 点击`[+]`新建3个标签
3. 输入不同URL并跳转
4. 切换不同标签
5. 关闭标签（保留最后一个）
6. 双击标签测试URL编辑

Expected: 所有操作正常，状态正确保存

- [ ] **Step 2: 测试布局切换**

1. 点击布局切换按钮
2. 确认切换到左侧布局
3. 再次点击，切换回顶部布局
4. 刷新页面，确认布局保持

Expected: 布局切换流畅，状态持久化

- [ ] **Step 3: 测试缩放功能**

1. 点击放大按钮，确认缩放增加
2. 点击缩小按钮，确认缩放减少
3. 切换标签，确认每个标签独立缩放
4. 刷新页面，确认缩放级别保持

Expected: 缩放正常，独立保存

- [ ] **Step 4: 测试键盘快捷键**

1. Ctrl+T：新建标签
2. Ctrl+W：关闭标签
3. Ctrl++：放大
4. Ctrl+-：缩小
5. Ctrl+0：重置缩放

Expected: 所有快捷键正常工作

- [ ] **Step 5: 测试localStorage持久化**

1. 创建几个标签页
2. 设置不同的缩放级别
3. 切换布局
4. 关闭浏览器
5. 重新打开`index.html`

Expected: 所有状态完全恢复

- [ ] **Step 6: 测试iframe功能**

1. 访问https://www.google.com
2. 访问https://github.com
3. 测试页面交互（点击、滚动等）

Expected: iframe正常加载，页面可交互

- [ ] **Step 7: 最终提交**

```bash
git add .
git commit -m "feat: complete WebWeb Browser implementation"
```

---

## Spec Coverage Check

- ✅ 标签页增减：Task 3
- ✅ 标签页编辑（URL）：Task 3
- ✅ 标签页切换：Task 3
- ✅ 状态持久化（localStorage）：Task 2, 3, 4
- ✅ 网页缩放：Task 4
- ✅ 布局切换（顶部/左侧）：Task 5
- ✅ 极简黑白UI：Task 6
- ✅ 无沙箱完全浏览器行为：Task 1 (iframe无sandbox属性)
- ✅ 键盘快捷键：Task 5
- ✅ 错误处理：Task 3 (URL自动补全)
- ✅ 性能优化：Task 3 (iframe管理)

所有规格要求均已覆盖喵！
