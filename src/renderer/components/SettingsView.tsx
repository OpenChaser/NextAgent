import { useState } from 'react'
import { ChevronLeft, Server, Settings, Bot, Sliders, Bell, Shield, Sparkles } from 'lucide-react'
import { AgentConfigView } from './AgentConfigView'
import { McpSettings } from './McpSettings'
import { SkillView } from './SkillView'

interface SettingsViewProps {
  onBack?: () => void
}

interface SettingsSection {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const sections: SettingsSection[] = [
  { id: 'general', label: '通用设置', icon: Sliders, description: '应用基础偏好' },
  { id: 'agent', label: '智能体配置', icon: Bot, description: '新建与管理智能体' },
  { id: 'skill', label: '技能管理', icon: Sparkles, description: '管理 AI 技能（SKILL.md）' },
  { id: 'mcp', label: 'MCP', icon: Server, description: '管理 MCP 服务器' },
  { id: 'notification', label: '通知', icon: Bell, description: '消息提醒偏好' },
  { id: 'permission', label: '权限与安全', icon: Shield, description: '工具权限与数据安全' },
]

export function SettingsView({ onBack }: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState('agent')

  return (
    <div className="flex-1 h-full overflow-hidden bg-gray-50">
      <div className="h-full max-w-5xl mx-auto flex flex-col">
        <div className="px-8 pt-8 pb-4">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-3"
            >
              <ChevronLeft className="w-4 h-4" />
              返回
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">设置</h1>
              <p className="text-sm text-gray-500">管理应用与智能体偏好</p>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex gap-6 px-8 pb-8">
          <nav className="w-56 shrink-0">
            <ul className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon
                const isActive = activeSection === section.id
                return (
                  <li key={section.id}>
                    <button
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                        isActive
                          ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                          : 'text-gray-600 hover:bg-white/60'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-500' : 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{section.label}</div>
                        <div className="text-xs text-gray-400 font-normal truncate">{section.description}</div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
            {activeSection === 'agent' ? (
              <AgentConfigView />
            ) : activeSection === 'mcp' ? (
              <McpSettings />
            ) : activeSection === 'skill' ? (
              <SkillView />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <Sliders className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">该设置项尚未提供，敬请期待</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}