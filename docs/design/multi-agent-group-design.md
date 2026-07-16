# 多 Agent 群聊协同设计

> 模块：多 Agent 群聊协同（多选 / Roster / 共享 transcript / `delegate_to_agent` 委派 / 轮转编排）
>
> 对应代码：`src/main/groupChat.ts`、`src/main/tools/delegateAgent.ts`、`src/main/main.ts`（chat:send 分流）、`src/renderer/components/ChatArea.tsx`、`src/renderer/components/AgentPopover.tsx`、`src/preload/preload.ts`、`src/renderer/electron.d.ts`。

## 1. 目标与模式

在单 Agent 对话之上，新增「多 Agent 群聊协同」模式：用户在 Agent 选择器中**多选 2~N 个 Agent** 组成群聊。每个 Agent 知道群里有哪些成员及各自职责；Agent 之间通过 `delegate_to_agent` 工具（UI 渲染为「@AgentName」芯片）相互委派任务，被 @ 的 Agent 收到任务后接续工作，整体像微信群聊。

**自动模式切换**：选 1 个 = 原单 Agent 路径（代码完全不动）；选 ≥2 个 = 群聊编排路径。判定在 `chat:send` 顶部：`if (agentIds && agentIds.length >= 2)`。

## 2. 关键决策

| 决策点 | 选择 | 说明 |
|--------|------|------|
| @ 触发机制 | 专用工具 `delegate_to_agent` | LLM 走 tool_call 委派，参数结构化（`targetAgentId` + `task`）；前端把该调用渲染为「@AgentName: task」芯片。可靠性优先，UI 还原微信群 @ 外观。 |
| 初始派发 | 首位 Agent 默认响应 | 用户未 @ 时由选中列表第一个 Agent 响应；用户可在输入框 @ 指定首响应者（`mentionAgentId` 传入主进程）。 |
| 共享上下文 | 单一共享群聊 transcript | 群聊维护一份共享消息流，每个 Agent 发言时能看到所有发言（带发言者标签）。长期记忆仍按 agentId 隔离。 |
| 兼容 | 单选/多选自动切换 | Agent 选择器改多选；不引入独立模式开关。 |

## 3. 数据结构

### 3.1 共享 transcript（短记忆，仅内存）

`src/main/groupChat.ts` 模块级 `groupTranscript: GroupTurn[]`：

```ts
interface GroupTurn {
  kind: 'user' | 'agent' | 'delegation'
  speakerAgentId?: string
  speakerName: string          // '用户' 或 agent.name
  content: string
  toAgentId?: string            // delegation：目标
  toAgentName?: string
}
```

- `resetGroupSession()` 清空（由 `chat:reset` 调用）。
- 渲染给 LLM 时统一用 `role:'user'` + `[发言者]: ...` 标签，多成员对话更稳定。

### 3.2 渲染层 Message 扩展

`ChatArea.tsx` 的 `Message` 新增：

```ts
speakerAgentId?: string
speakerAgentName?: string
mentions?: MentionRecord[]
```

`MentionRecord = { fromAgentId; fromAgentName; toAgentId; toAgentName; task }`，由 `chat:mention` 事件填充。

## 4. 委派工具 `delegate_to_agent`

声明在 `src/main/tools/delegateAgent.ts`，注册于 `src/main/tools/index.ts` 的 `allTools`。参数：`targetAgentId` + `task`。

**双语义**：
- **群聊模式**：编排器在工具执行分支**拦截**（`tc.name === 'delegate_to_agent'` 不走 `executeTool`）：校验 `targetAgentId` ∈ 群成员 → 记录 delegation 到 transcript → 发 `chat:mention` 事件 → 入队 → 返回提示串给 LLM 作为 tool 结果。
- **单 Agent 模式**：executor 桩返回「非群聊模式」提示（LLM 一般不会调用）。

## 5. 编排流程（`runGroupChat`）

入参 `GroupChatParams { message, agentIds, mentionAgentId }`，依赖 `GroupChatDeps`（win/client/mcpManager/tools/agents/effectiveModel/modelConfig/signal/recallMemories/formatMemoriesForInjection/executeTool）由 `main.ts` 注入。

```
1. 校验成员 ≥ 2，否则 chat:error
2. 用户消息 push 进 groupTranscript（kind:'user'）
3. 初始发言者 = mentionAgentId ∈ agentIds ? mentionAgentId : agentIds[0]
4. queue = [{ agentId: 初始, task: message }]
5. while queue 非空 && turns < MAX_GROUP_TURNS(12) && !aborted:
     取出 job → 找 agent（缺失则 warn 跳过）
     win.send('chat:speaker', { agentId, agentName })
     messages = [system: roster, system: agent.systemPrompt, system: 召回记忆, ...render(transcript)]
     effTools = agent.toolsEnabled === false ? [] : tools
     for round in 0..MAX_ROUNDS_PER_AGENT(10):
       流式 create(...)，chunk 带 agentId 发 chat:chunk
       累积 content / tool_calls
       若有 tool_calls:
         assistant 消息入 messages
         for tc:
           if delegate_to_agent: 拦截 → 记录/transcript/chat:mention/入队/tool 结果
           else: isMcpTool ? mcp.callTool : executeTool → chat:tool_call + tool 消息
         continue
       否则：assistant 内容入 messages，break（该 agent 发言结束）
     agentResponseText 非空 → push kind:'agent' 进 transcript
6. win.send('chat:done', { usage, max_input_tokens })
```

