import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import type { McpTransportClient, McpToolInfo } from './types'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

const PROTOCOL_VERSION = '2024-11-05'

export class McpStdioClient implements McpTransportClient {
  private process: ChildProcessWithoutNullStreams | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private buffer = ''
  private connected = false
  private exiting = false

  constructor(
    private readonly command: string,
    private readonly args: string[],
    private readonly env: Record<string, string>
  ) {}

  async connect(): Promise<void> {
    if (this.connected) return
    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.env },
      shell: process.platform === 'win32',
    }) as ChildProcessWithoutNullStreams

    this.process.on('error', (err) => {
      this.connected = false
      for (const { reject } of this.pending.values()) {
        reject(new Error(`MCP 进程启动失败: ${err.message}`))
      }
      this.pending.clear()
    })

    this.process.on('exit', (code) => {
      this.connected = false
      if (!this.exiting) {
        for (const { reject } of this.pending.values()) {
          reject(new Error(`MCP 进程意外退出 (code=${code})`))
        }
        this.pending.clear()
      }
    })

    this.process.stdout.setEncoding('utf-8')
    this.process.stdout.on('data', (chunk: string) => {
      this.buffer += chunk
      this.handleStream()
    })

    this.process.stderr.setEncoding('utf-8')
    this.process.stderr.on('data', (chunk: string) => {
      console.error(`[MCP stderr] ${chunk}`)
    })

    await this.initialize()
    this.connected = true
  }

  private handleStream(): void {
    let idx: number
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim()
      this.buffer = this.buffer.slice(idx + 1)
      if (!line) continue
      try {
        const msg = JSON.parse(line) as JsonRpcResponse
        const handler = this.pending.get(msg.id)
        if (handler) {
          this.pending.delete(msg.id)
          if (msg.error) {
            handler.reject(new Error(msg.error.message))
          } else {
            handler.resolve(msg.result)
          }
        }
      } catch {
        // 忽略非 JSON 行（部分 server 会输出日志）
      }
    }
  }

  private sendRequest(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.process || !this.process.stdin.writable) {
      return Promise.reject(new Error('MCP 进程未连接'))
    }
    const id = this.nextId++
    const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params }
    const proc = this.process
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      proc.stdin.write(JSON.stringify(req) + '\n')
    })
  }

  private async initialize(): Promise<void> {
    const result = (await this.sendRequest('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'NextAgent', version: '1.0.0' },
    })) as { protocolVersion?: string; serverInfo?: { name: string; version: string } }

    await this.sendRequest('notifications/initialized', {}).catch(() => {})
    console.log(`[MCP] 已连接: ${result.serverInfo?.name} v${result.serverInfo?.version}`)
  }

  async listTools(): Promise<McpToolInfo[]> {
    const result = (await this.sendRequest('tools/list', {})) as { tools?: McpToolInfo[] }
    return result.tools || []
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = (await this.sendRequest('tools/call', { name, arguments: args })) as {
      content?: Array<{ type: string; text?: string }>
      isError?: boolean
    }
    const text = (result.content || [])
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text!)
      .join('\n')
    if (result.isError) {
      return `MCP 工具 "${name}" 返回错误: ${text || '未知错误'}`
    }
    return text || '(无文本输出)'
  }

  async disconnect(): Promise<void> {
    this.exiting = true
    this.connected = false
    if (this.process) {
      try {
        this.process.stdin.end()
      } catch {
        // 忽略
      }
      this.process.kill()
      this.process = null
    }
    this.pending.clear()
  }

  get isConnected(): boolean {
    return this.connected
  }
}
