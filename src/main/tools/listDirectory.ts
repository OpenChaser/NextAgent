import fs from 'fs'
import path from 'path'
import type { ToolDefinition } from './types'

export const listDirectoryTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_directory',
    description: '列出指定目录下的文件和子目录。',
    parameters: {
      type: 'object',
      properties: {
        dirPath: {
          type: 'string',
          description: '要列出的目录路径',
        },
      },
      required: ['dirPath'],
    },
  },
  executor: async (args) => {
    const dirPath = args.dirPath as string
    try {
      const resolved = path.resolve(dirPath)
      const entries = fs.readdirSync(resolved, { withFileTypes: true })
      const result = entries.map((entry) => {
        const type = entry.isDirectory() ? '[目录]' : '[文件]'
        const size = entry.isFile() ? ` (${fs.statSync(path.join(resolved, entry.name)).size} bytes)` : ''
        return `${type} ${entry.name}${size}`
      })
      if (result.length === 0) {
        return `目录 "${resolved}" 为空`
      }
      return result.join('\n')
    } catch (error) {
      return `错误：无法列出目录 "${dirPath}"：${error instanceof Error ? error.message : '未知错误'}`
    }
  },
}
