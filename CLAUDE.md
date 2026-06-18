# WebWeb Browser

一个基于 Canvas 渲染的浏览器标签页系统，使用 headless Chrome 后端。

## 项目结构

```
webweb/
├── Cargo.toml          # Rust项目配置
├── src/
│   ├── main.rs         # 入口点，CLI解析，服务器启动
│   ├── browser.rs      # Chrome 浏览器管理器（chromiumoxide）
│   ├── dom.rs          # DOM 提取器（CDP DOM.getDocument）
│   ├── ws.rs           # WebSocket 处理器
│   └── static_files.rs # 静态文件服务（rust-embed）
├── static/
│   ├── index.html      # 主页面
│   ├── css/
│   │   └── style.css   # 样式文件
│   └── js/
│       ├── storage.js      # localStorage管理
│       ├── ws-client.js    # WebSocket 客户端
│       ├── canvas-renderer.js # Canvas 渲染器
│       ├── tab-manager.js  # 标签页CRUD
│       ├── zoom.js         # 缩放控制
│       └── app.js          # 主应用逻辑
├── build.sh            # 跨平台构建脚本
└── docs/
    └── superpowers/
        ├── specs/      # 设计文档
        └── plans/      # 实现计划
```

## 架构

```
┌─────────────────┐         WebSocket         ┌─────────────────┐
│   Frontend      │ ◄──────────────────────► │   Backend       │
│   (Canvas 2D)   │                           │   (Rust/Axum)   │
└─────────────────┘                           └─────────────────┘
                                                      │
                                                      ▼
                                              ┌─────────────────┐
                                              │   chromiumoxide │
                                              │   (Headless     │
                                              │    Chrome)      │
                                              └─────────────────┘
```

- `src/browser.rs` - Chrome 浏览器管理器（chromiumoxide）
- `src/dom.rs` - DOM 提取器（JS 评估获取 DOM + 样式 + 布局）
- `src/ws.rs` - WebSocket 处理器（事件转发）
- `src/static_files.rs` - 静态文件服务（rust-embed编译时嵌入）
- `static/js/canvas-renderer.js` - Canvas 渲染器
- `static/js/ws-client.js` - WebSocket 客户端

## 技术栈

- Rust + Axum（后端）
- chromiumoxide（Chrome DevTools Protocol 客户端）
- WebSocket（实时双向通信）
- HTML/CSS/JavaScript（前端）
- Canvas 2D API（DOM 渲染）
- localStorage持久化状态

## 核心功能

1. 标签页管理：新建、关闭、切换、编辑URL
2. Canvas 渲染：DOM 序列化 + Canvas 重绘
3. 实时通信：WebSocket 双向通信
4. 事件转发：鼠标、键盘、滚动事件通过 CDP 转发
5. 键盘快捷键：Ctrl+T/W/+/-/0
6. 状态持久化：localStorage保存所有状态

## Rust Backend

webweb 使用 Rust 后端提供静态文件服务和 headless Chrome 管理。

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

## 开发注意事项

- 用户偏好：简洁直接的回复，避免冗长的技术解释
- 偏好 Subagent-Driven Development 执行复杂任务
- Chrome/Chromium 必须安装在系统上
- chromiumoxide 需要 `--no-sandbox` 参数（Linux 环境）

## chromiumoxide API 注意事项

- `page.get_document()` 不接受参数
- `NodeId` 使用 `.inner()` 方法获取 i64 值
- `node_type` 是 `i64` 不是 `u32`
- `node_value` 是 `String` 不是 `Option<String>`
- 导入路径：`chromiumoxide::cdp::browser_protocol::dom::Node`
- 使用 CDP 原生事件（DispatchMouseEvent/DispatchKeyEvent）优于 JavaScript 评估
- `page.evaluate()` 返回 `Result<EvaluationResult>`，用 `.value()` 获取 `Option<&serde_json::Value>`
- `page.url()` 和 `page.get_title()` 都返回 `Result<Option<String>>`
- `handle_message` 返回 `Vec<ServerMessage>` 支持单次请求多条响应

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
- **Canvas 渲染**：DOM 序列化 + Canvas 重绘，不使用 iframe
- **WebSocket 通信**：实时双向通信，JSON 消息格式
- **CDP 事件转发**：使用原生 CDP 事件而非 JavaScript 评估
- **DOM 提取**：使用 JS 评估一次性获取 DOM 树 + 计算样式 + 布局，避免逐节点 CDP 调用

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
- 默认端口：7899（可通过 `-b` 参数自定义）
- Canvas 渲染限制：不支持自动换行，简化渲染
- WebSocket 消息格式：JSON，使用 `serde(tag = "type")` 判别

## JavaScript ES 模块注意事项

- `storage.js`、`tab-manager.js`、`zoom.js` 导出的是普通对象（单例），不是 class，不要用 `new`
- ES 模块必须显式 import 依赖，没有隐式全局变量
- `tabManager.createTab()` 返回 tab ID 字符串，不是完整的 tab 对象
- JS 中 CSS 属性用 camelCase（`marginTop`），不是 kebab-case（`margin-top`）
- `getBoundingClientRect()` 返回视口相对坐标，需要加 `scrollX/scrollY` 转为页面绝对坐标

## 快捷键

- `Ctrl+T`：新建标签
- `Ctrl+W`：关闭标签
- `Ctrl++`：放大
- `Ctrl+-`：缩小
- `Ctrl+0`：重置缩放
