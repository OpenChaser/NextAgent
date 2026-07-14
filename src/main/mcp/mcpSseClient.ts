import http from 'http'
import https from 'https'
import { EventEmitter } from 'events'
import type { McpToolInfo, McpTransportClient } from './types'

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

export class McpSseClient implements McpTransportClient {
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private endpoint = ''
  private connected = false
  private exiting = false
  private responseStream: NodeJS.ReadableStream | null = null
  private eventBus = new EventEmitter()
  private buffer = ''

  constructor(private readonly url: string) {
    this.eventBus.setMaxListeners(50)
  }

  async connect(): Promise<void> {
    if (this.connected) return
    await new Promise<void>((resolve, reject) => {
      const lib = this.url.startsWith('https') ? https : http
      const req = lib.get(this.url, {
        headers: { Accept: 'text/event-stream' },
      }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`SSE 连接失败: HTTP ${res.statusCode}`))
          return
        }
        this.responseStream = res
        this.connected = true
        res.setEncoding('utf-8')
        res.on('data', (chunk: string) => {
          this.buffer += chunk
          this.handleSseData()
        })
        res.on('end', () => {
          this.connected = false
          if (!this.exiting) {
            for (const { reject } of this.pending.values()) {
              reject(new Error('SSE 连接已关闭'))
            }
            this.pending.clear()
          }
        })
        res.on('error', (err) => {
          this.connected = false
          for (const { reject } of this.pending.values()) {
            reject(new Error(`SSE 连接错误: ${err.message}`))
          }
          this.pending.clear()
        })
        this.eventBus.once('endpoint', resolve)
      })
      req.on('error', (err) => {
        reject(new Error(`SSE 连接失败: ${err.message}`))
      })
    })

    await this.initialize()
  }

  private handleSseData(): void {
    let sep: number
    while ((sep = this.buffer.indexOf('\n\n')) >= 0) {
      const block = this.buffer.slice(0, sep)
      this.buffer = this.buffer.slice(sep + 2)
      this.handleSseBlock(block)
    }
  }

  private handleSseBlock(block: string): void {
    let event = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
    }
    const data = dataLines.join('\n')
    if (event === 'endpoint') {
      const base = new URL(this.url)
      const full = new URL(data, base)
      this.endpoint = full.href
      this.eventBus.emit('endpoint')
      return
    }
    if (event !== 'message') return
    if (!data) return
    try {
      const msg = JSON.parse(data) as JsonRpcResponse
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
      // 忽略非 JSON 消息
    }
  }

  private sendRequest(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.connected || !this.endpoint) {
      return Promise.reject(new Error('MCP SSE 未连接'))
    }
    const id = this.nextId++
    const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      const body = JSON.stringify(req)
      const parsed = new URL(this.endpoint)
      const lib = parsed.protocol === 'https:' ? https : http
      const request = lib.request(
        this.endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          res.resume()
          res.on('end', () => {
            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
              const handler = this.pending.get(id)
              if (handler) {
                this.pending.delete(id)
                handler.reject(new Error(`HTTP ${res.statusCode}`))
              }
            }
          })
        }
      )
      request.on('error', (err) => {
        const handler = this.pending.get(id)
        if (handler) {
          this.pending.delete(id)
          handler.reject(new Error(`请求失败: ${err.message}`))
        }
      })
      request.write(body)
      request.end()
    })
  }

  private async initialize(): Promise<void> {
    const result = (await this.sendRequest('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'NextAgent', version: '1.0.0' },
    })) as { protocolVersion?: string; serverInfo?: { name: string; version: string } }

    await this.sendRequest('notifications/initialized', {}).catch(() => {})
    console.log(`[MCP] 已连接(SSE): ${result.serverInfo?.name} v${result.serverInfo?.version}`)
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
    if (this.responseStream) {
      try {
        ;(this.responseStream as unknown as { destroy: () => void }).destroy()
      } catch {
        // 忽略
      }
      this.responseStream = null
    }
    this.pending.clear()
  }

  get isConnected(): boolean {
    return this.connected
  }
}
