import { contextBridge, ipcRenderer } from 'electron'

interface SendChatMessageParams {
  message: string
  model: string
}

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

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  sendChatMessage: (params: SendChatMessageParams) => ipcRenderer.send('chat:send', params),
  onChatChunk: (callback: (data: { content: string }) => void) =>
    ipcRenderer.on('chat:chunk', (_event, data) => callback(data)),
  onChatToolCall: (callback: (data: { name: string; arguments: string; result: string }) => void) =>
    ipcRenderer.on('chat:tool_call', (_event, data) => callback(data)),
  onChatDone: (callback: (data: { usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }; max_input_tokens?: number }) => void) =>
    ipcRenderer.on('chat:done', (_event, data) => callback(data)),
  onChatError: (callback: (data: { message: string }) => void) =>
    ipcRenderer.on('chat:error', (_event, data) => callback(data)),
  removeChatListeners: () => {
    ipcRenderer.removeAllListeners('chat:chunk')
    ipcRenderer.removeAllListeners('chat:tool_call')
    ipcRenderer.removeAllListeners('chat:done')
    ipcRenderer.removeAllListeners('chat:error')
  },
  getModels: () => ipcRenderer.invoke('models:get'),
  addModel: (model: Model) => ipcRenderer.invoke('models:add', model),
})
