import { useState, useRef, useEffect } from 'react'
import { Send, Plus, Globe, Lock, ChevronDown, FolderOpen, User, Bot, Loader2 } from 'lucide-react'
import { Popover } from './Popover'
import { WorkspacePopover } from './WorkspacePopover'
import { PermissionPopover } from './PermissionPopover'
import { ModelPopover } from './ModelPopover'
import { Modal } from './Modal'
import { CustomModelConfigDialog } from './CustomModelConfigDialog'

interface Workspace {
  id: string
  name: string
  path: string
}

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
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
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [selectedModel, setSelectedModel] = useState('deepseek-v4-flash')
  const [lastPromptTokens, setLastPromptTokens] = useState(0)
  const [lastCompletionTokens, setLastCompletionTokens] = useState(0)
  const [totalPromptTokens, setTotalPromptTokens] = useState(0)
  const [totalCompletionTokens, setTotalCompletionTokens] = useState(0)
  const [maxInputTokens, setMaxInputTokens] = useState(0)
  const workspaceButtonRef = useRef<HTMLButtonElement>(null)
  const permissionButtonRef = useRef<HTMLButtonElement>(null)
  const modelButtonRef = useRef<HTMLButtonElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!message.trim() || isSending) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      content: message.trim(),
      role: 'user',
    }

    setMessages((prev) => [...prev, userMessage])
    setMessage('')
    setIsSending(true)
    closeAllPopovers()

    const assistantId = `msg-${Date.now()}-resp`
    const assistantMessage: Message = {
      id: assistantId,
      content: '',
      role: 'assistant',
      model: selectedModel,
      tool_calls: [],
    }
    setMessages((prev) => [...prev, assistantMessage])

    // 设置流式事件监听
    window.electronAPI.onChatChunk((data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: m.content + data.content } : m
        )
      )
    })

    window.electronAPI.onChatToolCall((data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, tool_calls: [...(m.tool_calls || []), data] }
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
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: `发送失败：${data.message}` } : m
        )
      )
      setIsSending(false)
      window.electronAPI.removeChatListeners()
    })

    // 发送消息（流式，无需等待返回值）
    window.electronAPI.sendChatMessage({
      message: userMessage.content,
      model: selectedModel,
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSelectWorkspace = (workspace: Workspace) => {
    setSelectedWorkspace(workspace)
    setIsWorkspaceOpen(false)
  }

  const handleSelectModel = (model: string) => {
    setSelectedModel(model)
    setIsModelOpen(false)
  }

  const closeAllPopovers = () => {
    setIsWorkspaceOpen(false)
    setIsPermissionOpen(false)
    setIsModelOpen(false)
    setIsModelConfigOpen(false)
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

  const toggleModel = () => {
    const willOpen = !isModelOpen
    closeAllPopovers()
    setIsModelOpen(willOpen)
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
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>
            <div className="flex flex-col max-w-[70%]">
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
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="今天帮你做些什么？@ 引用对话文件，/ 调用技能与指令"
            className="w-full bg-transparent resize-none outline-none text-gray-700 placeholder-gray-400 text-base min-h-[60px] max-h-[200px]"
            rows={3}
            disabled={isSending}
          />

          <div className="flex items-center justify-between mt-3">
            <button
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={isSending}
            >
              <Plus className="w-5 h-5 text-gray-500" />
            </button>

            <div className="flex items-center gap-4">
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
                onClick={handleSend}
                className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!message.trim() || isSending}
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
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
          onSelectWorkspace={handleSelectWorkspace}
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
