import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import OpenAI from 'openai'
import { getToolDefinitions, executeTool } from './tools'
import { showAbout } from './about'
import { McpManager } from './mcp/mcpManager'
import { ensureSkillsDirs, loadSkills, loadGlobalSkills, saveSkill, deleteSkill } from './skills'
import type { SkillFile, SkillSource } from './skills'

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const isDev = !app.isPackaged

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    frame: true,
    title: 'NextAgent',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: isDev,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    setTimeout(() => {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }, 1000)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Render process crashed:', details)
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('Render process unresponsive')
  })
}

const menuTemplate: Electron.MenuItemConstructorOptions[] = [
  {
    label: '编辑(E)',
    submenu: [
      { role: 'undo', label: '撤销' },
      { role: 'redo', label: '重做' },
      { type: 'separator' },
      { role: 'cut', label: '剪切' },
      { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' },
      { role: 'selectAll', label: '全选' },
    ],
  },
  {
    label: '窗口(W)',
    submenu: [
      { role: 'minimize', label: '最小化' },
      { role: 'close', label: '关闭' },
    ],
  },
  {
    label: '帮助(H)',
    submenu: [
      { label: '关于 NextAgent', click: () => showAbout() },
    ],
  },
]

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)
  ensureSkillsDirs()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

interface ModelConfig {
  name: string
  max_input_tokens?: number
}

interface Model {
  id: string
  name: string
  provider: string
  url: string
  key: string
  models: ModelConfig[]
}

function getModelsFilePath(): string {
  const homeDir = os.homedir()
  return path.join(homeDir, '.nextagent', 'models.json')
}

function getDefaultModelsFilePath(): string {
  if (app.isPackaged) {
    return path.join(__dirname, '../data/model.json')
  } else {
    return path.join(__dirname, '../../src/data/model.json')
  }
}

function ensureModelsFile(): void {
  const filePath = getModelsFilePath()
  if (!fs.existsSync(filePath)) {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const defaultFilePath = getDefaultModelsFilePath()
    try {
      if (fs.existsSync(defaultFilePath)) {
        fs.copyFileSync(defaultFilePath, filePath)
      } else {
        const defaultModels: Model[] = [
          { id: 'deepseek-chat', name: 'DeepSeek', provider: 'deepseek', url: 'https://api.deepseek.com', key: '', models: [{ name: 'deepseek-v4-flash', max_input_tokens: 65536 }, { name: 'deepseek-v4-pro', max_input_tokens: 131072 }] },
        ]
        fs.writeFileSync(filePath, JSON.stringify(defaultModels, null, 2), 'utf-8')
      }
    } catch (error) {
      console.error('Failed to initialize models file:', error)
    }
  }
}

ipcMain.handle('models:get', () => {
  ensureModelsFile()
  const filePath = getModelsFilePath()
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const models = JSON.parse(content) as Model[]
    return models
  } catch (error) {
    console.error('Failed to read models file:', error)
    return []
  }
})

ipcMain.handle('models:add', (_event, newModel: Model) => {
  ensureModelsFile()
  const filePath = getModelsFilePath()
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const models = JSON.parse(content) as Model[]

    const exists = models.some((m) => m.id === newModel.id)
    if (!exists) {
      models.push(newModel)
      fs.writeFileSync(filePath, JSON.stringify(models, null, 2), 'utf-8')
    }

    return true
  } catch (error) {
    console.error('Failed to add model:', error)
    return false
  }
})

ipcMain.handle('skills:get', () => {
  return loadSkills()
})

ipcMain.handle('skills:getGlobal', () => {
  return loadGlobalSkills()
})

ipcMain.handle('skills:save', (_event, payload: { skill: SkillFile; target: SkillSource }) => {
  return saveSkill(payload.skill, payload.target)
})

ipcMain.handle('skills:delete', (_event, payload: { source: SkillSource; name: string }) => {
  return deleteSkill(payload.source, payload.name)
})

type McpTransport = 'stdio' | 'sse'

interface McpServer {
  id: string
  name: string
  transport: McpTransport
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  enabled: boolean
}

function getMcpFilePath(): string {
  const homeDir = os.homedir()
  return path.join(homeDir, '.nextagent', 'mcp.json')
}

function ensureMcpFile(): void {
  const filePath = getMcpFilePath()
  if (!fs.existsSync(filePath)) {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    try {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to initialize mcp file:', error)
    }
  }
}

interface AgentConfig {
  id: string
  name: string
  description: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  toolsEnabled: boolean
  builtin: boolean
  createdAt: number
  updatedAt: number
}

