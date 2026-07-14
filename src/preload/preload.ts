import { contextBridge, ipcRenderer } from 'electron'

interface SendChatMessageParams {
  message: string
  model: string
  agentId?: string
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
type SkillSource = 'global' | 'project'

interface SkillFile {
  name: string
  description: string
  content: string
  license?: string
  allowedTools?: string[]
  enabled?: boolean
}

interface Skill extends SkillFile {
  id: string
  source: SkillSource
  createdAt: number
  dir: string
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
  getMcpServers: () => ipcRenderer.invoke('mcp:get'),
  saveMcpServer: (server: McpServer) => ipcRenderer.invoke('mcp:save', server),
  deleteMcpServer: (id: string) => ipcRenderer.invoke('mcp:delete', id),
  toggleMcpServer: (id: string) => ipcRenderer.invoke('mcp:toggle', id),
  getAgents: () => ipcRenderer.invoke('agents:get'),
  addAgent: (agent: AgentConfig) => ipcRenderer.invoke('agents:add', agent),
  updateAgent: (agent: AgentConfig) => ipcRenderer.invoke('agents:update', agent),
  deleteAgent: (agentId: string) => ipcRenderer.invoke('agents:delete', agentId),
  getSelectedAgent: () => ipcRenderer.invoke('agents:getSelected'),
  setSelectedAgent: (agentId: string) => ipcRenderer.invoke('agents:setSelected', agentId),
  getSkills: () => ipcRenderer.invoke('skills:get') as Promise<Skill[]>,
  getGlobalSkills: () => ipcRenderer.invoke('skills:getGlobal') as Promise<Skill[]>,
  saveSkill: (skill: SkillFile, target: SkillSource) =>
    ipcRenderer.invoke('skills:save', { skill, target }) as Promise<boolean>,
  deleteSkill: (source: SkillSource, name: string) =>
    ipcRenderer.invoke('skills:delete', { source, name }) as Promise<boolean>,
})
