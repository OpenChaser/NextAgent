# SKILL(技能)— 设计文档

> 本文档描述 NextAgent 中 SKILL 子系统的实现原理:文件格式、全局/项目双层加载、gray-matter 解析、CRUD 与启用开关。

## 一、总体架构

SKILL 模块由单文件 `src/main/skills.ts` 构成,采用 `SKILL.md`(YAML frontmatter + Markdown 正文)格式存储。主进程提供加载/保存/删除,渲染层提供查看与启停 UI。

```
┌──────────────────────────────────────────────────────┐
│ 渲染层                                                 │
│  SettingsView.tsx → SkillView.tsx (技能管理 UI)       │
│   ├─ getGlobalSkills() 加载全局技能                    │
│   ├─ toggle: saveSkill(enabled 取反)                   │
│   └─ 展示 content / license / allowedTools 胶囊        │
└────────────────────────┬─────────────────────────────┘
                          │ IPC (skills:get/getGlobal/save/delete)
┌─────────────────────────▼─────────────────────────────┐
│ 主进程 main.ts                                         │
│   ├─ app.whenReady → ensureSkillsDirs()                │
│   └─ IPC handlers (4个)                                │
│                                                         │
│  skills.ts (全部逻辑)                                   │
│   ├─ 类型: SkillSource / SkillFile / Skill             │
│   ├─ 目录: getGlobalSkillsDir / getProjectSkillsDir     │
│   ├─ 加载: loadSkillsFromDir / loadSkills / loadGlobal  │
│   ├─ 持久化: saveSkill / deleteSkill                    │
│   └─ 解析: gray-matter (frontmatter)                   │
└────────────────────────┬─────────────────────────────┘
                          │
            ┌─────────────▼──────────────┐
            ▼                             ▼
  ~/.nextagent/skills/          <app>/.nextagent/skills/
    (全局,跨项目共享)              (项目级,随应用)
    pdf/SKILL.md                   api-doc/SKILL.md
```

---

## 二、核心类型

### SkillSource

```typescript
export type SkillSource = 'global' | 'project'
```

- `'global'`:用户主目录下的全局技能,跨项目共享
- `'project'`:应用安装目录下的项目级技能

### SkillFile

```typescript
export interface SkillFile {
  name: string              // 必填,技能名称
  description: string       // 必填,一句话描述
  content: string           // Markdown 正文(技能指令本体)
  license?: string          // 可选,许可证
  allowedTools?: string[]   // 可选,工具白名单(预留)
  enabled?: boolean         // 可选,默认 true
}
```

### Skill

```typescript
export interface Skill extends SkillFile {
  id: string                // 格式: {source}:{name},如 global:pdf
  source: SkillSource       // 来源目录
  createdAt: number        // 取自文件 mtimeMs
  dir: string              // 技能文件夹绝对路径
}
```

---

## 三、目录结构

### 目录路径

| 类型 | 路径 | 含义 |
|------|------|------|
| 全局 | `~/.nextagent/skills/` | 跨项目共享 |
| 项目 | `<app.getAppPath()>/.nextagent/skills/` | 随应用 |

### 技能文件结构

每个技能一个文件夹,内含一个 `SKILL.md`:

```
~/.nextagent/skills/
  ├── pdf/
  │   └── SKILL.md
  └── api-doc/
      └── SKILL.md
```

### ensureSkillsDirs()

```typescript
export function ensureSkillsDirs(): void {
  ensureDir(getGlobalSkillsDir())   // ~/.nextagent/skills
  ensureDir(getProjectSkillsDir())  // <app>/.nextagent/skills
}
```

在 `app.whenReady`、`loadSkills`、`loadGlobalSkills`、`saveSkill` 中调用,确保目录存在。

---

## 四、SKILL.md 文件格式