function getAgentsFilePath(): string {
  const homeDir = os.homedir()
  return path.join(homeDir, '.nextagent', 'agents.json')
}

function getBuiltinAgents(): AgentConfig[] {
  const now = Date.now()
  return [
    {
      id: 'builtin-plan',
      name: 'Plan',
      description: '规划与分析智能体：只读分析代码库，制定实现方案，不修改任何代码',
      systemPrompt:
        'You are a planning agent focused on analysis and architectural design. Your role is to:\n\n' +
        '- Analyze codebases and understand existing architecture, conventions, and dependencies\n' +
        '- Break down complex requirements into clear, actionable implementation plans\n' +
        '- Identify potential risks, edge cases, and dependencies before any code is written\n' +
        '- Suggest the best approach, file structure, and implementation order\n' +
        '- Review proposed changes and provide constructive, specific feedback\n\n' +
        'You operate in read-only mode: do NOT write or modify any code. Instead, produce detailed, step-by-step plans that the Build agent can execute. ' +
        'Think carefully about each step, consider alternatives, and explain your reasoning. ' +
        'Keep the plan concrete and specific — reference actual files, functions, and modules whenever possible.',
      model: '',
      temperature: 0.1,
      maxTokens: 8192,
      toolsEnabled: true,
      builtin: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'builtin-build',
      name: 'Build',
      description: '构建与实现智能体：编写和修改代码，执行实现方案，验证编译通过',
      systemPrompt:
        'You are a build agent focused on implementing code changes. Your role is to:\n\n' +
        '- Write clean, idiomatic, and maintainable code following existing project conventions\n' +
        '- Execute implementation plans step by step, creating and modifying files as needed\n' +
        '- Run type checks and builds to verify your changes compile correctly\n' +
        '- Fix any errors, type issues, or test failures that arise during implementation\n' +
        '- Keep changes minimal and focused — avoid unnecessary refactoring unless explicitly requested\n\n' +
        'When writing code, first understand the surrounding context: check imports, follow existing patterns, and use the project\u2019s established libraries and utilities. ' +
        'Always prioritize correctness and consistency over cleverness. ' +
        'After making changes, verify they compile and pass checks before declaring the task complete.',
      model: '',
      temperature: 0.3,
      maxTokens: 8192,
      toolsEnabled: true,
      builtin: true,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

function ensureAgentsFile(): void {
  const filePath = getAgentsFilePath()
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(getBuiltinAgents(), null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to initialize agents file:', error)
    }
    return
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const agents = JSON.parse(content) as AgentConfig[]
    const builtins = getBuiltinAgents()
    const missing = builtins.filter((b) => !agents.some((a) => a.id === b.id))
    if (missing.length > 0) {
      agents.push(...missing)
      fs.writeFileSync(filePath, JSON.stringify(agents, null, 2), 'utf-8')
    }
  } catch (error) {
    console.error('Failed to ensure built-in agents:', error)
  }
}

ipcMain.handle('agents:get', () => {
  ensureAgentsFile()
  const filePath = getAgentsFilePath()
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const agents = JSON.parse(content) as AgentConfig[]
    return agents.sort((a, b) => Number(b.builtin) - Number(a.builtin))
  } catch (error) {
    console.error('Failed to read agents file:', error)
    return []
  }
})

ipcMain.handle('agents:add', (_event, newAgent: AgentConfig) => {
  ensureAgentsFile()
  const filePath = getAgentsFilePath()
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const agents = JSON.parse(content) as AgentConfig[]
    const exists = agents.some((a) => a.id === newAgent.id)
    if (!exists) {
      agents.push(newAgent)
      fs.writeFileSync(filePath, JSON.stringify(agents, null, 2), 'utf-8')
    }
    return true
  } catch (error) {
    console.error('Failed to add agent:', error)
    return false
  }
})

ipcMain.handle('agents:update', (_event, updatedAgent: AgentConfig) => {
  ensureAgentsFile()
  const filePath = getAgentsFilePath()
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const agents = JSON.parse(content) as AgentConfig[]
    const index = agents.findIndex((a) => a.id === updatedAgent.id)
    if (index !== -1) {
      agents[index] = { ...agents[index], ...updatedAgent, updatedAt: Date.now() }
      fs.writeFileSync(filePath, JSON.stringify(agents, null, 2), 'utf-8')
      return true
    }
    return false
  } catch (error) {
    console.error('Failed to update agent:', error)
    return false
  }
})

