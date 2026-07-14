import { useState, useEffect } from 'react'
import { Bot, Plus, Pencil, Trash2, Save, X, Sparkles, ShieldCheck } from 'lucide-react'

const emptyAgent: AgentConfig = {
  id: '',
  name: '',
  description: '',
  systemPrompt: '',
  model: '',
  temperature: 0.7,
  maxTokens: 4096,
  toolsEnabled: true,
  builtin: false,
  createdAt: 0,
  updatedAt: 0,
}

export function AgentConfigView() {
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AgentConfig>(emptyAgent)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [agentData, modelData] = await Promise.all([
          window.electronAPI.getAgents(),
          window.electronAPI.getModels(),
        ])
        setAgents(agentData)
        setModels(modelData)
      } catch (error) {
        console.error('Failed to load agents/models:', error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const modelEntries = models.flatMap((p) => p.models.map((m) => m.name))

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyAgent)
  }

  const handleSave = async () => {
    if (!form.name.trim() || (!form.model && !form.builtin)) return
    setIsSaving(true)
    try {
      if (editingId) {
        const updated = { ...form, updatedAt: Date.now() }
        await window.electronAPI.updateAgent(updated)
        setAgents((prev) => prev.map((a) => (a.id === editingId ? updated : a)))
      } else {
        const newAgent: AgentConfig = {
          ...form,
          id: `agent-${Date.now()}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        await window.electronAPI.addAgent(newAgent)
        setAgents((prev) => [newAgent, ...prev])
      }
      resetForm()
    } catch (error) {
      console.error('Failed to save agent:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (agent: AgentConfig) => {
    setEditingId(agent.id)
    setForm(agent)
  }

  const handleDelete = async (id: string) => {
    try {
      const ok = await window.electronAPI.deleteAgent(id)
      if (ok) {
        setAgents((prev) => prev.filter((a) => a.id !== id))
        if (editingId === id) resetForm()
      }
    } catch (error) {
      console.error('Failed to delete agent:', error)
    }
  }

  const isEditing = editingId !== null

  return (
    <div className="flex-1 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Bot className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">智能体配置</h1>
              <p className="text-sm text-gray-500">新建并管理你的智能体</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-gray-800 flex items-center gap-2">
              {isEditing ? <Pencil className="w-4 h-4 text-blue-500" /> : <Plus className="w-4 h-4 text-blue-500" />}
              {isEditing ? '编辑智能体' : '新建智能体'}
            </h2>
            {isEditing && (
              <button
                onClick={resetForm}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
                取消编辑
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：代码审查助手"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="一句话简介"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">系统提示词</label>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                placeholder="定义智能体的角色、行为与约束..."
                rows={4}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型</label>
                <select
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                >
                  <option value="">选择模型</option>
                  {modelEntries.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {modelEntries.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">尚未配置模型，请先在模型配置中添加</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  温度 ({form.temperature.toFixed(1)})
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
                  className="w-full h-9 accent-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最大输出 Tokens</label>
                <input
                  type="number"
                  value={form.maxTokens}
                  onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) })}
                  placeholder="4096"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.toolsEnabled}
                  onChange={(e) => setForm({ ...form, toolsEnabled: e.target.checked })}
                  className="w-4 h-4 accent-blue-500"
                />
                启用工具调用（允许智能体调用内置工具）
              </label>
              <button
                onClick={handleSave}
                disabled={isSaving || !form.name.trim() || (!form.model && !form.builtin)}
                className="flex items-center gap-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isSaving ? '保存中...' : isEditing ? '保存修改' : '创建智能体'}
              </button>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-base font-medium text-gray-800 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gray-500" />
            已创建的智能体 ({agents.length})
          </h2>
          {isLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="flex justify-center gap-1">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-sm text-gray-400 mt-2">加载中...</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Bot className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">还没有智能体，创建一个开始吧</p>
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`bg-white rounded-xl border p-4 transition-shadow hover:shadow-sm ${
                    editingId === agent.id ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-indigo-500" />
                      <h3 className="text-sm font-medium text-gray-800">{agent.name}</h3>
                      {agent.builtin && (
                        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                          <ShieldCheck className="w-3 h-3" />
                          内置
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                        {agent.model || '默认模型'}
                      </span>
                      {agent.toolsEnabled && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">工具</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(agent)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Pencil className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(agent.id)}
                        disabled={agent.builtin}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={agent.builtin ? '内置智能体不可删除' : '删除'}
                      >
                        <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                  {agent.description && (
                    <p className="text-sm text-gray-500 mb-2">{agent.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>温度 {agent.temperature.toFixed(1)}</span>
                    <span>最大输出 {agent.maxTokens}</span>
                    {agent.systemPrompt && (
                      <span className="truncate flex-1" title={agent.systemPrompt}>
                        提示词：{agent.systemPrompt}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
