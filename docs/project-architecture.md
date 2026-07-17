# NextAgent 项目整体架构介绍

> 本文为 NextAgent 项目的整体架构概览，涵盖项目定位、技术栈、目录结构、三进程模型、核心功能模块、数据流与构建规范。作为新成员快速了解项目的入口文档。
>
> 更细粒度的模块设计见 [`docs/design/`](design/) 下的各设计文档。

## 一、项目定位

**NextAgent** 是一个桌面端 **AI 工作助手**（AI Work Assistant），基于 **Electron + React + TypeScript** 构建。它把多个 AI Agent、MCP 工具、技能（SKILL）、记忆（Memory）、任务会话（Task Session）整合在一个本地桌面应用中，定位是"个人/团队的本地 AI 工作空间"。

- **应用名**：NextAgent
- **入口**：`package.json` 的 `main: dist/main/main.js`（Electron 主进程）
- **许可**：MIT
- **目标平台**：Windows（nsis 安装包，`appId: com.nextagent.app`）

## 二、技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 桌面壳 | Electron 43 | 主进程 + 渲染进程双进程模型 |
| 前端框架 | React 18 + TypeScript 5.5 | 函数组件 + Hooks |
| 构建工具 | Vite 8 | dev server (5173) + production build |
| 样式 | TailwindCSS 3.4 + PostCSS | 原子化 CSS |
| LLM SDK | openai 4.57 | OpenAI 兼容 API 客户端 |
| 解析 | gray-matter 4 | SKILL.md 的 YAML frontmatter 解析 |
| 测试 | Vitest 4 + Testing Library | 单元 + 集成测试 |
| 打包 | electron-builder 26 | Windows nsis 安装包 |
| 包管理 | pnpm | `pnpm-workspace.yaml` + `pnpmfile.cjs` |

## 三、顶层目录结构

```
NextAgent/
├── .github/workflows/     # CI: build.yml (编译门禁) + release.yml (发布)
├── docs/                  # 设计文档（单一事实来源）
│   ├── design/            # 7 个架构设计文档
│   ├── FEATURE_LIST.md
│   └── 开发经验总结.md
├── src/                   # 全部源代码
│   ├── data/              # 内置静态资源
│   ├── main/              # Electron 主进程
│   ├── preload/           # 预加载桥接层
│   └── renderer/          # 渲染进程（React UI）
├── AGENTS.md              # ★ AI 开发规范（编译/运行/PR 流程）
├── README.md
├── index.html             # Vite 入口
├── package.json
├── tsconfig.json          # 渲染进程 tsconfig
├── tsconfig.main.json     # 主进程 tsconfig
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## 四、核心架构：Electron 三进程模型

项目遵循 Electron 标准的三层结构，各层职责清晰：

```
┌─────────────────────────────────────────────────────────┐
│  渲染进程 (renderer/)  ── React UI                       │
│  App.tsx → Sidebar + ChatArea + 各 View 组件            │
│  通过 window.electronAPI.* 调用主进程                    │
└────────────────────────┬────────────────────────────────┘
                         │  ipcRenderer.invoke / on
┌────────────────────────┴────────────────────────────────┐
│  Preload (preload/)  ── 安全桥接层                         │
│  contextBridge 暴露 electronAPI，隔离主进程 Node 能力      │
└────────────────────────┬────────────────────────────────┘
                         │  ipcMain.handle / on
