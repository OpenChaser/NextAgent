import { useState, useEffect, useCallback } from 'react'
import { Brain, Plus, Trash2, ArrowLeft, RefreshCw } from 'lucide-react'

interface AgentConfig {
  id: string
  name: string
}

interface MemoryViewProps {
  onBack: () => void
}

export function MemoryView({ onBack }: MemoryViewProps) {
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [newContent, setNewContent] = useState('')
  const [newTags, setNewTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadAgents = useCallback(async () => {
    try {
      const list = await window.electronAPI.getAgents()
      setAgents(list)
      if (list.length > 0 && !selectedAgentId) {
        setSelectedAgentId(list[0].id)
      }
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }, [selectedAgentId])

  const loadMemories = useCallback(async () => {
    setLoading(true)
    try {
      const all = await window.electronAPI.getMemories()
      setMemories(all)
    } catch (error) {
      console.error('Failed to load memories:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAgents()
    loadMemories()
  }, [loadAgents, loadMemories])

  const filtered = selectedAgentId
    ? memories.filter((m) => m.agentId === selectedAgentId)
    : memories

  const sorted = filtered.slice().sort((a, b) => b.createdAt - a.createdAt)

  const handleAdd = async () => {
    const content = newContent.trim()
    if (!content || !selectedAgentId) return
    setSaving(true)
    try {
      const tags = newTags.trim()
        ? newTags.split(/[,，\s]+/).filter(Boolean)
        : undefined
      await window.electronAPI.addMemory({
        agentId: selectedAgentId,
        content,
        tags,
      })
      setNewContent('')
      setNewTags('')
      await loadMemories()
    } catch (error) {
      console.error('Failed to add memory:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await window.electronAPI.deleteMemory(id)
      await loadMemories()
    } catch (error) {
      console.error('Failed to delete memory:', error)
    }
  }

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="返回"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" />
            <h1 className="text-lg font-semibold text-gray-800">记忆管理</h1>
          </div>
        </div>
        <button
          onClick={loadMemories}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="刷新"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <label className="text-sm text-gray-600">Agent:</label>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400">
            共 {sorted.length} 条记忆
          </span>
        </div>

        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="输入要保存到长期记忆的内容..."
            className="w-full bg-transparent resize-none outline-none text-sm text-gray-700 placeholder-gray-400 min-h-[50px]"
            rows={2}
            disabled={!selectedAgentId || saving}
          />
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="标签(逗号分隔,可选)"
              className="flex-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:border-blue-400"
              disabled={!selectedAgentId || saving}
            />
            <button
              onClick={handleAdd}
              disabled={!newContent.trim() || !selectedAgentId || saving}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-3 h-3" />
              保存
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="text-center text-gray-400 py-8">加载中...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            暂无记忆条目。可通过上方表单或让 agent 调用 save_memory 工具来创建。
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((m) => (
              <li
                key={m.id}
                className="bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {m.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          m.type === 'summary'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {m.type}
                      </span>
                      {m.tags && m.tags.length > 0 && (
                        <span className="text-xs text-gray-400">
                          #{m.tags.join(' #')}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatTime(m.createdAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="p-1.5 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
