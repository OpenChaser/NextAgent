import { useState, useRef, useEffect } from 'react'
import { Send, Globe, Lock, ChevronDown, FolderOpen, User, Bot, Sparkles, Square, AtSign } from 'lucide-react'
import { Popover } from './Popover'
import { WorkspacePopover } from './WorkspacePopover'
import { PermissionPopover } from './PermissionPopover'
import { ModelPopover } from './ModelPopover'
import { AgentPopover } from './AgentPopover'
import { Modal } from './Modal'
import { CustomModelConfigDialog } from './CustomModelConfigDialog'

interface Workspace {
  id: string
  name: string
  path: string
}

interface MentionRecord {
  fromAgentId: string
  fromAgentName: string
  toAgentId: string
  toAgentName: string
  task: string
}

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  speakerAgentId?: string
  speakerAgentName?: string
  speakerAgentEmoji?: string
  mentions?: MentionRecord[]
  model?: string
  usage?: ChatUsage
  tool_calls?: ToolCallRecord[]
}

export function ChatArea() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false)
  const [isPermissionOpen, setIsPermissionOpen] = useState(false)
  const [isModelOpen, setIsModelOpen] = useState(false)
  const [isModelConfigOpen, setIsModelConfigOpen] = useState(false)
  const [isAgentOpen, setIsAgentOpen] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    { id: '1', name: '项目 A', path: 'D:\\Projects\\ProjectA' },
    { id: '2', name: '文档管理', path: 'D:\\Documents\\Docs' },
    { id: '3', name: '开发环境', path: 'D:\\Dev\\Workspace' },
  ])
  const [selectedModel, setSelectedModel] = useState('deepseek-v4-flash')
  const [selectedAgents, setSelectedAgents] = useState<AgentConfig[]>([])
  const [mentionAgentId, setMentionAgentId] = useState<string | null>(null)
  const [isMentionPickerOpen, setIsMentionPickerOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionError, setMentionError] = useState<string | null>(null)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0)
  const [lastPromptTokens, setLastPromptTokens] = useState(0)
  const [lastCompletionTokens, setLastCompletionTokens] = useState(0)
  const [totalPromptTokens, setTotalPromptTokens] = useState(0)
  const [totalCompletionTokens, setTotalCompletionTokens] = useState(0)
  const [maxInputTokens, setMaxInputTokens] = useState(0)
  const workspaceButtonRef = useRef<HTMLButtonElement>(null)
  const permissionButtonRef = useRef<HTMLButtonElement>(null)
  const modelButtonRef = useRef<HTMLButtonElement>(null)
  const agentButtonRef = useRef<HTMLButtonElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mentionListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const loadSelectedAgents = async () => {
      try {
        const agents = await window.electronAPI.getAgents()
        const savedIds = await window.electronAPI.getSelectedAgents()
        let picked: AgentConfig[] = []
        if (savedIds && savedIds.length > 0) {
          picked = agents.filter((a) => savedIds.includes(a.id))
        }
        if (picked.length === 0) {
          const savedSingleId = await window.electronAPI.getSelectedAgent()
          if (savedSingleId) {
            const a = agents.find((x) => x.id === savedSingleId)
            if (a) picked = [a]
          }
        }
        if (picked.length === 0 && agents.length > 0) {
          picked = [agents[0]]
          await window.electronAPI.setSelectedAgents(picked.map((a) => a.id))
        }
        if (picked.length > 0) {
          setSelectedAgents(picked)
          const withModel = picked.find((a) => a.model)
          if (withModel) setSelectedModel(withModel.model)
        }
      } catch (error) {
        console.error('Failed to load selected agents:', error)
      }
    }
    loadSelectedAgents()
  }, [])

  const isGroup = selectedAgents.length >= 2
  const filteredMentionAgents = isMentionPickerOpen
    ? selectedAgents.filter((a) => a.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : []

  useEffect(() => {
    if (mentionHighlightIndex >= filteredMentionAgents.length && filteredMentionAgents.length > 0) {
      setMentionHighlightIndex(0)
    }
  }, [filteredMentionAgents.length, mentionHighlightIndex])

  useEffect(() => {
    if (!isMentionPickerOpen || !mentionListRef.current) return
    const el = mentionListRef.current.querySelector('[data-highlight="true"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [mentionHighlightIndex, isMentionPickerOpen, mentionQuery])

  const handleSend = async () => {
    if (!message.trim() || isSending) return
    if (!selectedWorkspace || !selectedWorkspace.path) {
      setWorkspaceError('请先选择项目目录后再发送消息')
      return
    }
    setWorkspaceError(null)
    if (selectedAgents.length === 0) {
      setMentionError('请先选择一个智能体后再发送消息')
      return
    }

    // 群聊模式：必须通过 @ 指定首响应智能体，否则不允许发送
    if (isGroup && !mentionAgentId) {
      setMentionError('群聊模式下，请输入 @ 指定一位智能体后再发送消息')
      return
    }
    setMentionError(null)

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      content: message.trim(),
      role: 'user',
    }

    setMessages((prev) => [...prev, userMessage])
    setMessage('')
    setIsSending(true)
    closeAllPopovers()
    setIsMentionPickerOpen(false)

    const speakerToMsgId = new Map<string, string>()

    const ensureAssistantFor = (agentId: string, agentName: string): string => {
      let id = speakerToMsgId.get(agentId)
      if (!id) {
        id = `msg-${Date.now()}-${agentId}`
        const agentEmoji = selectedAgents.find((a) => a.id === agentId)?.emoji
        const placeholder: Message = {
          id,
          content: '',
          role: 'assistant',
          speakerAgentId: agentId,
          speakerAgentName: agentName,
          speakerAgentEmoji: agentEmoji,
          model: selectedModel,
          tool_calls: [],
          mentions: isGroup ? [] : undefined,
        }
        setMessages((prev) => [...prev, placeholder])
        speakerToMsgId.set(agentId, id)
      }
      return id
    }

    let singleAssistantId: string | null = null
    if (!isGroup) {
      singleAssistantId = `msg-${Date.now()}-resp`
      const agent = selectedAgents[0]
      const placeholder: Message = {
        id: singleAssistantId,
        content: '',
        role: 'assistant',
        speakerAgentId: agent?.id,
        speakerAgentName: agent?.name,
        speakerAgentEmoji: agent?.emoji,
        model: selectedModel,
        tool_calls: [],
      }
      setMessages((prev) => [...prev, placeholder])
    }

    window.electronAPI.onChatSpeaker((data) => {
      ensureAssistantFor(data.agentId, data.agentName)
    })

    window.electronAPI.onChatChunk((data) => {
      let targetId: string | null = null
      if (isGroup && data.agentId) {
        targetId = speakerToMsgId.get(data.agentId) ?? null
        if (!targetId && data.agentName) {
          targetId = ensureAssistantFor(data.agentId, data.agentName)
        }
      } else {
        targetId = singleAssistantId
      }
      if (!targetId) return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === targetId ? { ...m, content: m.content + data.content } : m
        )
      )
    })

    window.electronAPI.onChatMention((data) => {
      const fromId = speakerToMsgId.get(data.fromAgentId)
      if (!fromId) return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === fromId
            ? { ...m, mentions: [...(m.mentions || []), data] }
            : m
        )
      )
    })

    window.electronAPI.onChatToolCall((data) => {
      let targetId: string | null = null
      if (isGroup && data.agentId) {
        targetId = speakerToMsgId.get(data.agentId) ?? null
      } else {
        targetId = singleAssistantId
      }
      if (!targetId) return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === targetId
            ? {
                ...m,
                tool_calls: [
                  ...(m.tool_calls || []),
                  { name: data.name, arguments: data.arguments, result: data.result },
                ],
              }
            : m
        )
      )
    })

    window.electronAPI.onChatDone((data) => {
      if (data.usage) {
        setLastPromptTokens(data.usage.prompt_tokens)
        setLastCompletionTokens(data.usage.completion_tokens)
        setTotalPromptTokens((prev) => prev + data.usage!.prompt_tokens)
        setTotalCompletionTokens((prev) => prev + data.usage!.completion_tokens)
      }
      if (data.max_input_tokens) {
        setMaxInputTokens(data.max_input_tokens)
      }
      setIsSending(false)
      window.electronAPI.removeChatListeners()
    })

    window.electronAPI.onChatError((data) => {
      setMessages((prev) => {
        const targetId = isGroup
          ? Array.from(speakerToMsgId.values()).pop() ?? null
          : singleAssistantId
        if (!targetId) return prev
        return prev.map((m) =>
          m.id === targetId ? { ...m, content: `发送失败：${data.message}` } : m
        )
      })
      setIsSending(false)
      window.electronAPI.removeChatListeners()
    })

    const effectiveModel = selectedAgents.find((a) => a.model)?.model || selectedModel
    if (isGroup) {
      window.electronAPI.sendChatMessage({
        message: userMessage.content,
        model: effectiveModel,
        agentIds: selectedAgents.map((a) => a.id),
        mentionAgentId: mentionAgentId || undefined,
      })
      setMentionAgentId(null)
    } else {
      window.electronAPI.sendChatMessage({
        message: userMessage.content,
        model: effectiveModel,
        agentId: selectedAgents[0]?.id,
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isMentionPickerOpen && filteredMentionAgents.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionHighlightIndex((prev) => (prev + 1) % filteredMentionAgents.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionHighlightIndex((prev) => (prev - 1 + filteredMentionAgents.length) % filteredMentionAgents.length)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const idx = Math.min(mentionHighlightIndex, filteredMentionAgents.length - 1)
        handlePickMention(filteredMentionAgents[idx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsMentionPickerOpen(false)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSelectWorkspace = (workspace: Workspace) => {
    setSelectedWorkspace(workspace)
    setWorkspaceError(null)
    setIsWorkspaceOpen(false)
    setWorkspaces((prev) =>
      prev.some((w) => w.path === workspace.path) ? prev : [workspace, ...prev]
    )
  }

  const handleRemoveWorkspace = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setWorkspaces((prev) => prev.filter((w) => w.id !== id))
    setSelectedWorkspace((prev) => (prev?.id === id ? null : prev))
  }

  const handleSelectModel = (model: string) => {
    setSelectedModel(model)
    setIsModelOpen(false)
  }

  const handleToggleAgent = (agent: AgentConfig) => {
    setSelectedAgents((prev) => {
      const exists = prev.some((a) => a.id === agent.id)
      const next = exists ? prev.filter((a) => a.id !== agent.id) : [...prev, agent]
      window.electronAPI.setSelectedAgents(next.map((a) => a.id))
      const withModel = next.find((a) => a.model)
      if (withModel) setSelectedModel(withModel.model)
      return next
    })
    setMentionAgentId((prev) => (prev === agent.id ? null : prev))
    setMentionError(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setMessage(val)
    if (!isGroup) {
      setIsMentionPickerOpen(false)
      return
    }
    const match = /(?:^|\s)@([^\s]*)$/.exec(val)
    if (match) {
      setMentionQuery(match[1])
      setIsMentionPickerOpen(true)
      setMentionHighlightIndex(0)
    } else {
      setIsMentionPickerOpen(false)
      if (!val.includes('@')) {
        setMentionAgentId(null)
        setMentionError(null)
      }
    }
  }

  const handlePickMention = (agent: AgentConfig) => {
    setMessage((prev) => prev.replace(/(?:^|\s)@[^\s]*$/, ` @${agent.name} `))
    setMentionAgentId(agent.id)
    setIsMentionPickerOpen(false)
    setMentionError(null)
  }

  const closeAllPopovers = () => {
    setIsWorkspaceOpen(false)
    setIsPermissionOpen(false)
    setIsModelOpen(false)
    setIsModelConfigOpen(false)
    setIsAgentOpen(false)
  }

  const handleConfigureModel = () => {
    closeAllPopovers()
    setIsModelConfigOpen(true)
  }

  const handleModelSaved = () => {
    setIsModelOpen(false)
  }

  const toggleWorkspace = () => {
    const willOpen = !isWorkspaceOpen
    closeAllPopovers()
    setIsWorkspaceOpen(willOpen)
  }

  const togglePermission = () => {
    const willOpen = !isPermissionOpen
    closeAllPopovers()
    setIsPermissionOpen(willOpen)
  }

  const toggleAgent = () => {
    const willOpen = !isAgentOpen
    closeAllPopovers()
    setIsAgentOpen(willOpen)
  }

  const toggleModel = () => {
    const willOpen = !isModelOpen
    closeAllPopovers()
    setIsModelOpen(willOpen)
  }

  const handleStop = () => {
    window.electronAPI.stopChatMessage()
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {msg.role === 'user' ? (
                <User className="w-4 h-4" />
              ) : msg.speakerAgentEmoji ? (
                <span className="text-base leading-none">{msg.speakerAgentEmoji}</span>
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>
            <div className="flex flex-col max-w-[70%]">
              {msg.role === 'assistant' && msg.speakerAgentName && (
                <span className="text-xs text-gray-500 mb-1 ml-1 font-medium">
                  {msg.speakerAgentName}
                </span>
              )}
              {msg.role === 'assistant' && msg.mentions && msg.mentions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {msg.mentions.map((mn, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-full px-2 py-0.5"
                    >
                      <AtSign className="w-3 h-3" />
                      {mn.toAgentName}
                      <span className="text-purple-400">· {mn.task.length > 40 ? mn.task.substring(0, 40) + '...' : mn.task}</span>
                    </span>
                  ))}
                </div>
              )}
              <div
                className={`px-4 py-3 rounded-xl ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-tr-sm'
                    : 'bg-gray-100 text-gray-700 rounded-tl-sm'
                }`}
              >
                {msg.role === 'assistant' && !msg.content && (!msg.tool_calls || msg.tool_calls.length === 0) ? (
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                )}
              </div>
              {msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.tool_calls.map((tc, idx) => (
                    <div key={idx} className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2">
                      <div className="font-medium text-gray-600">🔧 {tc.name}</div>
                      <div className="text-gray-400 mt-1">参数: {tc.arguments.length > 200 ? tc.arguments.substring(0, 200) + '...' : tc.arguments}</div>
                      <div className="text-gray-400 mt-1">结果: {tc.result.length > 200 ? tc.result.substring(0, 200) + '...' : tc.result}</div>
                    </div>
                  ))}
                </div>
              )}
              {msg.role === 'assistant' && msg.model && (
                <span className="text-xs text-gray-400 mt-1 ml-1">
                  {msg.model}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6">
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
          {workspaceError && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{workspaceError}</span>
            </div>
          )}
          {(selectedAgents.length === 0 || mentionError) && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              <AtSign className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{selectedAgents.length === 0 ? '请先选择一个智能体后再发送消息' : mentionError}</span>
            </div>
          )}
          <div className="relative">
            {isMentionPickerOpen && (
              <div ref={mentionListRef} className="absolute bottom-full mb-2 left-0 w-[240px] bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-[200px] overflow-y-auto">
                {filteredMentionAgents.map((agent, idx) => (
                  <button
                    key={agent.id}
                    onClick={() => handlePickMention(agent)}
                    onMouseEnter={() => setMentionHighlightIndex(idx)}
                    data-highlight={idx === mentionHighlightIndex}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left ${
                      idx === mentionHighlightIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {agent.emoji ? (
                      <span className="text-base leading-none flex-shrink-0">{agent.emoji}</span>
                    ) : (
                      <Bot className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm text-gray-700 truncate">{agent.name}</div>
                      <div className="text-xs text-gray-400 truncate">{agent.description}</div>
                    </div>
                  </button>
                ))}
                {filteredMentionAgents.length === 0 && (
                  <div className="px-3 py-3 text-xs text-gray-400 text-center">未找到匹配的智能体</div>
                )}
              </div>
            )}
            <textarea
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isGroup ? '群聊模式：请输入 @ 指定首响应智能体后再发送' : '今天帮你做些什么？@ 引用对话文件，/ 调用技能与指令'}
              className="w-full bg-transparent resize-none outline-none text-gray-700 placeholder-gray-400 text-base min-h-[60px] max-h-[200px]"
              rows={3}
              disabled={isSending}
            />
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-4">
              <button
                ref={agentButtonRef}
                onClick={toggleAgent}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                disabled={isSending}
              >
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-sm text-indigo-600 font-medium">
                  {selectedAgents.length === 0
                    ? '选择智能体'
                    : selectedAgents.length === 1
                    ? `${selectedAgents[0].emoji ? selectedAgents[0].emoji + ' ' : ''}${selectedAgents[0].name}`
                    : `${selectedAgents.length} 个智能体 · 群聊`}
                </span>
                <ChevronDown className="w-4 h-4 text-indigo-500" />
              </button>

              <button
                ref={modelButtonRef}
                onClick={toggleModel}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                disabled={isSending}
              >
                <Globe className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-blue-600 font-medium">{selectedModel}</span>
                <ChevronDown className="w-4 h-4 text-blue-500" />
              </button>

              <button
                onClick={isSending ? handleStop : handleSend}
                className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isSending && (!message.trim() || selectedAgents.length === 0)}
                title={isSending ? '停止生成' : '发送消息'}
              >
                {isSending ? (
                  <Square className="w-5 h-5 text-white" />
                ) : (
                  <Send className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-4">
              <button
                ref={workspaceButtonRef}
                onClick={toggleWorkspace}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                disabled={isSending}
              >
                <FolderOpen className="w-4 h-4" />
                <span>{selectedWorkspace?.name || '选择工作空间'}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                ref={permissionButtonRef}
                onClick={togglePermission}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                disabled={isSending}
              >
                <Lock className="w-4 h-4" />
                <span>默认权限</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            {(lastPromptTokens > 0 || lastCompletionTokens > 0) && (
              <span className="text-xs text-gray-400">
                Token消耗：{maxInputTokens > 0 ? `窗口消耗: ${((lastPromptTokens / maxInputTokens) * 100).toFixed(1)}%  |    ` : ''}本次 输入: {lastPromptTokens} 输出: {lastCompletionTokens}    |    累计 输入: {totalPromptTokens} 输出: {totalCompletionTokens}
              </span>
            )}
          </div>
        </div>
      </div>

      <Popover
        isOpen={isWorkspaceOpen}
        onClose={closeAllPopovers}
        anchorRef={workspaceButtonRef}
        height={200}
      >
        <WorkspacePopover
          selectedWorkspace={selectedWorkspace}
          workspaces={workspaces}
          onSelectWorkspace={handleSelectWorkspace}
          onRemoveWorkspace={handleRemoveWorkspace}
        />
      </Popover>

      <Popover
        isOpen={isPermissionOpen}
        onClose={closeAllPopovers}
        anchorRef={permissionButtonRef}
        height={130}
        alignRight
      >
        <PermissionPopover />
      </Popover>

      <Popover
        isOpen={isAgentOpen}
        onClose={closeAllPopovers}
        anchorRef={agentButtonRef}
        height={420}
        alignRight
      >
        <AgentPopover
          selectedAgentIds={selectedAgents.map((a) => a.id)}
          onToggleAgent={handleToggleAgent}
          onClose={() => setIsAgentOpen(false)}
        />
      </Popover>

      <Popover
        isOpen={isModelOpen}
        onClose={closeAllPopovers}
        anchorRef={modelButtonRef}
        height={420}
        alignRight
      >
        <ModelPopover
          selectedModel={selectedModel}
          onSelectModel={handleSelectModel}
          onConfigureClick={handleConfigureModel}
        />
      </Popover>

      <Modal
        isOpen={isModelConfigOpen}
        onClose={() => setIsModelConfigOpen(false)}
        title="添加模型"
      >
        <CustomModelConfigDialog
          onClose={() => setIsModelConfigOpen(false)}
          onSave={handleModelSaved}
        />
      </Modal>
    </div>
  )
}
