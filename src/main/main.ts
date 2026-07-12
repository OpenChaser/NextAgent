import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import OpenAI from 'openai'

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

  mainWindow.webContents.on('render-process-gone', (event, details) => {
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

function showAbout() {
  const aboutWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: true,
    title: '关于 NextAgent',
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  aboutWindow.loadURL(`data:text/html;charset=utf-8,
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px; background: #f5f5f5; }
          h1 { color: #333; }
          p { color: #666; }
          .version { font-size: 14px; color: #999; }
        </style>
      </head>
      <body>
        <h1>NextAgent</h1>
        <p>AI 工作助手</p>
        <p class="version">v1.0.0</p>
        <p>基于 Electron + React 构建</p>
      </body>
    </html>
  `)
}

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

let modelsCache: Model[] | null = null

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
    modelsCache = models
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
      modelsCache = models
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

interface ChatUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

interface ChatResponse {
  content: string
  usage?: ChatUsage
  max_input_tokens?: number
}

ipcMain.handle('chat:send', async (_event, params: ChatMessageParams): Promise<ChatResponse> => {
  const { message, model } = params

  console.log(`[Chat] Sending message to ${model}: ${message}`)

  // 从 models.json 加载配置，找到对应的 provider
  ensureModelsFile()
  const filePath = getModelsFilePath()
  let providers: Model[] = []
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    providers = JSON.parse(content) as Model[]
  } catch (error) {
    console.error('Failed to read models file:', error)
    return { content: '错误：无法读取模型配置文件' }
  }

  // 找到包含该模型的 provider
  const provider = providers.find((p) => p.models.some((m) => m.name === model))
  if (!provider) {
    return { content: `错误：未找到模型 "${model}" 对应的配置` }
  }

  const modelConfig = provider.models.find((m) => m.name === model)

  if (!provider.key) {
    return { content: `错误：模型提供商 "${provider.name}" 未配置 API Key，请在模型配置中填写` }
  }

  try {
    const client = new OpenAI({
      baseURL: provider.url,
      apiKey: provider.key,
    })

    const completion = await client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: message }],
    })

    const response = completion.choices[0]?.message?.content || '（空回复）'
    const usage = completion.usage
      ? {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens,
        }
      : undefined

    return { content: response, usage, max_input_tokens: modelConfig?.max_input_tokens }
  } catch (error) {
    console.error('OpenAI API call failed:', error)
    if (error instanceof Error) {
      return { content: `API 调用失败：${error.message}` }
    }
    return { content: 'API 调用失败：未知错误' }
  }
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})