┌────────────────────────┴────────────────────────────────┐
│  主进程 (main/)  ── Node.js 后端逻辑                      │
│  LLM 调用 / 工具执行 / 记忆 / MCP / Skill / 文件持久化     │
└─────────────────────────────────────────────────────────┘
```

### 1. 主进程 `src/main/`（Node.js 后端）

主进程是应用的"大脑"，承载所有重逻辑：

| 文件/目录 | 职责 | 行数级 |
|-----------|------|--------|
| [main.ts](../src/main/main.ts) | 主入口：窗口创建、IPC handlers、`chat:send` 核心（组装 messages 调 LLM）、TaskItem 持久化、内置 Agent 定义 | ~900+ |
| [groupChat.ts](../src/main/groupChat.ts) | 群聊模式：roster 花名册、`buildMessagesForAgent`、轮转编排、`delegate_to_agent` | ~170 |
| [skills.ts](../src/main/skills.ts) | SKILL 加载：`loadSkills()` 解析 `~/.nextagent/skills/` 和项目 `.nextagent/skills/` 的 SKILL.md（gray-matter） | ~163 |
| [about.ts](../src/main/about.ts) | 关于页面 | 小 |
| **memory/** | 记忆系统 | |
| └ [memoryManager.ts](../src/main/memory/memoryManager.ts) | sessionContext 单例：短记忆 recentTurns / 长记忆 recall / 对话摘要 summarize | ~230 |
| **tools/** | 内置工具系统（ToolDefinition） | |
| └ [index.ts](../src/main/tools/index.ts) | 工具注册表 | |
| └ [types.ts](../src/main/tools/types.ts) | ToolDefinition 接口 | |
| └ [readFile.ts](../src/main/tools/readFile.ts) / [writeFile.ts](../src/main/tools/writeFile.ts) / [editFile.ts](../src/main/tools/editFile.ts) | 文件读写编辑 | |
| └ [listDirectory.ts](../src/main/tools/listDirectory.ts) / [searchFiles.ts](../src/main/tools/searchFiles.ts) / [searchContent.ts](../src/main/tools/searchContent.ts) | 目录/文件搜索 | |
| └ [gitStatus.ts](../src/main/tools/gitStatus.ts) | git 状态 | |
| └ [runCommand.ts](../src/main/tools/runCommand.ts) | 终端命令执行 | |
| └ [delegateAgent.ts](../src/main/tools/delegateAgent.ts) | 委派给其他 agent（群聊用） | |
| └ [memory.ts](../src/main/tools/memory.ts) | 记忆操作工具 | |
| **mcp/** | MCP (Model Context Protocol) | |
| └ [mcpManager.ts](../src/main/mcp/mcpManager.ts) | MCP server 管理（stdio + sse 双传输） | |
| └ [mcpClient.ts](../src/main/mcp/mcpClient.ts) / [mcpSseClient.ts](../src/main/mcp/mcpSseClient.ts) | stdio / sse 客户端 | |
| └ [types.ts](../src/main/mcp/types.ts) | MCP 类型定义 | |
| **__tests__/** | 主进程测试 | |
| └ groupChat.test.ts / groupChat.integration.test.ts / delegateAgent.test.ts / tools.registry.test.ts | 群聊、委派、工具注册表测试 | |

### 2. 预加载层 `src/preload/preload.ts`

**安全桥接层**：用 `contextBridge` 把主进程能力暴露为 `window.electronAPI.*`，渲染进程只能通过这个白名单 API 访问 Node 能力。定义了：
- `sendChatMessage` / `sendMentionChat`（对话）
- `getSkills` / `getGlobalSkills` / `saveSkill` / `deleteSkill`（技能）
- `getAgents` / `saveAgent` / `deleteAgent`（智能体）
- `getTasks` / `updateTask` / `deleteTask`（任务）
- `generateTitle`（LLM 生成标题）
- `openWorkspaceFolder`（选择项目目录）
- MCP / Model / Memory 等完整 API

类型定义在 [renderer/electron.d.ts](../src/renderer/electron.d.ts) 中同步声明。

### 3. 渲染进程 `src/renderer/`（React UI）

UI 层基于 React 18 + TailwindCSS，单页应用：

| 文件 | 职责 |
|------|------|
| [main.tsx](../src/renderer/main.tsx) | React 入口，挂载 App |
| [App.tsx](../src/renderer/App.tsx) | 顶层组件：tasks 状态管理、Sidebar + 主内容区路由、projectPath 绑定回调 |
| [electron.d.ts](../src/renderer/electron.d.ts) | 全局类型声明（ElectronAPI / TaskItem / Workspace / AgentConfig 等） |
| [index.css](../src/renderer/index.css) | Tailwind 入口 + 全局样式 |

**components/ 组件树**：

```
App.tsx
├── Sidebar.tsx              # 左侧任务列表（新建/切换/删除任务）
└── 主内容区（根据 tab 切换）
    ├── ChatArea.tsx         # ★ 对话主区（消息列表 + 输入框 + 工具栏）
    │   ├── Popover.tsx      # 通用弹层（anchor 定位 + 自动上下）
    │   ├── AgentPopover.tsx # 智能体选择
    │   ├── ModelPopover.tsx # 大模型选择
    │   ├── WorkspacePopover.tsx  # 工作空间选择
    │   ├── CommandSkillPopover.tsx # ★ 技能命令选择
    │   ├── Modal.tsx        # 通用模态框
    │   └── CustomModelConfigDialog.tsx # 自定义模型配置
    ├── AgentConfigView.tsx  # 智能体配置页
    ├── MemoryView.tsx       # 记忆管理页
    ├── SkillView.tsx        # 技能管理页
    ├── McpSettings.tsx      # MCP 配置页
    ├── SettingsView.tsx     # 设置页
    └── AutomationView.tsx   # 自动化页
