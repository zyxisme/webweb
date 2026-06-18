# WebWeb Browser

一个基于iframe的浏览器标签页模拟系统，用于个人本地日常使用。

## 项目结构

```
webweb/
├── Cargo.toml          # Rust项目配置
├── src/
│   ├── main.rs         # 入口点，CLI解析，服务器启动
│   ├── proxy.rs        # 代理处理器（请求转发，头部过滤）
│   └── static_files.rs # 静态文件服务（rust-embed）
├── static/
│   ├── index.html      # 主页面
│   ├── sw.js           # Service Worker（URL重写）
│   ├── css/
│   │   └── style.css   # 样式文件
│   └── js/
│       ├── storage.js      # localStorage管理
│       ├── proxy.js        # Service Worker代理管理
│       ├── tab-manager.js  # 标签页CRUD
│       ├── zoom.js         # 缩放控制
│       └── app.js          # 主应用逻辑
├── build.sh            # 跨平台构建脚本
└── docs/
    └── superpowers/
        ├── specs/      # 设计文档
        └── plans/      # 实现计划
```

## Rust Backend

webweb 使用 Rust 后端提供静态文件服务和代理功能。

### 运行

```bash
cargo run
# 或指定端口
./target/release/webweb -b 0.0.0.0:7899
```

### 构建

```bash
cargo build --release
```

### 架构

- `src/main.rs` - 入口点，CLI解析，服务器启动
- `src/proxy.rs` - 代理处理器（请求转发，头部过滤）
- `src/static_files.rs` - 静态文件服务（rust-embed编译时嵌入）
- `static/` - 前端文件（编译时嵌入二进制）
- `sw.js` - 最小化Service Worker（仅URL重写）

## 技术栈

- Rust + Axum（后端）
- HTML/CSS/JavaScript（前端）
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
- `buildProxyUrl(url)`：构建代理 URL（`/proxy?url=ENCODED_URL`）
- `loadPage(iframe, url)`：通过代理加载页面到 iframe
- `extractDomain(url)`：从 URL 提取域名

### Service Worker (sw.js)
- 最小化 Service Worker，仅做 URL 重写
- 将页面内的子请求重写到 `/proxy?url=` 路径
- 头部过滤和 CORS 处理由 Rust 后端负责

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
- Rust 后端已取代纯前端 Service Worker 方案

## Rust 开发命令

```bash
# 运行测试
cargo test

# 检查编译
cargo check

# 构建发布版本
cargo build --release
```

## 重要架构决策

- **Cargo.lock 版本控制**：二进制 crate 应该提交 Cargo.lock 以确保可复现构建
- **SSRF 保护**：代理拒绝私有 IP 地址（10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x）
- **共享 HTTP 客户端**：使用 `axum::Extension` 共享 `reqwest::Client` 实例以提高性能
- **CORS 头部**：所有代理响应都包含 `access-control-allow-origin: *`

## 使用方式

```bash
# 开发模式
cargo run

# 生产构建
cargo build --release
./target/release/webweb

# 访问
open http://localhost:7899
```

## 技术笔记

- Git推送使用SSH：`git@github.com:zyxisme/webweb.git`（HTTPS认证不可用）
- Favicon服务：`https://www.google.com/s2/favicons?domain=DOMAIN&sz=32`
- **Rust代理**：Axum处理器在服务端转发请求，剔除安全头部并添加CORS头部
- 代理URL格式：`/proxy?url=ENCODED_URL`（查询参数方式）
- Service Worker仅做URL重写，将页面内的子请求重写到`/proxy?url=`路径
- iframe 使用 `src` 属性加载代理 URL（非 srcdoc）
- iframe `load` 事件用于同步地址栏（解析代理URL获取原始 URL）
- 地址栏始终在顶部（#address-bar在#main-area外层）
- 布局类：`.layout-top` / `.layout-left` / `.collapsed` 均在#browser元素上
- JS加载顺序：storage.js → proxy.js → tab-manager.js → zoom.js → app.js
- proxy.js必须在tab-manager.js之前加载（TabManager依赖ProxyManager）
- 默认端口：7899（可通过 `-b` 参数自定义）

## 快捷键

- `Ctrl+T`：新建标签
- `Ctrl+W`：关闭标签
- `Ctrl++`：放大
- `Ctrl+-`：缩小
- `Ctrl+0`：重置缩放
