import fs from 'fs'
import path from 'path'
import type { ToolDefinition } from './types'

export const editFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'edit_file',
    description: '通过搜索替换方式编辑文件。在文件中查找 oldText 并替换为 newText。只替换第一个匹配项。',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '要编辑的文件路径',
        },
        oldText: {
          type: 'string',
          description: '要查找的文本（必须完全匹配）',
        },
        newText: {
          type: 'string',
          description: '替换的新文本',
        },
      },
      required: ['filePath', 'oldText', 'newText'],
    },
  },
  executor: async (args) => {
    const filePath = args.filePath as string
    const oldText = args.oldText as string
    const newText = args.newText as string
    try {
      const resolved = path.resolve(filePath)
      const content = fs.readFileSync(resolved, 'utf-8')
      const index = content.indexOf(oldText)
      if (index === -1) {
        return `错误：在文件 "${resolved}" 中未找到要替换的文本`
      }
      const newContent = content.substring(0, index) + newText + content.substring(index + oldText.length)
      fs.writeFileSync(resolved, newContent, 'utf-8')
      return `成功：已在文件 "${resolved}" 中完成替换`
    } catch (error) {
      return `错误：无法编辑文件 "${filePath}"：${error instanceof Error ? error.message : '未知错误'}`
    }
  },
}
