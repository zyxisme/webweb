# WebWeb Browser

一个基于iframe的浏览器标签页模拟系统，用于个人本地日常使用。

## 项目结构

```
webweb/
├── index.html          # 主页面
├── sw.js               # Service Worker（代理功能）
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── storage.js      # localStorage管理
│   ├── proxy.js        # Service Worker代理管理
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
- 无构建工具，需要通过 HTTP 服务器访问（Service Worker 要求）
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
11. Service Worker代理：自动绕过跨域限制，无需额外服务器或配置

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
- `init()`：注册 Service Worker 并等待激活
- `buildProxyUrl(url)`：构建代理 URL（`/proxy/ENCODED_URL`）
- `loadPage(iframe, url)`：通过 Service Worker 代理加载页面到 iframe
- `testProxy()`：测试代理连接状态
- `updateSettings(settings)`：更新代理设置
- `extractDomain(url)`：从 URL 提取域名

### Service Worker (sw.js)
- 拦截 `/proxy/*` 路径的请求
- 剔除安全限制头部（X-Frame-Options, CSP 等）
- 添加 CORS 头部（Access-Control-Allow-Origin: *）
- 处理导航请求（链接点击、表单提交）

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
- `openSettings()` / `closeSettings()`

## 开发注意事项

- 用户偏好：简洁直接的回复，避免冗长的技术解释
- 偏好前端方案：优先使用纯JavaScript实现，避免引入服务器依赖
- Service Worker 代理已取代 Node.js 服务器方案，无需 `server.js`

## 使用方式

通过 HTTP 服务器访问 `index.html`（Service Worker 需要 HTTPS 或 localhost）。

推荐使用 Python 快速启动：
```bash
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`。

## 技术笔记

- Git推送使用SSH：`git@github.com:zyxisme/webweb.git`（HTTPS认证不可用）
- Favicon服务：`https://www.google.com/s2/favicons?domain=DOMAIN&sz=32`
- **Service Worker代理**：通过 `sw.js` 拦截 `/proxy/*` 请求，剔除安全头部并添加 CORS 头部
- 代理URL格式：`/proxy/ENCODED_URL`（相对于当前 origin）
- Service Worker 自动处理导航请求（链接点击、表单提交）
- iframe 使用 `src` 属性加载代理 URL（非 srcdoc）
- iframe `load` 事件用于同步地址栏（解析 `/proxy/ENCODED_URL` 获取原始 URL）
- 地址栏始终在顶部（#address-bar在#main-area外层）
- 布局类：`.layout-top` / `.layout-left` / `.collapsed` 均在#browser元素上
- JS加载顺序：storage.js → proxy.js → tab-manager.js → zoom.js → app.js
- proxy.js必须在tab-manager.js之前加载（TabManager依赖ProxyManager）
- Service Worker 需要 HTTPS 或 localhost 环境

## 快捷键

- `Ctrl+T`：新建标签
- `Ctrl+W`：关闭标签
- `Ctrl++`：放大
- `Ctrl+-`：缩小
- `Ctrl+0`：重置缩放
