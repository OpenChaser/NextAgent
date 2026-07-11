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

- Node.js >= 18.x
- npm >= 9.x

### 安装依赖

```bash
pnpm install --registry=https://registry.npmmirror.com
pnpm approve-builds

```

> **注意**：由于依赖版本冲突，必须使用 `--legacy-peer-deps` 标志。

### 开发模式

```bash
npm run start
```

这将同时启动 Vite 开发服务器和 Electron 应用。

### 构建生产版本

```bash
npm run build
```

### 打包应用

```bash
npm run pack    # 仅打包，不生成安装包
npm run dist    # 生成安装包
```

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
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run electron` | 启动 Electron 应用 |
| `npm run start` | 同时启动开发服务器和 Electron |
| `npm run pack` | 打包应用（不生成安装包） |
| `npm run dist` | 生成安装包 |

## 开发指南

### 主进程

主进程负责窗口管理、系统菜单、IPC 通信等。位于 `src/main/main.ts`。

### 渲染进程

渲染进程使用 React 构建用户界面，位于 `src/renderer/`。

### 预加载脚本

预加载脚本提供渲染进程和主进程之间的安全通信桥接，位于 `src/preload/preload.ts`。

## 故障排除

### Electron 安装失败

如果遇到 `Electron failed to install correctly` 错误，请尝试以下步骤：

```bash
# 删除现有 Electron 安装
rm -rf node_modules/electron

# 重新安装
npm install electron --legacy-peer-deps
```

如果网络环境受限，可以设置 Electron 的镜像源：

```bash
# 使用淘宝镜像（Windows）
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

# 使用淘宝镜像（Linux/macOS）
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

npm install electron --legacy-peer-deps
```

### 依赖冲突

如果遇到依赖解析错误，使用 `--legacy-peer-deps` 标志：

```bash
npm install --legacy-peer-deps
```

## 许可证

ISC License
