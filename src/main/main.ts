import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import OpenAI from 'openai'
import { getToolDefinitions, executeTool } from './tools'
import { showAbout } from './about'
import { McpManager } from './mcp/mcpManager'
import { runGroupChat, resetGroupSession } from './groupChat'
import { ensureSkillsDirs, loadSkills, loadGlobalSkills, saveSkill, deleteSkill } from './skills'
import type { SkillFile, SkillSource } from './skills'
import {
  ensureSessionForAgent,
  setCurrentAgent,
  appendTurns,
  getSession,
  recallMemories,
  formatMemoriesForInjection,
  compressIfNeeded,
  setLastPromptTokens,
  resetSession,
  getAllMemories,
  saveMemory,
  deleteMemory,
  MAX_INPUT_TOKENS_FALLBACK,
  COMPRESSION_THRESHOLD_RATIO,
} from './memory/memoryManager'

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let mainWindow: BrowserWindow | null = null

let activeChatAbort: AbortController | null = null

function readJsonFileSync<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const stripped = raw.replace(/^\uFEFF/, '').trim()
    return JSON.parse(stripped) as T
  } catch (error) {
    console.error(`Failed to read/parse JSON (${filePath}):`, error)
    return null
  }
}

function writeJsonFileSync(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: 'utf-8' })
}

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
        writeJsonFileSync(filePath, defaultModels)
      }
    } catch (error) {
      console.error('Failed to initialize models file:', error)
    }
  }
}

ipcMain.handle('models:get', () => {
  ensureModelsFile()
  const filePath = getModelsFilePath()
  const models = readJsonFileSync<Model[]>(filePath)
  return models ?? []
})

ipcMain.handle('models:add', (_event, newModel: Model) => {
  ensureModelsFile()
  const filePath = getModelsFilePath()
  try {
    const models = readJsonFileSync<Model[]>(filePath) ?? []

    const exists = models.some((m) => m.id === newModel.id)
    if (!exists) {
      models.push(newModel)
      writeJsonFileSync(filePath, models)
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
      writeJsonFileSync(filePath, [])
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
  emoji?: string
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
      emoji: '🧠',
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
      emoji: '🔨',
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
      writeJsonFileSync(filePath, getBuiltinAgents())
    } catch (error) {
      console.error('Failed to initialize agents file:', error)
    }
    return
  }
  try {
    let agents = readJsonFileSync<AgentConfig[]>(filePath)
    if (!Array.isArray(agents)) {
      console.warn('Agents file unreadable or invalid, restoring built-in agents')
      agents = getBuiltinAgents()
      writeJsonFileSync(filePath, agents)
      return
    }
    const builtins = getBuiltinAgents()
    let changed = false
    const missing = builtins.filter((b) => !agents.some((a) => a.id === b.id))
    if (missing.length > 0) {
      agents.push(...missing)
      changed = true
    }
    for (const b of builtins) {
      const existing = agents.find((a) => a.id === b.id)
      if (existing && existing.emoji !== b.emoji) {
        existing.emoji = b.emoji
        changed = true
      }
    }
    if (changed) {
      writeJsonFileSync(filePath, agents)
    }
  } catch (error) {
    console.error('Failed to ensure built-in agents:', error)
  }
}

ipcMain.handle('workspace:openFolder', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择项目目录',
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  const dirPath = result.filePaths[0]
  const baseName = path.basename(dirPath)
  return {
    id: `local-${Date.now()}`,
    name: baseName,
    path: dirPath,
  }
})

ipcMain.handle('agents:get', () => {
  ensureAgentsFile()
  const filePath = getAgentsFilePath()
  const agents = readJsonFileSync<AgentConfig[]>(filePath)
  if (!agents) {
    return []
  }
  return agents.sort((a, b) => Number(b.builtin) - Number(a.builtin))
})

