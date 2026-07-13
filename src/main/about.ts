import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'

let aboutWindow: BrowserWindow | null = null

function getAboutHtmlPath(): string {
  if (app.isPackaged) {
    return path.join(__dirname, '../data/about.html')
  }
  return path.join(__dirname, '../../src/data/about.html')
}

export function showAbout() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus()
    return
  }

  aboutWindow = new BrowserWindow({
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

  const aboutHtmlPath = getAboutHtmlPath()
  if (fs.existsSync(aboutHtmlPath)) {
    aboutWindow.loadFile(aboutHtmlPath)
  } else {
    aboutWindow.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(
          `<html><body><h1>NextAgent</h1><p>about.html 未找到</p></body></html>`
        )
    )
  }

  aboutWindow.on('closed', () => {
    aboutWindow = null
  })
}
