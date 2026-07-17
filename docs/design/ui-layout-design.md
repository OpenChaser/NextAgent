# 页面布局（UI Layout）— 设计文档

> 本文档描述 NextAgent 渲染进程的页面布局结构、各区域命名规范与层次关系，作为团队沟通的「单一事实来源」，避免在 PR 描述、设计文档、对话中出现指代不清的口语化说法。

## 一、总体架构

NextAgent 渲染层采用经典的 **左侧边栏 + 右主内容区** 双栏布局，主内容区根据侧边栏选中的 `activeTab` 动态切换视图。项目未抽取独立的 `Layout.tsx` / `Header.tsx` / `MainContent.tsx` 壳组件，布局逻辑直接内联在 `App.tsx` 中，由 `Sidebar` 组件 + 主内容区 div + 各 View 组件组合而成。视图切换使用简单的条件渲染，未引入路由库（如 React Router）。

```
┌────────────────────────────────────────────────────────────┐
│  侧边栏 Sidebar (w-64)  │   主内容区 Main Content (flex-1)    │
│  ┌───────────────────┐  │  ┌─────────────────────────────┐  │
│  │ 头部 Header        │  │  │  视图标题区 / Header (可选)    │  │
│  │ Logo + 工具 + 搜索 │  │  ├─────────────────────────────┤  │
│  ├───────────────────┤  │  │                             │  │
│  │ 导航 Nav           │  │  │  ChatArea / AutomationView  │  │
│  │  · 主菜单          │  │  │   / SettingsView / MemoryView│  │
│  │  · 任务清单 Task   │  │  │                             │  │
│  ├───────────────────┤  │  │                             │  │
│  │ 底部 Footer (设置) │  │  │                             │  │
│  └───────────────────┘  │  └─────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

根容器结构（[App.tsx](../../src/renderer/App.tsx)）：

```tsx
<div className="flex h-screen bg-white">
  <Sidebar ... />
  <div className="flex-1 flex flex-col">
    {activeTab === 'automation' ? <AutomationView />
     : activeTab === 'settings' ? <SettingsView />
     : activeTab === 'memory' ? <MemoryView />
     : <ChatArea ... />}
  </div>
</div>
```

---

## 二、布局层次与命名词汇表

下表为布局区域的「单一事实来源」命名，后续 PR 描述、设计文档、对话中请统一使用此处的「中文名 / 英文名」组合。

| 层级 | 中文名 | 英文名 | 组件名 | 文件 |
|------|--------|--------|--------|------|
| L0 | 根挂载点 | Root Mount Point | `#root` | [index.html](../../index.html) |
| L0 | 渲染入口 | Renderer Entry | `App` | [main.tsx](../../src/renderer/main.tsx) |
| L1 | 根容器 | Root Container | `App` | [App.tsx](../../src/renderer/App.tsx) |
| L2 | 侧边栏 | Sidebar | `Sidebar` | [Sidebar.tsx](../../src/renderer/components/Sidebar.tsx) |
| L2 | 主内容区 | Main Content Area | (内联 div) | [App.tsx](../../src/renderer/App.tsx) |
| L3 | 侧边栏头部 | Sidebar Header | `Sidebar` | [Sidebar.tsx](../../src/renderer/components/Sidebar.tsx) |
| L3 | 侧边栏导航 | Sidebar Nav | `Sidebar` | [Sidebar.tsx](../../src/renderer/components/Sidebar.tsx) |
| L3 | 侧边栏底部 | Sidebar Footer | `Sidebar` | [Sidebar.tsx](../../src/renderer/components/Sidebar.tsx) |
| L3 | 对话区 | Chat Area | `ChatArea` | [ChatArea.tsx](../../src/renderer/components/ChatArea.tsx) |
| L3 | 自动化视图 | Automation View | `AutomationView` | [AutomationView.tsx](../../src/renderer/components/AutomationView.tsx) |
| L3 | 设置视图 | Settings View | `SettingsView` | [SettingsView.tsx](../../src/renderer/components/SettingsView.tsx) |
| L3 | 记忆管理视图 | Memory View | `MemoryView` | [MemoryView.tsx](../../src/renderer/components/MemoryView.tsx) |
| L4 | 消息列表区 | Message List Area | `ChatArea` | [ChatArea.tsx](../../src/renderer/components/ChatArea.tsx) |
| L4 | 输入区 | Input Area | `ChatArea` | [ChatArea.tsx](../../src/renderer/components/ChatArea.tsx) |
| L4 | 设置导航 | Settings Nav | `SettingsView` | [SettingsView.tsx](../../src/renderer/components/SettingsView.tsx) |
| L4 | 设置内容区 | Settings Content | `SettingsView` | [SettingsView.tsx](../../src/renderer/components/SettingsView.tsx) |
| L5 | 智能体配置 | Agent Config View | `AgentConfigView` | [AgentConfigView.tsx](../../src/renderer/components/AgentConfigView.tsx) |
| L5 | 技能管理 | Skill View | `SkillView` | [SkillView.tsx](../../src/renderer/components/SkillView.tsx) |
| L5 | MCP 服务器管理 | MCP Settings | `McpSettings` | [McpSettings.tsx](../../src/renderer/components/McpSettings.tsx) |

