import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runGroupChat, resetGroupSession } from '../groupChat'
import {
  makeAgent,
  makeClient,
  setupDeps,
  chunk,
  eventsOf,
  type StreamChunkData,
} from './testUtils'

const agentA = makeAgent({ id: 'a', name: 'Agent A' })
const agentB = makeAgent({ id: 'b', name: 'Agent B' })

beforeEach(() => {
  resetGroupSession()
})

describe('runGroupChat - 前置校验', () => {
  it('少于 2 个智能体时发送 chat:error 并直接返回', async () => {
    const client = makeClient(() => [])
    const { deps, sent } = setupDeps([agentA], client)
    await runGroupChat({ message: 'hi', agentIds: ['a'] }, deps)
    expect(eventsOf(sent, 'chat:error')).toHaveLength(1)
    expect(eventsOf(sent, 'chat:chunk')).toHaveLength(0)
    expect(eventsOf(sent, 'chat:done')).toHaveLength(0)
  })
})

describe('runGroupChat - 单发言者文本回复', () => {
  it('被 @ 的智能体回复文本时发送 speaker/chunk/done', async () => {
    const client = makeClient((i) => (i === 0 ? [chunk({ content: 'Hello' }, { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 })] : []))
    const { deps, sent } = setupDeps([agentA, agentB], client)
    await runGroupChat({ message: 'hi', agentIds: ['a', 'b'], mentionAgentId: 'a' }, deps)

    const speakers = eventsOf(sent, 'chat:speaker')
    expect(speakers[0].data).toEqual({ agentId: 'a', agentName: 'Agent A' })

    const chunks = eventsOf(sent, 'chat:chunk')
    expect(chunks).toHaveLength(1)
    expect(chunks[0].data).toMatchObject({ content: 'Hello', agentId: 'a' })

    const done = eventsOf(sent, 'chat:done')
    expect(done).toHaveLength(1)
    expect(done[0].data).toMatchObject({
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      max_input_tokens: 8192,
    })
  })

  it('mentionAgentId 决定首位发言者', async () => {
    const client = makeClient((i) => (i === 0 ? [chunk({ content: 'B first' })] : []))
    const { deps, sent } = setupDeps([agentA, agentB], client)
    await runGroupChat({ message: 'hi', agentIds: ['a', 'b'], mentionAgentId: 'b' }, deps)

    const speakers = eventsOf(sent, 'chat:speaker')
    expect(speakers[0].data).toEqual({ agentId: 'b', agentName: 'Agent B' })
  })

  it('未提供 mentionAgentId 时首位为 agentIds[0]', async () => {
    const client = makeClient((i) => (i === 0 ? [chunk({ content: 'A first' })] : []))
    const { deps, sent } = setupDeps([agentA, agentB], client)
    await runGroupChat({ message: 'hi', agentIds: ['a', 'b'] }, deps)
    expect(eventsOf(sent, 'chat:speaker')[0].data).toMatchObject({ agentId: 'a' })
  })
})

describe('runGroupChat - 工具启用控制', () => {
  it('toolsEnabled=false 的智能体收到空 tools 列表', async () => {
    const noToolAgent = makeAgent({ id: 'a', name: 'Agent A', toolsEnabled: false })
    const client = makeClient((i) => (i === 0 ? [chunk({ content: 'ok' })] : []))
    const { deps, create } = setupDeps([noToolAgent, agentB], client)
    await runGroupChat({ message: 'hi', agentIds: ['a', 'b'], mentionAgentId: 'a' }, deps)
    expect(create).toHaveBeenCalledTimes(1)
    const callArg = create.mock.calls[0][0] as { tools: unknown[] }
    expect(callArg.tools).toEqual([])
  })

  it('toolsEnabled=true 的智能体收到注入的 tools', async () => {
    const client = makeClient((i) => (i === 0 ? [chunk({ content: 'ok' })] : []))
    const { deps, create } = setupDeps([agentA, agentB], client)
    const fakeTool = { type: 'function' as const, function: { name: 'noop', description: 'd', parameters: { type: 'object' as const, properties: {} } } }
    deps.tools = [fakeTool]
    await runGroupChat({ message: 'hi', agentIds: ['a', 'b'], mentionAgentId: 'a' }, deps)
    const callArg = create.mock.calls[0][0] as { tools: unknown[] }
    expect(callArg.tools).toContainEqual(fakeTool)
  })
})

