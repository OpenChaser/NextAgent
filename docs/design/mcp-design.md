# MCP(Model Context Protocol)— 设计文档

> 本文档描述 NextAgent 中 MCP 子系统的实现原理:自研 JSON-RPC 协议、stdio/sse 双传输、工具前缀隔离、一会话一生命周期。

## 一、总体架构

NextAgent 的 MCP 实现**未使用官方 `@modelcontextprotocol/sdk`**,而是基于 Node.js 原生模块(`child_process`、`http`/`https`)手写 JSON-RPC 2.0 协议。分布在 4 个核心文件:

```
┌───────────────────────────────────────────────────────┐
│ 渲染层 McpSettings.tsx ←→ window.electronAPI          │
│   (getMcpServers/saveMcpServer/delete/toggle)          │
└────────────────────────┬──────────────────────────────┘
                          │ IPC
┌─────────────────────────▼──────────────────────────────┐
│ 主进程 main.ts                                          │
│   ├─ IPC: mcp:get/save/delete/toggle                   │
│   ├─ readMcpServers/writeMcpServers ←→ ~/.nextagent/mcp.json │
│   └─ chat:send: new McpManager() → connectAll          │
│        → 合并工具 → callTool → disconnectAll(finally)  │
│                                                         │
│  mcp/mcpManager.ts (McpManager)                         │
│    ├─ readEnabledServers() (仅 enabled)                 │
│    ├─ createClient() → stdio 或 sse                     │
│    ├─ connectAll(): 连接 + listTools + 注册(mcp__ 前缀)  │
│    ├─ getToolDefinitions() → ChatTool[]                 │
│    ├─ isMcpTool() / callTool()                          │
│    └─ disconnectAll()                                   │
│                                                         │
│  mcp/mcpClient.ts (McpStdioClient)                      │
│    spawn() → stdin/stdout JSON-RPC 2.0                  │
│                                                         │
│  mcp/mcpSseClient.ts (McpSseClient)                     │
│    GET /sse → endpoint → POST JSON-RPC 2.0             │
└─────────────────────────────────────────────────────────┘
```

---

## 二、核心类型

### McpServer 接口

```typescript
type McpTransport = 'stdio' | 'sse'

interface McpServer {
  id: string              // 唯一标识 mcp-{timestamp}
  name: string            // 服务器名称
  transport: McpTransport // 传输方式
  command?: string        // stdio: 可执行命令
  args?: string[]         // stdio: 命令参数
  env?: Record<string, string>  // stdio: 环境变量
  url?: string            // sse: 远程 URL
  enabled: boolean        // 是否启用
}
```

### McpTransportClient 统一抽象接口

```typescript
interface McpTransportClient {
  connect(): Promise<void>
  listTools(): Promise<McpToolInfo[]>
  callTool(name: string, args: Record<string, unknown>): Promise<string>
  disconnect(): Promise<void>
  readonly isConnected: boolean
}
```

stdio 和 sse 两种传输都实现这 5 个方法,上层管理器无需感知传输差异。

### McpToolInfo

```typescript
interface McpToolInfo {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}
```

---

## 三、McpManager 管理器

`src/main/mcp/mcpManager.ts` 的 `McpManager` 类是核心管理器。

### 3.1 内部状态

```typescript
private clients = new Map<string, McpTransportClient>()  // serverName → client
private tools = new Map<string, RegisteredTool>()          // prefixedName → tool
private connected = false
```

工具注册用 `mcp__` 前缀隔离:

```typescript
const PREFIX = 'mcp__'

interface RegisteredTool {
  serverName: string       // 所属服务器
  originalName: string     // MCP 原始工具名
  prefixedName: string     // mcp__serverName__toolName
  description: string
  schema: McpToolInfo['inputSchema']
}
```

### 3.2 connectAll() — 连接与注册

