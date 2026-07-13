import { execSync } from 'child_process'
import path from 'path'
import type { ToolDefinition } from './types'

export const searchFilesTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_files',
    description: '按文件名模式搜索文件（支持 glob 通配符，如 *.ts, *.json）。',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: '文件名匹配模式（如 "*.ts", "*.{js,ts}", "test*"）',
        },
        dirPath: {
          type: 'string',
          description: '搜索的根目录路径',
        },
      },
      required: ['pattern', 'dirPath'],
    },
  },
  executor: async (args) => {
    const pattern = args.pattern as string
    const dirPath = args.dirPath as string
    try {
      const resolved = path.resolve(dirPath)
      // Windows 使用 dir 命令搜索文件，Linux/Mac 使用 find
      const isWindows = process.platform === 'win32'
      let command: string
      if (isWindows) {
        command = `powershell -Command "Get-ChildItem -Path '${resolved}' -Filter '${pattern}' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName"`
      } else {
        command = `find "${resolved}" -type f -name "${pattern}"`
      }
      const output = execSync(command, { encoding: 'utf-8', maxBuffer: 1024 * 1024, timeout: 10000 })
      const files = output.trim().split('\n').filter(Boolean)
      if (files.length === 0) {
        return `在目录 "${resolved}" 中未找到匹配 "${pattern}" 的文件`
      }
      const maxResults = 100
      const result = files.slice(0, maxResults)
      if (files.length > maxResults) {
        result.push(`... (共 ${files.length} 个结果，仅显示前 ${maxResults} 个)`)
      }
      return result.join('\n')
    } catch (error) {
      return `错误：搜索文件失败：${error instanceof Error ? error.message : '未知错误'}`
    }
  },
}
