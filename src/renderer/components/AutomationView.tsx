import { useState } from 'react'
import { Zap, Plus, Clock, Play, Pause, Trash2, Calendar, Pencil } from 'lucide-react'

interface AutomationTask {
  id: string
  name: string
  trigger: 'manual' | 'scheduled'
  schedule: string
  prompt: string
  enabled: boolean
  createdAt: number
}

export function AutomationView() {
  const [tasks, setTasks] = useState<AutomationTask[]>([])
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<'manual' | 'scheduled'>('manual')
  const [schedule, setSchedule] = useState('')
  const [prompt, setPrompt] = useState('')

  const handleCreate = () => {
    if (!name.trim() || !prompt.trim()) return
    const newTask: AutomationTask = {
      id: `task-${Date.now()}`,
      name: name.trim(),
      trigger,
      schedule: trigger === 'scheduled' ? schedule.trim() || '未设置' : '手动触发',
      prompt: prompt.trim(),
      enabled: true,
      createdAt: Date.now(),
    }
    setTasks((prev) => [newTask, ...prev])
    setName('')
    setTrigger('manual')
    setSchedule('')
    setPrompt('')
  }

  const toggleEnabled = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    )
  }

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">自动化</h1>
              <p className="text-sm text-gray-500">创建并管理你的自动化任务</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-medium text-gray-800 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-500" />
            创建自动化任务
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">任务名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：每日早报总结"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">触发方式</label>
                <select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value as 'manual' | 'scheduled')}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                >
                  <option value="manual">手动触发</option>
                  <option value="scheduled">定时触发</option>
                </select>
              </div>
              {trigger === 'scheduled' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">定时设置</label>
                  <input
                    type="text"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="例如：每天 09:00"
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">执行内容</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="任务要执行的提示词或操作..."
                rows={4}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleCreate}
                disabled={!name.trim() || !prompt.trim()}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建任务
              </button>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-base font-medium text-gray-800 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            已创建的任务 ({tasks.length})
          </h2>
          {tasks.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Zap className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">还没有自动化任务，创建一个开始吧</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className={`w-4 h-4 ${task.enabled ? 'text-amber-500' : 'text-gray-400'}`} />
                      <h3 className="text-sm font-medium text-gray-800">{task.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          task.enabled
                            ? 'bg-green-50 text-green-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {task.enabled ? '已启用' : '已停用'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleEnabled(task.id)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        title={task.enabled ? '停用' : '启用'}
                      >
                        {task.enabled ? (
                          <Pause className="w-4 h-4 text-gray-500" />
                        ) : (
                          <Play className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {task.trigger === 'scheduled' ? task.schedule : '手动触发'}
                    </span>
                    <span className="flex items-center gap-1 truncate">
                      <Pencil className="w-3 h-3" />
                      {task.prompt}
                    </span>
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
