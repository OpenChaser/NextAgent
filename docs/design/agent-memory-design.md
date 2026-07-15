# Agent 记忆功能 — 设计文档

> 本文档描述 NextAgent 中 Agent 记忆系统的具体实现原理,涵盖短记忆、长记忆、内容压缩三大能力。

## 总体架构

记忆系统采用 **主进程集中管理** 模式,核心代码在 `src/main/memory/memoryManager.ts`,分为两层:

```
┌─────────────────────────────────────────────────────┐
│  渲染层 (Renderer)                                  │
│  ChatArea ──sendChatMessage──┐   MemoryView ──IPC──┐│
└──────────────────────────────┼──────────────────────┼│
                               │                      │
┌──────────────────────────────▼──────────────────────▼│
│  Preload 桥接 (resetSession / getMemories / ...)    │
└──────────────────────────────┬──────────────────────┬│
                               │                      │
┌──────────────────────────────▼──────────────────────▼│
│  主进程 main.ts                                       │
│  chat:send handler                                    │
│   ├─ 短记忆: sessionContext (内存,进程级单例)         │
│   ├─ 长记忆召回: recallMemories() 注入 system 消息     │
│   ├─ 压缩闭环: syncAndMaybeCompress()                 │
│   └─ 记忆工具: save_memory/recall_memory/...          │
│                       │                               │
└───────────────────────┼───────────────────────────────┘
                        ▼
        ~/.nextagent/memory.json (持久化,按 agent 隔离)
```

设计要点:**不向渲染层暴露对话历史**。渲染层只发 `{message, model, agentId}`,主进程自己维护完整上下文,避免渲染层与主进程状态分歧。

---

## 一、短记忆(会话上下文)

### 1.1 数据结构

定义在 `src/main/memory/memoryManager.ts`:

```typescript
interface SessionContext {
  agentId: string | null
  systemPrompt: string
  summary: string | null      // 已压缩的历史摘要
  recentTurns: any[]          // 未压缩的近期对话轮次
  lastPromptTokens: number
  needsCompression: boolean
}
let sessionContext: SessionContext = { ... }  // 进程级单例
```

这是一个**模块级单例变量**,整个主进程只维护一份。不做持久化——重启即清空(短记忆的语义就是"当前会话")。

### 1.2 会话切换与延续

`ensureSessionForAgent` 在每次 `chat:send` 开始时调用:

```typescript
export function ensureSessionForAgent(agentId: string, systemPrompt: string): void {
  if (sessionContext.agentId !== agentId) {
    // agentId 变了 → 起全新会话,清空所有上下文
    sessionContext = { agentId, systemPrompt, summary: null, recentTurns: [], ... }
  } else if (!sessionContext.systemPrompt && systemPrompt) {
    // 同 agent,补全 systemPrompt
    sessionContext.systemPrompt = systemPrompt
  }
}
```

原理:**按 agent 隔离**。切换到不同 agent 时旧上下文丢弃,同一 agent 连续对话时上下文延续——这就是"短记忆"的核心语义。

用户也可通过 ChatArea「+」按钮主动清空,触发 `chat:reset` → `resetSession()`。

### 1.3 轮次回灌

每次 chat:send 完成后,通过 `syncAndMaybeCompress` 把本轮新增的消息(assistant + tool 结果)回灌:

```typescript
const syncAndMaybeCompress = async () => {
  appendTurns(messages.slice(payloadLen))   // 只回灌 payload 之后新增的
  setLastPromptTokens(totalPromptTokens)
  ...
}
```

`payloadLen` 是请求 payload 的长度,`messages.slice(payloadLen)` 取本轮工具循环新增的部分,避免重复回灌。

---

## 二、长记忆(持久化 + 召回)

### 2.1 存储

持久化到 `~/.nextagent/memory.json`,格式为 `MemoryEntry[]`:

```typescript
interface MemoryEntry {
  id: string          // mem-{时间戳}-{随机后缀}
  agentId: string     // 按 agent 隔离
  content: string
  type: 'fact' | 'summary'   // fact=主动保存的事实, summary=压缩产生的摘要
  tags?: string[]
  createdAt: number
}
```

读写走传统的 `ensureFile + readFileSync + writeFileSync` 模式,与项目现有的 models.json/agents.json 配置文件模式一致。

### 2.2 关键词召回(无向量库)

`recallMemories` 是召回核心,采用**纯关键词子串匹配**,不依赖向量数据库:

```typescript
export function recallMemories(agentId, query, topK = RECALL_TOP_K): MemoryEntry[] {
  const memories = loadMemories(agentId)      // 先按 agent 过滤
  const terms = extractTerms(query)          // 从用户消息提取检索词
  const scored = memories.map((m) => {
    let score = 0
    for (const t of terms) {
      if (m.content.toLowerCase().includes(t.toLowerCase())) score++
    }
    return { m, score }
  }).filter((x) => x.score > 0)
  scored.sort((a, b) => b.score - a.score || b.m.createdAt - a.m.createdAt)
  return scored.slice(0, topK).map((x) => x.m)
}
```

