# WebWeb Browser

一个基于iframe的浏览器标签页模拟系统，用于个人本地日常使用。

## 项目结构

```
webweb/
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── storage.js      # localStorage管理
│   ├── tab-manager.js  # 标签页CRUD
│   ├── zoom.js         # 缩放控制
│   └── app.js          # 主应用逻辑
└── docs/
    └── superpowers/
        ├── specs/      # 设计文档
        └── plans/      # 实现计划
```

## 技术栈

- 纯HTML/CSS/JavaScript
- 无构建工具，双击index.html直接使用
- localStorage持久化状态

## 核心功能

1. 标签页管理：新建、关闭、切换、编辑URL
2. 布局切换：顶部标签栏 / 左侧标签栏
3. 网页缩放：独立缩放级别（0.3x - 3.0x）
4. 状态持久化：localStorage保存所有状态
5. 完全浏览器行为：无沙箱限制
6. 现代极简UI：Google风格配色、圆角输入框、平滑过渡
7. 键盘快捷键：Ctrl+T/W/+/-/0
8. Favicon显示：标签页显示网站图标
9. 浏览器标题跟随：标题和favicon实时跟随活跃标签页
10. 可折叠侧边栏：左侧布局支持折叠，只显示favicon

## 设计规范

- 颜色：Google风格（#202124文字、#5f6368次要、#1a73e8强调、#f8f9fa背景）
- 圆角：输入框20px、按钮6px、标签6px
- 边框：1px solid #dadce0
- 字体：system-ui, -apple-system, sans-serif
- 阴影：无（仅输入框聚焦时有蓝色边框）
- 过渡动画：0.15s ease（快速）、0.25s ease（常规）

## 模块接口

### StorageManager
- `get(key)` / `set(key, value)` / `remove(key)`
- `getState()` / `setState(state)`
- `getDefaultState()` / `clear()`

### TabManager
- `createTab(url)` / `closeTab(tabId)` / `switchTab(tabId)`
- `updateTabUrl(tabId, url)` / `updateTabTitle(tabId, title)`
- `updateBrowserChrome(tab)` / `updateTabFavicon(tabId, url)`
- `getActiveTab()` / `getAllTabs()` / `renderTabs()`

### ZoomManager
- `zoomIn()` / `zoomOut()` / `resetZoom()`
- `setZoom(level)` / `getZoom()` / `updateZoomDisplay(zoom)`

### App
- `init()` / `bindEvents()` / `navigateToUrl()`
- `toggleLayout()` / `applyLayout(layout)` / `restoreLayout()`

## 使用方式

双击 `index.html` 即可使用，无需服务器。

## 技术笔记

- Git推送使用SSH：`git@github.com:zyxisme/webweb.git`（HTTPS认证不可靠）
- Favicon服务：`https://www.google.com/s2/favicons?domain=DOMAIN&sz=32`
- 跨域iframe无法读取title/URL，回退使用hostname作为标题
- 地址栏始终在顶部（#address-bar在#main-area外层）
- 布局类：`.layout-top` / `.layout-left` / `.collapsed` 均在#browser元素上

## 快捷键

- `Ctrl+T`：新建标签
- `Ctrl+W`：关闭标签
- `Ctrl++`：放大
- `Ctrl+-`：缩小
- `Ctrl+0`：重置缩放
