import type OpenAI from 'openai'
import type { WebContents } from 'electron'
import type { ChatTool } from './tools/types'
import type { McpManager } from './mcp/mcpManager'
import type { MemoryEntry } from './memory/memoryManager'

// Agent 配置类型（与 main.ts / preload.ts / electron.d.ts 中定义保持一致）
interface AgentConfig {
  id: string
  name: string
  description: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  toolsEnabled: boolean
  builtin: boolean
  createdAt: number
  updatedAt: number
}

// 群聊共享短记忆条目
export interface GroupTurn {
  kind: 'user' | 'agent' | 'delegation'
  speakerAgentId?: string
  speakerName: string
  content: string
  toAgentId?: string
  toAgentName?: string
}

// 群聊模式运行参数
export interface GroupChatParams {
  message: string
  agentIds: string[]
  mentionAgentId?: string
}

// 群聊模式运行依赖（由 main.ts 在解析完 provider/client/tools 后注入）
export interface GroupChatDeps {
  win: WebContents
  client: OpenAI
  mcpManager: McpManager
  tools: ChatTool[]
  agents: AgentConfig[]
  effectiveModel: string
  modelConfig?: { max_input_tokens?: number }
  signal: AbortSignal
  recallMemories: (agentId: string, query: string, topK?: number) => MemoryEntry[]
  formatMemoriesForInjection: (entries: MemoryEntry[]) => string
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>
}

const MAX_ROUNDS_PER_AGENT = 10
const MAX_GROUP_TURNS = 12
const MAX_TOKENS_LIMIT = 393216

// 模块级共享群聊上下文（仅内存，刷新即清）
let groupTranscript: GroupTurn[] = []

export function resetGroupSession(): void {
  groupTranscript = []
}

function buildRoster(agents: AgentConfig[], selfAgent: AgentConfig): string {
  const lines = agents.map(
    (a) => `- ${a.name} (id: ${a.id}) — ${a.description}`
  )
  return (
    '你正在一个多智能体群聊中协作。群成员如下：\n' +
    lines.join('\n') +
    `\n\n你自己的身份：${selfAgent.name} (id: ${selfAgent.id}) — ${selfAgent.description}\n\n` +
    '协作规则：\n' +
    '- 你能看到群里所有成员的发言（带 [发言者] 标签）。\n' +
    '- 当你需要让其他成员接手工作时，调用 delegate_to_agent 工具（不要在文本里写纯 @ 字符）。\n' +
    '- 被委派的成员会在你结束发言后接续处理该任务。\n' +
    '- 只委派给群内已存在的成员，且只在确实需要他人协作时委派。\n'
  )
}

// 将共享 transcript 渲染为带发言者标签的消息序列（统一用 user 角色，多成员对话更稳定）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderTranscript(transcript: GroupTurn[]): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = []
  for (const t of transcript) {
    if (t.kind === 'user') {
      out.push({ role: 'user', content: `[用户]: ${t.content}` })
    } else if (t.kind === 'agent') {
      out.push({ role: 'user', content: `[${t.speakerName}]: ${t.content}` })
    } else {
      out.push({
        role: 'user',
        content: `[@${t.toAgentName}（委派自 ${t.speakerName}）]: ${t.content}`,
      })
    }
  }
  return out
}

// 构建某 Agent 当次的 LLM messages
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMessagesForAgent(
  agent: AgentConfig,
  roster: string,
  recalled: MemoryEntry[],
  formatMemories: (e: MemoryEntry[]) => string
): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = []
  messages.push({ role: 'system', content: roster })
  if (agent.systemPrompt) {
    messages.push({ role: 'system', content: agent.systemPrompt })
  }
  if (recalled.length > 0) {
    messages.push({ role: 'system', content: formatMemories(recalled) })
  }
  messages.push(...renderTranscript(groupTranscript))
  return messages
}

function effectiveToolsFor(agent: AgentConfig, tools: ChatTool[]): ChatTool[] {
  return agent.toolsEnabled === false ? [] : tools
}

