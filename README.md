# WebWeb Browser

一个基于iframe的浏览器标签页模拟系统，用于个人本地日常使用。

## 功能特性

- 🏷️ 标签页管理：新建、关闭、切换、编辑URL
- 📐 布局切换：顶部标签栏 / 左侧标签栏
- 🔍 网页缩放：独立缩放级别（0.3x - 3.0x）
- 💾 状态持久化：localStorage保存所有状态
- 🌐 完全浏览器行为：无沙箱限制
- 🎨 现代极简UI：Google风格配色、圆角输入框、平滑过渡
- ⌨️ 键盘快捷键：Ctrl+T/W/+/-/0
- 🔗 Service Worker代理：自动绕过跨域限制，无需额外配置

## 使用方法

直接打开 `index.html` 即可使用（需要通过 HTTP 服务器访问，不能直接双击打开）。

推荐使用 Python 快速启动：
```bash
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+T` | 新建标签 |
| `Ctrl+W` | 关闭标签 |
| `Ctrl++` | 放大 |
| `Ctrl+-` | 缩小 |
| `Ctrl+0` | 重置缩放 |

## 代理系统

WebWeb 使用 Service Worker 实现代理功能，无需启动额外的服务器。

### 工作原理

1. Service Worker 拦截 iframe 中的请求
2. 剔除安全限制头部（X-Frame-Options, CSP 等）
3. 添加 CORS 头部（Access-Control-Allow-Origin: *）
4. 返回修改后的响应

### 优势

- 纯客户端实现，无需 Node.js
- 无需外部代理服务
- 自动剔除跨域限制
- 现代浏览器原生支持

### 限制

- 需要 HTTPS 或 localhost
- 仅支持现代浏览器

## 技术栈

- 纯HTML/CSS/JavaScript
- Service Worker（代理功能）
- 无依赖，无构建工具
- localStorage持久化

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
```

## 许可证

MIT
