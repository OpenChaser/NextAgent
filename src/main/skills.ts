import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import matter from 'gray-matter'

export type SkillSource = 'global' | 'project'

export interface SkillFile {
  name: string
  description: string
  content: string
  license?: string
  allowedTools?: string[]
  enabled?: boolean
}

export interface Skill extends SkillFile {
  id: string
  source: SkillSource
  createdAt: number
  dir: string
}

const SKILL_FILE_NAME = 'SKILL.md'

export function getGlobalSkillsDir(): string {
  return path.join(os.homedir(), '.nextagent', 'skills')
}

export function getProjectSkillsDir(): string {
  return path.join(app.getAppPath(), '.nextagent', 'skills')
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function ensureSkillsDirs(): void {
  ensureDir(getGlobalSkillsDir())
  ensureDir(getProjectSkillsDir())
}

function normalizeFolderName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim()
  return cleaned || 'unnamed'
}

interface ParsedFrontmatter {
  name?: string
  description?: string
  license?: string
  'allowed-tools'?: string[]
  enabled?: boolean
}

function loadSkillsFromDir(dir: string, source: SkillSource): Skill[] {
  if (!fs.existsSync(dir)) return []
  let folders: string[] = []
  try {
    folders = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch (error) {
    console.error(`Failed to read skills dir ${dir}:`, error)
    return []
  }

  const result: Skill[] = []
  for (const folderName of folders) {
    const skillDir = path.join(dir, folderName)
    const skillFile = path.join(skillDir, SKILL_FILE_NAME)
    if (!fs.existsSync(skillFile)) continue
    try {
      const raw = fs.readFileSync(skillFile, 'utf-8')
      const parsed = matter(raw)
      const data = parsed.data as ParsedFrontmatter
      if (!data.name || !data.description) continue

      let mtime = Date.now()
      try {
        mtime = fs.statSync(skillFile).mtimeMs
      } catch {
        // ignore stat error
      }

      result.push({
        name: data.name,
        description: data.description,
        content: parsed.content.trim(),
        license: data.license,
        allowedTools: data['allowed-tools'],
        enabled: data.enabled !== false,
        source,
        id: `${source}:${data.name}`,
        createdAt: mtime,
        dir: skillDir,
      })
    } catch (error) {
      console.error(`Failed to parse skill ${folderName}:`, error)
    }
  }
  return result
}

export function loadSkills(): Skill[] {
  ensureSkillsDirs()
  const globalSkills = loadSkillsFromDir(getGlobalSkillsDir(), 'global')
  const projectSkills = loadSkillsFromDir(getProjectSkillsDir(), 'project')

  const map = new Map<string, Skill>()
  for (const s of globalSkills) map.set(s.name, s)
  for (const s of projectSkills) map.set(s.name, s)
  return Array.from(map.values())
}

export function loadGlobalSkills(): Skill[] {
  ensureDir(getGlobalSkillsDir())
  return loadSkillsFromDir(getGlobalSkillsDir(), 'global')
}

export function saveSkill(skill: SkillFile, target: SkillSource): boolean {
  const baseDir = target === 'global' ? getGlobalSkillsDir() : getProjectSkillsDir()
  ensureDir(baseDir)
  const skillDir = path.join(baseDir, normalizeFolderName(skill.name))
  ensureDir(skillDir)
  const filePath = path.join(skillDir, SKILL_FILE_NAME)
  try {
    const data: Record<string, unknown> = {
      name: skill.name,
      description: skill.description,
      enabled: skill.enabled !== false,
    }
    if (skill.license) data.license = skill.license
    if (skill.allowedTools && skill.allowedTools.length) {
      data['allowed-tools'] = skill.allowedTools
    }
    const output = matter.stringify(skill.content || '', data)
    fs.writeFileSync(filePath, output, 'utf-8')
    return true
  } catch (error) {
    console.error(`Failed to save skill ${skill.name}:`, error)
    return false
  }
}

export function deleteSkill(source: SkillSource, name: string): boolean {
  const baseDir = source === 'global' ? getGlobalSkillsDir() : getProjectSkillsDir()
  const skillDir = path.join(baseDir, normalizeFolderName(name))
  try {
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true })
      return true
    }
    return false
  } catch (error) {
    console.error(`Failed to delete skill ${name}:`, error)
    return false
  }
}
