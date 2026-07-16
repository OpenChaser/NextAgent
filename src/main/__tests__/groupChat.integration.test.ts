import { describe, it, expect, beforeEach } from 'vitest'
import { runGroupChat, resetGroupSession } from '../groupChat'
import { makeAgent, makeClient, setupDeps, chunk, eventsOf, type StreamChunkData } from './testUtils'

const agentA = makeAgent({ id: 'a', name: 'Planner', description: '规划任务' })
const agentB = makeAgent({ id: 'b', name: 'Builder', description: '执行构建' })

beforeEach(() => {
  resetGroupSession()
})

function delegateChunk(targetId: string, task: string): StreamChunkData {
  return chunk({
    tool_calls: [
      { index: 0, id: 'tc1', function: { name: 'delegate_to_agent', arguments: JSON.stringify({ targetAgentId: targetId, task }) } },
    ],
  })
}

describe('群聊集成：多轮委派端到端流程', () => {
  it('用户→A 委派→B 委派→A 收尾，IPC 事件按序触发', async () => {
    const client = makeClient((i) => {
      switch (i) {
        case 0:
          return [delegateChunk('b', '请构建模块 X')]
        case 1:
          return [chunk({ content: 'A: 已委派，等待结果' })]
        case 2:
          return [delegateChunk('a', 'X 构建完成，请验收')]
        case 3:
          return [chunk({ content: 'B: 已交付' })]
        case 4:
          return [chunk({ content: 'A: 验收通过，结束' })]
        default:
          return []
      }
    })
    const { deps, sent } = setupDeps([agentA, agentB], client)
    await runGroupChat({ message: '开始任务', agentIds: ['a', 'b'], mentionAgentId: 'a' }, deps)

    const channels = sent.map((s) => s.channel)
    expect(channels.indexOf('chat:speaker')).toBeLessThan(channels.indexOf('chat:mention'))
    expect(channels.indexOf('chat:mention')).toBeLessThan(channels.indexOf('chat:done'))

    const speakers = eventsOf(sent, 'chat:speaker').map((s) => (s.data as { agentId: string }).agentId)
    expect(speakers).toEqual(['a', 'b', 'a'])

    const mentions = eventsOf(sent, 'chat:mention')
    expect(mentions).toHaveLength(2)
    expect(mentions[0].data).toMatchObject({ fromAgentId: 'a', toAgentId: 'b', task: '请构建模块 X' })
    expect(mentions[1].data).toMatchObject({ fromAgentId: 'b', toAgentId: 'a', task: 'X 构建完成，请验收' })

    const chunkTexts = eventsOf(sent, 'chat:chunk').map((c) => (c.data as { content: string }).content).join('')
    expect(chunkTexts).toContain('A: 已委派，等待结果')
    expect(chunkTexts).toContain('B: 已交付')
    expect(chunkTexts).toContain('A: 验收通过，结束')

    expect(eventsOf(sent, 'chat:done')).toHaveLength(1)
  })

  it('A 自主完成（无委派）时只触发单轮发言', async () => {
    const client = makeClient((i) => (i === 0 ? [chunk({ content: 'A: 直接完成' })] : []))
    const { deps, sent } = setupDeps([agentA, agentB], client)
    await runGroupChat({ message: '简单任务', agentIds: ['a', 'b'], mentionAgentId: 'a' }, deps)
    expect(eventsOf(sent, 'chat:speaker')).toHaveLength(1)
    expect(eventsOf(sent, 'chat:mention')).toHaveLength(0)
    expect(eventsOf(sent, 'chat:tool_call')).toHaveLength(0)
    expect(eventsOf(sent, 'chat:done')).toHaveLength(1)
  })
})
