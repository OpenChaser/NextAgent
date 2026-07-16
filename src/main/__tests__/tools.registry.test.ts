import { describe, it, expect } from 'vitest'
import { allTools, getToolDefinitions } from '../tools/index'
import { delegateAgentTool } from '../tools/delegateAgent'

describe('工具注册表', () => {
  it('allTools 包含 delegateAgentTool', () => {
    expect(allTools).toContainEqual(delegateAgentTool)
  })

  it('getToolDefinitions 输出包含 delegate_to_agent（供 LLM 可见）', () => {
    const defs = getToolDefinitions()
    const found = defs.find((d) => d.function.name === 'delegate_to_agent')
    expect(found).toBeDefined()
    expect(found!.function.parameters.required).toContain('targetAgentId')
    expect(found!.function.parameters.required).toContain('task')
  })

  it('getToolDefinitions 输出不含 executor（与 OpenAI tool 格式一致）', () => {
    const defs = getToolDefinitions()
    for (const d of defs) {
      expect(d).not.toHaveProperty('executor')
    }
  })
})
