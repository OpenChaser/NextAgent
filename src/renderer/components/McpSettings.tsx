import { useEffect, useState } from 'react'
import { Server, Plus, Trash2, Pencil, Play, Pause, Terminal, Link as LinkIcon, X } from 'lucide-react'

type McpTransport = 'stdio' | 'sse'

interface McpServer {
  id: string
  name: string
  transport: McpTransport
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  enabled: boolean
}

interface McpForm {
  id: string
  name: string
  transport: McpTransport
  command: string
  args: string
  env: string
  url: string
}

const emptyForm: McpForm = {
  id: '',
  name: '',
  transport: 'stdio',
  command: '',
  args: '',
  env: '',
  url: '',
}

function parseEnv(raw: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim()
      if (key) env[key] = value
    }
  }
  return env
}

export function McpSettings() {
  const [servers, setServers] = useState<McpServer[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<McpForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const loadServers = async () => {
    const list = await window.electronAPI.getMcpServers()
    setServers(list)
  }

  useEffect(() => {
    loadServers()
  }, [])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  const handleAdd = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  const handleEdit = (server: McpServer) => {
    setForm({
      id: server.id,
      name: server.name,
      transport: server.transport,
      command: server.command || '',
      args: (server.args || []).join(' '),
      env: server.env
        ? Object.entries(server.env)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n')
        : '',
      url: server.url || '',
    })
    setEditingId(server.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    if (form.transport === 'stdio' && !form.command.trim()) return
    if (form.transport === 'sse' && !form.url.trim()) return

    setSaving(true)
    try {
      const id = editingId || `mcp-${Date.now()}`
      const server: McpServer = {
        id,
        name: form.name.trim(),
        transport: form.transport,
        enabled: editingId
          ? servers.find((s) => s.id === editingId)?.enabled ?? true
          : true,
      }
      if (form.transport === 'stdio') {
        server.command = form.command.trim()
        server.args = form.args.trim()
          ? form.args.trim().split(/\s+/).filter(Boolean)
          : []
        const env = parseEnv(form.env)
        if (Object.keys(env).length > 0) server.env = env
      } else {
        server.url = form.url.trim()
      }
      await window.electronAPI.saveMcpServer(server)
      await loadServers()
      resetForm()
    } catch (error) {
      console.error('Failed to save mcp server:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: string) => {
    await window.electronAPI.toggleMcpServer(id)
    await loadServers()
  }

  const handleDelete = async (id: string) => {
    await window.electronAPI.deleteMcpServer(id)
    if (editingId === id) resetForm()
    await loadServers()
  }

  const canSave =
    form.name.trim() &&
    (form.transport === 'stdio' ? form.command.trim() : form.url.trim())

  return (
    <div className="flex-1 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Server className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">MCP</h1>
              <p className="text-sm text-gray-500">管理你的 Model Context Protocol 服务器</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-gray-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-500" />
              {editingId ? '编辑 MCP 服务器' : '添加 MCP 服务器'}
            </h2>
            {showForm && (
              <button
                onClick={resetForm}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="取消"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>

          {!showForm ? (
            <button
              onClick={handleAdd}
              className="w-full py-3 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              + 添加 MCP 服务器
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：filesystem"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">传输方式</label>
                <select
                  value={form.transport}
                  onChange={(e) => setForm({ ...form, transport: e.target.value as McpTransport })}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                >
                  <option value="stdio">stdio（本地命令）</option>
                  <option value="sse">sse（远程 URL）</option>
                </select>
              </div>

              {form.transport === 'stdio' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">命令</label>
                    <input
                      type="text"
                      value={form.command}
                      onChange={(e) => setForm({ ...form, command: e.target.value })}
                      placeholder="例如：npx"
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">参数（空格分隔）</label>
                    <input
                      type="text"
                      value={form.args}
                      onChange={(e) => setForm({ ...form, args: e.target.value })}
                      placeholder="例如：-y @modelcontextprotocol/server-filesystem /tmp"
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">环境变量（每行 KEY=VALUE）</label>
                    <textarea
                      value={form.env}
                      onChange={(e) => setForm({ ...form, env: e.target.value })}
                      placeholder={'例如：\nAPI_KEY=xxxx\nDEBUG=true'}
                      rows={3}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务器 URL</label>
                  <input
                    type="text"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://example.com/sse"
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave || saving}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-base font-medium text-gray-800 mb-3 flex items-center gap-2">
            <Server className="w-4 h-4 text-gray-500" />
            已配置的服务器 ({servers.length})
          </h2>
          {servers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Server className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">还没有 MCP 服务器，添加一个开始扩展能力</p>
            </div>
          ) : (
            <div className="space-y-3">
              {servers.map((server) => {
                const isEditing = editingId === server.id && showForm
                return (
                  <div
                    key={server.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {server.transport === 'stdio' ? (
                          <Terminal className={`w-4 h-4 ${server.enabled ? 'text-indigo-500' : 'text-gray-400'}`} />
                        ) : (
                          <LinkIcon className={`w-4 h-4 ${server.enabled ? 'text-indigo-500' : 'text-gray-400'}`} />
                        )}
                        <h3 className="text-sm font-medium text-gray-800">{server.name}</h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            server.transport === 'stdio'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-purple-50 text-purple-600'
                          }`}
                        >
                          {server.transport}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            server.enabled
                              ? 'bg-green-50 text-green-600'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {server.enabled ? '已启用' : '已停用'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggle(server.id)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                          title={server.enabled ? '停用' : '启用'}
                        >
                          {server.enabled ? (
                            <Pause className="w-4 h-4 text-gray-500" />
                          ) : (
                            <Play className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        <button
                          onClick={() => (isEditing ? resetForm() : handleEdit(server))}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                          title={isEditing ? '收起' : '编辑'}
                        >
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleDelete(server.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 font-mono break-all">
                      {server.transport === 'stdio'
                        ? [server.command, ...(server.args || [])].join(' ')
                        : server.url}
                    </div>
                    {server.env && Object.keys(server.env).length > 0 && (
                      <div className="mt-2 text-xs text-gray-400">
                        环境变量：{Object.keys(server.env).join(', ')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
