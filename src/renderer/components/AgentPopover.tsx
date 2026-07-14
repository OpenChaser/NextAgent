import { useState, useEffect } from 'react'
import { Search, Bot, Check, ShieldCheck } from 'lucide-react'

interface AgentPopoverProps {
  selectedAgentId: string | null
  onSelectAgent: (agent: AgentConfig) => void
}

export function AgentPopover({ selectedAgentId, onSelectAgent }: AgentPopoverProps) {
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

  return (
    <div className="w-[280px]">
      <div className="relative p-3">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索智能体"
          className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="max-h-[240px] overflow-y-auto">
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
          filteredAgents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent)}
              className={`w-full flex items-start justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors text-left ${
                selectedAgentId === agent.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                <Bot className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm truncate ${selectedAgentId === agent.id ? 'text-blue-600' : 'text-gray-700'}`}>
                      {agent.name}
                    </span>
                    {agent.builtin && (
                      <ShieldCheck className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{agent.description}</p>
                </div>
              </div>
              {selectedAgentId === agent.id && (
                <Check className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
