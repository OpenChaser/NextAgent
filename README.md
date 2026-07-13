# NextAgent

一个基于 Electron + React 构建的跨平台 AI 工作助手应用。

## 开发状态

**⚠️ 项目处于早期开发阶段**

目前仅实现了 UI 界面框架，所有功能模块（任务管理、AI 助理、项目管理等）均为占位符，尚未实现实际业务逻辑。

## 功能特性（计划中）

- 🎯 **任务管理** - 创建和管理工作任务
- 🤖 **AI 助理** - 集成 AI 助手进行智能对话
- 📁 **项目管理** - 组织和管理项目文件
- 🔗 **专家技能连接器** - 连接专家和技能
- ⚡ **自动化** - 工作流程自动化
- 💾 **资料库** - 灵感和资料收集

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **React 18** - 用户界面库
- **TypeScript** - 类型安全的 JavaScript 超集
- **Vite** - 快速构建工具
- **Tailwind CSS 3** - 原子化 CSS 框架
- **Lucide React** - 图标库

## 快速开始

### 前置条件

- Node.js >= 20.x
- pnpm >= 9.x

### 安装依赖

```bash
pnpm install
```

> **注意**：本项目 [pnpm-workspace.yaml](pnpm-workspace.yaml) 中设置了 `allowBuilds: electron: false`，会跳过 Electron 二进制的下载。安装完成后请确认 `node_modules/electron/dist/electron.exe` 是否存在；若缺失，需手动触发一次下载：
> ```powershell
> $env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
> node node_modules/electron/install.js
> ```

### 开发模式

```bash
pnpm start
```

这将通过 `concurrently` 同时启动 Vite 开发服务器（默认 `http://localhost:5173`）和 Electron 应用，并等待 dev server 就绪后再加载窗口，同时自动打开 DevTools。

### 类型检查

```bash
pnpm run typecheck
```

分别对主进程（`tsconfig.main.json`）和渲染进程（`tsconfig.json`）做完整类型检查，不产出文件。这是上库门禁的第一道关卡，弥补了 Vite 构建时 esbuild 不校验渲染进程类型的缺口。

### 构建生产版本

```bash
pnpm run build
```

该命令依次执行：
- `tsc --project tsconfig.main.json` — 将主进程 TS 编译到 `dist/main/`
- `vite build` — 打包渲染进程到 `dist/renderer/`

产物布局：
```
dist/
├── main/        # Electron 主进程
├── preload/     # preload 脚本
└── renderer/    # 前端页面资源（index.html + assets）
```

### 打包应用

```bash
pnpm run pack    # 仅打包，不生成安装包
pnpm run dist    # 生成安装包（.exe / nsis 安装器）
```

输出目录为 `release/`，配置见 [package.json](package.json) 的 `build` 段。

## 项目结构

```
src/
├── main/           # Electron 主进程
│   └── main.ts     # 窗口管理、菜单、IPC 通信
├── preload/        # 预加载脚本
│   └── preload.ts  # 安全的 API 桥接
└── renderer/       # React 渲染进程
    ├── components/
    │   ├── Sidebar.tsx    # 侧边栏组件
    │   └── ChatArea.tsx   # 聊天区域组件
    ├── App.tsx            # 主应用组件
    ├── main.tsx           # 入口文件
    └── index.css          # 全局样式
```

## 脚本命令

| 命令 | 描述 |
|------|------|
| `pnpm run dev` | 启动 Vite 开发服务器 |
| `pnpm run typecheck` | 对主进程和渲染进程做完整类型检查（不产文件） |
| `pnpm run build` | 编译主进程 + 打包渲染进程，产出 `dist/` |
| `pnpm run electron` | 启动 Electron 应用（加载 dev server 或已构建产物） |
| `pnpm start` | 同时启动开发服务器和 Electron（开发模式） |
| `pnpm run pack` | 打包应用（不生成安装包） |
| `pnpm run dist` | 生成安装包（.exe / nsis 安装器） |

## CI 门禁

项目通过 GitHub Actions（[.github/workflows/build.yml](.github/workflows/build.yml)）对上库代码做编译门禁校验。当向 `main`/`master` 分支 `push` 或提交 `pull_request` 时自动触发，依次执行：

1. `pnpm install --frozen-lockfile` — 严格按 lockfile 安装依赖
2. `pnpm run typecheck` — 全仓类型检查
3. `pnpm run build` — 编译主进程 + 打包渲染进程

任一步骤失败，本次提交/PR 会被标记为 ❌，从而挡住上库。`concurrency` 配置还会自动取消同分支旧的运行以节省 CI 资源。

## 典型工作流

- **日常开发**：`pnpm start`（边改边热更新）
- **上库前自检**：`pnpm run typecheck` + `pnpm run build`（与 GitHub 门禁一致）
- **发布/分发**：`pnpm run dist`

## 开发指南

### 主进程

主进程负责窗口管理、系统菜单、IPC 通信等。位于 `src/main/main.ts`。

### 渲染进程

渲染进程使用 React 构建用户界面，位于 `src/renderer/`。

### 预加载脚本

预加载脚本提供渲染进程和主进程之间的安全通信桥接，位于 `src/preload/preload.ts`。

## 故障排除

### Electron 安装失败

如果遇到 `Electron failed to install correctly` 错误，通常是因为 [pnpm-workspace.yaml](pnpm-workspace.yaml) 中 `allowBuilds: electron: false` 跳过了二进制下载，导致 `node_modules/electron/dist/electron.exe` 缺失。重新触发下载即可：

```powershell
# 使用淘宝镜像（Windows PowerShell）
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
node node_modules/electron/install.js
```

```bash
# 使用淘宝镜像（Linux/macOS）
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
node node_modules/electron/install.js
```

### 端口 5173 被占用

启动时若提示 `Port 5173 is already in use`，说明有遗留的 Vite dev server 进程。先释放端口再重新启动：

```powershell
# Windows PowerShell：查找并结束占用 5173 的进程
Get-NetTCPConnection -LocalPort 5173 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

```bash
# Linux/macOS
lsof -ti:5173 | xargs kill -9
```

## 许可证

ISC License
