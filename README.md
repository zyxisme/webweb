# WebWeb Browser

一个基于iframe的浏览器标签页模拟系统，用于个人本地日常使用。

## 功能特性

- 🏷️ 标签页管理：新建、关闭、切换、编辑URL
- 📐 布局切换：顶部标签栏 / 左侧标签栏
- 🔍 网页缩放：独立缩放级别（0.3x - 3.0x）
- 💾 状态持久化：localStorage保存所有状态
- 🌐 完全浏览器行为：无沙箱限制
- 🎨 极简UI：黑白配色，无圆角，无阴影
- ⌨️ 键盘快捷键：Ctrl+T/W/+/-/0

## 使用方法

直接打开 `index.html` 即可使用，无需服务器或构建工具。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+T` | 新建标签 |
| `Ctrl+W` | 关闭标签 |
| `Ctrl++` | 放大 |
| `Ctrl+-` | 缩小 |
| `Ctrl+0` | 重置缩放 |

## 技术栈

- 纯HTML/CSS/JavaScript
- 无依赖，无构建工具
- localStorage持久化

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
```

## 许可证

MIT
