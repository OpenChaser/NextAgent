import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import OpenAI from 'openai'
import { getToolDefinitions, executeTool } from './tools'
import { showAbout } from './about'

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

interface ChatMessageParams {
  message: string
  model: string
}

ipcMain.on('chat:send', async (event, params: ChatMessageParams) => {
  const { message, model } = params
  const win = event.sender

  console.log(`[Chat] Streaming message to ${model}: ${message}`)

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
  const provider = providers.find((p) => p.models.some((m) => m.name === model))
  if (!provider) {
    win.send('chat:error', { message: `错误：未找到模型 "${model}" 对应的配置` })
    return
  }

  const modelConfig = provider.models.find((m) => m.name === model)

  if (!provider.key) {
    win.send('chat:error', { message: `错误：模型提供商 "${provider.name}" 未配置 API Key，请在模型配置中填写` })
    return
  }

  try {
    const client = new OpenAI({
      baseURL: provider.url,
      apiKey: provider.key,
    })

    const tools = getToolDefinitions()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [{ role: 'user', content: message }]

    let totalPromptTokens = 0
    let totalCompletionTokens = 0
    let totalTokens = 0

    const MAX_ROUNDS = 10
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const stream = await client.chat.completions.create({
        model: model,
        messages: messages,
        tools: tools,
        stream: true,
        stream_options: { include_usage: true },
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
          const result = await executeTool(tc.name, toolArgs)

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
  }
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})
