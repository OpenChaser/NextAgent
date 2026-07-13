# NextAgent 功能列表

> 每个功能独占一行，按「已实现 / 部分实现 / 待实现」三档分类，附源码位置。

## 状态图例

- ✅ 已实现：代码已落地，可正常使用
- 🟡 部分实现：有 UI 或接口，但缺后端/持久化/联动
- ⬜ 待实现：仅计划或入口存在，尚未开始

---

## 一、已实现（✅）

- ✅ Electron 主窗口（1400×800，最小 1000×600，标题 NextAgent） — [main.ts:13-52](../src/main/main.ts#L13-L52)
- ✅ 安全上下文（contextIsolation + preload 桥接） — [main.ts:23-29](../src/main/main.ts#L23-L29)
- ✅ 开发/生产加载（dev 加载 5173 并开 DevTools；prod 加载打包产物） — [main.ts:32-39](../src/main/main.ts#L32-L39)
- ✅ 应用菜单（编辑/窗口/帮助） — [main.ts:54-80](../src/main/main.ts#L54-L80)
- ✅ 进程异常兜底（render-process-gone/unresponsive/uncaughtException/unhandledRejection） — [main.ts:45-51](../src/main/main.ts#L45-L51)
- ✅ macOS 激活重建 — [main.ts:87-91](../src/main/main.ts#L87-L91)
- ✅ 应用版本查询（IPC get-app-version） — [main.ts:100-102](../src/main/main.ts#L100-L102)
- ✅ 关于弹窗独立窗口（400×300，加载 about.html） — [about.ts](../src/main/about.ts)
- ✅ 关于窗口单例复用 — [about.ts:14-19](../src/main/about.ts#L14-L19)
- ✅ 关于窗口静态兜底（about.html 缺失时 data URL 回退） — [about.ts:34-43](../src/main/about.ts#L34-L43)
- ✅ OpenAI 兼容接入（按 provider url/key 创建 client） — [main.ts:225-229](../src/main/main.ts#L225-L229)
- ✅ 流式响应（stream 逐 chunk 推送 chat:chunk） — [main.ts:241-281](../src/main/main.ts#L241-L281)
- ✅ 多轮工具调用 Agent Loop（最多 10 轮） — [main.ts:239-335](../src/main/main.ts#L239-L335)
- ✅ tool_calls 分片重组（按 index 累积拼装） — [main.ts:250-273](../src/main/main.ts#L250-L273)
- ✅ 工具执行结果以 tool 角色回灌模型 — [main.ts:298-320](../src/main/main.ts#L298-L320)
- ✅ Token 用量统计（prompt/completion/total） — [main.ts:275-280](../src/main/main.ts#L275-L280)
- ✅ 错误处理（provider/key 缺失、API 异常经 chat:error 上报） — [main.ts:206-223](../src/main/main.ts#L206-L223)
- ✅ 工具 read_file（超 50000 字符截断） — [readFile.ts](../src/main/tools/readFile.ts)
- ✅ 工具 write_file（覆盖写入，自动建父目录） — [writeFile.ts](../src/main/tools/writeFile.ts)
- ✅ 工具 edit_file（搜索替换，首个匹配） — [editFile.ts](../src/main/tools/editFile.ts)
- ✅ 工具 list_directory（标注目录/文件与大小） — [listDirectory.ts](../src/main/tools/listDirectory.ts)
- ✅ 工具 search_files（glob 按名搜索，PowerShell/find） — [searchFiles.ts](../src/main/tools/searchFiles.ts)
- ✅ 工具 search_content（grep 内容，SelectString/grep） — [searchContent.ts](../src/main/tools/searchContent.ts)
- ✅ 工具 run_command（30s 超时，输出 20000 字符截断） — [runCommand.ts](../src/main/tools/runCommand.ts)
- ✅ 工具 git_status（分支 + status --short + diff --stat） — [gitStatus.ts](../src/main/tools/gitStatus.ts)
- ✅ 工具统一注册与执行器（getToolDefinitions/executeTool） — [tools/index.ts](../src/main/tools/index.ts)
- ✅ 模型配置文件（~/.nextagent/models.json） — [main.ts:118-121](../src/main/main.ts#L118-L121)
- ✅ 模型首次初始化（复制内置默认或写入 DeepSeek） — [main.ts:131-152](../src/main/main.ts#L131-L152)
- ✅ 读取模型列表（IPC models:get） — [main.ts:154-165](../src/main/main.ts#L154-L165)
- ✅ 新增模型（IPC models:add，按 id 去重） — [main.ts:167-185](../src/main/main.ts#L167-L185)
- ✅ 默认模型数据（内置 DeepSeek 两个模型） — [model.json](../src/data/model.json)
- ✅ electronAPI 暴露（contextBridge） — [preload.ts:22](../src/preload/preload.ts#L22)
- ✅ 双向通信（invoke 模型/版本；send+on 流式聊天） — [preload.ts:23-40](../src/preload/preload.ts#L23-L40)
- ✅ 聊天监听清理（removeChatListeners） — [preload.ts:33-38](../src/preload/preload.ts#L33-L38)
- ✅ 渲染端 ElectronAPI 类型声明 — [electron.d.ts](../src/renderer/electron.d.ts)
- ✅ 消息流式渲染（onChatChunk 增量追加） — [ChatArea.tsx:74-80](../src/renderer/components/ChatArea.tsx#L74-L80)
- ✅ 工具调用展示（工具名/参数/结果，>200 字符截断） — [ChatArea.tsx:215-225](../src/renderer/components/ChatArea.tsx#L215-L225)
- ✅ 加载/错误态（等待动画、失败提示） — [ChatArea.tsx:203-209](../src/renderer/components/ChatArea.tsx#L203-L209)
- ✅ Enter 发送 / Shift+Enter 换行 — [ChatArea.tsx:123-128](../src/renderer/components/ChatArea.tsx#L123-L128)
- ✅ 新消息自动滚动到底部 — [ChatArea.tsx:45-47](../src/renderer/components/ChatArea.tsx#L45-L47)
- ✅ Token 统计 UI（单次/累计，窗口消耗百分比） — [ChatArea.tsx:313-317](../src/renderer/components/ChatArea.tsx#L313-L317)
- ✅ 模型列表加载（getModels 展开为模型×provider） — [ModelPopover.tsx:50-73](../src/renderer/components/ModelPopover.tsx#L50-L73)
- ✅ 模型搜索（按模型名/provider 名模糊过滤） — [ModelPopover.tsx:70-73](../src/renderer/components/ModelPopover.tsx#L70-L73)
- ✅ provider 图标映射（13 种配色） — [ModelPopover.tsx:10-43](../src/renderer/components/ModelPopover.tsx#L10-L43)
- ✅ 自定义模型配置弹窗（provider/BaseURL/Key/模型名/token） — [CustomModelConfigDialog.tsx](../src/renderer/components/CustomModelConfigDialog.tsx)
- ✅ 保存模型（addModel 写入 models.json） — [CustomModelConfigDialog.tsx:38-63](../src/renderer/components/CustomModelConfigDialog.tsx#L38-L63)
- ✅ Popover 组件（锚点定位浮层，外部点击/ESC 关闭） — [Popover.tsx](../src/renderer/components/Popover.tsx)
- ✅ Modal 组件（居中模态，背景模糊，body 滚动锁） — [Modal.tsx](../src/renderer/components/Modal.tsx)
- ✅ 类型检查命令（pnpm run typecheck） — [package.json:9](../package.json#L9)
- ✅ 构建命令（tsc 主进程 + vite build 渲染） — [package.json:8](../package.json#L8)
- ✅ 打包命令（electron-builder 产出 nsis） — [package.json:13-14](../package.json#L13-L14)
- ✅ CI 门禁（GitHub Actions install→typecheck→build） — [.github/workflows/build.yml](../.github/workflows/build.yml)
- ✅ 开发模式（concurrently 并启 Vite+Electron，wait-on） — [package.json:11-12](../package.json#L11-L12)

---

## 二、部分实现 / 仅 UI 占位（🟡）

- 🟡 工作空间选择（UI 齐全，数据 mockWorkspaces 硬编码，未持久化/联动） — [WorkspacePopover.tsx:15-19](../src/renderer/components/WorkspacePopover.tsx#L15-L19)
- 🟡 权限管理（有「允许完全访问」开关，未与主进程/工具链路联动，无沙箱） — [PermissionPopover.tsx](../src/renderer/components/PermissionPopover.tsx)
- 🟡 侧边栏导航（7 菜单项仅切换 activeTab，内容区未实现） — [Sidebar.tsx](../src/renderer/components/Sidebar.tsx)、[App.tsx](../src/renderer/App.tsx)
- 🟡 侧边栏计数（「任务 (17)」「空间 (3)」写死） — [Sidebar.tsx:80-86](../src/renderer/components/Sidebar.tsx#L80-L86)
- 🟡 用户信息（「星辰大海」静态文本，无账号体系） — [Sidebar.tsx:90-104](../src/renderer/components/Sidebar.tsx#L90-L104)
- 🟡 输入框指令提示（占位符有 @ //，语法解析未实现） — [ChatArea.tsx:243](../src/renderer/components/ChatArea.tsx#L243)
- 🟡 顶部工具按钮（Plus/Lock 无 onClick） — [ChatArea.tsx:250-274](../src/renderer/components/ChatArea.tsx#L250-L274)

---

## 三、待实现（⬜）

- ⬜ 会话历史持久化（当前 messages 仅内存 state，刷新即丢）
- ⬜ 多会话管理（新建/切换/重命名/删除）
- ⬜ 会话列表与侧边栏「任务」计数联动
- ⬜ 消息复制/重新生成/编辑/删除
- ⬜ 对话导出（Markdown / JSON）
- ⬜ 工作空间 CRUD（替换 mockWorkspaces）
- ⬜ 工作空间持久化（参考 models.json 模式）
- ⬜ 工作空间与工具 cwd/dirPath 默认值联动
- ⬜ 「打开本地文件夹」接入原生目录选择对话框
- ⬜ 工作空间切换时自动 git_status
- ⬜ 工具执行权限分级（只读/受限写/完全访问）
- ⬜ 危险操作二次确认弹窗（run_command/write_file/edit_file）
- ⬜ 「允许完全访问」开关与权限策略联动
- ⬜ 命令白名单/黑名单
- ⬜ 路径访问边界（限制在工作空间根目录内）
- ⬜ @ 引用对话文件/资料
- ⬜ / 斜杠指令（技能与指令面板）
- ⬜ 文件拖拽上传到输入框
- ⬜ 多行/粘贴大段文本优化
- ⬜ 图片/附件输入（多模态）
- ⬜ 新建任务（任务创建表单与任务实体）
- ⬜ 助理（可配置多 persona 与系统提示词）
- ⬜ 项目（项目实体、项目级配置与会话归属）
- ⬜ 专家·技能·连接器（专家定义、技能注册、连接器编排）
- ⬜ 自动化（工作流触发器/动作/定时任务）
- ⬜ 资料库·灵感（资料收集与灵感沉淀）
- ⬜ 系统提示词（system message）可配置
- ⬜ 上下文窗口管理（超 max_input_tokens 截断/摘要）
- ⬜ 工具结果大小自适应截断策略统一
- ⬜ 中断/取消正在进行的流式请求
- ⬜ 重试与错误恢复策略
- ⬜ 更多工具（网页抓取、HTTP 请求、代码执行沙箱、数据库查询等）
- ⬜ 模型删除/编辑（目前仅能新增）
- ⬜ API Key 加密存储（当前 models.json 明文）
- ⬜ provider 连通性测试按钮
- ⬜ 更多内置 provider 预设（13 种已有图标，预设数据未补齐）
- ⬜ 深色模式（Tailwind 已就绪，未做主题切换）
- ⬜ 国际化（中英文混用，无 i18n 框架）
- ⬜ 快捷键体系
- ⬜ 设置页（通用偏好/主题/默认模型/默认权限）
- ⬜ 自动更新（electron-updater）
- ⬜ 日志面板/调试视图
- ⬜ 单元测试与端到端测试（仓库尚无测试）

---

## 与 README 的差异

[README.md](../README.md#L7-L9) 标注「仅实现 UI 框架，功能为占位符」，已滞后于实际代码：AI 对话核心、8 个本地工具、模型配置管理均已真实实现并可用。建议下次维护时同步更新 README。
