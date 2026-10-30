// BIT 落库结构的 TS 镜像。字段名/可选性与 crates/bit-core 一一对应，改一边必须改另一边。

/// ai.rs ChatMessage：会话里的一条消息（扁平结构，工具调用/思考过程挂在同一条上）
export interface ChatMessage {
  role: "user" | "assistant" | "system" | string
  content: string
  tool_calls?: ToolCallRecord[]
  thinking?: string
  ts?: string
  diagram?: unknown
}

export interface ToolCallRecord {
  tool: string
  params: unknown
  ok: boolean
  result: unknown
}

/// session.rs Session：sessions 表一行的 data 列
export interface Session {
  id: string
  title: string
  created: string
  updated: string
  messages: ChatMessage[]
  favorite: boolean
  color: string
}

/// memory.rs Memory / Skill
export interface Memory {
  id: string
  ts: string
  kind: "raw" | "summary" | string
  content: string
  source: string
}

export interface Skill {
  id: string
  ts: string
  name: string
  summary: string
  source: string
}

/// registry.rs ToolDef：kind 是带 tag 的联合
export type ToolKind =
  | { kind: "builtin"; handler: string }
  | { kind: "remote"; url: string }
  | { kind: "script"; code: string }
  | { kind: "interpreter"; runtime: string; code: string }
  | { kind: "mcp"; server_id: string; tool: string }

export interface ToolDef {
  id: string
  name: string
  description: string
  parameters: unknown
  kind: ToolKind
  created_by: string
  created_at: string
  enabled: boolean
}

/// ai.rs AiConfig（敏感文档 ai_config，双层加密）
export interface Provider {
  name?: string
  protocol?: string
  base_url?: string
  api_key?: string
  model?: string
  models?: string[]
  active?: boolean
  [k: string]: unknown
}

export interface AiConfig {
  providers: Provider[]
  reasoning_effort?: string
  temperature?: number | null
  model_context?: Record<string, number>
  max_output_tokens?: number | null
}

/// config.rs Config 中 CLI 需要的那部分（全量文档在 documents/config）
export interface BitConfig {
  custom_prompt?: string
  system_prompt?: string
  minimal_prompt?: boolean
  disabled_plugins?: string[]
  workspace_root?: string | null
  tool_timeout_secs?: number
  remote_enabled?: boolean
  hidden_code_enabled?: boolean
  host?: string
  port?: number
  [k: string]: unknown
}

/// hidden_code.rs HiddenCodeEntry（敏感文档 hidden_codes）
export interface HiddenCodeEntry {
  id: string
  /** value = 精确值条目；pattern = 正则条目 */
  kind: "value" | "pattern" | string
  /** phone | email | apikey | username | custom（展示用） */
  label: string
  /** value 条目 = 敏感原文；pattern 条目 = "builtin:phone" 等 */
  value: string
  /** 别名（仅 value 条目）：非空时 AI 看到别名而非 [HC:xxx] 占位符 */
  alias?: string
  enabled: boolean
  created: string
}

/// plugins.rs：toolhomes/plugins/<id>/plugin.json
export interface PluginTool {
  name: string
  description?: string
  parameters?: unknown
  kind?: "interpreter" | "script"
  runtime?: string
  code?: string
  file?: string
}

export interface PluginSkill {
  name: string
  summary?: string
}

export interface PluginJob {
  name: string
  schedule: string
  runtime?: string
  code?: string
  file?: string
  session?: string
}

export interface Plugin {
  id: string
  name: string
  version?: string
  description?: string
  tools?: PluginTool[]
  prompts?: string[]
  skills?: PluginSkill[]
  memories?: string[]
  jobs?: PluginJob[]
}

/// mcp.rs：已接入的 MCP 服务器（敏感文档 mcp_servers，双层加密）
export type McpTransport = "http" | "stdio"

export interface McpServer {
  id: string
  name: string
  url?: string
  transport?: McpTransport
  command?: string
  args?: string[]
  env?: Record<string, string>
  version?: string
  protocol?: string
  session?: string
  enabled?: boolean
  connected_at?: string
}

export interface McpTool {
  name: string
  description?: string
  input_schema?: unknown
}

/// audit.rs AuditEntry（audit 表）
export interface AuditEntry {
  id: string
  ts: string
  actor: string
  action: string
  target: string
  detail: unknown
  ok: boolean
}

/// goal.rs：goals 表
export interface Goal {
  id: string
  ts: string
  updated_ts: string
  title: string
  detail: string
  status: "active" | "achieved" | "abandoned" | string
  source: string
  session_id: string | null
}

/// goals 配套的 todos 表
export interface Todo {
  id: string
  ts: string
  goal_id: string | null
  content: string
  status: "pending" | "in_progress" | "completed" | string
  source: string
  session_id: string | null
}
