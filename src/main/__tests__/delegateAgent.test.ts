import { describe, it, expect } from 'vitest'
import { delegateAgentTool } from '../tools/delegateAgent'

describe('delegateAgentTool', () => {
  it('声明为 function 类型的工具', () => {
    expect(delegateAgentTool.type).toBe('function')
    expect(delegateAgentTool.function).toBeDefined()
  })

  it('工具名称为 delegate_to_agent', () => {
    expect(delegateAgentTool.function.name).toBe('delegate_to_agent')
  })

  it('描述包含群聊与委派语义', () => {
    expect(delegateAgentTool.function.description).toContain('群聊')
    expect(delegateAgentTool.function.description).toContain('委派')
  })

  it('参数 schema 为 object 且要求 targetAgentId 与 task', () => {
    const params = delegateAgentTool.function.parameters
    expect(params.type).toBe('object')
    expect(params.properties).toHaveProperty('targetAgentId')
    expect(params.properties).toHaveProperty('task')
    expect(params.required).toContain('targetAgentId')
    expect(params.required).toContain('task')
  })

  it('targetAgentId 参数类型为 string', () => {
    const props = delegateAgentTool.function.parameters.properties as Record<string, { type: string }>
    expect(props.targetAgentId.type).toBe('string')
    expect(props.task.type).toBe('string')
  })

  it('executor 返回单智能体模式提示，不抛出异常', async () => {
    const result = await delegateAgentTool.executor({})
    expect(typeof result).toBe('string')
    expect(result).toContain('单智能体模式')
  })

  it('executor 在传入参数时仍返回固定提示（单 Agent 模式下不产生副作用）', async () => {
    const result = await delegateAgentTool.executor({
      targetAgentId: 'any-id',
      task: 'any-task',
    })
    expect(result).toContain('单智能体模式')
  })
})