ipcMain.handle('agents:add', (_event, newAgent: AgentConfig) => {
  ensureAgentsFile()
  const filePath = getAgentsFilePath()
  try {
    const agents = readJsonFileSync<AgentConfig[]>(filePath) ?? []
    const exists = agents.some((a) => a.id === newAgent.id)
    if (!exists) {
      agents.push(newAgent)
      writeJsonFileSync(filePath, agents)
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
    const agents = readJsonFileSync<AgentConfig[]>(filePath) ?? []
    const index = agents.findIndex((a) => a.id === updatedAgent.id)
    if (index !== -1) {
      agents[index] = { ...agents[index], ...updatedAgent, updatedAt: Date.now() }
      writeJsonFileSync(filePath, agents)
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
    const agents = readJsonFileSync<AgentConfig[]>(filePath) ?? []
    const target = agents.find((a) => a.id === agentId)
    if (target?.builtin) {
      return false
    }
    const filtered = agents.filter((a) => a.id !== agentId)
    writeJsonFileSync(filePath, filtered)
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
      writeJsonFileSync(filePath, {})
    } catch (error) {
      console.error('Failed to initialize preferences file:', error)
    }
  }
}

function readMcpServers(): McpServer[] {
  ensureMcpFile()
  const filePath = getMcpFilePath()
  const servers = readJsonFileSync<McpServer[]>(filePath)
  return Array.isArray(servers) ? servers : []
}

function writeMcpServers(servers: McpServer[]): void {
  ensureMcpFile()
  const filePath = getMcpFilePath()
  writeJsonFileSync(filePath, servers)
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
  const prefs = readJsonFileSync<Record<string, unknown>>(getPreferencesFilePath())
  return prefs ?? {}
}

function writePreferences(prefs: Record<string, unknown>): void {
  ensurePreferencesFile()
  try {
    writeJsonFileSync(getPreferencesFilePath(), prefs)
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

ipcMain.handle('agents:getSelectedAgents', () => {
  const prefs = readPreferences()
  const ids = prefs.selectedAgentIds
  return Array.isArray(ids) ? (ids as string[]) : []
})

ipcMain.handle('agents:setSelectedAgents', (_event, agentIds: string[]) => {
  const prefs = readPreferences()
  prefs.selectedAgentIds = agentIds
  writePreferences(prefs)
  return true
})

ipcMain.handle('memory:get', () => {
  return getAllMemories()
})

ipcMain.handle(
  'memory:add',
  (_event, payload: { agentId: string; content: string; tags?: string[] }) => {
    try {
      return saveMemory(payload.agentId, payload.content, 'fact', payload.tags)
    } catch (error) {
      console.error('Failed to add memory:', error)
      return null
    }
  }
)

ipcMain.handle('memory:delete', (_event, id: string) => {
  return deleteMemory(id)
})

ipcMain.on('chat:reset', () => {
  resetSession()
  resetGroupSession()
})

interface ChatMessageParams {
  message: string
  model: string
  agentId?: string
  agentIds?: string[]
  mentionAgentId?: string
}

ipcMain.on('chat:send', async (event, params: ChatMessageParams) => {
  const { message, model, agentId, agentIds, mentionAgentId } = params
  const win = event.sender

  // 多智能体群聊模式：选中 2 个及以上智能体时走群聊编排器
  if (agentIds && agentIds.length >= 2) {
    ensureModelsFile()
    const loadedProviders = readJsonFileSync<Model[]>(getModelsFilePath())
    if (!loadedProviders) {
      win.send('chat:error', { message: '错误：无法读取模型配置文件' })
      return
    }
    const provider = loadedProviders.find((p) => p.models.some((m) => m.name === model))
    if (!provider) {
      win.send('chat:error', { message: `错误：未找到模型 "${model}" 对应的配置` })
      return
    }
    const modelConfig = provider.models.find((m) => m.name === model)
    if (!provider.key) {
      win.send('chat:error', { message: `错误：模型提供商 "${provider.name}" 未配置 API Key，请在模型配置中填写` })
      return
    }
    const mcpManager = new McpManager()
    const abortController = new AbortController()
    activeChatAbort = abortController
    const signal = abortController.signal
    try {
      await mcpManager.connectAll()
      const client = new OpenAI({ baseURL: provider.url, apiKey: provider.key })
      const tools = [...getToolDefinitions(), ...mcpManager.getToolDefinitions()]
      ensureAgentsFile()
      const agents = readJsonFileSync<AgentConfig[]>(getAgentsFilePath()) ?? []
      await runGroupChat(
        { message, agentIds, mentionAgentId },
        {
          win,
          client,
          mcpManager,
          tools,
          agents,
          effectiveModel: model,
          modelConfig,
          signal,
          recallMemories,
          formatMemoriesForInjection,
          executeTool,
        }
      )
    } catch (error) {
      if (signal.aborted) {
        console.log('[Chat] Group chat stopped by user')
      } else {
        console.error('Group chat failed:', error)
        win.send('chat:error', { message: error instanceof Error ? error.message : '未知错误' })
      }
    } finally {
      if (activeChatAbort === abortController) {
        activeChatAbort = null
      }
      await mcpManager.disconnectAll()
    }
    return
  }

  // 解析智能体配置（若指定），用于注入 systemPrompt / temperature / maxTokens / model
  let agentSystemPrompt = ''
  let agentTemperature: number | undefined
  let agentMaxTokens: number | undefined
  let effectiveModel = model
  if (agentId) {
    ensureAgentsFile()
    try {
      const agents = readJsonFileSync<AgentConfig[]>(getAgentsFilePath()) ?? []
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
  const loadedProviders = readJsonFileSync<Model[]>(filePath)
  if (!loadedProviders) {
    win.send('chat:error', { message: '错误：无法读取模型配置文件' })
    return
  }
  const providers = loadedProviders

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
  const abortController = new AbortController()
  activeChatAbort = abortController
  const signal = abortController.signal
  let totalPromptTokens = 0
  let totalCompletionTokens = 0
  let totalTokens = 0
  try {
    await mcpManager.connectAll()
    const client = new OpenAI({
      baseURL: provider.url,
      apiKey: provider.key,
    })

    const tools = [...getToolDefinitions(), ...mcpManager.getToolDefinitions()]
    const effectiveTools = (() => {
      if (agentId) {
        const allAgents = readJsonFileSync<AgentConfig[]>(getAgentsFilePath()) ?? []
        const ag = allAgents.find((a) => a.id === agentId)
        if (ag && !ag.toolsEnabled) return []
      }
      return tools
    })()

    // 会话上下文：切换 agent 起新会话；同 agent 延续上下文（短记忆）
    ensureSessionForAgent(agentId || '', agentSystemPrompt)
    setCurrentAgent(agentId || '')
    appendTurns([{ role: 'user', content: message }])

    const sess = getSession()
    const recalled = recallMemories(agentId || '', message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = []
    if (sess.systemPrompt) {
      messages.push({ role: 'system', content: sess.systemPrompt })
    }
    if (recalled.length > 0) {
      messages.push({ role: 'system', content: formatMemoriesForInjection(recalled) })
    }
    if (sess.summary) {
      messages.push({ role: 'system', content: `[对话摘要]\n${sess.summary}` })
    }
    messages.push(...sess.recentTurns)
    const payloadLen = messages.length

    const MAX_TOKENS_LIMIT = 393216
    const effectiveMaxTokens =
      agentMaxTokens !== undefined && Number.isFinite(agentMaxTokens) && agentMaxTokens > 0
        ? Math.min(Math.floor(agentMaxTokens), MAX_TOKENS_LIMIT)
        : undefined

    const MAX_ROUNDS = 10

    const syncAndMaybeCompress = async () => {
      appendTurns(messages.slice(payloadLen))
      setLastPromptTokens(totalPromptTokens)
      const tokenLimit = modelConfig?.max_input_tokens || MAX_INPUT_TOKENS_FALLBACK
      if (totalPromptTokens > tokenLimit * COMPRESSION_THRESHOLD_RATIO) {
        try {
          await compressIfNeeded(client, effectiveModel, tokenLimit)
        } catch (error) {
          console.error('[Memory] compression failed:', error)
        }
      }
    }

    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (signal.aborted) break

      const stream = await client.chat.completions.create({
        model: effectiveModel,
        messages: messages,
        tools: effectiveTools,
        stream: true,
        stream_options: { include_usage: true },
        ...(agentTemperature !== undefined ? { temperature: agentTemperature } : {}),
        ...(effectiveMaxTokens !== undefined ? { max_tokens: effectiveMaxTokens } : {}),
      }, { signal })

      let contentBuffer = ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolCallsBuffer = new Map<number, { id: string; name: string; arguments: string }>()

      for await (const chunk of stream) {
        if (signal.aborted) break
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
          if (signal.aborted) break
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

        if (signal.aborted) break
        continue
      }

      // 没有 tool_calls，流式完成
      messages.push({ role: 'assistant', content: contentBuffer })
      win.send('chat:done', {
        usage: {
          prompt_tokens: totalPromptTokens,
          completion_tokens: totalCompletionTokens,
          total_tokens: totalTokens,
        },
        max_input_tokens: modelConfig?.max_input_tokens,
      })
      await syncAndMaybeCompress()
      return
    }

    // 达到最大轮次
    await syncAndMaybeCompress()
    win.send('chat:done', {
      usage: {
        prompt_tokens: totalPromptTokens,
        completion_tokens: totalCompletionTokens,
        total_tokens: totalTokens,
      },
      max_input_tokens: modelConfig?.max_input_tokens,
    })
  } catch (error) {
    if (signal.aborted) {
      console.log('[Chat] Generation stopped by user')
      win.send('chat:done', {
        usage: {
          prompt_tokens: totalPromptTokens,
          completion_tokens: totalCompletionTokens,
          total_tokens: totalTokens,
        },
        max_input_tokens: modelConfig?.max_input_tokens,
      })
    } else {
      console.error('OpenAI API call failed:', error)
      win.send('chat:error', {
        message: error instanceof Error ? error.message : '未知错误',
      })
    }
  } finally {
    if (activeChatAbort === abortController) {
      activeChatAbort = null
    }
    await mcpManager.disconnectAll()
  }
})

ipcMain.on('chat:stop', () => {
  if (activeChatAbort) {
    console.log('[Chat] Aborting active chat generation')
    activeChatAbort.abort()
  }
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})
