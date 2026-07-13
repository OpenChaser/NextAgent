import { execSync } from 'child_process'
import path from 'path'
import type { ToolDefinition } from './types'

export const searchContentTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_content',
    description: '在文件内容中搜索指定文本（grep 功能）。返回匹配的文件和行内容。',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: '要搜索的文本或正则表达式',
        },
        dirPath: {
          type: 'string',
          description: '搜索的根目录路径',
        },
        filePattern: {
          type: 'string',
          description: '文件名过滤模式（如 "*.ts"，可选）',
        },
      },
      required: ['pattern', 'dirPath'],
    },
  },
  executor: async (args) => {
    const pattern = args.pattern as string
    const dirPath = args.dirPath as string
    const filePattern = (args.filePattern as string) || '*'
    try {
      const resolved = path.resolve(dirPath)
      const isWindows = process.platform === 'win32'
      let command: string
      if (isWindows) {
        command = `powershell -Command "Get-ChildItem -Path '${resolved}' -Filter '${filePattern}' -Recurse -File -ErrorAction SilentlyContinue | Select-String -Pattern '${pattern}' -ErrorAction SilentlyContinue | ForEach-Object { $_.Path + ':' + $_.LineNumber + ': ' + $_.Line }"`
      } else {
        command = `grep -rn --include="${filePattern}" "${pattern}" "${resolved}"`
      }
      const output = execSync(command, { encoding: 'utf-8', maxBuffer: 1024 * 1024, timeout: 10000 })
      const lines = output.trim().split('\n').filter(Boolean)
      if (lines.length === 0) {
        return `在目录 "${resolved}" 中未找到匹配 "${pattern}" 的内容`
      }
      const maxResults = 50
      const result = lines.slice(0, maxResults)
      if (lines.length > maxResults) {
        result.push(`... (共 ${lines.length} 个匹配，仅显示前 ${maxResults} 个)`)
      }
      return result.join('\n')
    } catch (error) {
      // grep 在没有匹配时返回非零退出码，这不是错误
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('no matches') || msg.includes('not found')) {
        return `在目录 "${dirPath}" 中未找到匹配 "${pattern}" 的内容`
      }
      return `错误：搜索内容失败：${msg}`
    }
  },
}
