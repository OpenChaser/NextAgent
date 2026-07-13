// 工具类型定义

export interface ToolFunction {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface ToolDefinition {
  type: 'function'
  function: ToolFunction
  executor: (args: Record<string, unknown>) => Promise<string>
}

// OpenAI SDK 所需的 tool 格式（不含 executor）
export interface ChatTool {
  type: 'function'
  function: ToolFunction
}
