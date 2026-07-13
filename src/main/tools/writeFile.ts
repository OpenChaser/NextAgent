import fs from 'fs'
import path from 'path'
import type { ToolDefinition } from './types'

export const writeFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'write_file',
    description: '写入内容到指定文件。如果文件不存在则创建，如果存在则覆盖。',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '要写入的文件路径',
        },
        content: {
          type: 'string',
          description: '要写入的文件内容',
        },
      },
      required: ['filePath', 'content'],
    },
  },
  executor: async (args) => {
    const filePath = args.filePath as string
    const content = args.content as string
    try {
      const resolved = path.resolve(filePath)
      const dir = path.dirname(resolved)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(resolved, content, 'utf-8')
      return `成功：已写入文件 "${resolved}"（${content.length} 字符）`
    } catch (error) {
      return `错误：无法写入文件 "${filePath}"：${error instanceof Error ? error.message : '未知错误'}`
    }
  },
}