ipcMain.handle('agents:delete', (_event, agentId: string) => {
  ensureAgentsFile()
  const filePath = getAgentsFilePath()
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const agents = JSON.parse(content) as AgentConfig[]
    const target = agents.find((a) => a.id === agentId)
    if (target?.builtin) {
      return false
    }
    const filtered = agents.filter((a) => a.id !== agentId)
    fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to delete agent:', error)
    return false
  }
})

function getPreferencesFilePath(): string {
  const homeDir = os.homedir()
  return path.join(homeDir, '.nextagent', 'preferences.json')
}

function ensurePreferencesFile(): void {
  const filePath = getPreferencesFilePath()
  if (!fs.existsSync(filePath)) {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    try {
      fs.writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to initialize preferences file:', error)
    }
  }
}

function readMcpServers(): McpServer[] {
  ensureMcpFile()
  const filePath = getMcpFilePath()
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const servers = JSON.parse(content) as McpServer[]
    return Array.isArray(servers) ? servers : []
  } catch (error) {
    console.error('Failed to read mcp file:', error)
    return []
  }
}

function writeMcpServers(servers: McpServer[]): void {
  ensureMcpFile()
  const filePath = getMcpFilePath()
  fs.writeFileSync(filePath, JSON.stringify(servers, null, 2), 'utf-8')
}

ipcMain.handle('mcp:get', () => {
  return readMcpServers()
})

ipcMain.handle('mcp:save', (_event, server: McpServer) => {
  try {
    const servers = readMcpServers()
    const index = servers.findIndex((s) => s.id === server.id)
    if (index >= 0) {
      servers[index] = server
    } else {
      servers.push(server)
    }
    writeMcpServers(servers)
    return true
  } catch (error) {
    console.error('Failed to save mcp server:', error)
    return false
  }
})

ipcMain.handle('mcp:delete', (_event, id: string) => {
  try {
    const servers = readMcpServers()
    const filtered = servers.filter((s) => s.id !== id)
    writeMcpServers(filtered)
    return true
  } catch (error) {
    console.error('Failed to delete mcp server:', error)
    return false
  }
})

ipcMain.handle('mcp:toggle', (_event, id: string) => {
  try {
    const servers = readMcpServers()
    const target = servers.find((s) => s.id === id)
    if (target) {
      target.enabled = !target.enabled
      writeMcpServers(servers)
    }
    return true
  } catch (error) {
    console.error('Failed to toggle mcp server:', error)
    return false
  }
})

function readPreferences(): Record<string, unknown> {
  ensurePreferencesFile()
  try {
    const content = fs.readFileSync(getPreferencesFilePath(), 'utf-8')
    return JSON.parse(content) as Record<string, unknown>
  } catch (error) {
    console.error('Failed to read preferences file:', error)
    return {}
  }
}

function writePreferences(prefs: Record<string, unknown>): void {
  ensurePreferencesFile()
  try {
    fs.writeFileSync(getPreferencesFilePath(), JSON.stringify(prefs, null, 2), 'utf-8')
  } catch (error) {
    console.error('Failed to write preferences file:', error)
  }
}

ipcMain.handle('agents:getSelected', () => {
  const prefs = readPreferences()
  return (prefs.selectedAgentId as string) || null
})

ipcMain.handle('agents:setSelected', (_event, agentId: string) => {
  const prefs = readPreferences()
  prefs.selectedAgentId = agentId
  writePreferences(prefs)
  return true
})

interface ChatMessageParams {
  message: string
  model: string
  agentId?: string
}

