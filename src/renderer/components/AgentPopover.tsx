import { useState, useEffect } from 'react'
import { Search, Bot, Check, ShieldCheck, Users } from 'lucide-react'

interface AgentPopoverProps {
  selectedAgentIds: string[]
  onToggleAgent: (agent: AgentConfig) => void
  onClose?: () => void
}

export function AgentPopover({ selectedAgentIds, onToggleAgent, onClose }: AgentPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const data = await window.electronAPI.getAgents()
        setAgents(data)
      } catch (error) {
        console.error('Failed to load agents:', error)
        setAgents([])
      } finally {
        setIsLoading(false)
      }
    }
    loadAgents()
  }, [])

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedCount = selectedAgentIds.length

  return (
    <div className="w-[300px]">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Users className="w-3.5 h-3.5" />
          <span>
            已选 {selectedCount} 个{selectedCount >= 2 ? ' · 群聊模式' : ''}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-blue-500 hover:text-blue-600 font-medium"
          >
            完成
          </button>
        )}
      </div>

      <div className="relative px-3 pb-2">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索智能体"
          className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="max-h-[260px] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            {agents.length === 0 ? '尚未创建智能体' : '未找到智能体'}
          </div>
        ) : (
          filteredAgents.map((agent) => {
            const isSelected = selectedAgentIds.includes(agent.id)
            return (
              <button
                key={agent.id}
                onClick={() => onToggleAgent(agent)}
                className={`w-full flex items-start justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors text-left ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-2 min-w-0">
                  {agent.emoji ? (
                    <span className="text-base leading-none mt-0.5 flex-shrink-0">{agent.emoji}</span>
                  ) : (
                    <Bot className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm truncate ${isSelected ? 'text-blue-600' : 'text-gray-700'}`}>
                        {agent.name}
                      </span>
                      {agent.builtin && (
                        <ShieldCheck className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{agent.description}</p>
                  </div>
                </div>
                <div className={`w-4 h-4 mt-0.5 flex-shrink-0 rounded border flex items-center justify-center ${
                  isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            )
          })
        )}
      </div>

      {selectedCount < 2 && (
        <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">
          再选 1 个即可进入群聊协同模式
        </div>
      )}
    </div>
  )
}