```

## 五、核心功能模块（对应设计文档）

项目把"单一事实来源"放在 [docs/design/](design/) 下，7 个设计文档与代码模块一一对应：

| 设计文档 | 功能模块 | 核心代码 |
|----------|----------|----------|
| [agent-memory-design.md](design/agent-memory-design.md) | 记忆系统（短/长/摘要） | `memory/memoryManager.ts` |
| [builtin-tools-design.md](design/builtin-tools-design.md) | 内置工具系统（ToolDefinition + ReAct 循环） | `tools/*.ts` |
| [builtin-agent-design.md](design/builtin-agent-design.md) | 内置 Agent（Plan/Build） | `main.ts` getBuiltinAgents |
| [mcp-design.md](design/mcp-design.md) | MCP（stdio/sse 双传输 + 工具前缀隔离） | `mcp/*.ts` |
| [skill-design.md](design/skill-design.md) | SKILL（SKILL.md + gray-matter + 双层加载） | `skills.ts` |
| [multi-agent-group-design.md](design/multi-agent-group-design.md) | 多 Agent 群聊（roster + 共享 transcript + delegate） | `groupChat.ts` |
| [task-session-design.md](design/task-session-design.md) | 任务会话（tasks.json + LLM 标题 + projectPath 绑定） | `main.ts` + `App.tsx` + `ChatArea.tsx` |

## 六、数据流：一次对话的完整链路

以"用户在 ChatArea 发送消息"为例，串起整个架构：

```
1. ChatArea.handleSend
   ├─ onEnsureTask() → 主进程 tasks.json 落盘 task
   ├─ onProjectPathChange() → task.projectPath 绑定
   ├─ selectedSkills 的 content 拼到 message 前（渲染层方案）
   └─ window.electronAPI.sendChatMessage({message, model, agentId/agentIds, projectPath})
        │
2. preload.ts → ipcRenderer.invoke('chat:send', params)
        │
3. main.ts ipcMain.on('chat:send')
   ├─ 单 Agent 模式:
   │   ├─ ensureSessionForAgent(agentId, systemPrompt) → memoryManager sessionContext
   │   ├─ recallMemories(agentId, message) → 长期记忆召回
   │   ├─ 组装 messages:
   │   │   1. projectPath 上下文 system message
   │   │   2. agent.systemPrompt
   │   │   3. 召回的长期记忆
   │   │   4. 对话摘要
   │   │   5. recentTurns 短记忆
   │   ├─ effectiveTools = agent.toolsEnabled ? tools : []
   │   └─ client.chat.completions → LLM（含 ReAct 工具循环）
   └─ 群聊模式:
       └─ runGroupChat({message, agentIds, mentionAgentId, projectPath})
           ├─ buildRoster(members, currentAgent) → 花名册 system message
           ├─ buildMessagesForAgent(...) → 注入 projectPath + roster + agent prompt + 记忆 + transcript
           └─ 轮转编排（@mention 指定首响应 / delegate_to_agent 转交）

4. 主进程通过 win.webContents.send('chat:response', chunk) 流式回推
        │
5. preload.ts → ipcRenderer.on('chat:response') → window.electronAPI.onChatResponse
        │
6. ChatArea 收到流 → setMessages 更新 UI → onMessagesChange 持久化到 task
```

## 七、构建与开发命令

按 [AGENTS.md](../AGENTS.md) 规范：

| 命令 | 用途 |
|------|------|
| `pnpm run typecheck` | 主进程 + 渲染进程完整类型检查（不产出） |
| `pnpm run build` | 编译主进程 (`tsc`) + 打包渲染进程 (`vite build`) → `dist/` |
| `pnpm start` | 并行启动 Vite dev server (5173) + Electron（wait-on 等待 5173） |
| `pnpm test` | Vitest 跑全部测试 |
| `pnpm run pack` / `dist` | electron-builder 打包 |

**门禁规则**：上库前必须 `typecheck` + `build` 通过；运行程序前必须先编译，禁止跳过编译直接 `pnpm start`。CI（`.github/workflows/build.yml`）与本地规则一致。

## 八、代码规模

- **源代码**：49 个文件 / 7,079 行（TypeScript 为主）
- **设计文档**：9 个文件 / 1,781 行
- **合计**：约 8,860 行

属于中小型项目，但架构分层清晰、文档完备、有测试覆盖（`__tests__/` 目录含 groupChat / delegateAgent / tools.registry / ChatArea 等测试）。

## 九、项目特色

1. **本地优先**：所有数据（tasks.json / agents.json / skills/ / 记忆）存在 `~/.nextagent/`，不依赖云端账号。
2. **多 Agent 协同**：支持单 Agent 对话 + 群聊模式（多 Agent 轮转、@mention 指定首响应、`delegate_to_agent` 转交）。
3. **可扩展工具系统**：内置 12 个工具（文件读写/搜索/git/命令/记忆/委派）+ MCP 协议接入外部工具。
4. **SKILL 技能系统**：用户可用 Markdown + frontmatter 编写技能，双层加载（全局 + 项目级），支持 `/` 触发选择。
5. **任务会话隔离**：每个 task 绑定独立的 messages + projectPath，LLM 生成标题，侧边栏管理。
6. **设计文档即架构**：7 个设计文档与代码强绑定，PR 审查对照文档同步更新，文档是"单一事实来源"。