### Roster（花名册）注入

每个 Agent 的 systemPrompt 前注入：

```
你正在一个多智能体群聊中协作。群成员如下：
- Plan (id: builtin-plan) — 规划与分析智能体：...
- Build (id: builtin-build) — 构建与实现智能体：...
你自己的身份：Plan (id: builtin-plan) — ...
规则：需要他人接手时调用 delegate_to_agent（不要在文本里写纯 @ 字符）。
```

## 6. IPC 事件

新增/扩展（payload 在单 Agent 模式留空，向后兼容）：

| 事件 | 方向 | 载荷 |
|------|------|------|
| `chat:speaker` | main→renderer | `{ agentId, agentName }` — Agent 开始发言，UI 创建带发言者的占位 |
| `chat:chunk` | main→renderer | `{ content, agentId?, agentName? }` |
| `chat:mention` | main→renderer | `{ fromAgentId, fromAgentName, toAgentId, toAgentName, task }` |
| `chat:tool_call` | main→renderer | `{ name, arguments, result, agentId? }` |
| `chat:done` | main→renderer | `{ usage?, max_input_tokens? }` |
| `agents:getSelectedAgents` / `agents:setSelectedAgents` | invoke | `string[]`，持久化 `preferences.json` 的 `selectedAgentIds` |

`removeChatListeners` 一并清理 `chat:speaker` / `chat:mention`。

## 7. 前端 UI

- **AgentPopover**：改多选，props `{ selectedAgentIds, onToggleAgent, onClose }`，显示「已选 N 个」。
- **ChatArea**：状态 `selectedAgents: AgentConfig[]`、`mentionAgentId`、`isMentionPickerOpen`、`mentionQuery`。`handleSend` 双模式：群聊靠 `onChatSpeaker` 创建占位、`onChatChunk` 按 agentId 追加、`onChatMention` 填 mentions、`onChatToolCall` 按 agentId 追加。单 Agent 维持原逻辑。
- **输入框 @**：群聊模式下输入 `@` 触发已选 Agent 选择浮层，选中插入 `@Name ` 并记录 `mentionAgentId` 作为首响应者。
- **消息渲染**：assistant 消息显示 `speakerAgentName` 标签；`mentions` 渲染为紫色「@AgentName · task」芯片。

## 8. 边界与失败模式

- **死循环**：`MAX_GROUP_TURNS = 12` 兜底；单 Agent 轮 `MAX_ROUNDS_PER_AGENT = 10`。
- **@ 不存在成员**：编排器校验，返回错误提示给 LLM，不入队。
- **中途停止**：复用 `activeChatAbort`，每轮与工具执行前检查 `signal.aborted`，终止后发一次 `chat:done`。
- **Agent 配置缺失**：跳过并 `console.warn`，不阻塞其他成员。
- **模型**：群聊模式统一使用用户选定的 `model` 与对应 provider（单 client）；per-agent `model` 在群聊模式被忽略，作为已知限制。

## 9. 持久化

- `preferences.json`：新增 `selectedAgentIds: string[]`（与旧 `selectedAgentId` 并存，启动加载优先读数组，回退单选）。
- 群聊 transcript 仅内存，刷新即清（与 `SessionContext` 一致）。

## 10. 文件索引

| 文件 | 职责 |
|------|------|
| [src/main/groupChat.ts](../../src/main/groupChat.ts) | 编排器 / Roster / 共享 transcript / 委派拦截 |
| [src/main/tools/delegateAgent.ts](../../src/main/tools/delegateAgent.ts) | 委派工具声明（桩 executor） |
| [src/main/tools/index.ts](../../src/main/tools/index.ts) | 注册 `delegateAgentTool` |
| [src/main/main.ts](../../src/main/main.ts) | `chat:send` 分流 + 群聊 IPC + `chat:reset` |
| [src/preload/preload.ts](../../src/preload/preload.ts) | 事件/方法桥接 |
| [src/renderer/electron.d.ts](../../src/renderer/electron.d.ts) | 类型声明 |
| [src/renderer/components/AgentPopover.tsx](../../src/renderer/components/AgentPopover.tsx) | 多选 UI |
| [src/renderer/components/ChatArea.tsx](../../src/renderer/components/ChatArea.tsx) | 状态/流程/渲染/输入框 @ |
