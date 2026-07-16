import { useState } from 'react'
import { Search, FolderOpen, RefreshCw, ChevronRight, Trash2 } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  path: string
}

interface WorkspacePopoverProps {
  selectedWorkspace: Workspace | null
  workspaces: Workspace[]
  onSelectWorkspace: (workspace: Workspace) => void
  onRemoveWorkspace: (id: string, e: React.MouseEvent) => void
}

export function WorkspacePopover({ selectedWorkspace, workspaces, onSelectWorkspace, onRemoveWorkspace }: WorkspacePopoverProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)

  const filteredWorkspaces = workspaces.filter((w) =>
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
                {removingId === workspace.id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-red-500 mr-1">确认删除?</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveWorkspace(workspace.id, e)
                        setRemovingId(null)
                      }}
                      className="px-2 py-0.5 text-xs text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                    >
                      删除
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setRemovingId(null)
                      }}
                      className="px-2 py-0.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      setRemovingId(workspace.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        setRemovingId(workspace.id)
                      }
                    }}
                    className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                    title="从列表删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
        <button
          onClick={async () => {
            const workspace = await window.electronAPI.openWorkspaceFolder()
            if (workspace) {
              onSelectWorkspace(workspace)
            }
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          <span>打开本地文件夹</span>
        </button>
      </div>
    </div>
  )
}
