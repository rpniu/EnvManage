# EnvManage - 现代化的 Windows 环境变量管理器

EnvManage 是一个基于 **Go**、**Wails v2** 和 **React** 构建的高性能、现代化的 Windows 环境变量管理工具。它提供了一个比原生 Windows 界面更卓越的替代方案，侧重于速度、安全性和生产力。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)

---

## ✨ 核心特性

### 环境变量管理
- **⚡ 实时生效**: 修改立即应用，无需重启系统。使用优化的 Windows API 标志，防止在广播时出现 UI 卡顿。
- **🛡️ 权限分层**: 支持用户级（`HKEY_CURRENT_USER`）和系统级（`HKEY_LOCAL_MACHINE`，需管理员）变量独立管理。
- **🔍 智能搜索**: 跨变量名和变量值的实时搜索过滤与高亮显示。
- **📥 导入 / 导出**: 支持 JSON 格式批量导入导出，可按范围（全部 / 用户 / 系统）选择性导出。

### 🔗 PATH 可视化编辑器
- **拖拽排序**: 原生支持拖拽重新排序 PATH 条目。
- **多选移动**: 支持选择多个路径作为一个整体进行移动。
- **自动滚动**: 在列表边缘拖拽时自动滚动。
- **✨ 交互式去重**: 扫描重复路径，提供侧边栏进行比对，并在清理前直接跳转查看。
- **✅ 路径验证**: 实时检测并以视觉警告形式提示不存在的目录路径。
- **启用 / 禁用**: 可单独禁用某个 PATH 条目而不删除，方便临时测试。

### 🔁 环境切换（Profiles）
- 保存多组变量配置作为不同环境（如 `开发环境`、`测试环境`），一键切换，自动备份。

### 📋 环境模板（Templates）
- 内置 **Java / Go / Node.js / Python** 开发环境预设模板，开箱即用。
- 支持自定义模板的创建、编辑和删除，模板变量支持选择性部署。

### 🗃️ 系统快照（Snapshots）
- 对当前所有环境变量创建快照备份，支持一键回滚，变更差异可视化高亮展示。

### 📖 配置文件指引
- 内置完整的配置文件格式说明、字段说明、示例 JSON 及推荐工作流，帮助快速上手。

### 🎨 现代化 UI
- 简洁、响应式的侧边栏导航界面，支持 **浅色 / 深色 / 系统** 三种主题模式。

---

## 🛠️ 技术栈

| 层次 | 技术 |
|------|------|
| 后端 | Go 1.25+ (Wails v2) |
| 前端 | React 18, TypeScript, Vite |
| 样式 | Tailwind CSS |
| 组件库 | Radix UI, Lucide Icons |
| 构建 | Wails CLI |

---

## 🚀 快速开始

### 前置要求

- [Go](https://go.dev/) v1.25+
- [Node.js](https://nodejs.org/) v18+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation) v2

### 开发模式

在实时开发模式下运行（支持热重载）：

```powershell
wails dev
```

### 编译打包

构建生产环境可执行文件：

```powershell
wails build
```

输出文件将位于 `build/bin/EnvManage.exe`。

---

## 📁 配置文件

所有应用数据（快照、模板、配置文件等）统一存储在程序同级目录下的 `config.json`：

```
EnvManage.exe
└── config.json    ← 配置文件（自动创建）
```

配置文件格式为 JSON 对象，包含以下字段：

```json
{
  "snapshots": [],
  "templates": [],
  "profiles": [],
  "disabledPaths": []
}
```

导入导出的环境变量文件为独立的 JSON 数组格式：

```json
[
  { "key": "JAVA_HOME", "value": "C:\\Program Files\\Java\\jdk-17", "isSystem": false },
  { "key": "PATH",       "value": "%JAVA_HOME%\\bin",               "isSystem": false }
]
```

---

## 📄 许可证

MIT