describe('runGroupChat - 委派拦截', () => {
  const delegateChunk = (targetId: string, task: string): StreamChunkData =>
    chunk({
      tool_calls: [{ index: 0, id: 'tc1', function: { name: 'delegate_to_agent', arguments: JSON.stringify({ targetAgentId: targetId, task }) } }],
    })

  it('合法委派：发送 chat:mention、chat:tool_call，被委派者接续发言', async () => {
    const client = makeClient((i) => {
      if (i === 0) return [delegateChunk('b', 'do B work')]
      if (i === 1) return [chunk({ content: 'A done' })]
      if (i === 2) return [chunk({ content: 'B finished' })]
      return []
    })
    const { deps, sent } = setupDeps([agentA, agentB], client)
    await runGroupChat({ message: 'hi', agentIds: ['a', 'b'], mentionAgentId: 'a' }, deps)

    const mentions = eventsOf(sent, 'chat:mention')
    expect(mentions).toHaveLength(1)
    expect(mentions[0].data).toEqual({
      fromAgentId: 'a',
      fromAgentName: 'Agent A',
      toAgentId: 'b',
      toAgentName: 'Agent B',
      task: 'do B work',
    })

    const toolCalls = eventsOf(sent, 'chat:tool_call')
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].data).toMatchObject({ name: 'delegate_to_agent' })
    expect((toolCalls[0].data as { result: string }).result).toContain('委派给')
    expect((toolCalls[0].data as { result: string }).result).toContain('Agent B')

    const speakers = eventsOf(sent, 'chat:speaker')
    expect(speakers.map((s) => (s.data as { agentId: string }).agentId)).toEqual(['a', 'b'])

    const chunkTexts = eventsOf(sent, 'chat:chunk').map((c) => (c.data as { content: string }).content)
    expect(chunkTexts).toContain('A done')
    expect(chunkTexts).toContain('B finished')
  })

  it('非法委派目标：返回错误结果，不产生 chat:mention', async () => {
    const client = makeClient((i) => {
      if (i === 0) return [delegateChunk('zzz', 'x')]
      if (i === 1) return [chunk({ content: 'A recovering' })]
      return []
    })
    const { deps, sent } = setupDeps([agentA, agentB], client)
    await runGroupChat({ message: 'hi', agentIds: ['a', 'b'], mentionAgentId: 'a' }, deps)

    expect(eventsOf(sent, 'chat:mention')).toHaveLength(0)
    const toolCalls = eventsOf(sent, 'chat:tool_call')
    expect(toolCalls).toHaveLength(1)
    expect((toolCalls[0].data as { result: string }).result).toContain('不存在')
    expect((toolCalls[0].data as { result: string }).result).toContain('zzz')
    expect(eventsOf(sent, 'chat:speaker')).toHaveLength(1)
  })
})

describe('runGroupChat - 中止与边界', () => {
  it('signal 已中止时不发送任何 chunk，但仍发送 chat:done', async () => {
    const client = makeClient(() => [])
    const { deps, sent, abortController } = setupDeps([agentA, agentB], client)
    abortController.abort()
    await runGroupChat({ message: 'hi', agentIds: ['a', 'b'], mentionAgentId: 'a' }, deps)
    expect(eventsOf(sent, 'chat:speaker')).toHaveLength(0)
    expect(eventsOf(sent, 'chat:chunk')).toHaveLength(0)
    expect(eventsOf(sent, 'chat:done')).toHaveLength(1)
  })

  it('无限委派被 MAX_GROUP_TURNS 封顶，不会死循环', async () => {
    const delegateChunk = (targetId: string, task: string): StreamChunkData =>
      chunk({
        tool_calls: [{ index: 0, id: 'tc1', function: { name: 'delegate_to_agent', arguments: JSON.stringify({ targetAgentId: targetId, task }) } }],
      })
    const client = makeClient((i) => {
      if (i % 2 === 1) return [chunk({ content: `text ${i}` })]
      const target = Math.floor(i / 2) % 2 === 0 ? 'b' : 'a'
      return [delegateChunk(target, `ping ${i}`)]
    })
    const { deps, sent } = setupDeps([agentA, agentB], client)
    await runGroupChat({ message: 'hi', agentIds: ['a', 'b'], mentionAgentId: 'a' }, deps)

    const speakerCount = eventsOf(sent, 'chat:speaker').length
    expect(speakerCount).toBeLessThanOrEqual(12)
    expect(speakerCount).toBeGreaterThan(0)
    expect(eventsOf(sent, 'chat:done')).toHaveLength(1)
  }, 10000)
})

describe('runGroupChat - 记忆注入', () => {
  it('为每位发言者调用 recallMemories 并注入格式化记忆', async () => {
    const client = makeClient((i) => (i === 0 ? [chunk({ content: 'ok' })] : []))
    const { deps, sent, recallMemories } = setupDeps([agentA, agentB], client)
    recallMemories.mockReturnValue([{ id: 'm1', agentId: 'a', content: 'remembered', type: 'fact', createdAt: 0 }])
    deps.formatMemoriesForInjection = vi.fn((entries) => `MEMO:${entries.length}`)
    await runGroupChat({ message: 'hi', agentIds: ['a', 'b'], mentionAgentId: 'a' }, deps)
    expect(recallMemories).toHaveBeenCalledWith('a', 'hi')
    expect(deps.formatMemoriesForInjection).toHaveBeenCalled()
    expect(eventsOf(sent, 'chat:done')).toHaveLength(1)
  })
})
