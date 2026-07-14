import fs from 'fs'
import os from 'os'
import path from 'path'
import { McpStdioClient } from './mcpClient'
import { McpSseClient } from './mcpSseClient'
import type { McpToolInfo, McpTransportClient } from './types'
import type { ChatTool } from '../tools/types'

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

interface RegisteredTool {
  serverName: string
  originalName: string
  prefixedName: string
  description: string
  schema: McpToolInfo['inputSchema']
}

const PREFIX = 'mcp__'

function readEnabledServers(): McpServer[] {
  const filePath = path.join(os.homedir(), '.nextagent', 'mcp.json')
  try {
    if (!fs.existsSync(filePath)) return []
    const content = fs.readFileSync(filePath, 'utf-8')
    const servers = JSON.parse(content) as McpServer[]
    return Array.isArray(servers) ? servers.filter((s) => s.enabled) : []
  } catch (error) {
    console.error('Failed to read mcp file:', error)
    return []
  }
}

function createClient(server: McpServer): McpTransportClient | null {
  if (server.transport === 'stdio') {
    if (!server.command) {
      console.warn(`[MCP] ${server.name} 缺少 command，跳过`)
      return null
    }
    return new McpStdioClient(server.command, server.args || [], server.env || {})
  }
  if (server.transport === 'sse') {
    if (!server.url) {
      console.warn(`[MCP] ${server.name} 缺少 url，跳过`)
      return null
    }
    return new McpSseClient(server.url)
  }
  console.warn(`[MCP] 不支持 ${server.transport} 传输，跳过 ${server.name}`)
  return null
}

export class McpManager {
  private clients = new Map<string, McpTransportClient>()
  private tools = new Map<string, RegisteredTool>()
  private connected = false

  async connectAll(): Promise<void> {
    if (this.connected) return
    const servers = readEnabledServers()
    for (const server of servers) {
      const client = createClient(server)
      if (!client) continue
      try {
        await client.connect()
        this.clients.set(server.name, client)

        const tools = await client.listTools()
        for (const tool of tools) {
          const prefixed = `${PREFIX}${server.name}__${tool.name}`
          this.tools.set(prefixed, {
            serverName: server.name,
            originalName: tool.name,
            prefixedName: prefixed,
            description: tool.description,
            schema: tool.inputSchema,
          })
        }
        console.log(`[MCP] ${server.name} (${server.transport}): 注册 ${tools.length} 个工具`)
      } catch (error) {
        console.error(`[MCP] 连接 ${server.name} 失败:`, error instanceof Error ? error.message : error)
      }
    }
    this.connected = true
  }

  getToolDefinitions(): ChatTool[] {
    const tools: ChatTool[] = []
    for (const [name, reg] of this.tools) {
      tools.push({
        type: 'function',
        function: {
          name,
          description: `[MCP/${reg.serverName}] ${reg.description}`,
          parameters: reg.schema || { type: 'object', properties: {} },
        },
      })
    }
    return tools
  }

  isMcpTool(name: string): boolean {
    return name.startsWith(PREFIX)
  }

  hasTools(): boolean {
    return this.tools.size > 0
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const reg = this.tools.get(name)
    if (!reg) {
      return `错误：未找到 MCP 工具 "${name}"`
    }
    const client = this.clients.get(reg.serverName)
    if (!client || !client.isConnected) {
      return `错误：MCP 服务器 "${reg.serverName}" 未连接`
    }
    try {
      return await client.callTool(reg.originalName, args)
    } catch (error) {
      return `错误：执行 MCP 工具 "${name}" 失败：${error instanceof Error ? error.message : '未知错误'}`
    }
  }

  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect()
    }
    this.clients.clear()
    this.tools.clear()
    this.connected = false
  }
}
