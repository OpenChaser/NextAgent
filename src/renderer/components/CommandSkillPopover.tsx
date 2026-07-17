import { useState, useMemo } from 'react'
import { Search, Sparkles } from 'lucide-react'

interface SkillItem {
  id: string
  name: string
  description: string
  content: string
  source: 'global' | 'project'
  enabled?: boolean
}

interface CommandSkillPopoverProps {
  skills: SkillItem[]
  selectedSkillIds: string[]
  onPickSkill: (skill: SkillItem) => void
}

export function CommandSkillPopover({ skills, selectedSkillIds, onPickSkill }: CommandSkillPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSkills = useMemo(() => {
    const enabledSkills = skills.filter((s) => s.enabled !== false)
    const q = searchQuery.trim().toLowerCase()
    const list = q
      ? enabledSkills.filter(
          (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
        )
      : enabledSkills
    return list
  }, [skills, searchQuery])

  return (
    <div className="p-2">
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索技能命令"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="px-1 pt-1 pb-1.5 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">技能</span>
      </div>

      <div className="border-t border-gray-100" />

      <div className="max-h-[220px] overflow-y-auto mt-1">
        {filteredSkills.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
            <span>未找到技能命令</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredSkills.map((skill) => {
              const isSelected = selectedSkillIds.includes(skill.id)
              return (
                <button
                  key={skill.id}
                  onClick={() => onPickSkill(skill)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">/{skill.name}</p>
                    <p className="text-xs text-gray-400 truncate">{skill.description}</p>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] text-indigo-500 flex-shrink-0">已选</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
