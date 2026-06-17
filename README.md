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
- 🔗 CORS代理：通过代理绕过跨域限制
- ⚙️ 代理设置：可配置代理地址、启用/禁用代理

## 使用方法

### 基本使用
直接打开 `index.html` 即可使用。

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

本地代理服务器会自动检测并优先使用，外部代理作为备用。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+T` | 新建标签 |
| `Ctrl+W` | 关闭标签 |
| `Ctrl++` | 放大 |
| `Ctrl+-` | 缩小 |
| `Ctrl+0` | 重置缩放 |

## 代理设置

点击地址栏右侧的 ⚙ 按钮打开设置：

- **启用代理**：通过代理服务器访问网页，绕过跨域限制
- **禁用代理**：直接访问网页，可能遇到跨域问题
- **自定义代理地址**：支持任何兼容的CORS代理服务
- **测试代理**：检查代理连接是否正常

### 代理地址格式

| 代理类型 | 地址格式 |
|----------|----------|
| 本地代理 | `http://localhost:8088/?url=` |
| corsproxy.io | `https://corsproxy.io/?` |
| allorigins | `https://api.allorigins.win/raw?url=` |

## 技术栈

- 纯HTML/CSS/JavaScript
- 无依赖，无构建工具
- localStorage持久化
- Node.js（可选，用于本地代理服务器）

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
```

## 许可证

MIT