---

## 三、侧边栏（Sidebar）

**文件**：[Sidebar.tsx](../../src/renderer/components/Sidebar.tsx)
**容器类名**：`w-64 h-full bg-sidebar-bg flex flex-col`（固定宽度 16rem，纵向 flex）

侧边栏内部自上而下分为三个区域：

| 子区域 | 中文名 | 英文名 | 代码位置 | 说明 |
|--------|--------|--------|----------|------|
| 头部区 | 侧边栏头部 | Sidebar Header | [Sidebar.tsx:33-59](../../src/renderer/components/Sidebar.tsx#L33-L59) | 含 Logo「NextAgent v1.0.0」、网格/搜索/刷新三按钮、搜索输入框（placeholder「搜索...」） |
| 导航区 | 侧边栏导航 | Sidebar Nav | [Sidebar.tsx:61-132](../../src/renderer/components/Sidebar.tsx#L61-L132) | `flex-1` 可滚动，包含主菜单与任务清单 |
| 底部区 | 侧边栏底部 | Sidebar Footer | [Sidebar.tsx:134-146](../../src/renderer/components/Sidebar.tsx#L134-L146) | 「设置」按钮入口 |

### 3.1 侧边栏导航菜单项

定义于 [Sidebar.tsx:15-24](../../src/renderer/components/Sidebar.tsx#L15-L24)：

| id | 中文标签 | 英文(语义) | 图标 |
|----|---------|-----------|------|
| `new-task` | 新建任务 | New Task | Plus |
| `assistant` | 助理 | Assistant | Bot |
| `assistant2` | 助理 | Assistant (次) | MessageSquare |
| `project` | 项目 | Project | FolderKanban |
| `experts` | 专家·技能·连接器 | Experts·Skills·Connectors | Users |
| `automation` | 自动化 | Automation | Zap |
| `memory` | 记忆 | Memory | Brain |
| `more` | 更多（资料库·灵感） | More (Library·Inspiration) | MoreHorizontal |

### 3.2 任务清单

- 标题「任务清单 (N)」，可折叠
- 列出所有任务，点击切换，hover 显示删除按钮
- 任务清单本身的命名：**任务清单 / Task List**

> **注意**：侧边栏定义了 8 个菜单项，但 [App.tsx](../../src/renderer/App.tsx) 实际只有 4 个 `activeTab` 值（`new-task` / `automation` / `settings` / `memory`）会触发视图切换，`assistant` / `assistant2` / `project` / `experts` / `more` 等菜单项点击后会 fallback 到默认的 `ChatArea`。

---

## 四、主内容区各视图

主内容区容器在 [App.tsx:118](../../src/renderer/App.tsx#L118) 定义为 `flex-1 flex flex-col`，根据 `activeTab` 切换四个视图。

### 4.1 对话区 ChatArea（默认视图）

**文件**：[ChatArea.tsx](../../src/renderer/components/ChatArea.tsx)
**容器类名**：`flex-1 flex flex-col h-full bg-white`

| 子区域 | 中文名 | 英文名 | 代码位置 | 说明 |
|--------|--------|--------|----------|------|
| 消息列表区 | 消息列表区 | Message List Area | [ChatArea.tsx:637-713](../../src/renderer/components/ChatArea.tsx#L637-L713) | `flex-1 overflow-y-auto p-6`，渲染用户/助手消息气泡、工具调用、@提及标签 |
| 输入区 | 输入区 | Input Area | [ChatArea.tsx:715-908](../../src/renderer/components/ChatArea.tsx#L715-L908) | `p-6`，含错误提示、技能标签、选择器、文本框、工具栏、Token 统计 |

输入区内部结构：

| 子区域 | 中文名 | 英文名 | 代码位置 | 说明 |
|--------|--------|--------|----------|------|
| 错误/警告提示 | 工作空间错误提示 | Workspace Error | [ChatArea.tsx:717-722](../../src/renderer/components/ChatArea.tsx#L717-L722) | 未选目录时提示「请先选择项目目录后再发送消息」 |
| 智能体错误提示 | 智能体错误提示 | Agent Error | [ChatArea.tsx:723-728](../../src/renderer/components/ChatArea.tsx#L723-L728) | 未选智能体或群聊未 @ 时提示 |
| 已选技能标签 | 已选技能标签 | Selected Skills Chips | [ChatArea.tsx:729-749](../../src/renderer/components/ChatArea.tsx#L729-L749) | 紫色 chip，含移除按钮 |
| 智能体提及选择器 | @ 提及选择器 | Mention Picker | [ChatArea.tsx:751-778](../../src/renderer/components/ChatArea.tsx#L751-L778) | `absolute bottom-full`，群聊模式输入 @ 触发 |
| 技能命令选择器 | 技能命令选择器 | Command Picker | [ChatArea.tsx:779-808](../../src/renderer/components/ChatArea.tsx#L779-L808) | `absolute bottom-full`，输入 / 触发 |
| 文本输入框 | 文本输入框 | Textarea | [ChatArea.tsx:809-818](../../src/renderer/components/ChatArea.tsx#L809-L818) | placeholder「今天帮你做些什么？@ 引用对话文件，/ 调用技能」 |
| 工具栏（左） | 工具栏左侧 | Toolbar Left | [ChatArea.tsx:821-854](../../src/renderer/components/ChatArea.tsx#L821-L854) | 技能按钮（Slash 图标）、工作空间选择器（FolderOpen） |
| 工具栏（右） | 工具栏右侧 | Toolbar Right | [ChatArea.tsx:856-897](../../src/renderer/components/ChatArea.tsx#L856-L897) | 智能体选择器（Sparkles）、模型选择器（Globe）、发送/停止按钮（Send/Square） |
| Token 统计 | Token 消耗统计 | Token Usage | [ChatArea.tsx:900-906](../../src/renderer/components/ChatArea.tsx#L900-L906) | 显示输入/输出 Token 及窗口消耗百分比 |

### 4.2 自动化视图 AutomationView

**文件**：[AutomationView.tsx](../../src/renderer/components/AutomationView.tsx)
**容器类名**：`flex-1 h-full overflow-y-auto bg-gray-50`

| 子区域 | 中文名 | 英文名 | 代码位置 | 说明 |
|--------|--------|--------|----------|------|
| 标题区 | 自动化标题区 | Title Area | [AutomationView.tsx:52-62](../../src/renderer/components/AutomationView.tsx#L52-L62) | 标题「自动化」+ 副标题「创建并管理你的自动化任务」 |
| 创建任务卡片 | 创建自动化任务卡片 | Create Task Card | [AutomationView.tsx:64-125](../../src/renderer/components/AutomationView.tsx#L64-L125) | 表单：任务名称、触发方式、定时设置、执行内容 |
| 任务列表区 | 已创建任务列表 | Task List | [AutomationView.tsx:127-193](../../src/renderer/components/AutomationView.tsx#L127-L193) | 任务卡片列表，含启停/删除操作 |

### 4.3 设置视图 SettingsView

**文件**：[SettingsView.tsx](../../src/renderer/components/SettingsView.tsx)
**容器类名**：`flex-1 h-full overflow-hidden bg-gray-50`

设置视图内部嵌套一层「左导航 + 右内容」的双栏结构：

| 子区域 | 中文名 | 英文名 | 代码位置 | 说明 |
|--------|--------|--------|----------|------|
| 顶部标题区 | 设置顶部标题区 | Header | [SettingsView.tsx:33-52](../../src/renderer/components/SettingsView.tsx#L33-L52) | 含「返回」按钮、标题「设置」+ 副标题 |
| 设置导航 | 设置导航 | Settings Nav | [SettingsView.tsx:55-80](../../src/renderer/components/SettingsView.tsx#L55-L80) | `w-56` 左侧导航，6 个设置分区 |
| 设置内容区 | 设置内容区 | Settings Content | [SettingsView.tsx:82-95](../../src/renderer/components/SettingsView.tsx#L82-L95) | `flex-1 overflow-y-auto`，按选中分区渲染子视图 |

设置导航分区（[SettingsView.tsx:18-25](../../src/renderer/components/SettingsView.tsx#L18-L25)）：

| id | 中文名 | 英文名 | 状态 | 子组件 |
|----|--------|--------|------|--------|
| `general` | 通用设置 | General Settings | 占位 | — |
| `agent` | 智能体配置 | Agent Config | ✅ | [AgentConfigView](../../src/renderer/components/AgentConfigView.tsx) |
| `skill` | 技能管理 | Skill Management | ✅ | [SkillView](../../src/renderer/components/SkillView.tsx) |
| `mcp` | MCP | MCP (Model Context Protocol) | ✅ | [McpSettings](../../src/renderer/components/McpSettings.tsx) |
| `notification` | 通知 | Notification | 占位 | — |
| `permission` | 权限与安全 | Permission & Security | 占位 | — |

### 4.4 记忆管理视图 MemoryView

**文件**：[MemoryView.tsx](../../src/renderer/components/MemoryView.tsx)
**容器类名**：`flex-1 flex flex-col h-full overflow-hidden`

| 子区域 | 中文名 | 英文名 | 代码位置 | 说明 |
|--------|--------|--------|----------|------|
| 顶部标题栏 | 记忆管理标题栏 | Header Bar | [MemoryView.tsx:100-121](../../src/renderer/components/MemoryView.tsx#L100-L121) | 含返回按钮、标题「记忆管理」、刷新按钮 |
| 筛选与新建区 | 筛选与新建区 | Filter & Add Area | [MemoryView.tsx:123-170](../../src/renderer/components/MemoryView.tsx#L123-L170) | Agent 选择下拉、记忆内容输入、标签输入、保存按钮 |
| 记忆列表区 | 记忆列表区 | Memory List Area | [MemoryView.tsx:172-223](../../src/renderer/components/MemoryView.tsx#L172-L223) | `flex-1 overflow-y-auto`，按时间倒序展示记忆条目 |

---

## 五、浮层与对话框（脱离文档流）

对话区工具栏按钮（技能、工作空间、智能体、模型）通过 [Popover.tsx](../../src/renderer/components/Popover.tsx) 锚定定位，删除确认与自定义模型配置通过 [Modal.tsx](../../src/renderer/components/Modal.tsx) 居中弹出。它们脱离文档流，不占据布局流位置，但仍属于布局词汇表的一部分。

| 中文名 | 英文名 | 文件 |
|--------|--------|------|
| 通用浮层容器 | Popover | [Popover.tsx](../../src/renderer/components/Popover.tsx) |
| 通用对话框 | Modal | [Modal.tsx](../../src/renderer/components/Modal.tsx) |
| 工作空间选择浮层 | Workspace Popover | [WorkspacePopover.tsx](../../src/renderer/components/WorkspacePopover.tsx) |
| 技能选择浮层 | Command-Skill Popover | [CommandSkillPopover.tsx](../../src/renderer/components/CommandSkillPopover.tsx) |
| 智能体选择浮层 | Agent Popover | [AgentPopover.tsx](../../src/renderer/components/AgentPopover.tsx) |
| 模型选择浮层 | Model Popover | [ModelPopover.tsx](../../src/renderer/components/ModelPopover.tsx) |
| 自定义模型配置对话框 | Custom Model Config Dialog | [CustomModelConfigDialog.tsx](../../src/renderer/components/CustomModelConfigDialog.tsx) |

---

## 六、样式约定

### 6.1 Tailwind 自定义颜色

定义于 [tailwind.config.js:9-19](../../tailwind.config.js#L9-L19)：

```js
colors: {
  sidebar: {
    bg: '#f5f5f5',     // 侧边栏背景色
    active: '#e8e8e8', // 侧边栏选中项背景
    hover: '#ebebeb',  // 侧边栏 hover 背景
  },
  primary: {
    blue: '#3b82f6',
    green: '#22c55e',
  }
}
```

引用侧边栏样式时统一使用 `bg-sidebar-bg` / `bg-sidebar-active` / `bg-sidebar-hover` 语义 token，禁止硬编码十六进制色值。

### 6.2 全局样式

- `body` 背景白色，字体使用系统字体栈
- 自定义滚动条样式（6px 宽，圆角 3px）

---

## 七、命名规范要点

1. **统一用语**：在 PR 描述、设计文档、对话中，统一使用本文档第二章词汇表中的「中文名 / 英文名」组合，例如「侧边栏导航 / Sidebar Nav」「输入区 / Input Area」。
2. **避免口语化**：禁止出现「左边栏菜单」「输入框区域」「底部工具条」等指代不清的说法。
3. **组件名优先**：涉及代码引用时，优先使用组件名（如 `ChatArea`、`Sidebar`），而非文件路径片段。
4. **新增视图**：新增主内容区视图时，需在本文档第二章词汇表与第四章中同步登记，并在 [App.tsx](../../src/renderer/App.tsx) 的 `activeTab` 条件渲染中补充分支。
5. **新增浮层**：新增浮层/对话框组件时，在第五章同步登记。

---

## 八、文件索引

| 区域 | 文件路径 |
|------|----------|
| 渲染入口 | `src/renderer/main.tsx` |
| 根容器 | `src/renderer/App.tsx` |
| 侧边栏 | `src/renderer/components/Sidebar.tsx` |
| 对话区 | `src/renderer/components/ChatArea.tsx` |
| 自动化视图 | `src/renderer/components/AutomationView.tsx` |
| 设置视图 | `src/renderer/components/SettingsView.tsx` |
| 记忆管理视图 | `src/renderer/components/MemoryView.tsx` |
| 智能体配置 | `src/renderer/components/AgentConfigView.tsx` |
| 技能管理 | `src/renderer/components/SkillView.tsx` |
| MCP 服务器管理 | `src/renderer/components/McpSettings.tsx` |
| 通用浮层容器 | `src/renderer/components/Popover.tsx` |
| 通用对话框 | `src/renderer/components/Modal.tsx` |
| 工作空间浮层 | `src/renderer/components/WorkspacePopover.tsx` |
| 技能浮层 | `src/renderer/components/CommandSkillPopover.tsx` |
| 智能体浮层 | `src/renderer/components/AgentPopover.tsx` |
| 模型浮层 | `src/renderer/components/ModelPopover.tsx` |
| 自定义模型对话框 | `src/renderer/components/CustomModelConfigDialog.tsx` |
| Tailwind 配置 | `tailwind.config.js` |
| 全局样式 | `src/renderer/index.css` |
