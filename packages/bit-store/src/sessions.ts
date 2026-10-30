// sessions 表读写。语义以 crates/bit-core/src/store.rs::sync_sessions + session.rs::merge_from_disk 为准：
// - 一行一个会话，data 列是 Session JSON 原文
// - ord 决定稳定顺序；updated 是 "YYYY-MM-DD HH:MM:SS" 本地时间字符串，直接字符串比较
// - 每次写都要 bump meta.sessions_rev —— 桌面端靠它判断"磁盘变过没有"，不 bump 就会被它的整表覆盖吞掉
import type { Session } from "./types.ts"
import type { SqliteDb } from "./sqlite.ts"
import { isBusyError } from "./sqlite.ts"

export const TS_FORMAT = "%Y-%m-%d %H:%M:%S"

export function nowTs(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

interface SessionRow {
  id: string
  ord: number
  updated: string
  data: string
}

export class SessionRepo {
  private readonly db: SqliteDb

  constructor(db: SqliteDb) {
    this.db = db
  }

  rev(): number {
    const row = this.db.get<{ value: string }>("SELECT value FROM meta WHERE key='sessions_rev'")
    const n = Number(row?.value ?? 0)
    return Number.isFinite(n) ? Math.max(0, n) : 0
  }

  activeId(): string {
    return this.db.get<{ value: string }>("SELECT value FROM meta WHERE key='sessions_active'")?.value ?? ""
  }

  /** 读全部会话（ord 稳定序）。坏 JSON 单行跳过，不拖垮整表。 */
  loadAll(): Session[] {
    const rows = this.db.all<SessionRow>("SELECT id, ord, updated, data FROM sessions ORDER BY ord, id")
    const out: Session[] = []
    for (const r of rows) {
      try {
        out.push(JSON.parse(r.data) as Session)
      } catch {
        // 与 Rust 侧 filter_map 行为一致：跳过无法解析的行
      }
    }
    return out
  }

  get(id: string): Session | undefined {
    const row = this.db.get<SessionRow>("SELECT id, ord, updated, data FROM sessions WHERE id=?", [id])
    if (!row) return undefined
    try {
      return JSON.parse(row.data) as Session
    } catch {
      return undefined
    }
  }

  /** 单行 upsert。新会话追加到末尾；已有会话保留原 ord。 */
  upsert(session: Session): void {
    this.tx(() => {
      const max = this.db.get<{ m: number | null }>("SELECT MAX(ord) m FROM sessions")?.m ?? -1
      const existing = this.db.get<{ ord: number }>("SELECT ord FROM sessions WHERE id=?", [session.id])
      const ord = existing?.ord ?? Math.max(0, max + 1)
      this.writeRow(session, ord)
      this.bumpRev()
    })
  }

  /** 与 bit-core 的整仓覆盖一致：写全部 + 删多余 + 更新 active。调用方需先 mergeFromDisk。 */
  sync(sessions: Session[], active: string): void {
    this.tx(() => {
      const ids: string[] = []
      sessions.forEach((s, i) => {
        ids.push(s.id)
        this.writeRow(s, i)
      })
      if (ids.length === 0) {
        this.db.run("DELETE FROM sessions")
      } else {
        const ph = ids.map(() => "?").join(",")
        this.db.run(`DELETE FROM sessions WHERE id NOT IN (${ph})`, ids)
      }
      this.db.run(
        "INSERT INTO meta(key,value) VALUES('sessions_active',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [active],
      )
      this.bumpRev()
    })
  }

  delete(id: string): void {
    this.tx(() => {
      this.db.run("DELETE FROM sessions WHERE id=?", [id])
      this.bumpRev()
    })
  }

  setActive(id: string): void {
    this.tx(() => {
      this.db.run(
        "INSERT INTO meta(key,value) VALUES('sessions_active',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [id],
      )
    })
  }

  /**
   * 把磁盘上的会话并进内存副本（updated 新者胜，缺的补进来）。
   * prune=true 时反过来以磁盘为准裁掉已删除的会话 —— 对应 refresh_from_disk。
   * 返回是否有变化，调用方据此决定要不要重发 UI 刷新。
   */
  mergeInto(memory: Session[], prune = false): boolean {
    const disk = this.loadAll()
    const diskIds = new Set(disk.map((s) => s.id))
    let changed = false
    for (const d of disk) {
      const cur = memory.find((s) => s.id === d.id)
      if (!cur) {
        memory.push(d)
        changed = true
      } else if (d.updated > cur.updated) {
        const idx = memory.indexOf(cur)
        memory[idx] = d
        changed = true
      }
    }
    if (prune) {
      for (let i = memory.length - 1; i >= 0; i--) {
        if (!diskIds.has(memory[i].id)) {
          memory.splice(i, 1)
          changed = true
        }
      }
    }
    return changed
  }

  private writeRow(session: Session, ord: number): void {
    this.db.run(
      `INSERT INTO sessions(id, ord, updated, data) VALUES(?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET ord=excluded.ord, updated=excluded.updated, data=excluded.data`,
      [session.id, ord, session.updated, JSON.stringify(session)],
    )
  }

  private bumpRev(): void {
    this.db.run(
      `INSERT INTO meta(key,value) VALUES('sessions_rev','1')
       ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)`,
    )
  }

  private tx<T>(fn: () => T): T {
    for (let attempt = 0; ; attempt++) {
      try {
        this.db.exec("BEGIN IMMEDIATE")
        try {
          const out = fn()
          this.db.exec("COMMIT")
          return out
        } catch (err) {
          try {
            this.db.exec("ROLLBACK")
          } catch {
            // 连接可能已被 SQLite 自动回滚
          }
          throw err
        }
      } catch (err) {
        // 多进程共享：另一进程持有写锁时短暂退避重试（bit-core 是直接放弃，CLI 交互场景重试更友好）
        if (isBusyError(err) && attempt < 20) {
          sleepSync(50 * (attempt + 1))
          continue
        }
        throw err
      }
    }
  }
}

function sleepSync(ms: number): void {
  const buf = new Int32Array(new SharedArrayBuffer(4))
  Atomics.wait(buf, 0, 0, ms)
}

export function newSession(title: string, id?: string): Session {
  const ts = nowTs()
  return {
    id: id ?? randomId(),
    title: title.trim() || "新对话",
    created: ts,
    updated: ts,
    messages: [],
    favorite: false,
    color: "",
  }
}

function randomId(): string {
  // bit-core 用 uuid v4 simple（32 位十六进制，无连字符）
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}
