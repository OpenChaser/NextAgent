# 内置工具(Built-in Tools)— 设计文档

> 本文档描述 NextAgent 中内置工具系统的实现原理:类型定义、工具注册、执行调度与 ReAct 循环。

## 一、总体架构

内置工具系统采用**类型分离 + 单一注册源 + ReAct 循环编排**的设计,核心文件在 `src/main/tools/` 目录。

```
┌──────────────────────────────────────────────────┐
│  main.ts chat:send handler                       │
│   ├─ getToolDefinitions() → ChatTool[] (去executor)│
│   ├─ 传给 LLM: tools: effectiveTools              │
│   ├─ 流式累积 tool_calls 分片                      │
│   ├─ 执行分流: isMcpTool? MCP : executeTool       │
│   └─ role:'tool' 结果回传 → 下一轮循环             │
└───────────────────────┬──────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────┐
│  tools/index.ts (注册层)                          │
│   ├─ allTools: ToolDefinition[]  ← 单一数据源      │
│   ├─ toolExecutorMap: Map<name, executor>         │
│   ├─ getToolDefinitions(): ChatTool[]             │
│   └─ executeTool(name, args): Promise<string>     │
└───────────────────────┬──────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────┐
│  tools/types.ts (类型层)                          │
│   ├─ ToolFunction (name/description/parameters)    │
│   ├─ ToolDefinition (type + function + executor)   │
│   └─ ChatTool (type + function, 无 executor)      │
└──────────────────────────────────────────────────┘
```

---

## 二、核心类型定义

定义在 `src/main/tools/types.ts`:

```typescript
export interface ToolFunction {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface ToolDefinition {
  type: 'function'
  function: ToolFunction
  executor: (args: Record<string, unknown>) => Promise<string>
}

export interface ChatTool {
  type: 'function'
  function: ToolFunction
}
```

**双类型分离**设计:
- `ToolDefinition`:带 `executor` 字段,是 NextAgent 内部的完整工具定义
- `ChatTool`:与 OpenAI Chat Completions API 的 tools 参数格式对齐,**不包含 executor**,用于传给 LLM

---

## 三、工具清单

### 8 个基础工具(主仓库)

| 文件 | 工具名 | 功能 | 参数 |
|------|--------|------|------|
| `readFile.ts` | `read_file` | 读取文件内容,限制 50000 字符 | `filePath` (必填) |
| `writeFile.ts` | `write_file` | 写入文件,不存在则创建 | `filePath`, `content` (必填) |
| `editFile.ts` | `edit_file` | 搜索替换编辑,只替换首个匹配 | `filePath`, `oldText`, `newText` (必填) |
| `listDirectory.ts` | `list_directory` | 列出目录文件与子目录 | `dirPath` (必填) |
| `searchFiles.ts` | `search_files` | 按 glob 搜索文件,跨平台 | `pattern`, `dirPath` (必填) |
| `searchContent.ts` | `search_content` | 文件内容 grep 搜索,跨平台 | `pattern`, `dirPath` (必填), `filePattern` (可选) |
| `runCommand.ts` | `run_command` | 执行终端命令,30s 超时 | `command` (必填), `cwd` (可选) |
| `gitStatus.ts` | `git_status` | 查看 Git 仓库状态 | 无参数 |

### 4 个记忆工具(记忆功能分支)

| 工具名 | 功能 | 参数 |
|--------|------|------|
| `save_memory` | 保存事实到长期记忆 | `content` (必填), `tags` (可选) |
| `recall_memory` | 按关键词检索长期记忆 | `query` (必填), `limit` (可选) |
| `list_memory` | 列出全部记忆(最近优先) | `limit` (可选) |
| `delete_memory` | 按 id 删除记忆 | `id` (必填) |

---

## 四、注册机制

`src/main/tools/index.ts`:

```typescript
// 单一数据源
export const allTools: ToolDefinition[] = [
  readFileTool, writeFileTool, editFileTool, listDirectoryTool,
  searchFilesTool, searchContentTool, runCommandTool, gitStatusTool,
  saveMemoryTool, recallMemoryTool, listMemoryTool, deleteMemoryTool,
  delegateAgentTool,   // 多 Agent 群聊委派工具
]
```

> 其中 `delegateAgentTool`（`src/main/tools/delegateAgent.ts`）用于多 Agent 群聊协同：LLM 通过 `delegate_to_agent(targetAgentId, task)` 委派其他成员。其 `executor` 为桩函数，**真正语义在群聊编排器 [`src/main/groupChat.ts`](../../src/main/groupChat.ts) 拦截实现**（记录 delegation、入队、发 `chat:mention`）；单 Agent 模式下若被误调用，桩返回提示。详见 [multi-agent-group-design.md](./multi-agent-group-design.md)。

// 模块加载时构建执行器映射
const toolExecutorMap = new Map<string, ToolDefinition['executor']>()
for (const tool of allTools) {
  toolExecutorMap.set(tool.function.name, tool.executor)
}

