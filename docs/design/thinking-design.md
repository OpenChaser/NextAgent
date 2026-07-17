# 模型思考模式（Thinking / Reasoning）— 设计文档

> 本文档描述 NextAgent 对 DeepSeek 等支持「思考模式」的模型的接入：主进程开启思考、流式透传 `reasoning_content`、渲染层折叠展示思考过程、对话历史持久化。

## 一、总体架构

思考模式横跨主进程与渲染进程。DeepSeek（V3.1+ / V4 / deepseek-reasoner）在开启思考后，流式响应中**思考内容**与**最终回答**分属不同字段：

```
┌──────────────────────────────────────────────────────────┐
│ 主进程 main.ts                                            │
│  - isDeepSeekThinkingModel 判定（deepseek 且非 flash）  │
│  - 请求加 enable_thinking: true                          │
│  - 流式捕获 delta.reasoning_content                      │
│  - chat:chunk { reasoning } 透传                         │
└────────────────────────┬─────────────────────────────────┘
                          │ IPC chat:chunk
┌─────────────────────────▼─────────────────────────────────┐
│ 渲染层 ChatArea.tsx                                        │
│  - onChatChunk 累积 reasoning 到 Message.reasoning       │
│  - ReasoningItem 折叠组件（琥珀色，仿 ToolCallItem）     │
│  - MessageBubble 在正文上方渲染思考过程（默认折叠）       │
│  - onMessagesChange 持久化 reasoning 到 tasks.json       │
└──────────────────────────────────────────────────────────┘
```

## 二、DeepSeek 思考模式机制

### 流式响应字段

DeepSeek 开启思考后，流式 chunk 的 `delta` 中会包含两个独立字段：

| 字段 | 含义 | 出现时机 |
|------|------|----------|
| `delta.content` | 最终回答正文 | 思考完成后 |
| `delta.reasoning_content` | 思考链内容 | 回答之前（思考阶段） |

> 参考 DeepSeek 官方 API：`reasoning_content` 用于 deepseek-reasoner 模型，作为思维链内容输出。普通 `deepseek-chat` 不产生该字段。

### 开启参数

DeepSeek 新版支持通过请求参数开启思考：

```json
{ "enable_thinking": true }
```

本项目对 DeepSeek 系列模型（非 flash 版）自动开启，见 [main.ts](../../src/main/main.ts)：

```typescript
const isDeepSeekThinkingModel = /deepseek/i.test(effectiveModel) && !/flash/i.test(effectiveModel)
// ...
...(isDeepSeekThinkingModel ? { enable_thinking: true } : {})
```

> flash 版（如 deepseek-v4-flash）通常不支持思考模式，故排除，避免无效参数报错。

## 三、数据流

### 3.1 流式思考透传

1. 主进程 `for await (const chunk of stream)` 循环中，分别捕获 `delta.content` 与 `delta.reasoning_content`
2. 思考内容经 `win.send('chat:chunk', { reasoning: reasoningDelta })` 透传
3. 正文仍走 `{ content: delta.content }`

### 3.2 渲染层累积

[ChatArea.tsx](../../src/renderer/components/ChatArea.tsx) 的 `onChatChunk` 回调：

```typescript
setMessages((prev) =>
  prev.map((m) => {
    if (m.id !== targetId) return m
    const next: Message = { ...m }
    if (data.content) next.content = (m.content || '') + data.content
    if (data.reasoning) next.reasoning = (m.reasoning || '') + data.reasoning
    return next
  })
)
```

思考与正文分别累积到 `Message.reasoning` 与 `Message.content`，互不污染。

### 3.3 折叠展示

`ReasoningItem` 组件（仿 `ToolCallItem` 的折叠范式）：

- 默认折叠，只显示标题栏「思考过程」+ 🧠 图标 + 箭头
- 点击展开，显示完整 `reasoning` 文本（`whitespace-pre-wrap` 保留换行）
- 琥珀色（amber）视觉风格，与工具调用的灰色区分

在 MessageBubble 中，`ReasoningItem` 渲染在 mentions 之后、正文气泡之前：

```
┌─────────────────────────┐
│ ▸ 🧠 思考过程          │ ← 折叠态，点击展开
├─────────────────────────┤
│ [正文气泡]              │ ← 最终回答
│ 🔧 tool_call (若有)     │
└─────────────────────────┘
```

### 3.4 持久化

`Message.reasoning` 随 `onMessagesChange` 回调写入 `tasks.json`，切换任务恢复历史时思考内容一并恢复。

> 注意：主进程发给 LLM 的 `messages` 历史**不包含** reasoning（`messages.push` 只存 content + tool_calls）。DeepSeek 多轮对话中 reasoning 由模型自行管理，无需回传。

## 四、类型定义

### ChatChunkData（[electron.d.ts](../../src/renderer/electron.d.ts)）

```typescript
interface ChatChunkData {
  content?: string    // 改为可选，思考 chunk 可能只有 reasoning
  reasoning?: string   // 新增：思考内容增量
  agentId?: string
  agentName?: string
}
```

### Message（[ChatArea.tsx](../../src/renderer/components/ChatArea.tsx)）

```typescript
interface Message {
  // ...原有字段
  reasoning?: string   // 新增：思考链内容
}
```

preload.ts 的 `onChatChunk` 签名同步更新为 `content?` + `reasoning?`。

## 五、关键代码索引

| 文件 | 职责 |
|------|------|
| [src/main/main.ts](../../src/main/main.ts) | `isDeepSeekThinkingModel` 判定、`enable_thinking` 参数、`reasoning_content` 流式捕获 |
| [src/preload/preload.ts](../../src/preload/preload.ts) | `onChatChunk` 签名补 `reasoning` 字段 |
| [src/renderer/electron.d.ts](../../src/renderer/electron.d.ts) | `ChatChunkData.reasoning` 类型 |
| [src/renderer/components/ChatArea.tsx](../../src/renderer/components/ChatArea.tsx) | `Message.reasoning`、`ReasoningItem` 组件、`onChatChunk` 累积、MessageBubble 渲染 |

## 六、设计要点

| 要点 | 选择 | 理由 |
|------|------|------|
| 开启策略 | 仅 deepseek 非 flash 自动开启 | flash 不支持思考，避免无效参数；其他模型 provider 参数语义不同，不强制 |
| 思考字段 | `reasoning_content`（DeepSeek 协议） | 官方流式字段，独立于 content |
| 透传方式 | 复用 `chat:chunk` 加 `reasoning` 字段 | 不新增 IPC 事件，最小改动 |
| 展示方式 | 默认折叠（仿 ToolCallItem） | 思考内容冗长，默认折叠不干扰阅读；需要时可展开 |
| 持久化 | reasoning 随 Message 存入 tasks.json | 切任务恢复历史时思考可见 |
| 主进程历史 | 不存 reasoning | DeepSeek 多轮自行管理，避免协议不一致 |

## 七、已知限制

- `enable_thinking` 参数名基于 DeepSeek 文档；若 provider 透传层（如 OpenRouter）参数语义不同，可能需按 provider 适配。
- 非 DeepSeek 模型（如 Qwen/GLM）的思考字段可能不同（如 `reasoning` 而非 `reasoning_content`），当前仅适配 DeepSeek。
- flash 版模型被排除，若后续 flash 支持思考需调整正则。