```typescript
async connectAll(): Promise<void> {
  if (this.connected) return          // 幂等
  const servers = readEnabledServers() // 只读 enabled=true
  for (const server of servers) {
    const client = createClient(server)  // 工厂:stdio 或 sse
    if (!client) continue
    try {
      await client.connect()
      this.clients.set(server.name, client)
      const tools = await client.listTools()
      for (const tool of tools) {
        const prefixed = `${PREFIX}${server.name}__${tool.name}`
        this.tools.set(prefixed, { serverName, originalName: tool.name, ... })
      }
    } catch (error) {
      console.error(`[MCP] 连接 ${server.name} 失败:`, error)
      // 单个失败不影响其他
    }
  }
  this.connected = true
}
```

### 3.3 工具定义导出

```typescript
getToolDefinitions(): ChatTool[] {
  return Array.from(this.tools.entries()).map(([name, reg]) => ({
    type: 'function',
    function: {
      name,
      description: `[MCP/${reg.serverName}] ${reg.description}`,
      parameters: reg.schema || { type: 'object', properties: {} },
    },
  }))
}
```

description 加 `[MCP/服务器名]` 前缀标记来源。

### 3.4 调用分流

```typescript
isMcpTool(name: string): boolean {
  return name.startsWith(PREFIX)   // 判断 mcp__ 前缀
}

async callTool(name: string, args): Promise<string> {
  const reg = this.tools.get(name)
  const client = this.clients.get(reg.serverName)
  return await client.callTool(reg.originalName, args)  // 用原始名调用
}
```

---

## 四、stdio 传输 — McpStdioClient

通过 `child_process.spawn` 启动 MCP 服务器子进程,stdin/stdout 交换 JSON-RPC。

### connect()

```typescript
this.process = spawn(this.command, this.args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, ...this.env },
  shell: process.platform === 'win32',  // Windows 用 shell
})

// stdout: 按行解析 JSON-RPC 响应
this.process.stdout.on('data', (chunk) => {
  this.buffer += chunk
  this.handleStream()   // buffer.indexOf('\n') 分行
})

// 请求发送:写入 stdin
this.process.stdin.write(JSON.stringify(req) + '\n')
```

### 通信机制

- **请求**:序列化 JSON-RPC 后写入 `proc.stdin.write(JSON + '\n')`
- **响应**:stdout 按行读取,解析 JSON 后按 `id` 匹配 pending Promise
- **pending Map**:`Map<number, { resolve, reject }>`,递增 `nextId` 关联

### initialize() 握手

```typescript
await this.sendRequest('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'NextAgent', version: '1.0.0' },
})
await this.sendRequest('notifications/initialized', {})
```

### disconnect()

关闭 stdin,kill 进程,清空 pending Map。

---

## 五、sse 传输 — McpSseClient

通过 HTTP GET 建立 SSE 长连接接收响应,HTTP POST 发送请求。

### connect()

```typescript
const lib = this.url.startsWith('https') ? https : http
const req = lib.get(this.url, { headers: { Accept: 'text/event-stream' } }, (res) => {
  this.responseStream = res
  res.on('data', (chunk) => {
    this.buffer += chunk
    this.handleSseData()   // 按 \n\n 分割事件块
  })
  this.eventBus.once('endpoint', resolve)  // 等 endpoint 事件
})
```

### SSE 事件解析

- 按 `\n\n` 分割事件块
- 解析 `event:` 和 `data:` 行
- `event: endpoint` → 记录消息端点 URL
- `event: message` → 解析 JSON-RPC 响应,按 id 匹配 pending

### sendRequest()

```typescript
const id = this.nextId++
const req = { jsonrpc: '2.0', id, method, params }
this.pending.set(id, { resolve, reject })
// 通过 HTTP POST 发送到 endpoint
const request = lib.request(this.endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
})
request.write(JSON.stringify(req))
request.end()
```

**与 stdio 的区别**:stdio 用 stdin 通道写请求,stdout 读响应(双向管道);sse 用 POST 发请求,GET 长连接收响应(单向流)。

### 共同协议

两者都实现相同的 MCP 方法:
1. `initialize` 握手
2. `notifications/initialized` 通知
3. `tools/list` 获取工具列表
4. `tools/call` 调用工具

响应解析逻辑一致:提取 `content` 数组中 `type: 'text'` 的内容,处理 `isError` 标志。

---

## 六、配置文件与双读路径

配置文件:`~/.nextagent/mcp.json`

**双读路径设计**:

