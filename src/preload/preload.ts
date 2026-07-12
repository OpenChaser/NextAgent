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
  sendChatMessage: (params: SendChatMessageParams) => ipcRenderer.invoke('chat:send', params),
  getModels: () => ipcRenderer.invoke('models:get'),
  addModel: (model: Model) => ipcRenderer.invoke('models:add', model),
})
