import type { ToolDefinition, ChatTool } from './types'
import { readFileTool } from './readFile'
import { writeFileTool } from './writeFile'
import { editFileTool } from './editFile'
import { listDirectoryTool } from './listDirectory'
import { searchFilesTool } from './searchFiles'
import { searchContentTool } from './searchContent'
import { runCommandTool } from './runCommand'
import { gitStatusTool } from './gitStatus'
import { saveMemoryTool, recallMemoryTool, listMemoryTool, deleteMemoryTool } from './memory'

// 所有工具定义
export const allTools: ToolDefinition[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirectoryTool,
  searchFilesTool,
  searchContentTool,
  runCommandTool,
  gitStatusTool,
  saveMemoryTool,
  recallMemoryTool,
  listMemoryTool,
  deleteMemoryTool,
]

// 工具执行器映射
const toolExecutorMap = new Map<string, ToolDefinition['executor']>()
for (const tool of allTools) {
  toolExecutorMap.set(tool.function.name, tool.executor)
}

// 获取 OpenAI SDK 所需的 tool 格式（不含 executor）
export function getToolDefinitions(): ChatTool[] {
  return allTools.map((t) => ({
    type: t.type,
    function: t.function,
  }))
}

// 执行工具
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const executor = toolExecutorMap.get(name)
  if (!executor) {
    return `错误：未找到工具 "${name}"`
  }
  try {
    return await executor(args)
  } catch (error) {
    return `错误：执行工具 "${name}" 失败：${error instanceof Error ? error.message : '未知错误'}`
  }
}
