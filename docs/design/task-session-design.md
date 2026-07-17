# 任务会话（Task Session）— 设计文档

> 本文档描述 NextAgent 中「任务/会话」子系统的实现原理：任务列表持久化、新建任务触发新会话、LLM 自动生成任务标题、侧边栏任务列表与切换、对话历史恢复。

## 一、总体架构

任务会话模块横跨渲染进程（App / Sidebar / ChatArea）与主进程（main.ts）。任务列表与对话历史落盘到 `~/.nextagent/tasks.json`，标题由主进程非流式调用 LLM 生成。

```
┌──────────────────────────────────────────────────────┐
│ 渲染层                                                 │
│  App.tsx (tasks/currentTaskId 状态 + 持久化回调)       │
│   ├─ Sidebar.tsx (任务列表渲染 + 新建/切换)            │
│   └─ ChatArea.tsx (key={taskId} 重置 + 取标题 + 持久化)│
└────────────────────────┬─────────────────────────────┘
                          │ IPC (tasks:get/add/update/delete, llm:generateTitle)
┌─────────────────────────▼─────────────────────────────┐
│ 主进程 main.ts                                         │
│   ├─ tasks.json 持久化 (仿 agents.json)               │
│   ├─ tasks CRUD IPC (4个)                             │
│   └─ llm:generateTitle (非流式 LLM，仿 summarizeMessages)│
└───────────────────────────────────────────────────────┘
```

## 二、数据结构

### TaskItem

定义于三处（保持一致）：

- `src/renderer/electron.d.ts`（渲染层类型，全局可见）
- `src/preload/preload.ts`（preload 本地副本，与 main tsconfig 隔离）
- `src/main/main.ts`（主进程本地 interface）

```ts
interface TaskItem {
  id: string          // 如 `task-${Date.now()}`
  title: string       // 由 LLM 生成的简短名称，初始占位「新任务」
  messages: any[]     // 该任务的对话历史（Message[]，含 role/content/tool_calls 等）
  createdAt: number
  updatedAt: number
}
```

### 持久化文件

`~/.nextagent/tasks.json`，JSON 数组：

```json
[
  { "id": "task-1", "title": "查询天气", "messages": [...], "createdAt": 0, "updatedAt": 0 }
]
```

## 三、IPC 事件

| 事件 | 方向 | preload API | 用途 |
|------|------|-------------|------|
| `tasks:get` | renderer→main (invoke) | `getTasks()` | 读取全部任务 |
| `tasks:add` | renderer→main (invoke) | `addTask(task)` | 新增任务 |
| `tasks:update` | renderer→main (invoke) | `updateTask(task)` | 更新任务（标题/消息） |
| `tasks:delete` | renderer→main (invoke) | `deleteTask(id)` | 删除任务 |
| `llm:generateTitle` | renderer→main (invoke) | `generateTitle({message, model})` | 非流式生成标题 |

主进程 handler 位于 `src/main/main.ts`，复用 `readJsonFileSync/writeJsonFileSync` 与 `ensureModelsFile/getModelsFilePath` 的 provider 解析逻辑。

## 四、数据流

### 4.1 新建任务

1. 用户点击 Sidebar「新建任务」（`menuItems[0]`，`id: 'new-task'`）
2. `App.createTask()` 生成 `TaskItem{id, title:'新任务', messages:[]}`
3. `window.electronAPI.addTask(task)` 落盘
4. `setTasks([newTask, ...prev])` + `setCurrentTaskId(newTask.id)`
5. `window.electronAPI.resetSession()` 清空主进程 sessionContext（保证新任务上下文干净）
6. `ChatArea` 因 `key={currentTaskId}` 变化而重新挂载 → `messages` 重置为 `initialMessages`（空）

### 4.2 标题生成（首条消息后异步）

1. `ChatArea.handleSend` 在 `initialMessages.length === 0`（首条消息）时触发
2. `window.electronAPI.generateTitle({ message: userContent, model: selectedModel })`
3. 主进程非流式调用 LLM（system prompt：「请根据用户的首条消息生成一个简短的任务标题，4到10个字，只输出标题文字，不要标点符号和引号」）
4. 返回 title → `onTitleGenerated(taskId, title)` 回调
5. `App.handleTitleGenerated` 更新 `tasks` state + `updateTask` 落盘
6. Sidebar 任务项标题实时更新（React state 驱动）

失败时（provider 缺失/key 为空/异常）返回空串，不阻塞主流程。

### 4.3 对话历史持久化

1. `ChatArea` 在 `onChatDone` / `onChatError` 回调中，通过 `setTimeout(0)` 在 state 稳定后读取最新 `messages`
2. `onMessagesChange(taskId, messages)` 回调到 `App`
3. `App.handleMessagesChange` 更新 `tasks` state + `updateTask` 落盘

### 4.4 切换任务（恢复历史）

1. 用户点击 Sidebar 任务项
2. `App.selectTask(id)` → `setCurrentTaskId(id)` + `resetSession()`
3. `ChatArea` 因 `key` 变化重新挂载，`initialMessages` 取自 `tasks.find(id)?.messages`
4. 历史对话渲染显示，新会话从干净的主进程上下文开始

> **当前限制**：切换任务时主进程 `sessionContext` 被重置，新发送的消息不会携带该任务之前的对话上下文给 LLM（UI 显示历史，但 LLM 视角是新会话）。多轮上下文的跨任务恢复为主进程会话管理的后续增强项。

## 五、关键代码索引

| 文件 | 职责 |
|------|------|
| [src/renderer/App.tsx](../../src/renderer/App.tsx) | tasks/currentTaskId 状态、CRUD 回调、ChatArea key 重置 |
| [src/renderer/components/Sidebar.tsx](../../src/renderer/components/Sidebar.tsx) | 任务列表渲染、新建/切换入口 |
| [src/renderer/components/ChatArea.tsx](../../src/renderer/components/ChatArea.tsx) | 接收 taskId/initialMessages、取标题、持久化消息 |
| [src/main/main.ts](../../src/main/main.ts) | TaskItem interface、tasks.json 持久化、tasks CRUD IPC、llm:generateTitle IPC |
| [src/preload/preload.ts](../../src/preload/preload.ts) | tasks/generateTitle API 桥接、TaskItem 本地类型 |
| [src/renderer/electron.d.ts](../../src/renderer/electron.d.ts) | TaskItem 类型、ElectronAPI 接口扩展 |

## 六、设计要点

| 要点 | 选择 | 理由 |
|------|------|------|
| 状态管理 | App.tsx useState（无全局 store） | 项目无 zustand/redux，props 下发最轻量 |
| 持久化 | 主进程 tasks.json（仿 agents.json） | 与项目既有的 agents.json/memory.json 模式一致 |
| 标题时机 | 首条消息发送后异步 | 不阻塞流式回复，体验好 |
| 任务重置 | ChatArea key={taskId} | 复用 React key 机制，强制重置内部 state |
| 会话隔离 | 切任务调用 resetSession() | 清空主进程单例 sessionContext |
| 防御性返回 | generateTitle 失败返回空串 | 标题为锦上添花，失败不阻塞主流程 |