export async function runGroupChat(params: GroupChatParams, deps: GroupChatDeps): Promise<void> {
  const { win, client, mcpManager, tools, agents, effectiveModel, modelConfig, signal } = deps
  const { message, agentIds, mentionAgentId } = params

  const members = agents.filter((a) => agentIds.includes(a.id))
  if (members.length < 2) {
    win.send('chat:error', { message: '群聊至少需要 2 个智能体' })
    return
  }

  // 把用户消息写入共享 transcript
  groupTranscript.push({ kind: 'user', speakerName: '用户', content: message })

  let totalPromptTokens = 0
  let totalCompletionTokens = 0
  let totalTokens = 0

  // 任务队列：初始发言者为用户 @ 的成员或列表首位
  const initialAgentId = mentionAgentId && agentIds.includes(mentionAgentId) ? mentionAgentId : agentIds[0]
  const queue: { agentId: string; task: string }[] = [{ agentId: initialAgentId, task: message }]

  let turns = 0
  while (queue.length > 0 && turns < MAX_GROUP_TURNS && !signal.aborted) {
    const job = queue.shift()!
    turns++
    const agent = members.find((a) => a.id === job.agentId)
    if (!agent) {
      console.warn(`[GroupChat] agent ${job.agentId} not found, skip`)
      continue
    }

    win.send('chat:speaker', { agentId: agent.id, agentName: agent.name })

    // 首轮任务（用户消息）已写入 transcript；后续委派任务在委派时已 push delegation 记录，
    // 该 agent 通过 transcript 即可看到自己被委派的内容，无需额外注入。

    const roster = buildRoster(members, agent)
    const recalled = deps.recallMemories(agent.id, job.task)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = buildMessagesForAgent(agent, roster, recalled, deps.formatMemoriesForInjection)
    const effTools = effectiveToolsFor(agent, tools)

    const effectiveMaxTokens =
      Number.isFinite(agent.maxTokens) && agent.maxTokens > 0
        ? Math.min(Math.floor(agent.maxTokens), MAX_TOKENS_LIMIT)
        : undefined

    let agentResponseText = ''

    for (let round = 0; round < MAX_ROUNDS_PER_AGENT; round++) {
      if (signal.aborted) break

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = await client.chat.completions.create({
        model: effectiveModel,
        messages,
        tools: effTools,
        stream: true,
        stream_options: { include_usage: true },
        ...(agent.temperature !== undefined ? { temperature: agent.temperature } : {}),
        ...(effectiveMaxTokens !== undefined ? { max_tokens: effectiveMaxTokens } : {}),
      }, { signal })

      let contentBuffer = ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolCallsBuffer = new Map<number, { id: string; name: string; arguments: string }>()

      for await (const chunk of stream) {
        if (signal.aborted) break
        const delta = chunk.choices[0]?.delta
        if (delta?.content) {
          contentBuffer += delta.content
          win.send('chat:chunk', { content: delta.content, agentId: agent.id, agentName: agent.name })
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index
            if (!toolCallsBuffer.has(idx)) {
              toolCallsBuffer.set(idx, { id: tc.id || '', name: '', arguments: '' })
            }
            const buf = toolCallsBuffer.get(idx)!
            if (tc.function?.name) buf.name = tc.function.name
            if (tc.function?.arguments) buf.arguments += tc.function.arguments
          }
        }
        if (chunk.usage) {
          totalPromptTokens += chunk.usage.prompt_tokens
          totalCompletionTokens += chunk.usage.completion_tokens
          totalTokens += chunk.usage.total_tokens
        }
      }

      if (toolCallsBuffer.size > 0) {
        const toolCalls = Array.from(toolCallsBuffer.values())
        messages.push({
          role: 'assistant',
          content: contentBuffer,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        })
        agentResponseText += contentBuffer

        for (const tc of toolCalls) {
          if (signal.aborted) break
          let toolArgs: Record<string, unknown> = {}
          try {
            toolArgs = JSON.parse(tc.arguments)
          } catch {
            toolArgs = {}
          }

          // 委派工具：编排器拦截，不入 executeTool
          if (tc.name === 'delegate_to_agent') {
            const targetId = String(toolArgs.targetAgentId || '')
            const task = String(toolArgs.task || '')
            const target = members.find((a) => a.id === targetId)
            if (!target) {
              const result = `错误：群聊中不存在 id 为 "${targetId}" 的成员。可用成员：${members.map((m) => `${m.name}(${m.id})`).join('、 ')}`
              win.send('chat:tool_call', { name: tc.name, arguments: tc.arguments, result, agentId: agent.id })
              messages.push({ role: 'tool', content: result, tool_call_id: tc.id })
              continue
            }
            // 记录 delegation 到共享 transcript
            groupTranscript.push({
              kind: 'delegation',
              speakerAgentId: agent.id,
              speakerName: agent.name,
              content: task,
              toAgentId: target.id,
              toAgentName: target.name,
            })
            // 通知前端渲染 @ 气泡
            win.send('chat:mention', {
              fromAgentId: agent.id,
              fromAgentName: agent.name,
              toAgentId: target.id,
              toAgentName: target.name,
              task,
            })
            // 入队，等当前 agent 结束后接续
            queue.push({ agentId: target.id, task })
            const result = `已将任务委派给 ${target.name}（${target.id}）：${task}。该成员将在你结束发言后接续处理。`
            win.send('chat:tool_call', { name: tc.name, arguments: tc.arguments, result, agentId: agent.id })
            messages.push({ role: 'tool', content: result, tool_call_id: tc.id })
            continue
          }

          console.log(`[GroupChat][${agent.name}] Executing ${tc.name} with args:`, toolArgs)
          const result = mcpManager.isMcpTool(tc.name)
            ? await mcpManager.callTool(tc.name, toolArgs)
            : await deps.executeTool(tc.name, toolArgs)
          win.send('chat:tool_call', { name: tc.name, arguments: tc.arguments, result, agentId: agent.id })
          messages.push({ role: 'tool', content: result, tool_call_id: tc.id })
        }

        if (signal.aborted) break
        continue
      }

      // 无 tool_calls，该 agent 发言结束
      agentResponseText += contentBuffer
      messages.push({ role: 'assistant', content: contentBuffer })
      break
    }

    // 记录该 agent 的发言到共享 transcript
    if (agentResponseText.trim()) {
      groupTranscript.push({
        kind: 'agent',
        speakerAgentId: agent.id,
        speakerName: agent.name,
        content: agentResponseText,
      })
    }
  }

  if (signal.aborted) {
    console.log('[GroupChat] stopped by user')
  } else if (turns >= MAX_GROUP_TURNS) {
    console.log(`[GroupChat] reached max turns (${MAX_GROUP_TURNS})`)
  }

  win.send('chat:done', {
    usage: {
      prompt_tokens: totalPromptTokens,
      completion_tokens: totalCompletionTokens,
      total_tokens: totalTokens,
    },
    max_input_tokens: modelConfig?.max_input_tokens,
  })
}
