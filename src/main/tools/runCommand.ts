import { execSync } from 'child_process'
import path from 'path'
import type { ToolDefinition } from './types'

export const runCommandTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'run_command',
    description: '执行终端命令并返回输出。用于运行构建、测试、git 等命令。',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '要执行的命令',
        },
        cwd: {
          type: 'string',
          description: '命令执行的工作目录（可选，默认为项目根目录）',
        },
      },
      required: ['command'],
    },
  },
  executor: async (args) => {
    const command = args.command as string
    const cwd = (args.cwd as string) || process.cwd()
    try {
      const resolved = path.resolve(cwd)
      const output = execSync(command, {
        encoding: 'utf-8',
        cwd: resolved,
        maxBuffer: 1024 * 1024,
        timeout: 30000,
      })
      const result = output.trim()
      if (result.length === 0) {
        return `命令执行成功（无输出）`
      }
      // 限制输出长度
      const maxChars = 20000
      if (result.length > maxChars) {
        return result.substring(0, maxChars) + `\n\n... (输出已截断，共 ${result.length} 字符)`
      }
      return result
    } catch (error) {
      if (error instanceof Error && 'stderr' in error) {
        const stderr = (error as { stderr?: string }).stderr || ''
        return `命令执行失败（退出码 ${(error as { status?: number }).status}）：\n${stderr || error.message}`
      }
      return `命令执行失败：${error instanceof Error ? error.message : '未知错误'}`
    }
  },
}
