import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatArea } from '../components/ChatArea'

interface MockAgent {
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

function makeAgent(overrides: Partial<MockAgent> = {}): MockAgent {
  return {
    id: 'a',
    name: 'Agent A',
    description: '描述 A',
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

const agentA = makeAgent({ id: 'a', name: 'Agent A' })
const agentB = makeAgent({ id: 'b', name: 'Agent B' })

interface ElectronAPIStub {
  getAgents: ReturnType<typeof vi.fn>
  getSelectedAgents: ReturnType<typeof vi.fn>
  getSelectedAgent: ReturnType<typeof vi.fn>
  setSelectedAgents: ReturnType<typeof vi.fn>
  setSelectedAgent: ReturnType<typeof vi.fn>
  sendChatMessage: ReturnType<typeof vi.fn>
  stopChatMessage: ReturnType<typeof vi.fn>
  resetSession: ReturnType<typeof vi.fn>
  removeChatListeners: ReturnType<typeof vi.fn>
  onChatChunk: ReturnType<typeof vi.fn>
  onChatToolCall: ReturnType<typeof vi.fn>
  onChatSpeaker: ReturnType<typeof vi.fn>
  onChatMention: ReturnType<typeof vi.fn>
  onChatDone: ReturnType<typeof vi.fn>
  onChatError: ReturnType<typeof vi.fn>
}

function installElectronAPI(agents: MockAgent[], selectedIds: string[]): ElectronAPIStub {
  const api: ElectronAPIStub = {
    getAgents: vi.fn(async () => agents),
    getSelectedAgents: vi.fn(async () => selectedIds),
    getSelectedAgent: vi.fn(async () => null),
    setSelectedAgents: vi.fn(async () => true),
    setSelectedAgent: vi.fn(async () => true),
    sendChatMessage: vi.fn(),
    stopChatMessage: vi.fn(),
    resetSession: vi.fn(),
    removeChatListeners: vi.fn(),
    onChatChunk: vi.fn(),
    onChatToolCall: vi.fn(),
    onChatSpeaker: vi.fn(),
    onChatMention: vi.fn(),
    onChatDone: vi.fn(),
    onChatError: vi.fn(),
  }
  ;(window as unknown as { electronAPI: ElectronAPIStub }).electronAPI = api
  return api
}

async function waitForGroupReady() {
  await screen.findByText(/群聊/)
}

describe('ChatArea - 群聊 @ 校验', () => {
  let api: ElectronAPIStub

  beforeEach(() => {
    api = installElectronAPI([agentA, agentB], ['a', 'b'])
  })

  it('群聊模式下未 @ 直接回车：阻止发送并显示错误提示', async () => {
    const user = userEvent.setup()
    render(<ChatArea />)
    await waitForGroupReady()

    const textarea = await screen.findByPlaceholderText(/请输入 @ 指定首响应智能体/)
    await user.type(textarea, '直接发送消息')

    await user.keyboard('{Enter}')

    expect(api.sendChatMessage).not.toHaveBeenCalled()
    expect(await screen.findByText(/请输入 @ 指定一位智能体/)).toBeInTheDocument()
  })

  it('群聊模式下通过 @ 选择智能体后允许发送', async () => {
    const user = userEvent.setup()
    render(<ChatArea />)
    await waitForGroupReady()

    const textarea = await screen.findByPlaceholderText(/请输入 @ 指定首响应智能体/)
    await user.type(textarea, '@')

    await screen.findByText('Agent B')

    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    await user.type(textarea, '请执行任务')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(api.sendChatMessage).toHaveBeenCalledTimes(1)
    })
    const call = api.sendChatMessage.mock.calls[0][0] as {
      message: string
      model: string
      agentIds?: string[]
      mentionAgentId?: string
      agentId?: string
    }
    expect(call.agentIds).toEqual(['a', 'b'])
    expect(call.mentionAgentId).toBe('b')
    expect(call.message).toContain('Agent B')
  })
})

describe('ChatArea - @ 选择器键盘导航', () => {
  let api: ElectronAPIStub

  beforeEach(() => {
    api = installElectronAPI([agentA, agentB], ['a', 'b'])
  })

  it('输入 @ 后方向键下移高亮并 Enter 选中第二项', async () => {
    const user = userEvent.setup()
    render(<ChatArea />)
    await waitForGroupReady()

    const textarea = await screen.findByPlaceholderText(/请输入 @ 指定首响应智能体/)
    await user.type(textarea, '@')

    const items = await screen.findAllByText('Agent B')
    expect(items.length).toBeGreaterThan(0)

    await user.keyboard('{ArrowDown}')
    const highlighted = document.querySelector('[data-highlight="true"]') as HTMLElement | null
    expect(highlighted).not.toBeNull()
    expect(highlighted?.textContent).toContain('Agent B')

    await user.keyboard('{Enter}')
    expect(textarea.value).toContain('Agent B')
  })

  it('Esc 关闭 @ 选择器', async () => {
    const user = userEvent.setup()
    render(<ChatArea />)
    await waitForGroupReady()

    const textarea = await screen.findByPlaceholderText(/请输入 @ 指定首响应智能体/)
    await user.type(textarea, '@')
    expect(await screen.findByText('Agent B')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByText('Agent B')).toBeNull()
    })
  })

  it('ArrowUp 从首项循环到末项', async () => {
    const user = userEvent.setup()
    render(<ChatArea />)
    await waitForGroupReady()

    const textarea = await screen.findByPlaceholderText(/请输入 @ 指定首响应智能体/)
    await user.type(textarea, '@')

    const firstHighlight = document.querySelector('[data-highlight="true"]') as HTMLElement | null
    expect(firstHighlight?.textContent).toContain('Agent A')

    await user.keyboard('{ArrowUp}')
    const afterUp = document.querySelector('[data-highlight="true"]') as HTMLElement | null
    expect(afterUp?.textContent).toContain('Agent B')
  })
})

describe('ChatArea - 单智能体模式', () => {
  it('单 Agent 模式无需 @ 即可发送', async () => {
    const api = installElectronAPI([agentA], ['a'])
    const user = userEvent.setup()
    render(<ChatArea />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/今天帮你做些什么/)).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText(/今天帮你做些什么/) as HTMLTextAreaElement
    await user.type(textarea, '你好')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(api.sendChatMessage).toHaveBeenCalledTimes(1)
    })
    const call = api.sendChatMessage.mock.calls[0][0] as {
      agentId?: string
      agentIds?: string[]
      mentionAgentId?: string
    }
    expect(call.agentId).toBe('a')
    expect(call.agentIds).toBeUndefined()
    expect(call.mentionAgentId).toBeUndefined()
  })
})