// 面向 LLM:剥离 executor,返回 ChatTool[]
export function getToolDefinitions(): ChatTool[] {
  return allTools.map((t) => ({ type: t.type, function: t.function }))
}

// 面向执行:按名字查找 executor
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const executor = toolExecutorMap.get(name)
  if (!executor) return `错误：未找到工具 "${name}"`
  try {
    return await executor(args)
  } catch (error) {
    return `错误：执行工具 "${name}" 失败：${error instanceof Error ? error.message : '未知错误'}`
  }
}
```

设计要点:
- `allTools` 是**单一注册源**,新增工具只需在此数组追加一项
- `toolExecutorMap` 在模块加载时一次性构建,O(1) 查找
- `getToolDefinitions()` 与 `executeTool()` 分别面向 LLM(传定义)和执行(调函数)

---

## 五、executor 签名

```typescript
executor: (args: Record<string, unknown>) => Promise<string>
```

**没有 context 参数**。所有工具的 executor 都遵循此签名。记忆工具通过变通方式获取上下文:不依赖参数,而是通过模块级全局函数 `getCurrentAgent()` 读取 `currentAgentId` 全局变量(由 main.ts 在 chat:send 入口处 `setCurrentAgent(agentId)` 设置)。

---

## 六、ReAct 循环(main.ts chat:send)

### 6.1 工具定义传给 LLM

```typescript
const tools = [...getToolDefinitions(), ...mcpManager.getToolDefinitions()]
const effectiveTools = (() => {
  if (agentId) {
    const ag = agents.find((a) => a.id === agentId)
    if (ag && !ag.toolsEnabled) return []   // agent 可关闭工具
  }
  return tools
})()
```

内置工具与 MCP 工具合并;agent 的 `toolsEnabled: false` 时传空数组禁用工具。

### 6.2 流式 tool_calls 分片累积

LLM 流式响应中 `tool_calls` 会拆成多个 delta 分片(按 `index` 区分),用 Map 累积:

```typescript
const toolCallsBuffer = new Map<number, { id: string; name: string; arguments: string }>()

if (delta?.tool_calls) {
  for (const tc of delta.tool_calls) {
    const idx = tc.index
    if (!toolCallsBuffer.has(idx)) {
      toolCallsBuffer.set(idx, { id: tc.id || '', name: '', arguments: '' })
    }
    const buf = toolCallsBuffer.get(idx)!
    if (tc.function?.name) buf.name = tc.function.name
    if (tc.function?.arguments) buf.arguments += tc.function.arguments
  }
}
```

### 6.3 执行与结果回传

```typescript
if (toolCallsBuffer.size > 0) {
  const toolCalls = Array.from(toolCallsBuffer.values())
  // assistant 消息(含 tool_calls)入历史
  messages.push({ role: 'assistant', content: contentBuffer, tool_calls: [...] })

  for (const tc of toolCalls) {
    const toolArgs = JSON.parse(tc.arguments)
    // 执行分流
    const result = mcpManager.isMcpTool(tc.name)
      ? await mcpManager.callTool(tc.name, toolArgs)
      : await executeTool(tc.name, toolArgs)

    win.send('chat:tool_call', { name, arguments, result })

    // 结果以 role:'tool' 回传
    messages.push({ role: 'tool', content: result, tool_call_id: tc.id })
  }
  continue   // 继续下一轮
}
```

### 6.4 完整消息序列

标准 OpenAI function calling 协议:

```
1. { role: 'user', content: '用户问题' }
2. { role: 'assistant', content: '...', tool_calls: [{ id, function:{name, arguments} }] }
3. { role: 'tool', content: '执行结果', tool_call_id: 对应的 id }
   ↑ LLM 在下一轮看到此消息后继续生成
```

工具**串行执行**(`for` + `await`),最多 10 轮(`MAX_ROUNDS = 10`)。无 tool_calls 时发送 `chat:done` 结束。

---

## 七、关键设计权衡

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 类型层 | ToolDefinition / ChatTool 双类型 | executor 不暴露给 LLM,安全且符合 OpenAI 格式 |
| 注册层 | allTools 单一数组 | 新增工具零成本,只需追加一项 |
| 执行分流 | isMcpTool() 前缀判断 | 内置与 MCP 工具统一调度,命名空间隔离 |
| executor 签名 | (args) => Promise<string> 无 context | 简单统一;记忆工具用模块级全局变通 |
| 执行方式 | 串行 await | 顺序确定,结果可预测 |
| 循环上限 | MAX_ROUNDS = 10 | 防止死循环 |

---

## 八、相关文件索引

| 文件 | 职责 |
|------|------|
| `src/main/tools/types.ts` | ToolFunction / ToolDefinition / ChatTool 类型定义 |
| `src/main/tools/index.ts` | allTools 注册、getToolDefinitions、executeTool |
| `src/main/tools/readFile.ts` 等 8 个 | 各工具的 ToolDefinition 定义与 executor 实现 |
| `src/main/tools/memory.ts` | 4 个记忆工具(记忆功能分支) |
| `src/main/main.ts` | chat:send 的 ReAct 循环编排 |
