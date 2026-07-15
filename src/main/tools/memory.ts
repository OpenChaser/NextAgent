import type { ToolDefinition } from './types'
import {
  saveMemory,
  recallMemories,
  loadMemories,
  deleteMemory,
  getCurrentAgent,
  formatMemoriesForInjection,
} from '../memory/memoryManager'

export const saveMemoryTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'save_memory',
    description:
      '将一条事实或信息保存到当前 agent 的长期记忆库，以便后续跨会话召回。用于记录需要长期记住的关键信息。',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '要记忆的内容' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '可选的检索标签',
        },
      },
      required: ['content'],
    },
  },
  executor: async (args) => {
    const agentId = getCurrentAgent()
    if (!agentId) return '错误：当前没有活动的 agent，无法保存记忆'
    const content = (args.content as string) || ''
    if (!content.trim()) return '错误：记忆内容不能为空'
    const tags = args.tags as string[] | undefined
    const entry = saveMemory(agentId, content.trim(), 'fact', tags)
    return `已保存记忆（id: ${entry.id}）：${content.trim().slice(0, 80)}`
  },
}

export const recallMemoryTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'recall_memory',
    description:
      '根据查询关键词从当前 agent 的长期记忆库中检索相关记忆。在需要回忆此前记录的信息时调用。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索查询关键词' },
        limit: { type: 'number', description: '返回条数上限，默认 5' },
      },
      required: ['query'],
    },
  },
  executor: async (args) => {
    const agentId = getCurrentAgent()
    if (!agentId) return '错误：当前没有活动的 agent，无法检索记忆'
    const query = (args.query as string) || ''
    const limit = (args.limit as number | undefined) || 5
    const results = recallMemories(agentId, query, limit)
    if (results.length === 0) return '无匹配的长期记忆'
    return formatMemoriesForInjection(results)
  },
}

export const listMemoryTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_memory',
    description: '列出当前 agent 的全部长期记忆（最近优先）。',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '返回条数上限，默认 20' },
      },
    },
  },
  executor: async (args) => {
    const agentId = getCurrentAgent()
    if (!agentId) return '错误：当前没有活动的 agent'
    const limit = (args.limit as number | undefined) || 20
    const all = loadMemories(agentId)
    const sorted = all.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
    if (sorted.length === 0) return '当前 agent 暂无长期记忆'
    return formatMemoriesForInjection(sorted)
  },
}

export const deleteMemoryTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'delete_memory',
    description: '按 id 删除当前 agent 的一条长期记忆。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '要删除的记忆 id' },
      },
      required: ['id'],
    },
  },
  executor: async (args) => {
    const id = (args.id as string) || ''
    const ok = deleteMemory(id)
    return ok ? `已删除记忆：${id}` : `错误：未找到记忆 ${id}`
  },
}
