import { execSync } from 'child_process'
import type { ToolDefinition } from './types'

export const gitStatusTool: ToolDefinition = {
  type: 'function',
    function: {
    name: 'git_status',
    description: '查看当前 Git 仓库状态，包括当前分支、暂存区状态和未提交的更改。',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  executor: async () => {
    try {
      const branch = execSync('git branch --show-current', { encoding: 'utf-8', timeout: 5000 }).trim()
      const status = execSync('git status --short', { encoding: 'utf-8', timeout: 5000 }).trim()
      const diff = execSync('git diff --stat', { encoding: 'utf-8', timeout: 5000 }).trim()

      let result = `当前分支: ${branch}\n`
      if (status) {
        result += `\n文件状态:\n${status}\n`
      } else {
        result += '\n工作区干净，无未提交的更改\n'
      }
      if (diff) {
        result += `\n变更统计:\n${diff}\n`
      }
      return result
    } catch (error) {
      return `错误：获取 Git 状态失败：${error instanceof Error ? error.message : '未知错误'}`
    }
  },
}
