import { useState, useEffect, useCallback } from 'react'
import { Sparkles, FileText, ChevronDown, ChevronRight, Tag } from 'lucide-react'

interface Skill {
  name: string
  description: string
  content: string
  license?: string
  allowedTools?: string[]
  enabled?: boolean
  id: string
  source: 'global' | 'project'
  createdAt: number
  dir: string
}

export function SkillView() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await window.electronAPI.getGlobalSkills()
      setSkills(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载技能失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const toggleEnabled = async (skill: Skill) => {
    setTogglingId(skill.id)
    try {
      const ok = await window.electronAPI.saveSkill(
        {
          name: skill.name,
          description: skill.description,
          content: skill.content,
          license: skill.license,
          allowedTools: skill.allowedTools,
          enabled: !skill.enabled,
        },
        'global'
      )
      if (ok) {
        setSkills((prev) =>
          prev.map((s) => (s.id === skill.id ? { ...s, enabled: !s.enabled } : s))
        )
      } else {
        setError('更新技能状态失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新技能状态失败')
    } finally {
      setTogglingId(null)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">技能管理</h1>
              <p className="text-sm text-gray-500">
                查看 ~/.nextagent/skills 下的全局技能（SKILL.md），并控制启用状态
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-600 flex items-start justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        <div>
          <h2 className="text-base font-medium text-gray-800 mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-500" />
            全局技能 ({skills.length})
          </h2>
          {isLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 flex justify-center">
              <div className="flex gap-1">
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          ) : skills.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">~/.nextagent/skills 目录下暂无技能</p>
              <p className="text-xs text-gray-400 mt-1">
                将技能文件夹（含 SKILL.md）放入该目录后即可在此查看
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {skills.map((skill) => {
                const isExpanded = expandedId === skill.id
                const isEnabled = skill.enabled !== false
                const isToggling = togglingId === skill.id
                return (
                  <div
                    key={skill.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <button
                          onClick={() => toggleExpand(skill.id)}
                          className="p-1 hover:bg-gray-100 rounded-lg transition-colors shrink-0 mt-0.5"
                          title={isExpanded ? '收起' : '展开详情'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <Sparkles
                          className={`w-4 h-4 shrink-0 mt-1 ${
                            isEnabled ? 'text-indigo-500' : 'text-gray-300'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-medium text-gray-800">{skill.name}</h3>
                            {skill.license && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                                {skill.license}
                              </span>
                            )}
                            {skill.allowedTools && skill.allowedTools.length > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 shrink-0">
                                {skill.allowedTools.length} 工具
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                            {skill.description}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleEnabled(skill)}
                        disabled={isToggling}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 mt-1 ${
                          isEnabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                        title={isEnabled ? '点击停用' : '点击启用'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            isEnabled ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="pl-9 mt-3">
                        <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          技能指令（SKILL.md 正文）
                        </p>
                        <pre className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap break-words border border-gray-100 max-h-96 overflow-y-auto">
                          {skill.content}
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
