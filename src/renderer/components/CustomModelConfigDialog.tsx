import { useState } from 'react'
import { Eye, EyeOff, ChevronDown } from 'lucide-react'

interface CustomModelConfigDialogProps {
  onClose: () => void
  onSave: () => void
}

const providers = [
  { id: 'deepseek', name: 'DeepSeek', url: 'https://api.deepseek.com' },
  { id: 'openai', name: 'OpenAI', url: 'https://api.openai.com/v1' },
  { id: 'azure', name: 'Azure OpenAI', url: '' },
  { id: 'other', name: '其他 OpenAI 兼容 API', url: '' },
]

const modelNames = ['deepseek-chat', 'deepseek-coder', 'gpt-4o', 'gpt-4', 'gpt-3.5-turbo', 'glm-4', 'claude-3']

export function CustomModelConfigDialog({ onClose, onSave }: CustomModelConfigDialogProps) {
  const [provider, setProvider] = useState(providers[0].id)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(providers[0].url)
  const [modelName, setModelName] = useState(modelNames[0])
  const [maxInputTokens, setMaxInputTokens] = useState(65536)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isProviderOpen, setIsProviderOpen] = useState(false)
  const [isModelOpen, setIsModelOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleProviderChange = (providerId: string) => {
    setProvider(providerId)
    const selected = providers.find((p) => p.id === providerId)
    if (selected && selected.url) {
      setBaseUrl(selected.url)
    }
    setIsProviderOpen(false)
  }

  const handleSave = async () => {
    if (!apiKey.trim() || !baseUrl.trim() || !maxInputTokens) {
      return
    }

    setIsSaving(true)
    try {
      const selectedProvider = providers.find((p) => p.id === provider)
      const newModel = {
        id: `${provider}-${Date.now()}`,
        name: selectedProvider?.name || provider,
        provider,
        url: baseUrl,
        key: apiKey,
        models: [{ name: modelName, max_input_tokens: maxInputTokens }],
      }

      await window.electronAPI.addModel(newModel)
      onSave()
      onClose()
    } catch (error) {
      console.error('Failed to add model:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const selectedProvider = providers.find((p) => p.id === provider)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">仅支持 OpenAI 兼容协议 API</span>
        <a href="#" className="text-sm text-blue-500 hover:text-blue-600">
          查看文档
        </a>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">提供商</label>
        <div className="relative">
          <button
            onClick={() => setIsProviderOpen(!isProviderOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left"
          >
            <span className="text-sm text-gray-800">{selectedProvider?.name}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {isProviderOpen && (
            <>
              <div
                className="fixed inset-0 z-50"
                onClick={() => setIsProviderOpen(false)}
              />
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProviderChange(p.id)}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors ${
                      provider === p.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">API Base URL</label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com/v1"
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">API Key</label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="输入你的 API Key"
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-sm"
          />
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {showApiKey ? (
              <EyeOff className="w-4 h-4 text-gray-400" />
            ) : (
              <Eye className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">模型名称</label>
        <div className="relative">
          <button
            onClick={() => setIsModelOpen(!isModelOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left"
          >
            <span className="text-sm text-gray-800">{modelName}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {isModelOpen && (
            <>
              <div
                className="fixed inset-0 z-50"
                onClick={() => setIsModelOpen(false)}
              />
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                {modelNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      setModelName(name)
                      setIsModelOpen(false)
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors ${
                      modelName === name ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">最大输入 Token 数</label>
        <input
          type="number"
          value={maxInputTokens}
          onChange={(e) => setMaxInputTokens(Number(e.target.value))}
          placeholder="65536"
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-sm"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || !apiKey.trim() || !baseUrl.trim() || !maxInputTokens}
          className="px-4 py-2 text-sm text-white bg-black hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}
