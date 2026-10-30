import { BitDatabase } from "./store/db.js"
import { resolveDataDir } from "./store/paths.js"
import type { AiConfig, McpServer } from "./store/types.js"

// BrainTentacle 与桌面端共用一份配置：模型、密钥、MCP 从 bit.db 读出来，注入成 opencode
// 的一张配置文档。它排在用户与项目自己的配置文件之下，所以显式配置永远能盖住这里。
// documents.config 同一行里还装着 client_key / access_password，只按白名单取键。
export const BIT_CONFIG_SOURCE = "bit.db"

const OPENAI_COMPATIBLE = "@opencode/ai/providers/openai-compatible"
const ANTHROPIC = "@opencode/ai/providers/anthropic"

// 认不出的协议不注入，免得把一个跑不通的 provider 塞进模型列表。
const PROTOCOL_PACKAGES: Record<string, string> = {
  openai: OPENAI_COMPATIBLE,
  "openai-compatible": OPENAI_COMPATIBLE,
  anthropic: ANTHROPIC,
  claude: ANTHROPIC,
}

export type BitApproval = "ask" | "auto"

export type BitDocument = {
  providers?: Record<string, Record<string, unknown>>
  model?: { providerID: string; model: string }
  mcp?: { servers?: Record<string, Record<string, unknown>> }
}

export type BitSettings = {
  readonly document: BitDocument | undefined
  readonly theme?: "dark" | "light" | "auto"
  readonly approval?: BitApproval
  readonly systemPrompt?: string
  readonly customPrompt?: string
  readonly minimalPrompt?: boolean
  readonly workspaceRoot?: string
  readonly hiddenCodeEnabled?: boolean
  readonly hiddenCodes?: readonly string[]
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "provider"
  )
}

function label(provider: AiConfig["providers"][number], baseURL: string) {
  const name = provider.name?.trim()
  // BIT 里 provider 的 name 常常就是端点 URL，取主机名当展示名
  if (name && !/^https?:\/\//i.test(name)) return name
  try {
    return new URL(baseURL).hostname
  } catch {
    return name || baseURL
  }
}

/** BIT 的一条 provider → opencode 的 provider 配置条目。 */
export function providerEntry(provider: AiConfig["providers"][number]) {
  const baseURL = provider.base_url?.trim()
  const pkg = PROTOCOL_PACKAGES[(provider.protocol ?? "").toLowerCase()]
  if (!baseURL || !pkg) return undefined
  const ids = [provider.model, ...(provider.models ?? [])].filter((id): id is string => Boolean(id))
  return {
    name: label(provider, baseURL),
    package: pkg,
    // opencode 的 openai-compatible 用驼峰键；BIT 用下划线
    settings: { baseURL, ...(provider.api_key ? { apiKey: provider.api_key } : {}) },
    models: Object.fromEntries(
      [...new Set(ids)].map((id) => [id, { modelID: id, name: id.split("/").pop() ?? id }]),
    ),
    model: provider.model,
    active: provider.active,
  }
}

/** 桌面端的 MCP 服务器 → opencode 的 mcp.servers；stdio 缺 command、remote 缺 url 的跳过。 */
export function mcpEntries(servers: readonly McpServer[]) {
  const entries: Record<string, Record<string, unknown>> = {}
  for (const server of servers) {
    if (server.enabled === false) continue
    const id = slug(server.id || server.name)
    if (server.transport === "stdio" || (!server.url && server.command)) {
      if (!server.command) continue
      entries[id] = {
        type: "local",
        command: [server.command, ...(server.args ?? [])],
        ...(server.env && Object.keys(server.env).length ? { environment: server.env } : {}),
      }
      continue
    }
    if (!server.url) continue
    entries[id] = {
      type: "remote",
      url: server.url,
      ...(server.env && Object.keys(server.env).length ? { headers: server.env } : {}),
    }
  }
  return entries
}

export function bitDocument(input: { ai?: AiConfig; mcpServers?: readonly McpServer[] }): BitDocument | undefined {
  const providers: Record<string, Record<string, unknown>> = {}
  let model: BitDocument["model"]
  for (const provider of input.ai?.providers ?? []) {
    const entry = providerEntry(provider)
    if (!entry) continue
    const base = `bit-${slug(entry.name)}`
    const id = providers[base] ? `${base}-${slug(entry.settings.baseURL)}` : base
    providers[id] = {
      name: `${entry.name} (BIT)`,
      package: entry.package,
      settings: entry.settings,
      ...(Object.keys(entry.models).length ? { models: entry.models } : {}),
    }
    if (entry.active !== false && entry.model && !model) model = { providerID: id, model: entry.model }
  }
  const servers = mcpEntries(input.mcpServers ?? [])
  if (!Object.keys(providers).length && !Object.keys(servers).length) return undefined
  return {
    ...(Object.keys(providers).length ? { providers } : {}),
    ...(model ? { model } : {}),
    ...(Object.keys(servers).length ? { mcp: { servers } } : {}),
  }
}

// 桌面端把审批收成一个值：只有明确的全量放行才继承，其余一律回到 ask
function approval(value: unknown): BitApproval | undefined {
  return value === "allow_all" ? "auto" : value === "ask" || value === "approve" ? "ask" : undefined
}

function text(value: unknown) {
  return typeof value === "string" && value !== "" ? value : undefined
}

/// 没装桌面端、库被独占、文档解不开，都按"没有共用配置"处理：CLI 必须能独立起来。
/// 结果按 dataDir 缓存一小段时间：解密 ai_config 可能要起一次 PowerShell（DPAPI），
/// 而配置层会随文件监听反复重载，不能让每次重载都去开库和 spawn 进程。
const TTL = 15_000
const cache = new Map<string, { at: number; settings: BitSettings | undefined }>()

export function readBitSettings(dataDir?: string, refresh = false): BitSettings | undefined {
  // 按解析后的目录缓存：BIT_DATA_DIR 变了就是另一份数据，测试与并存的安装都不能复用旧结果
  const key = dataDir ?? resolveDataDir()
  const hit = cache.get(key)
  if (hit && !refresh && Date.now() - hit.at < TTL) return hit.settings
  const settings = load(key)
  cache.set(key, { at: Date.now(), settings })
  return settings
}

function load(dataDir: string): BitSettings | undefined {
  const db = BitDatabase.open(dataDir)
  if (!db) return undefined
  try {
    const config = db.config() as Record<string, unknown>
    const theme = config.theme === "dark" || config.theme === "light" || config.theme === "auto" ? config.theme : undefined
    const codes = db.hiddenCodes().map((entry) => entry.id).filter(Boolean)
    return {
      document: bitDocument({ ai: db.aiConfig(), mcpServers: db.mcpServers() }),
      theme,
      approval: approval(config.tool_approval),
      systemPrompt: text(config.system_prompt),
      customPrompt: text(config.custom_prompt),
      minimalPrompt: typeof config.minimal_prompt === "boolean" ? config.minimal_prompt : undefined,
      workspaceRoot: text(config.workspace_root),
      hiddenCodeEnabled: typeof config.hidden_code_enabled === "boolean" ? config.hidden_code_enabled : undefined,
      ...(codes.length ? { hiddenCodes: codes } : {}),
    }
  } catch {
    return undefined
  } finally {
    db.close()
  }
}
