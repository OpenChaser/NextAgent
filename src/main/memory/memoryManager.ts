import fs from 'fs'
import path from 'path'
import os from 'os'
import type OpenAI from 'openai'

export interface MemoryEntry {
  id: string
  agentId: string
  content: string
  type: 'fact' | 'summary'
  tags?: string[]
  createdAt: number
}

export const COMPRESSION_THRESHOLD_RATIO = 0.7
export const KEEP_RECENT_TURNS = 6
export const RECALL_TOP_K = 5
export const MAX_INPUT_TOKENS_FALLBACK = 32768

interface SessionContext {
  agentId: string | null
  systemPrompt: string
  summary: string | null
  recentTurns: any[]
  lastPromptTokens: number
  needsCompression: boolean
}

let currentAgentId: string | null = null
let sessionContext: SessionContext = {
  agentId: null,
  systemPrompt: '',
  summary: null,
  recentTurns: [],
  lastPromptTokens: 0,
  needsCompression: false,
}

function getMemoryFilePath(): string {
  return path.join(os.homedir(), '.nextagent', 'memory.json')
}

function ensureMemoryFile(): void {
  const filePath = getMemoryFilePath()
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to initialize memory file:', error)
    }
  }
}

function readAllMemories(): MemoryEntry[] {
  ensureMemoryFile()
  try {
    const content = fs.readFileSync(getMemoryFilePath(), 'utf-8')
    const arr = JSON.parse(content) as MemoryEntry[]
    return Array.isArray(arr) ? arr : []
  } catch (error) {
    console.error('Failed to read memory file:', error)
    return []
  }
}

function writeAllMemories(entries: MemoryEntry[]): void {
  ensureMemoryFile()
  try {
    fs.writeFileSync(getMemoryFilePath(), JSON.stringify(entries, null, 2), 'utf-8')
  } catch (error) {
    console.error('Failed to write memory file:', error)
  }
}

export function getAllMemories(): MemoryEntry[] {
  return readAllMemories()
}

export function loadMemories(agentId: string): MemoryEntry[] {
  return readAllMemories().filter((m) => m.agentId === agentId)
}

export function saveMemory(
  agentId: string,
  content: string,
  type: 'fact' | 'summary',
  tags?: string[]
): MemoryEntry {
  const entry: MemoryEntry = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agentId,
    content,
    type,
    tags,
    createdAt: Date.now(),
  }
  const all = readAllMemories()
  all.push(entry)
  writeAllMemories(all)
  return entry
}

export function deleteMemory(id: string): boolean {
  const all = readAllMemories()
  const filtered = all.filter((m) => m.id !== id)
  if (filtered.length === all.length) return false
  writeAllMemories(filtered)
  return true
}

function extractTerms(text: string): string[] {
  const terms = new Set<string>()
  const asciiWords = text.match(/[A-Za-z0-9_]{2,}/g) || []
  asciiWords.forEach((w) => terms.add(w.toLowerCase()))
  const cjkRuns = text.match(/[\u4e00-\u9fff]{2,}/g) || []
  for (const run of cjkRuns) {
    for (let i = 0; i < run.length - 1; i++) {
      terms.add(run.slice(i, i + 2))
    }
  }
  return Array.from(terms)
}

export function recallMemories(
  agentId: string,
  query: string,
  topK = RECALL_TOP_K
): MemoryEntry[] {
  const memories = loadMemories(agentId)
  if (memories.length === 0) return []
  const terms = extractTerms(query)
  if (terms.length === 0) return []
  const scored = memories
    .map((m) => {
      const contentLower = m.content.toLowerCase()
      let score = 0
      for (const t of terms) {
        if (contentLower.includes(t.toLowerCase())) score++
      }
      return { m, score }
    })
    .filter((x) => x.score > 0)
  scored.sort((a, b) => b.score - a.score || b.m.createdAt - a.m.createdAt)
  return scored.slice(0, topK).map((x) => x.m)
}

export function formatMemoriesForInjection(entries: MemoryEntry[]): string {
  const lines = entries.map((e) => `- ${e.content}`)
  return `[长期记忆]\n${lines.join('\n')}`
}

export function estimateTokens(messages: any[]): number {
  try {
    return Math.ceil(JSON.stringify(messages).length / 2)
  } catch {
    return 0
  }
}

export function getSession(): SessionContext {
  return sessionContext
}

export function resetSession(): void {
  sessionContext = {
    agentId: null,
    systemPrompt: '',
    summary: null,
    recentTurns: [],
    lastPromptTokens: 0,
    needsCompression: false,
  }
}

export function ensureSessionForAgent(agentId: string, systemPrompt: string): void {
  if (sessionContext.agentId !== agentId) {
    sessionContext = {
      agentId,
      systemPrompt: systemPrompt || '',
      summary: null,
      recentTurns: [],
      lastPromptTokens: 0,
      needsCompression: false,
    }
  } else if (!sessionContext.systemPrompt && systemPrompt) {
    sessionContext.systemPrompt = systemPrompt
  }
}

export function appendTurns(msgs: any[]): void {
  sessionContext.recentTurns.push(...msgs)
}

export function setLastPromptTokens(n: number): void {
  sessionContext.lastPromptTokens = n
}

export function setCurrentAgent(agentId: string): void {
  currentAgentId = agentId
}

export function getCurrentAgent(): string | null {
  return currentAgentId
}

export async function summarizeMessages(
  client: OpenAI,
  model: string,
  messages: any[]
): Promise<string> {
  const conversationText = messages
    .map((m) => {
      const role = m.role || 'unknown'
      let body = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
      if (m.tool_calls) body += `\n[tool_calls: ${JSON.stringify(m.tool_calls)}]`
      return `${role}: ${body}`
    })
    .join('\n')

  const resp = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: '请用简洁的要点总结以下对话，保留关键事实、已做决定与未完成事项，不要添加新信息。',
      },
      { role: 'user', content: conversationText },
    ],
  })

  return resp.choices[0]?.message?.content?.trim() || ''
}

function findSplitIndex(turns: any[], keepRecent: number): number {
  let splitAt = Math.max(0, turns.length - keepRecent)
  while (splitAt < turns.length && turns[splitAt].role === 'tool') {
    splitAt++
  }
  return splitAt
}

export async function compressIfNeeded(
  client: OpenAI,
  model: string,
  _limit: number
): Promise<void> {
  const sess = sessionContext
  const turns = sess.recentTurns
  if (turns.length <= KEEP_RECENT_TURNS) return
  const splitAt = findSplitIndex(turns, KEEP_RECENT_TURNS)
  if (splitAt <= 0) return
  const toSummarize = turns.slice(0, splitAt)
  const kept = turns.slice(splitAt)
  const summaryText = await summarizeMessages(client, model, toSummarize)
  if (!summaryText) return
  sess.summary = sess.summary ? `${sess.summary}\n\n${summaryText}` : summaryText
  sess.recentTurns = kept
  if (sess.agentId) {
    try {
      saveMemory(sess.agentId, summaryText, 'summary')
    } catch (error) {
      console.error('[Memory] persist summary failed:', error)
    }
  }
}
