import { contextBridge, ipcRenderer } from 'electron'

interface SendChatMessageParams {
  message: string
  model: string
  agentId?: string
  agentIds?: string[]
  mentionAgentId?: string
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
  emoji?: string
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

interface MemoryEntry {
  id: string
  agentId: string
  content: string
  type: 'fact' | 'summary'
  tags?: string[]
  createdAt: number
}

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  sendChatMessage: (params: SendChatMessageParams) => ipcRenderer.send('chat:send', params),
  stopChatMessage: () => ipcRenderer.send('chat:stop'),
  onChatChunk: (callback: (data: { content: string; agentId?: string; agentName?: string }) => void) =>
    ipcRenderer.on('chat:chunk', (_event, data) => callback(data)),
  onChatToolCall: (callback: (data: { name: string; arguments: string; result: string; agentId?: string }) => void) =>
    ipcRenderer.on('chat:tool_call', (_event, data) => callback(data)),
  onChatSpeaker: (callback: (data: { agentId: string; agentName: string }) => void) =>
    ipcRenderer.on('chat:speaker', (_event, data) => callback(data)),
  onChatMention: (callback: (data: { fromAgentId: string; fromAgentName: string; toAgentId: string; toAgentName: string; task: string }) => void) =>
    ipcRenderer.on('chat:mention', (_event, data) => callback(data)),
  onChatDone: (callback: (data: { usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }; max_input_tokens?: number }) => void) =>
    ipcRenderer.on('chat:done', (_event, data) => callback(data)),
  onChatError: (callback: (data: { message: string }) => void) =>
    ipcRenderer.on('chat:error', (_event, data) => callback(data)),
  removeChatListeners: () => {
    ipcRenderer.removeAllListeners('chat:chunk')
    ipcRenderer.removeAllListeners('chat:tool_call')
    ipcRenderer.removeAllListeners('chat:speaker')
    ipcRenderer.removeAllListeners('chat:mention')
    ipcRenderer.removeAllListeners('chat:done')
    ipcRenderer.removeAllListeners('chat:error')
  },
  resetSession: () => ipcRenderer.send('chat:reset'),
  openWorkspaceFolder: () => ipcRenderer.invoke('workspace:openFolder'),
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
  getSelectedAgents: () => ipcRenderer.invoke('agents:getSelectedAgents'),
  setSelectedAgents: (agentIds: string[]) => ipcRenderer.invoke('agents:setSelectedAgents', agentIds),
  getSkills: () => ipcRenderer.invoke('skills:get') as Promise<Skill[]>,
  getGlobalSkills: () => ipcRenderer.invoke('skills:getGlobal') as Promise<Skill[]>,
  saveSkill: (skill: SkillFile, target: SkillSource) =>
    ipcRenderer.invoke('skills:save', { skill, target }) as Promise<boolean>,
  deleteSkill: (source: SkillSource, name: string) =>
    ipcRenderer.invoke('skills:delete', { source, name }) as Promise<boolean>,
  getMemories: () => ipcRenderer.invoke('memory:get') as Promise<MemoryEntry[]>,
  addMemory: (entry: { agentId: string; content: string; tags?: string[] }) =>
    ipcRenderer.invoke('memory:add', entry) as Promise<MemoryEntry | null>,
  deleteMemory: (id: string) => ipcRenderer.invoke('memory:delete', id) as Promise<boolean>,
})
