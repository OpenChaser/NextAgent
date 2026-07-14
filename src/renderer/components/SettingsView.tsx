import { useState } from 'react'
import { ChevronLeft, Server } from 'lucide-react'
import { McpSettings } from './McpSettings'

interface SettingsViewProps {
  onBack: () => void
}

interface SettingsSection {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const sections: SettingsSection[] = [
  { id: 'mcp', label: 'MCP', icon: Server },
]

export function SettingsView({ onBack }: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState('mcp')

  return (
    <div className="flex-1 h-full flex bg-white">
      <aside className="w-60 h-full bg-sidebar-bg border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-3"
          >
            <ChevronLeft className="w-4 h-4" />
            返回
          </button>
          <h1 className="text-lg font-semibold text-gray-800">设置</h1>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <li key={section.id}>
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sidebar-active text-gray-900'
                        : 'text-gray-600 hover:bg-sidebar-hover'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-500' : ''}`} />
                    <span className="flex-1 text-left">{section.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        {activeSection === 'mcp' && <McpSettings />}
      </div>
    </div>
  )
}
