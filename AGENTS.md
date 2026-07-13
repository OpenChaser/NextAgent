# NextAgent - AI Agent 技术备忘录

> 本文档整理 AI Agent 中 Memory（记忆）相关技术，并约定项目开发与上库的必做检查项。

## 开发规范与上库检查

每次修改代码后，必须依次执行以下两个编译验证命令，确保上库代码编译通过：

```bash
pnpm run typecheck
pnpm run build
```

- `pnpm run typecheck`：对主进程（`tsconfig.main.json`）和渲染进程（`tsconfig.json`）做完整类型检查，不产出文件。
- `pnpm run build`：编译主进程并打包渲染进程，产出 `dist/`。

上述两条命令均通过后，方可提交代码。该检查与 GitHub Actions 门禁（[.github/workflows/build.yml](.github/workflows/build.yml)）保持一致。

## 依赖安装

使用 pnpm 安装相关软件（依赖包、Electron 二进制等）时，优先使用阿里云镜像，以提升国内网络环境下的下载速度与稳定性。

- npm registry 镜像：`https://registry.npmmirror.com`
- Electron 二进制镜像：`https://npmmirror.com/mirrors/electron/`

安装依赖时指定镜像源：

```bash
pnpm install --registry=https://registry.npmmirror.com
```

若 Electron 二进制缺失（受 [pnpm-workspace.yaml](pnpm-workspace.yaml) 中 `allowBuilds: electron: false` 影响），通过镜像补装：

```powershell
# Windows PowerShell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
node node_modules/electron/install.js
```

```bash
# Linux/macOS
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
node node_modules/electron/install.js
```
