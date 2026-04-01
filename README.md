# EnvManage - 现代化的 Windows 环境变量管理器

EnvManage 是一个基于 **Go**、**Wails v2** 和 **React** 构建的高性能、现代化的 Windows 环境变量管理工具。它提供了一个比原生 Windows 界面更卓越的替代方案，侧重于速度、安全性和生产力。

## ✨ 核心特性

- **⚡ 实时生效**: 修改立即应用，无需重启系统。使用优化的 Windows API 标志，防止在广播时出现 UI 卡顿。
- **🛡️ 管理员权限**: 支持自动 UAC 提权，用于修改系统级别的环境变量。
- **🔍 智能搜索**: 跨变量名和变量值的实时搜索过滤与高亮显示。
- **🔗 智能 Path 编辑器**:
  - **拖拽排序**: 原生支持拖拽重新排序。
  - **多选移动**: 支持选择多个路径作为一个整体进行移动。
  - **自动滚动**: 在列表边缘拖拽时自动滚动。
  - **✨ 交互式去重**: 扫描重复路径，提供侧边栏进行比对，并在清理前直接跳转查看。
- **✅ 路径验证**: 实时检测并以视觉警告形式提示不存在的目录路径。
- **🎨 现代化 UI**: 简洁、响应式的界面，支持暗黑模式，提供优秀的视觉体验。

## 🛠️ 技术栈

- **后端**: Go (Wails)
- **前端**: React, TypeScript, Tailwind CSS
- **组件库**: Radix UI, Lucide Icons

## 🚀 快速开始

### 前置要求

- [Go](https://go.dev/) (v1.25+)
- [Node.js](https://nodejs.org/) (v18+)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)

### 开发模式

在实时开发模式下运行：
```bash
wails dev
```

### 编译打包

构建生产环境可执行文件：
```bash
wails build
```
输出文件将位于 `build/bin/EnvManage.exe`。

## 📄 许可证

MIT
