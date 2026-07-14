interface SendChatMessageParams {
  message: string
  model: string
}

interface ChatUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

interface ToolCallRecord {
  name: string
  arguments: string
  result: string
}

interface ChatDoneData {
  usage?: ChatUsage
  max_input_tokens?: number
}

interface ChatErrorData {
  message: string
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

interface ElectronAPI {
  getAppVersion: () => Promise<string>
  sendChatMessage: (params: SendChatMessageParams) => void
  onChatChunk: (callback: (data: { content: string }) => void) => void
  onChatToolCall: (callback: (data: ToolCallRecord) => void) => void
  onChatDone: (callback: (data: ChatDoneData) => void) => void
  onChatError: (callback: (data: ChatErrorData) => void) => void
  removeChatListeners: () => void
  getModels: () => Promise<Model[]>
  addModel: (model: Model) => Promise<boolean>
  getMcpServers: () => Promise<McpServer[]>
  saveMcpServer: (server: McpServer) => Promise<boolean>
  deleteMcpServer: (id: string) => Promise<boolean>
  toggleMcpServer: (id: string) => Promise<boolean>
}

interface Window {
  electronAPI: ElectronAPI
}
