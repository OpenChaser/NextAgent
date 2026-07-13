import fs from 'fs'
import path from 'path'
import type { ToolDefinition } from './types'

export const readFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: '读取指定文件的内容。返回文件的文本内容。',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '要读取的文件路径（绝对路径或相对路径）',
        },
      },
      required: ['filePath'],
    },
  },
  executor: async (args) => {
    const filePath = args.filePath as string
    try {
      const resolved = path.resolve(filePath)
      const content = fs.readFileSync(resolved, 'utf-8')
      // 限制返回内容长度，避免超出 token 限制
      const maxChars = 50000
      if (content.length > maxChars) {
        return content.substring(0, maxChars) + `\n\n... (文件已截断，共 ${content.length} 字符)`
      }
      return content
    } catch (error) {
      return `错误：无法读取文件 "${filePath}"：${error instanceof Error ? error.message : '未知错误'}`
    }
  },
}
