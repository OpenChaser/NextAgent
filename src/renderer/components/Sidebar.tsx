import { useState } from 'react'
import { Plus, Bot, FolderKanban, Users, Zap, MoreHorizontal, ChevronRight, MessageSquare, LayoutGrid, Settings, RefreshCw, Search, Grid3X3, Brain, Trash2 } from 'lucide-react'
import { Modal } from './Modal'

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  tasks: TaskItem[]
  currentTaskId: string | null
  onCreateTask: () => void
  onSelectTask: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
}

const menuItems = [
  { id: 'new-task', icon: Plus, label: '新建任务', active: true },
  { id: 'assistant', icon: Bot, label: '助理' },
  { id: 'assistant2', icon: MessageSquare, label: '助理' },
  { id: 'project', icon: FolderKanban, label: '项目' },
  { id: 'experts', icon: Users, label: '专家·技能·连接器' },
  { id: 'automation', icon: Zap, label: '自动化' },
  { id: 'memory', icon: Brain, label: '记忆' },
  { id: 'more', icon: MoreHorizontal, label: '更多', badge: '资料库·灵感' },
]

export function Sidebar({ activeTab, onTabChange, tasks, currentTaskId, onCreateTask, onSelectTask, onDeleteTask }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [tasksCollapsed, setTasksCollapsed] = useState(false)

  return (
    <div className="w-64 h-full bg-sidebar-bg flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">NextAgent</h1>
            <span className="text-xs text-gray-500">v1.0.0</span>
          </div>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-sidebar-hover rounded-lg transition-colors">
              <Grid3X3 className="w-4 h-4 text-gray-500" />
            </button>
            <button className="p-2 hover:bg-sidebar-hover rounded-lg transition-colors">
              <Search className="w-4 h-4 text-gray-500" />
            </button>
            <button className="p-2 hover:bg-sidebar-hover rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="搜索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
        />
      </div>

      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = item.id === 'new-task'
              ? activeTab === 'new-task' && !currentTaskId
              : activeTab === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => (item.id === 'new-task' ? onCreateTask() : onTabChange(item.id))}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sidebar-active text-gray-900'
                      : 'text-gray-600 hover:bg-sidebar-hover'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-500' : ''}`} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="text-xs text-gray-400">{item.badge}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-6">
          <button
            onClick={() => setTasksCollapsed((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-500 hover:bg-sidebar-hover rounded-lg transition-colors"
          >
            <span>任务清单 ({tasks.length})</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${tasksCollapsed ? '' : 'rotate-90'}`} />
          </button>
          {!tasksCollapsed && (
            <div className="space-y-1 mt-1 ml-3">
              {tasks.map((task) => {
                const isActive = currentTaskId === task.id && activeTab === 'new-task'
                return (
                  <div
                    key={task.id}
                    className={`group w-full flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-sidebar-active text-gray-900'
                        : 'text-gray-600 hover:bg-sidebar-hover'
                    }`}
                    onClick={() => onSelectTask(task.id)}
                    title={task.title}
                  >
                    <span className="flex-1 truncate text-left">{task.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setPendingDeleteId(task.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity flex-shrink-0"
                      title="删除会话"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                )
              })}
              {tasks.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">暂无任务</div>
              )}
            </div>
          )}
          <button className="w-full flex items-center justify-between px-3 py-2 mt-3 text-sm text-gray-500 hover:bg-sidebar-hover rounded-lg transition-colors">
            <span>空间 (3)</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <div className="p-3 border-t border-gray-200">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center">
            <span className="text-white text-sm font-semibold">星</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">星辰大海</p>
          </div>
          <button
            onClick={() => onTabChange('settings')}
            className={`p-1.5 hover:bg-sidebar-hover rounded-lg transition-colors ${
              activeTab === 'settings' ? 'bg-sidebar-active' : ''
            }`}
            title="设置"
          >
            <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-blue-500' : 'text-gray-500'}`} />
          </button>
          <button className="p-1.5 hover:bg-sidebar-hover rounded-lg transition-colors">
            <LayoutGrid className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
      <Modal
        isOpen={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        title="删除会话"
      >
        <p className="text-sm text-gray-600 mb-6">
          确定删除会话「{tasks.find((t) => t.id === pendingDeleteId)?.title ?? ''}」吗？该会话的对话历史将一并删除，且不可恢复。
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setPendingDeleteId(null)}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => {
              if (pendingDeleteId) {
                onDeleteTask(pendingDeleteId)
              }
              setPendingDeleteId(null)
            }}
            className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
          >
            删除
          </button>
        </div>
      </Modal>
    </div>
  )
}
