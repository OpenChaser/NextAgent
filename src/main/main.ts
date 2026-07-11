import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import path from 'path'

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

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})