**分词策略** `extractTerms` 针对中英文混合场景:

```typescript
const asciiWords = text.match(/[A-Za-z0-9_]{2,}/g) || []   // 英文:整词
const cjkRuns = text.match(/[\u4e00-\u9fff]{2,}/g) || []   // 中文:2-gram 滑窗
for (const run of cjkRuns) {
  for (let i = 0; i < run.length - 1; i++) {
    terms.add(run.slice(i, i + 2))   // "记忆功能" → ["记忆","忆功","功能"]
  }
}
```

排序:命中词数降序,并列时取最新的。

### 2.3 自动注入

在 chat:send 构建 payload 时,召回的记忆作为 system 消息注入:

```typescript
const recalled = recallMemories(agentId || '', message)   // 用用户当前消息做查询
if (recalled.length > 0) {
  messages.push({ role: 'system', content: formatMemoriesForInjection(recalled) })
}
```

注入格式:
```
[长期记忆]
- {content1}
- {content2}
```

### 2.4 Agent 工具(主动存取)

`src/main/tools/memory.ts` 提供 4 个工具让 agent 自主管理记忆:

| 工具 | 作用 | 隔离机制 |
|------|------|----------|
| `save_memory` | 保存事实(type=fact) | 用 `getCurrentAgent()` 取当前 agent |
| `recall_memory` | 按关键词检索 | 作用域同 agent |
| `list_memory` | 列出全部(最近优先) | 同 agent |
| `delete_memory` | 按 id 删除 | — |

工具通过模块级 `currentAgentId` 获取当前 agent,无需改动 `executeTool` 的 `(args) => Promise<string>` 签名。`currentAgentId` 在每次 chat:send 开始时由 `setCurrentAgent(agentId)` 设置。

---

## 三、内容压缩

### 3.1 触发条件

`syncAndMaybeCompress` 在每轮对话结束后调用:

```typescript
const tokenLimit = modelConfig?.max_input_tokens || MAX_INPUT_TOKENS_FALLBACK  // 32768
if (totalPromptTokens > tokenLimit * COMPRESSION_THRESHOLD_RATIO) {            // 0.7
  await compressIfNeeded(client, effectiveModel, tokenLimit)
}
```

关键点:**用 OpenAI 返回的 `usage.prompt_tokens` 精确计量**,不依赖本地 tokenizer。token 上限从 `models.json` 的 `max_input_tokens` 读取(与 model.json 中 deepseek-v4-flash=65536 等一致)。当 prompt token 超过上限的 70% 时触发压缩。

### 3.2 压缩算法

`compressIfNeeded`:

```typescript
export async function compressIfNeeded(client, model, _limit): Promise<void> {
  const turns = sess.recentTurns
  if (turns.length <= KEEP_RECENT_TURNS) return        // 不足6轮不压缩
  const splitAt = findSplitIndex(turns, KEEP_RECENT_TURNS)
  const toSummarize = turns.slice(0, splitAt)         // 旧的部分→摘要
  const kept = turns.slice(splitAt)                   // 近6轮→保留
  const summaryText = await summarizeMessages(client, model, toSummarize)
  sess.summary = sess.summary ? `${sess.summary}\n\n${summaryText}` : summaryText
  sess.recentTurns = kept
  saveMemory(sess.agentId, summaryText, 'summary')    // 摘要也回写长记忆
}
```

**整组切分** `findSplitIndex`:

```typescript
function findSplitIndex(turns, keepRecent): number {
  let splitAt = Math.max(0, turns.length - keepRecent)
  while (splitAt < turns.length && turns[splitAt].role === 'tool') {
    splitAt++   // 切分点不能落在 tool 消息上,避免孤立的 tool_call_id
  }
  return splitAt
}
```

原理:OpenAI 要求 `tool` 消息必须紧跟在带 `tool_calls` 的 `assistant` 消息之后。如果切分点恰好落在 tool 消息上,会把它与前面的 assistant 分离,导致 API 报错。`findSplitIndex` 向后滑动直到越过 tool 消息,保证切出的两组各自完整。

### 3.3 LLM 摘要

`summarizeMessages` 用**非流式**调用:

```typescript
const conversationText = messages.map((m) => {
  const body = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
  if (m.tool_calls) body += `\n[tool_calls: ${JSON.stringify(m.tool_calls)}]`
  return `${m.role}: ${body}`
}).join('\n')

const resp = await client.chat.completions.create({
  model,
  messages: [
    { role: 'system', content: '请用简洁的要点总结以下对话,保留关键事实...' },
    { role: 'user', content: conversationText },
  ],
})
```

