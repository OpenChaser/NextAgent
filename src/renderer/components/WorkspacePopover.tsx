import { useState } from 'react'
import { Search, Plus, FolderOpen, RefreshCw, ChevronRight } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  path: string
}

interface WorkspacePopoverProps {
  selectedWorkspace: Workspace | null
  onSelectWorkspace: (workspace: Workspace) => void
}

const mockWorkspaces: Workspace[] = [
  { id: '1', name: '项目 A', path: 'D:\\Projects\\ProjectA' },
  { id: '2', name: '文档管理', path: 'D:\\Documents\\Docs' },
  { id: '3', name: '开发环境', path: 'D:\\Dev\\Workspace' },
]

export function WorkspacePopover({ selectedWorkspace, onSelectWorkspace }: WorkspacePopoverProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredWorkspaces = mockWorkspaces.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.path.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-2">
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索工作空间"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
        <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="max-h-[140px] overflow-y-auto">
        {filteredWorkspaces.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
            <span>未找到工作空间</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        ) : (
          <div className="space-y-1">
            {filteredWorkspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => onSelectWorkspace(workspace)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                  selectedWorkspace?.id === workspace.id
                    ? 'bg-blue-50 text-blue-600'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <FolderOpen className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{workspace.name}</p>
                  <p className="text-xs text-gray-400 truncate">{workspace.path}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
          <Plus className="w-4 h-4" />
          <span>新建工作空间</span>
        </button>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
          <FolderOpen className="w-4 h-4" />
          <span>打开本地文件夹</span>
        </button>
      </div>
    </div>
  )
}
