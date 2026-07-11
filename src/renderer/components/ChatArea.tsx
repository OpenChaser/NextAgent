import { useState } from 'react'
import { Send, Plus, Globe, Lock, ChevronDown } from 'lucide-react'

export function ChatArea() {
  const [message, setMessage] = useState('')

  const handleSend = () => {
    if (message.trim()) {
      console.log('Sending message:', message)
      setMessage('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto"></div>

      <div className="p-6">
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="今天帮你做些什么？@ 引用对话文件，/ 调用技能与指令"
            className="w-full bg-transparent resize-none outline-none text-gray-700 placeholder-gray-400 text-base min-h-[60px] max-h-[200px]"
            rows={3}
          />

          <div className="flex items-center justify-between mt-3">
            <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
              <Plus className="w-5 h-5 text-gray-500" />
            </button>

            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                <Globe className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-blue-600 font-medium">Hy3</span>
                <ChevronDown className="w-4 h-4 text-blue-500" />
              </button>

              <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                <Lock className="w-4 h-4 text-gray-500" />
              </button>

              <button
                onClick={handleSend}
                className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!message.trim()}
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
            <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              <Lock className="w-4 h-4" />
              <span>选择工作空间</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              <Lock className="w-4 h-4" />
              <span>默认权限</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
