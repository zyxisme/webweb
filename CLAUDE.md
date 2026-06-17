# WebWeb Browser

一个基于iframe的浏览器标签页模拟系统，用于个人本地日常使用。

## 项目结构

```
webweb/
├── index.html          # 主页面
├── server.js           # 本地CORS代理服务器（可选）
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── storage.js      # localStorage管理
│   ├── proxy.js        # CORS代理和URL重写
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
11. CORS代理：通过代理绕过跨域限制，地址栏实时跟随页面导航
12. 代理设置：可配置代理地址、启用/禁用代理、测试代理连接

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

### ProxyManager
- `corsProxy`：当前使用的代理地址（getter，从设置读取）
- `isProxyEnabled`：代理是否启用（getter）
- `init()`：初始化代理管理器，自动检测最佳代理
- `testProxy()`：测试代理连接，返回可用状态
- `updateSettings(settings)`：更新代理设置
- `fetchPage(url)`：通过代理获取页面（带fallback机制）
- `rewriteHtml(html, baseUrl)`：重写HTML中的URL并注入导航追踪
  - 支持的属性：`src`、`href`、`action`、`srcset`、`poster`
  - 支持的CSS：`url()`、`@import`
  - 自动添加`<base>`标签处理相对路径
  - **JavaScript API拦截**：自动重写动态加载的资源
    - `fetch()` API
    - `XMLHttpRequest`
    - `Image` 构造函数
    - `document.createElement()` (script, link, img, video, audio, source, iframe)
    - 动态样式 `style` 属性
    - `CSSStyleSheet.insertRule()`
- `loadPage(iframe, url)`：加载页面到iframe
- `extractTitle(html)`：从HTML中提取标题

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
- `openSettings()` / `closeSettings()` / `updateProxySettings()` / `testProxy()`

## 开发注意事项

- 用户偏好：简洁直接的回复，避免冗长的技术解释
- 偏好前端方案：优先使用纯JavaScript实现，避免引入服务器依赖

## 使用方式

### 基本使用
双击 `index.html` 即可使用。

### 推荐：启动本地代理服务器（更稳定）
```bash
node server.js
```

代理服务器支持命令行参数：
```bash
node server.js --host <ip> --port <port>
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--host` | 监听IP地址 | `0.0.0.0` |
| `--port` | 监听端口 | `8088` |

示例：
```bash
node server.js                              # 监听 0.0.0.0:8088
node server.js --port 9090                  # 监听 0.0.0.0:9090
node server.js --host 127.0.0.1             # 监听 127.0.0.1:8088
node server.js --host 127.0.0.1 --port 9090 # 监听 127.0.0.1:9090
```

本地代理服务器会自动检测并优先使用，外部代理作为备用。

## 技术笔记

- Git推送使用SSH：`git@github.com:zyxisme/webweb.git`（HTTPS认证不可用）
- Favicon服务：`https://www.google.com/s2/favicons?domain=DOMAIN&sz=32`
- 使用CORS代理绕过跨域限制，支持本地代理和外部代理fallback
- 通过fetch获取页面，重写URL后注入iframe（srcdoc）
- 注入脚本拦截链接点击，通过postMessage通知父页面导航
- 地址栏始终在顶部（#address-bar在#main-area外层）
- 布局类：`.layout-top` / `.layout-left` / `.collapsed` 均在#browser元素上
- CORS代理URL格式：
  - 本地代理：`http://localhost:8088/?url=ENCODED_URL`
  - 外部代理：`https://corsproxy.io/?ENCODED_URL`
- srcdoc注入时必须在</head>前注入追踪脚本
- postMessage消息类型：`webweb-navigate`
- JS加载顺序：storage.js → proxy.js → tab-manager.js → zoom.js → app.js
- proxy.js必须在tab-manager.js之前加载（TabManager依赖ProxyManager）
- URL重写支持：src/href/action/srcset/poster属性，CSS url()和@import
- CSS @import必须在CSS url()之前处理，避免双重代理
- 使用负向后视表达式 `(?<!@import\s)url\(...)` 排除已处理的@import
- **JavaScript API拦截**：在iframe中注入脚本重写所有网络API
  - 拦截fetch、XMLHttpRequest、Image、document.createElement等
  - 动态样式和CSSStyleSheet.insertRule也被拦截
  - 确保JavaScript动态加载的资源也通过代理

## 快捷键

- `Ctrl+T`：新建标签
- `Ctrl+W`：关闭标签
- `Ctrl++`：放大
- `Ctrl+-`：缩小
- `Ctrl+0`：重置缩放
