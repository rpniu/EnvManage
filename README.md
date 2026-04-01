# EnvManage - Modern Windows Environment Variable Manager

EnvManage is a high-performance, modern Windows environment variable management tool built with **Go**, **Wails v2**, and **React**. It provides a superior alternative to the native Windows interface with a focus on speed, safety, and productivity.

## ✨ Key Features

- **⚡ Real-time Broadcast**: Apply changes immediately without system restarts. Uses optimized Windows API flags to prevent UI hanging during broadcast.
- **🛡️ Administrative Access**: Automatic UAC elevation support for system-wide variable modifications.
- **🔍 Intelligent Search**: Real-time filtering and highlighting across variable names and values.
- **🔗 Smart Path Editor**:
  - **Drag & Drop**: Native reordering support.
  - **Multi-select Movement**: Select multiple paths and move them as a group.
  - **Auto-scroll**: Automatic scrolling when dragging near the edge of the list.
  - **✨ Interactive Deduplication**: Scan for duplicate paths with a side-panel for comparison and direct jumping before cleaning.
- **✅ Path Validation**: Real-time detection and visual warning for non-existent directory paths.
- **🎨 Modern UI**: Clean, responsive interface with Dark Mode support and premium aesthetics.

## 🛠️ Tech Stack

- **Backend**: Go (Wails)
- **Frontend**: React, TypeScript, Tailwind CSS
- **Components**: Radix UI, Lucide Icons

## 🚀 Getting Started

### Prerequisites

- [Go](https://go.dev/) (v1.25+)
- [Node.js](https://nodejs.org/) (v18+)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)

### Development

Run in live development mode:
```bash
wails dev
```

### Building

Build a production executable:
```bash
wails build
```
The output will be in `build/bin/EnvManage.exe`.

## 📄 License

MIT (Optional)
