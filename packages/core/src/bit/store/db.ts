import { DocRepo } from "./docs.js"
import { openSqlite, type SqliteDb } from "./sqlite.js"
import { readDeviceKey } from "./secret.js"
import { dbPathIn, resolveDataDir } from "./paths.js"
import type { AiConfig, BitConfig, HiddenCodeEntry, McpServer, Memory, Provider, Skill, ToolDef } from "./types.js"

export type Runtime = { id: string; name?: string; command?: string; [key: string]: unknown }

/// 桌面端共用数据的只读门面：CLI 只用它取配置，永远不写回 documents。
/// documents 是"整文档覆盖写"的单写者模型，桌面端在跑的时候写回去就是互相盖。
export class BitDatabase {
  private readonly sql: SqliteDb
  readonly docs: DocRepo
  readonly dataDir: string

  private constructor(sql: SqliteDb, docs: DocRepo, dataDir: string) {
    this.sql = sql
    this.docs = docs
    this.dataDir = dataDir
  }

  /// 没有 bit.db（没装桌面端、或库被独占打不开）时返回 undefined，让调用方安静跳过。
  static open(dataDir?: string): BitDatabase | undefined {
    const dir = dataDir ?? resolveDataDir()
    const file = dbPathIn(dir)
    let sql: SqliteDb | undefined
    try {
      sql = openSqlite(file, { readonly: true })
      return new BitDatabase(sql, new DocRepo(sql, readKey(dir)), dir)
    } catch {
      try {
        sql?.close()
      } catch {}
      return undefined
    }
  }

  private list<T>(name: string): T[] {
    return this.docs.getJson<T[]>(name) ?? []
  }

  config(): BitConfig {
    return this.docs.getJson<BitConfig>("config") ?? {}
  }

  aiConfig(): AiConfig | undefined {
    // 桌面端把 provider 与 api key 封在 DPAPI(+BITENC1) 里；解不开就当作没配
    return this.docs.getSecretJson<AiConfig>("ai_config")
  }

  mcpServers(): McpServer[] {
    return this.docs.getSecretJson<McpServer[]>("mcp_servers") ?? []
  }

  hiddenCodes(): HiddenCodeEntry[] {
    return this.docs.getSecretJson<HiddenCodeEntry[]>("hidden_codes") ?? []
  }

  providers(): Provider[] {
    return this.aiConfig()?.providers ?? []
  }

  tools(): ToolDef[] {
    return this.list<ToolDef>("tools")
  }

  skills(): Skill[] {
    return this.list<Skill>("skills")
  }

  memories(): Memory[] {
    return this.list<Memory>("memories")
  }

  runtimes(): Runtime[] {
    return this.list<Runtime>("runtimes")
  }

  close(): void {
    try {
      this.sql.close()
    } catch {}
  }
}

function readKey(dataDir: string): string {
  try {
    // 设备密钥只在解 BITENC1 内层时用，绝不进入任何输出
    return readDeviceKey(dataDir)
  } catch {
    return ""
  }
}
