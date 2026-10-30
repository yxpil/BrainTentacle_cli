// BitStore：CLI 侧的 bit.db 门面。只读模式用于"桌面端正在跑"的探测与预览；
// 读写模式用于 CLI 自有会话的落库。
import path from "node:path"
import fs from "node:fs"
import { openSqlite, type SqliteDb } from "./sqlite.ts"
import { dbPathIn, resolveDataDir } from "./paths.ts"
import { accessHint, DataAccessError, probeDataDir } from "./access.ts"
import { readDeviceKey } from "./secret.ts"
import { ensureSchema } from "./schema.ts"
import { DocRepo } from "./docs.ts"
import { SessionRepo } from "./sessions.ts"
import { AuditRepo } from "./audit.ts"
import type { AiConfig, BitConfig, Goal, HiddenCodeEntry, McpServer, Memory, Skill, Todo, ToolDef } from "./types.ts"

export interface BitStoreOptions {
  dataDir?: string
  readonly?: boolean
}

export class BitStore {
  readonly dataDir: string
  readonly dbPath: string
  readonly deviceKey: string
  readonly sessions: SessionRepo
  readonly docs: DocRepo
  readonly audit: AuditRepo
  /** 行级表（goals / todos）直连：业务规则在各自包里，这里只提供连接 */
  readonly sql: SqliteDb
  private readonly readonlyMode: boolean

  constructor(opts: BitStoreOptions = {}) {
    this.dataDir = path.resolve(opts.dataDir ?? resolveDataDir())
    this.dbPath = dbPathIn(this.dataDir)
    this.readonlyMode = opts.readonly === true

    // 跨应用访问：先探测权限，直接给出可执行的授权指引，而不是抛 SQLITE_CANTOPEN
    const pre = probeDataDir(this.dataDir)
    const blocked =
      pre.problem !== "" &&
      (pre.exists === false || !pre.readable || (pre.dbExists && !pre.dbReadable) || (!this.readonlyMode && !pre.writable))
    if (blocked) throw new DataAccessError(pre, accessHint(this.dataDir))

    try {
      if (!this.readonlyMode) fs.mkdirSync(this.dataDir, { recursive: true })
      this.sql = openSqlite(this.dbPath, { readonly: this.readonlyMode, busyTimeoutMs: 5000 })
    } catch (e) {
      const after = probeDataDir(this.dataDir)
      const msg = e instanceof Error ? e.message : String(e)
      if (after.problem !== "" || /EACCES|EPERM|unable to open database file|SQLITE_CANTOPEN/i.test(msg)) {
        throw new DataAccessError(
          { ...after, problem: after.problem !== "" ? after.problem : `无法打开 bit.db（${msg}）` },
          accessHint(this.dataDir),
        )
      }
      throw e
    }
    if (!this.readonlyMode) ensureSchema(this.sql)
    this.deviceKey = readDeviceKey(this.dataDir)
    this.sessions = new SessionRepo(this.sql)
    this.docs = new DocRepo(this.sql, this.deviceKey)
    this.audit = new AuditRepo(this.sql)
  }

  get readonly(): boolean {
    return this.readonlyMode
  }

  // ── 常用文档的强类型读取 ──────────────────────────────
  config(): BitConfig {
    return this.docs.getJson<BitConfig>("config") ?? {}
  }

  aiConfig(): AiConfig | undefined {
    return this.docs.getSecretJson<AiConfig>("ai_config")
  }

  mcpServers(): McpServer[] {
    return this.docs.getSecretJson<McpServer[]>("mcp_servers") ?? []
  }

  hiddenCodes(): HiddenCodeEntry[] {
    return this.docs.getSecretJson<HiddenCodeEntry[]>("hidden_codes") ?? []
  }

  memories(): Memory[] {
    return this.docs.getJson<Memory[]>("memories") ?? []
  }

  skills(): Skill[] {
    return this.docs.getJson<Skill[]>("skills") ?? []
  }

  tools(): ToolDef[] {
    return this.docs.getJson<ToolDef[]>("tools") ?? []
  }

  goals(): Goal[] {
    return this.sql.all<Goal>("SELECT * FROM goals ORDER BY rowid")
  }

  todos(): Todo[] {
    return this.sql.all<Todo>("SELECT * FROM todos ORDER BY rowid")
  }

  close(): void {
    this.sql.close()
  }
}

export { defaultDataDir, defaultDataDirHint, dbPathIn, dataDirCandidates, resolveDataDir } from "./paths.ts"
export {
  accessHint,
  DataAccessError,
  openPrivacySettings,
  probeDataDir,
  revealInFileManager,
  type AccessReport,
} from "./access.ts"
export * from "./types.ts"
export { nowTs, newSession } from "./sessions.ts"
