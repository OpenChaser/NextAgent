import { useState } from 'react'
import { Plus, Bot, FolderKanban, Users, Zap, MoreHorizontal, ChevronRight, MessageSquare, LayoutGrid, Settings, RefreshCw, Search, Grid3X3 } from 'lucide-react'

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const menuItems = [
  { id: 'new-task', icon: Plus, label: '新建任务', active: true },
  { id: 'assistant', icon: Bot, label: '助理' },
  { id: 'assistant2', icon: MessageSquare, label: '助理' },
  { id: 'project', icon: FolderKanban, label: '项目' },
  { id: 'experts', icon: Users, label: '专家·技能·连接器' },
  { id: 'automation', icon: Zap, label: '自动化' },
  { id: 'more', icon: MoreHorizontal, label: '更多', badge: '资料库·灵感' },
]

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')

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
            const isActive = activeTab === item.id
            return (
              <li key={item.id}>
                <button
                  onClick={() => onTabChange(item.id)}
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
          <button className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-500 hover:bg-sidebar-hover rounded-lg transition-colors">
            <span>任务 (17)</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-500 hover:bg-sidebar-hover rounded-lg transition-colors">
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
          <button className="p-1.5 hover:bg-sidebar-hover rounded-lg transition-colors">
            <Settings className="w-4 h-4 text-gray-500" />
          </button>
          <button className="p-1.5 hover:bg-sidebar-hover rounded-lg transition-colors">
            <LayoutGrid className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  )
}
