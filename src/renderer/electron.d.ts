interface SendChatMessageParams {
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

interface ElectronAPI {
  getAppVersion: () => Promise<string>
  sendChatMessage: (params: SendChatMessageParams) => Promise<ChatResponse>
  getModels: () => Promise<Model[]>
  addModel: (model: Model) => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
