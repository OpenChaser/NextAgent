# 内置 Agent(Built-in Agent)— 设计文档

> 本文档描述 NextAgent 中内置 Agent 的实现原理:AgentConfig 类型、Plan/Build 双 agent、持久化与自动修复、保护机制、chat 时配置注入。

## 一、总体架构

内置 Agent 系统由三层协同实现,围绕 `~/.nextagent/agents.json` 配置文件:

```
┌──────────────────────────────────────────────────┐
│  渲染层 (Renderer)                                │
│  ChatArea.tsx (selectedAgent 状态)                │
│  AgentPopover.tsx (选择/切换 UI)                  │
│  AgentConfigView.tsx (编辑/删除 UI,builtin 保护)  │
└──────────────────────┬───────────────────────────┘
                        │ IPC (invoke/handle)
┌──────────────────────▼───────────────────────────┐
│  主进程 (Main)                                     │
│  main.ts                                           │
│   ├─ getBuiltinAgents(): Plan + Build              │
│   ├─ ensureAgentsFile(): 自动修复缺失内置项         │
│   ├─ IPC: agents:get/add/update/delete/getSelected │
│   └─ chat:send: 加载 agent 配置注入 systemPrompt 等 │
└──────────────────────┬───────────────────────────┘
                        │
                        ▼
        ~/.nextagent/agents.json (持久化)
        ~/.nextagent/preferences.json (selectedAgentId)
```

---

## 二、AgentConfig 接口

接口在主进程、预加载、渲染层各定义一份,字段完全一致:

```typescript
interface AgentConfig {
  id: string              // 唯一标识,内置 agent 用 builtin- 前缀
  name: string            // 显示名称
  description: string     // 一句话简介
  systemPrompt: string    // 系统提示词
  model: string           // 指定模型;空字符串回退到用户选择
  temperature: number     // 采样温度
  maxTokens: number       // 最大输出 token
  toolsEnabled: boolean   // 是否允许工具调用
  builtin: boolean        // 是否内置(受保护,不可删除)
  createdAt: number
  updatedAt: number
}
```

| 字段 | 含义 |
|------|------|
| `id` | 内置 agent 用 `builtin-plan`/`builtin-build` |
| `model` | 空字符串表示不锁定,回退到用户选定的 model |
| `builtin` | `true` 时删除被拒(双重保护) |

---

## 三、Plan 与 Build 双 Agent

`getBuiltinAgents()` 返回两个内置 agent,形成「规划→执行」协作链。

### Plan Agent

```typescript
{
  id: 'builtin-plan',
  name: 'Plan',
  description: '规划与分析智能体:只读分析代码库,制定实现方案,不修改任何代码',
  systemPrompt: 'You are a planning agent focused on analysis and architectural design...',
  model: '',              // 不锁定模型
  temperature: 0.1,       // 低温度,输出稳定确定
  maxTokens: 8192,
  toolsEnabled: true,     // 允许只读工具
  builtin: true,
}
```

**Plan 职责**:只读分析代码库架构,拆解复杂需求为可执行计划,识别风险与依赖,产出 Build agent 可执行的步骤方案。明确要求**不修改任何代码**。

### Build Agent

```typescript
{
  id: 'builtin-build',
  name: 'Build',
  description: '构建与实现智能体:编写和修改代码,执行实现方案,验证编译通过',
  systemPrompt: 'You are a build agent focused on implementing code changes...',
  model: '',
  temperature: 0.3,       // 略高,保留少量创造性
  maxTokens: 8192,
  toolsEnabled: true,     // 允许写操作与编译验证
  builtin: true,
}
```

**Build 职责**:按计划逐步实现代码,创建/修改文件,运行 typecheck 与 build 验证编译,修复错误,保持改动最小化。

### 协作设计

两者 `temperature` 差异(0.1 vs 0.3)体现角色定位:Plan 需高确定性分析,Build 需少量创造性实现。`toolsEnabled` 均为 true,但通过 systemPrompt 约束 Plan 只做只读操作。

---

## 四、ensureAgentsFile() 自动修复

三层保障机制:

```typescript
function ensureAgentsFile(): void {
  // 第一层:确保目录存在
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  // 第二层:文件不存在 → 直接写入内置 agents
  if (!fs.existsSync(filePath)) {
    writeJsonFileSync(filePath, getBuiltinAgents())
    return
  }

  // 第三层:文件存在但损坏或缺少内置项 → 修复
  let agents = readJsonFileSync<AgentConfig[]>(filePath)
  if (!Array.isArray(agents)) {
    agents = getBuiltinAgents()     // 整体重建
    writeJsonFileSync(filePath, agents)
    return
  }
  // missing 检测:按 id 找出缺失的内置 agent
  const missing = builtins.filter((b) => !agents.some((a) => a.id === b.id))
  if (missing.length > 0) {
    agents.push(...missing)          // 只追加,不覆盖用户自定义
    writeJsonFileSync(filePath, agents)
  }
}
```

关键点:
- **按 id 检测**:只看 id 是否存在,不校验字段内容(用户编辑过内置 agent 不会被重置)
- **只追加**:缺失项追加,不影响已有 agent
- **自动修复**:每次 agents:get 前调用,保证内置 agent 永远在位