Markdown + YAML frontmatter,用 [`gray-matter`](https://github.com/jonschlinkert/gray-matter) 解析。

### 典型示例

```markdown
---
name: pdf
description: 解析并回答 PDF 文件相关问题
license: MIT
allowed-tools:
  - readFile
  - searchContent
enabled: true
---

# PDF 技能指令正文

当用户提问 PDF 时,先调用 readFile 读取……
```

### frontmatter 字段映射

| 磁盘字段(连字符) | 内存字段(驼峰) | 必填 | 默认 |
|---|---|---|---|
| `name` | `name` | 是 | - |
| `description` | `description` | 是 | - |
| `license` | `license` | 否 | - |
| `allowed-tools` | `allowedTools` | 否 | - |
| `enabled` | `enabled` | 否 | `true` |
| *(正文)* | `content` | 否 | - |

### 解析与序列化

- **读**:`matter(raw)` → `parsed.data`(frontmatter) + `parsed.content`(正文)
- **写**:`matter.stringify(content, data)` 拼回完整 `SKILL.md`

---

## 五、加载逻辑

### loadSkillsFromDir(dir, source) — 内部

```typescript
function loadSkillsFromDir(dir: string, source: SkillSource): Skill[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue          // 只认文件夹
    const skillPath = path.join(dir, entry.name, 'SKILL.md')
    if (!fs.existsSync(skillPath)) continue     // 无 SKILL.md 跳过

    const parsed = matter(raw)                  // gray-matter 解析
    // 校验必填:name 和 description 缺失则跳过
    if (!data.name || !data.description) continue

    result.push({
      name: data.name,
      description: data.description,
      content: parsed.content.trim(),
      license: data.license,
      allowedTools: data['allowed-tools'],       // 连字符 → 驼峰
      enabled: data.enabled !== false,           // 默认 true
      source,
      id: `${source}:${data.name}`,
      createdAt: mtime,                          // 文件 mtimeMs
      dir: skillDir,
    })
  }
}
```

### loadSkills() — 合并加载

```typescript
export function loadSkills(): Skill[] {
  const globalSkills = loadSkillsFromDir(getGlobalSkillsDir(), 'global')
  const projectSkills = loadSkillsFromDir(getProjectSkillsDir(), 'project')

  const map = new Map<string, Skill>()
  for (const s of globalSkills) map.set(s.name, s)
  for (const s of projectSkills) map.set(s.name, s)  // project 覆盖同名 global
  return Array.from(map.values())
}
```

**关键设计**:project 技能后写入 Map,以 `name` 为键覆盖同名 global,实现**项目级覆盖全局**的优先级。

### loadGlobalSkills() — 仅全局

```typescript
export function loadGlobalSkills(): Skill[] {
  ensureDir(getGlobalSkillsDir())
  return loadSkillsFromDir(getGlobalSkillsDir(), 'global')
}
```

渲染层 `SkillView` 用这个,只展示全局技能。

---

## 六、持久化

### saveSkill(skill, target)

```typescript
export function saveSkill(skill: SkillFile, target: SkillSource): boolean {
  const baseDir = target === 'global' ? getGlobalSkillsDir() : getProjectSkillsDir()
  const skillDir = path.join(baseDir, normalizeFolderName(skill.name))
  ensureDir(skillDir)

  const data = {
    name: skill.name,
    description: skill.description,
    enabled: skill.enabled !== false,
  }
  if (skill.license) data.license = skill.license
  if (skill.allowedTools?.length) data['allowed-tools'] = skill.allowedTools

  const output = matter.stringify(skill.content || '', data)
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), output, 'utf-8')
}
```

- 文件夹名由 `normalizeFolderName(name)` 生成,把 `\/:*?"<>|` 替换为 `_`
- 写入时 frontmatter 字段转回连字符风格 `allowed-tools`

### deleteSkill(source, name)

```typescript
export function deleteSkill(source: SkillSource, name: string): boolean {
  const skillDir = path.join(baseDir, normalizeFolderName(name))
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true })
    return true
  }
  return false
}
```

删除整个技能文件夹(含 SKILL.md)。

---

## 七、IPC Handlers

```typescript
ipcMain.handle('skills:get', () => loadSkills())                    // 合并加载
ipcMain.handle('skills:getGlobal', () => loadGlobalSkills())        // 仅全局
ipcMain.handle('skills:save', (_e, { skill, target }) => saveSkill(skill, target))
ipcMain.handle('skills:delete', (_e, { source, name }) => deleteSkill(source, name))
```

preload 桥接:

```typescript
getSkills: () => ipcRenderer.invoke('skills:get'),
getGlobalSkills: () => ipcRenderer.invoke('skills:getGlobal'),
saveSkill: (skill, target) => ipcRenderer.invoke('skills:save', { skill, target }),
deleteSkill: (source, name) => ipcRenderer.invoke('skills:delete', { source, name }),
```

---

## 八、渲染层管理 UI

`SkillView.tsx` 挂在 `SettingsView.tsx` 的「技能管理」Tab 下:

- **加载**:`getGlobalSkills()` 只显示全局技能
- **启停开关**:`toggleEnabled` 把 `enabled` 取反后调 `saveSkill(..., 'global')` 整体回写
- **展开详情**:点击展开,在 `<pre>` 中展示 `skill.content`
- **元信息**:`license` 灰色胶囊;`allowedTools.length > 0` 蓝色「N 工具」胶囊
- **空态/加载态/错误态**:均有对应 UI

---

## 九、allowedTools 字段现状(重要)

`allowedTools` 当前是**预留字段**,数据通路已打通但执行通路未接通:

| 维度 | 现状 |
|------|------|
| 定义 | `SkillFile.allowedTools?: string[]` |
| 解析 | `loadSkillsFromDir` 读取并赋值 |
| 持久化 | `saveSkill` 写回 `allowed-tools` |
| UI 展示 | SkillView 显示「N 工具」胶囊 |
| **实际限制工具** | **无**。chat:send 未读取 skill |

### chat:send 中的工具过滤(现状)

```typescript
const effectiveTools = (() => {
  if (agentId) {
    const ag = agents.find((a) => a.id === agentId)
    if (ag && !ag.toolsEnabled) return []   // 只看 agent.toolsEnabled 全开全关
  }
  return tools   // 完全没读 skill.allowedTools
})()
```

**技能 content 也未注入 system 消息**。chat 流程中对 `loadSkills` 的引用只有 `skills:get` IPC handler 一处。

### 要让 allowedTools 生效需做的事

1. chat:send 中调用 `loadSkills()`(或只取 enabled)
2. 把 enabled 技能的 `content` 拼进 system 消息
3. 把这些技能的 `allowedTools` 求交集/并集,过滤 `getToolDefinitions()` 返回的工具白名单

---

## 十、关键设计权衡

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 文件格式 | SKILL.md + YAML frontmatter | 人类可读,gray-matter 成熟 |
| 目录结构 | 每技能一文件夹 | 便于放附属资源 |
| 来源分层 | global + project 双层 | project 可覆盖 global |
| 合并策略 | project 后写入覆盖同名 global | 项目级优先 |
| 解析库 | gray-matter | npm 生态标准 frontmatter 解析器 |
| allowedTools | 预留未接通 | 数据通路先打通,执行后补 |
| enabled 默认 | true | 新技能默认启用 |

---

## 十一、相关文件索引

| 文件 | 职责 |
|------|------|
| `src/main/skills.ts` | 全部技能逻辑(类型/目录/加载/保存/删除) |
| `src/main/main.ts` | 4 个 skills IPC handlers + app ready 调 ensureSkillsDirs |
| `src/preload/preload.ts` | 4 个 skills 方法 contextBridge 桥接 |
| `src/renderer/electron.d.ts` | SkillFile/Skill/SkillSource 全局类型 |
| `src/renderer/components/SkillView.tsx` | 技能管理 UI(查看/启停) |
| `src/renderer/components/SettingsView.tsx` | 设置页挂载 SkillView |
