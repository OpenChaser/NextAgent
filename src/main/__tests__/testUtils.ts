import { vi } from 'vitest'
import type { GroupChatDeps } from '../groupChat'

export interface MockAgent {
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

export function makeAgent(overrides: Partial<MockAgent> = {}): MockAgent {
  return {
    id: 'a',
    name: 'Agent A',
    description: 'desc',
    systemPrompt: '',
    model: 'test-model',
    temperature: 0.7,
    maxTokens: 1024,
    toolsEnabled: true,
    builtin: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

export interface StreamChunk {
  content?: string
  tool_calls?: Array<{
    index: number
    id?: string
    function?: { name?: string; arguments?: string }
  }>
}

export interface Usage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export function chunk(opts: StreamChunk, usage?: Usage) {
  return {
    choices: [{ delta: { content: opts.content, tool_calls: opts.tool_calls } }],
    usage,
  }
}

export type StreamChunkData = ReturnType<typeof chunk>

export function makeStream(chunks: StreamChunkData[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c
    },
  }
}

export function makeClient(chunkFactory: (callIndex: number) => StreamChunkData[]) {
  let i = 0
  const create = vi.fn(async () => {
    const chunks = chunkFactory(i)
    const stream = makeStream(chunks)
    i++
    return stream
  })
  return { chat: { completions: { create } } }
}

export interface SetupResult {
  deps: GroupChatDeps
  sent: Array<{ channel: string; data: unknown }>
  abortController: AbortController
  create: ReturnType<typeof vi.fn>
  executeTool: ReturnType<typeof vi.fn>
  recallMemories: ReturnType<typeof vi.fn>
}

export function setupDeps(
  agents: MockAgent[],
  client: ReturnType<typeof makeClient>
): SetupResult {
  const sent: Array<{ channel: string; data: unknown }> = []
  const abortController = new AbortController()
  const win = {
    send: (channel: string, data: unknown) => {
      sent.push({ channel, data })
    },
  }
  const executeTool = vi.fn(async () => 'tool-result')
  const recallMemories = vi.fn(() => [])
  const deps: GroupChatDeps = {
    win: win as unknown as GroupChatDeps['win'],
    client: client as unknown as GroupChatDeps['client'],
    mcpManager: {
      isMcpTool: () => false,
      callTool: vi.fn(async () => 'mcp-result'),
    } as unknown as GroupChatDeps['mcpManager'],
    tools: [],
    agents: agents as unknown as GroupChatDeps['agents'],
    effectiveModel: 'test-model',
    modelConfig: { max_input_tokens: 8192 },
    signal: abortController.signal,
    recallMemories: recallMemories as unknown as GroupChatDeps['recallMemories'],
    formatMemoriesForInjection: () => '',
    executeTool,
  }
  return { deps, sent, abortController, create: client.chat.completions.create, executeTool, recallMemories }
}

export function eventsOf(sent: Array<{ channel: string; data: unknown }>, channel: string) {
  return sent.filter((s) => s.channel === channel)
}