注意:这里把 `tool_calls` 也序列化进摘要文本,保证工具调用的上下文不丢。

### 3.4 摘要的三重利用

压缩产生的 summary 被用在三处:
1. **下次请求注入**——作为 `[对话摘要]` system 消息
2. **叠加累积**——多次压缩时 summary 追加,不覆盖
3. **持久化**——以 type='summary' 存入长记忆,跨会话可被 `recallMemories` 召回

---

## 四、完整数据流(一次 chat:send)

以用户连续对话为例,完整链路如下:

```
用户在 ChatArea 输入 "上次我们聊的项目的架构是什么"
  │
  ▼ sendChatMessage({message, model, agentId})
preload ipcRenderer.send('chat:send', ...)
  │
  ▼
main.ts chat:send handler:
  1. 加载 agent 配置 → agentSystemPrompt / temperature / maxTokens / effectiveModel
  2. ensureSessionForAgent(agentId, agentSystemPrompt)
     └─ 若 agentId 未变:延续 sessionContext(短记忆生效)
        若变了:重置 sessionContext
  3. setCurrentAgent(agentId)             ← 供记忆工具作用域
  4. appendTurns([{role:'user', content}]) ← 当前用户消息入短记忆
  5. 构建 messages payload:
     ├─ system: agentSystemPrompt
     ├─ system: [长期记忆] recalled       ← recallMemories(agentId, 用户消息)
     ├─ system: [对话摘要] sess.summary   ← 压缩产生的历史摘要
     └─ ...sess.recentTurns               ← 近期完整轮次
  6. 记 payloadLen,进入 MAX_ROUNDS=10 工具循环
  7. 流式调用 LLM,累积 content + tool_calls + usage.prompt_tokens
  8. 若有 tool_calls:
     ├─ 执行工具(可能是 save_memory/recall_memory 等)
     └─ continue 下一轮
  9. 无 tool_calls → 流式完成:
     ├─ appendTurns([{role:'assistant', content}])
     └─ await syncAndMaybeCompress():
        ├─ appendTurns(本轮新增的所有 messages)
        ├─ setLastPromptTokens(totalPromptTokens)
        └─ 若 totalPromptTokens > tokenLimit×0.7:
           └─ compressIfNeeded():
              ├─ 切分 recentTurns(整组切分,保留近6轮)
              ├─ summarizeMessages() 非流式摘要旧部分
              ├─ sess.summary 追加新摘要
              ├─ sess.recentTurns = kept(近6轮)
              └─ saveMemory(agentId, summary, 'summary') 持久化
  10. send('chat:done', {usage, max_input_tokens})
```

---

## 五、关键设计权衡

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 短记忆存哪 | 主进程内存单例 | 避免渲染层/主进程状态分歧;sendChatMessage 签名不变 |
| 长记忆存哪 | `~/.nextagent/memory.json` | 复用项目配置文件模式;无需引入数据库 |
| 召回方式 | 关键词子串匹配(无向量) | 零依赖、可解释;中英文用 ASCII 整词 + CJK 2-gram |
| token 计量 | 用 API 返回的 usage.prompt_tokens | 精确,不依赖 tokenizer 库 |
| 压缩切分 | 整组切分(findSplitIndex) | 避免 tool 消息与 tool_calls 分离导致 API 报错 |
| 摘要持久化 | type='summary' 存长记忆 | 跨会话可召回,不丢失历史 |
| agent 隔离 | currentAgentId + entry.agentId | 工具无需改签名;召回天然隔离 |

---

## 六、混合策略

整体是**自动 + 主动**混合型:
- **自动**:短记忆延续、长记忆自动召回注入、token 阈值自动压缩——用户/agent 无需干预
- **主动**:agent 可调 `save_memory`/`recall_memory`/`list_memory`/`delete_memory` 工具显式管理;用户可在 MemoryView 面板手动增删

---

## 七、相关文件索引

| 文件 | 职责 |
|------|------|
| `src/main/memory/memoryManager.ts` | 核心记忆模块:SessionContext、文件IO、召回、压缩、会话上下文 |
| `src/main/tools/memory.ts` | 4 个 Agent 工具定义(save/recall/list/delete) |
| `src/main/main.ts` | chat:send 集成、记忆 IPC、压缩闭环 |
| `src/preload/preload.ts` | resetSession/getMemories/addMemory/deleteMemory 桥接 |
| `src/renderer/electron.d.ts` | MemoryEntry 全局类型 + ElectronAPI 方法签名 |
| `src/renderer/components/MemoryView.tsx` | 记忆管理 UI 面板 |
| `src/renderer/components/Sidebar.tsx` | 侧栏「记忆」入口 |
| `src/renderer/components/ChatArea.tsx` | 「+」新建对话按钮(清空会话) |
| `src/renderer/App.tsx` | memory tab 路由 |
