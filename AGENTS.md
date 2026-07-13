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

## PR 创建

本项目代码托管于 GitHub，使用 GitHub CLI（`gh`）直接创建 Pull Request，无需在网页手动操作，避免反复切换上下文。

### 前置条件

- 已安装 `gh` 并完成认证（`gh auth login`）。
- feature 分支已推送到远程（`git push -u origin <branch>`）。

### 创建 PR

以 feature 分支合入 `dev` 为例（与项目 feature→dev 开发流一致）：

```bash
gh pr create \
  --base dev \
  --head feature/<分支名> \
  --title "<简洁标题>" \
  --body "<PR 描述，可用多行字符串或 --body-file 指定文件>"
```

### 合并并删除源分支

PR 合并时使用 `gh pr merge --delete-branch`，合并完成后自动删除远程与本地 feature 分支，避免分支堆积：

```bash
gh pr merge <PR编号> --delete-branch
```

项目遵循「一个 feature 一个 PR 一个分支，合并即清理」的轻量流程，不长期保留 feature 分支。

> 已合并的 feature 分支无需保留；如需复用同一主题，请新建分支而非复用旧分支。

### 优势

- 命令行一键完成，无需打开浏览器。
- 标题、描述可复用模板，减少手动填写。
- 避免因「分支已推送但 PR 未建」造成的流程断点。
- 合并时删分支，仓库分支列表保持整洁。