ipcMain.on('chat:send', async (event, params: ChatMessageParams) => {
  const { message, model, agentId } = params
  const win = event.sender

  // 解析智能体配置（若指定），用于注入 systemPrompt / temperature / maxTokens / model
  let agentSystemPrompt = ''
  let agentTemperature: number | undefined
  let agentMaxTokens: number | undefined
  let effectiveModel = model
  if (agentId) {
    ensureAgentsFile()
    try {
      const content = fs.readFileSync(getAgentsFilePath(), 'utf-8')
      const agents = JSON.parse(content) as AgentConfig[]
      const agent = agents.find((a) => a.id === agentId)
      if (agent) {
        agentSystemPrompt = agent.systemPrompt
        agentTemperature = agent.temperature
        agentMaxTokens = agent.maxTokens
        if (agent.model) {
          effectiveModel = agent.model
        }
      }
    } catch (error) {
      console.error('Failed to load agent for chat:', error)
    }
  }

  console.log(`[Chat] Streaming message to ${effectiveModel}${agentId ? ` (agent: ${agentId})` : ''}: ${message}`)

  // 从 models.json 加载配置，找到对应的 provider
  ensureModelsFile()
  const filePath = getModelsFilePath()
  let providers: Model[] = []
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    providers = JSON.parse(content) as Model[]
  } catch (error) {
    console.error('Failed to read models file:', error)
    win.send('chat:error', { message: '错误：无法读取模型配置文件' })
    return
  }

  // 找到包含该模型的 provider
  const provider = providers.find((p) => p.models.some((m) => m.name === effectiveModel))
  if (!provider) {
    win.send('chat:error', { message: `错误：未找到模型 "${effectiveModel}" 对应的配置` })
    return
  }

  const modelConfig = provider.models.find((m) => m.name === effectiveModel)

  if (!provider.key) {
    win.send('chat:error', { message: `错误：模型提供商 "${provider.name}" 未配置 API Key，请在模型配置中填写` })
    return
  }

  const mcpManager = new McpManager()
  try {
    await mcpManager.connectAll()
    const client = new OpenAI({
      baseURL: provider.url,
      apiKey: provider.key,
    })

    const tools = [...getToolDefinitions(), ...mcpManager.getToolDefinitions()]
    const effectiveTools = (() => {
      if (agentId) {
        const allAgents = JSON.parse(fs.readFileSync(getAgentsFilePath(), 'utf-8')) as AgentConfig[]
        const ag = allAgents.find((a) => a.id === agentId)
        if (ag && !ag.toolsEnabled) return []
      }
      return tools
    })()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = []
    if (agentSystemPrompt) {
      messages.push({ role: 'system', content: agentSystemPrompt })
    }
    messages.push({ role: 'user', content: message })

    let totalPromptTokens = 0
    let totalCompletionTokens = 0
    let totalTokens = 0

    const MAX_ROUNDS = 10
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const stream = await client.chat.completions.create({
        model: effectiveModel,
        messages: messages,
        tools: effectiveTools,
        stream: true,
        stream_options: { include_usage: true },
        ...(agentTemperature !== undefined ? { temperature: agentTemperature } : {}),
        ...(agentMaxTokens !== undefined ? { max_tokens: agentMaxTokens } : {}),
      })

      let contentBuffer = ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolCallsBuffer = new Map<number, { id: string; name: string; arguments: string }>()

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta

        // 流式文本内容
        if (delta?.content) {
          contentBuffer += delta.content
          win.send('chat:chunk', { content: delta.content })
        }

        // 流式 tool_calls 分片累积
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

        // 累计 token
        if (chunk.usage) {
          totalPromptTokens += chunk.usage.prompt_tokens
          totalCompletionTokens += chunk.usage.completion_tokens
          totalTokens += chunk.usage.total_tokens
        }
      }

      // 检查是否有 tool_calls
      if (toolCallsBuffer.size > 0) {
        const toolCalls = Array.from(toolCallsBuffer.values())

        // 将 assistant 消息加入历史
        messages.push({
          role: 'assistant',
          content: contentBuffer,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        })

        // 执行所有工具
        for (const tc of toolCalls) {
          let toolArgs: Record<string, unknown> = {}
          try {
            toolArgs = JSON.parse(tc.arguments)
          } catch {
            toolArgs = {}
          }
          console.log(`[Tool] Executing ${tc.name} with args:`, toolArgs)
          const result = mcpManager.isMcpTool(tc.name)
            ? await mcpManager.callTool(tc.name, toolArgs)
            : await executeTool(tc.name, toolArgs)

          win.send('chat:tool_call', {
            name: tc.name,
            arguments: tc.arguments,
            result: result,
          })

          messages.push({
            role: 'tool',
            content: result,
            tool_call_id: tc.id,
          })
        }

        continue
      }

      // 没有 tool_calls，流式完成
      win.send('chat:done', {
        usage: {
          prompt_tokens: totalPromptTokens,
          completion_tokens: totalCompletionTokens,
          total_tokens: totalTokens,
        },
        max_input_tokens: modelConfig?.max_input_tokens,
      })
      return
    }

    // 达到最大轮次
    win.send('chat:done', {
      usage: {
        prompt_tokens: totalPromptTokens,
        completion_tokens: totalCompletionTokens,
        total_tokens: totalTokens,
      },
      max_input_tokens: modelConfig?.max_input_tokens,
    })
  } catch (error) {
    console.error('OpenAI API call failed:', error)
    win.send('chat:error', {
      message: error instanceof Error ? error.message : '未知错误',
    })
  } finally {
    await mcpManager.disconnectAll()
  }
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})
