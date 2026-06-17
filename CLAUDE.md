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
6. 极简UI：黑白配色，无圆角，无阴影
7. 键盘快捷键：Ctrl+T/W/+/-/0

## 设计规范

- 颜色：纯黑(#000)、纯白(#fff)、浅灰(#f5f5f5)、深灰(#333)
- 圆角：无，全部直角
- 边框：1px solid #ccc
- 字体：系统默认字体
- 阴影：无

## 模块接口

### StorageManager
- `get(key)` / `set(key, value)` / `remove(key)`
- `getState()` / `setState(state)`
- `getDefaultState()` / `clear()`

### TabManager
- `createTab(url)` / `closeTab(tabId)` / `switchTab(tabId)`
- `updateTabUrl(tabId, url)` / `updateTabTitle(tabId, title)`
- `getActiveTab()` / `getAllTabs()` / `renderTabs()`

### ZoomManager
- `zoomIn()` / `zoomOut()` / `resetZoom()`
- `setZoom(level)` / `getZoom()` / `updateZoomDisplay(zoom)`

### App
- `init()` / `bindEvents()` / `navigateToUrl()`
- `toggleLayout()` / `applyLayout(layout)` / `restoreLayout()`

## 使用方式

双击 `index.html` 即可使用，无需服务器。

## 快捷键

- `Ctrl+T`：新建标签
- `Ctrl+W`：关闭标签
- `Ctrl++`：放大
- `Ctrl+-`：缩小
- `Ctrl+0`：重置缩放
