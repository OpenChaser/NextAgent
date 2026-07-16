import type { ToolDefinition } from './types'

// 群聊委派工具：仅声明给 LLM 可见；真正语义在群聊编排器（groupChat.ts）拦截实现。
// 单 Agent 模式下若被误调用，executor 返回提示，不产生副作用。
export const delegateAgentTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'delegate_to_agent',
    description:
      '在多智能体群聊中 @（提及）另一位智能体并委派任务。被 @ 的智能体会收到你的任务说明并接续工作。仅在群聊模式（已选中多个智能体）下有效。',
    parameters: {
      type: 'object',
      properties: {
        targetAgentId: {
          type: 'string',
          description: '目标智能体的 ID（必须是当前群聊中已选中的成员之一）',
        },
        task: {
          type: 'string',
          description: '委派给该智能体的具体任务说明，需清晰、可执行',
        },
      },
      required: ['targetAgentId', 'task'],
    },
  },
  executor: async () => {
    return '当前为单智能体模式，群聊中无其他成员可委派。如需多智能体协作，请在选择器中选中 2 个及以上智能体。'
  },
}