---

## 五、文件路径与读写

| 文件 | 路径 | 用途 |
|------|------|------|
| agents.json | `~/.nextagent/agents.json` | 全部 agent 配置 |
| preferences.json | `~/.nextagent/preferences.json` | selectedAgentId 选中状态 |

读写工具函数:
- `readJsonFileSync`:读取 + 去 BOM + JSON.parse,失败返回 null
- `writeJsonFileSync`:JSON.stringify(data, null, 2) + 写入

**选中状态与 agents.json 解耦**,单独存在 preferences.json,避免删除 agent 时选中状态混乱。

---

## 六、IPC Handlers

| 通道 | 功能 |
|------|------|
| `agents:get` | 返回全部 agent,builtin 降序排序(内置在前) |
| `agents:add` | 按 id 去重追加 |
| `agents:update` | 展开合并 + 刷新 updatedAt |
| `agents:delete` | **builtin 保护**:true 时返回 false 拒绝 |
| `agents:getSelected` | 从 preferences.json 读 selectedAgentId |
| `agents:setSelected` | 写 selectedAgentId 到 preferences.json |

全部使用 `ipcMain.handle`(双向,可返回 Promise),preload 用 `ipcRenderer.invoke` 桥接。

---

## 七、删除保护机制

**双重保护**:

1. **主进程侧**:`agents:delete` handler 检查 `target?.builtin`,为 true 直接返回 false:
```typescript
const target = agents.find((a) => a.id === agentId)
if (target?.builtin) return false   // 拒绝删除
```

2. **渲染层**:删除按钮 `disabled={agent.builtin}`,tooltip 显示「内置智能体不可删除」

即使绕过 UI,主进程也会拒绝。且 `ensureAgentsFile()` 会在下次启动时自动补回缺失的内置项。

---

## 八、chat:send 配置注入

`chat:send` handler 加载 agent 配置并注入四个维度:

```typescript
if (agentId) {
  const agent = agents.find((a) => a.id === agentId)
  if (agent) {
    agentSystemPrompt = agent.systemPrompt
    agentTemperature = agent.temperature
    agentMaxTokens = agent.maxTokens
    if (agent.model) effectiveModel = agent.model   // 非空才覆盖
  }
}
```

| 维度 | 注入方式 |
|------|----------|
| systemPrompt | 作为 messages[0] = { role:'system', content } |
| temperature | 条件展开 `...(agentTemperature !== undefined ? { temperature } : {})` |
| maxTokens | 安全限制后条件展开(上限 393216) |
| model | agent.model 非空时覆盖用户选择的 model |
| toolsEnabled | false 时 effectiveTools = [] 禁用工具 |

**model 回退**:内置 Plan/Build 的 `model: ''`,因此始终使用用户选定的模型,不强制锁定。

---

## 九、渲染层选择流程

```
应用启动
  └─ ChatArea useEffect:
       ├─ getAgents() → 返回 builtin 优先排序的列表
       ├─ getSelectedAgent() → 读 savedId
       ├─ savedId 匹配 → 选中该 agent
       ├─ 无匹配 + agents.length > 0 → 默认选 agents[0](通常是 Plan)
       │   └─ setSelectedAgent(agent.id) 持久化
       └─ setSelectedAgent + setSelectedModel(agent.model)

用户切换 (AgentPopover)
  └─ handleSelectAgent:
       ├─ setSelectedAgent(agent)        (内存)
       ├─ setSelectedModel(agent.model) (同步模型)
       └─ window.electronAPI.setSelectedAgent(agent.id) (持久化)

发送消息
  └─ sendChatMessage({ message, model: agent.model||selectedModel, agentId })
```

---

## 十、关键设计权衡

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Agent 配置存哪 | agents.json + preferences.json 解耦 | 删除 agent 不影响选中状态 |
| 内置 agent 保护 | builtin 字段 + 双重校验 | UI + 主进程双重防线 |
| 自动修复 | ensureAgentsFile missing 检测 | 内置 agent 永远在位,用户编辑不被覆盖 |
| model 回退 | 空字符串回退到用户选择 | 内置 agent 不强制锁定模型 |
| 默认选中 | agents[0](builtin 优先) | 首次启动默认选 Plan |
| 排序 | builtin 降序 | 内置 agent 显示在前 |

---

## 十一、相关文件索引

| 文件 | 职责 |
|------|------|
| `src/main/main.ts` | getBuiltinAgents / ensureAgentsFile / IPC handlers / chat:send 注入 |
| `src/preload/preload.ts` | 6 个 agent 方法的 contextBridge 桥接 |
| `src/renderer/electron.d.ts` | AgentConfig 全局类型 + ElectronAPI 方法签名 |
| `src/renderer/components/AgentPopover.tsx` | agent 选择下拉 UI |
| `src/renderer/components/AgentConfigView.tsx` | agent 编辑/删除 UI(builtin 保护) |
| `src/renderer/components/ChatArea.tsx` | selectedAgent 状态与发送时传 agentId |