| 函数 | 位置 | 过滤 | 用途 |
|------|------|------|------|
| `readMcpServers()` | main.ts IPC 层 | 返回全部(含 disabled) | 供 UI 显示 |
| `readEnabledServers()` | mcpManager 运行时 | 只返回 enabled=true | 供连接 |

IPC 层返回全部给 UI 管理,运行时只读启用的进行连接。

### IPC Handlers

| 通道 | 功能 |
|------|------|
| `mcp:get` | 返回全部服务器配置 |
| `mcp:save` | 按 id 新增或更新 |
| `mcp:delete` | 按 id 删除 |
| `mcp:toggle` | 翻转 enabled 状态 |

---

## 七、chat:send 生命周期

**一会话一生命周期**设计:每次 chat:send 新建 McpManager,在 finally 中断开。

```
chat:send 开始
  ├─ new McpManager()
  ├─ try:
  │    ├─ connectAll()           ← 连接所有 enabled 服务器
  │    ├─ 合并工具: [...内置, ...mcp]
  │    ├─ 多轮对话循环:
  │    │    └─ isMcpTool(name)?
  │    │         ├─ yes → mcpManager.callTool()
  │    │         └─ no  → executeTool()
  │    └─ chat:done
  ├─ catch → chat:error
  └─ finally:
       └─ mcpManager.disconnectAll()  ← 无论成功失败都断开
```

```typescript
const mcpManager = new McpManager()
try {
  await mcpManager.connectAll()
  // ... 对话循环 ...
} catch (error) {
  win.send('chat:error', { message: error.message })
} finally {
  await mcpManager.disconnectAll()   // 确保清理
}
```

---

## 八、工具合并与执行分流

### 合并

```typescript
const tools = [...getToolDefinitions(), ...mcpManager.getToolDefinitions()]
```

内置 8 个工具 + MCP 工具合并为 ChatTool[] 传给 LLM。

### 分流执行

```typescript
const result = mcpManager.isMcpTool(tc.name)
  ? await mcpManager.callTool(tc.name, toolArgs)   // mcp__ 前缀 → MCP
  : await executeTool(tc.name, toolArgs)           // 否则 → 内置
```

LLM 看到的工具名带 `mcp__服务器名__` 前缀,执行时去掉前缀用 `originalName` 调用。

---

## 九、渲染层管理 UI

`McpSettings.tsx` 提供完整管理界面:

- **表单区**:名称、传输方式下拉(stdio/sse),根据 transport 动态显示字段
  - stdio: command + args(空格分隔) + env(多行 KEY=VALUE)
  - sse: url
- **列表区**:每个服务器卡片显示名称、transport 徽章(蓝/紫)、enabled 徽章(绿/灰)、命令或 URL,配三个操作:启用/停用、编辑、删除

---

## 十、关键设计权衡

| 决策点 | 选择 | 理由 |
|--------|------|------|
| SDK 选型 | 自研 JSON-RPC,不用官方 SDK | 零依赖,完全可控 |
| 工具隔离 | mcp__服务器名__ 前缀 | 与内置工具命名空间隔离 |
| 生命周期 | 一会话一生命周期(finally disconnect) | 避免连接泄漏,异常也能清理 |
| 双读路径 | IPC 全部 / 运行时 enabled | UI 需看全部,运行时只连启用的 |
| 容错 | 单服务器失败不影响其他 | for 循环 + try-catch |
| 幂等 | connectAll 已连接直接返回 | 防重复连接 |

---

## 十一、相关文件索引

| 文件 | 职责 |
|------|------|
| `src/main/mcp/types.ts` | McpToolInfo / McpTransportClient 接口 |
| `src/main/mcp/mcpClient.ts` | McpStdioClient(stdio 传输) |
| `src/main/mcp/mcpSseClient.ts` | McpSseClient(sse 传输) |
| `src/main/mcp/mcpManager.ts` | McpManager 管理器(连接/注册/调用/断开) |
| `src/main/main.ts` | MCP IPC handlers + chat:send 生命周期 |
| `src/preload/preload.ts` | 4 个 MCP 方法桥接 |
| `src/renderer/components/McpSettings.tsx` | MCP 管理 UI |
