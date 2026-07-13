import { useState, useEffect } from 'react'
import { Search, Sparkles, Zap, Check, Settings } from 'lucide-react'

interface ModelPopoverProps {
  selectedModel: string
  onSelectModel: (model: string) => void
  onConfigureClick: () => void
}

function getProviderIcon(provider: string) {
  switch (provider) {
    case 'deepseek':
      return <Sparkles className="w-4 h-4 text-cyan-500" />
    case 'openai':
      return <Sparkles className="w-4 h-4 text-blue-600" />
    case 'anthropic':
      return <Sparkles className="w-4 h-4 text-teal-500" />
    case 'google':
      return <Sparkles className="w-4 h-4 text-red-500" />
    case 'glm':
      return <Zap className="w-4 h-4 text-gray-800" />
    case 'moonshot':
      return <Sparkles className="w-4 h-4 text-purple-500" />
    case 'minimax':
      return <Sparkles className="w-4 h-4 text-pink-500" />
    case 'baidu':
      return <Sparkles className="w-4 h-4 text-blue-500" />
    case 'alibaba':
      return <Sparkles className="w-4 h-4 text-orange-500" />
    case 'kimi':
      return <Sparkles className="w-4 h-4 text-orange-500" />
    case 'yi':
      return <Sparkles className="w-4 h-4 text-green-500" />
    case 'microsoft':
      return <Sparkles className="w-4 h-4 text-blue-600" />
    case 'mistral':
      return <Sparkles className="w-4 h-4 text-purple-600" />
    case 'qwen':
      return <Sparkles className="w-4 h-4 text-orange-500" />
    default:
      return <Sparkles className="w-4 h-4 text-gray-400" />
  }
}

export function ModelPopover({ selectedModel, onSelectModel, onConfigureClick }: ModelPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [providers, setProviders] = useState<Model[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadModels = async () => {
      try {
        const data = await window.electronAPI.getModels()
        setProviders(data)
      } catch (error) {
        console.error('Failed to load models:', error)
        setProviders([])
      } finally {
        setIsLoading(false)
      }
    }
    loadModels()
  }, [])

  // 将 provider 列表展开为模型条目
  const modelEntries = providers.flatMap((p) =>
    p.models.map((m) => ({ modelName: m.name, providerName: p.name, provider: p.provider }))
  )

  const filteredEntries = modelEntries.filter((entry) =>
    entry.modelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.providerName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="w-[280px]">
      <div className="relative p-3">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索模型"
          className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="max-h-[300px] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            未找到模型
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <button
              key={entry.modelName}
              onClick={() => onSelectModel(entry.modelName)}
              className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors ${
                selectedModel === entry.modelName ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                {getProviderIcon(entry.provider)}
                <span className={`text-sm ${
                  selectedModel === entry.modelName ? 'text-blue-600' : 'text-gray-700'
                }`}>
                  {entry.modelName}
                </span>
                <span className="text-xs text-gray-400">
                  {entry.providerName}
                </span>
              </div>
              {selectedModel === entry.modelName && (
                <Check className="w-4 h-4 text-blue-500" />
              )}
            </button>
          ))
        )}
      </div>

      <div className="p-3 border-t border-gray-100">
        <button
          onClick={onConfigureClick}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>配置自定义模型</span>
        </button>
      </div>
    </div>
  )
}
