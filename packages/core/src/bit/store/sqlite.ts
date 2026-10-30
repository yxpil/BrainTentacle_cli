// SQLite 驱动薄封装：Node 用内置 node:sqlite，Bun 用 bun:sqlite。
// 不引原生依赖；两边 API 形状不同，这里统一成最小的同步接口。

import { createRequire } from "node:module"

export interface SqliteDb {
  readonly kind: "node" | "bun"
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[]
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined
  run(sql: string, params?: unknown[]): void
  exec(sql: string): void
  close(): void
}

export interface OpenOptions {
  readonly?: boolean
  /** 毫秒；多进程共享 bit.db 时必备（与 bit-core 的 5s 一致） */
  busyTimeoutMs?: number
}

const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined"
// ESM 下没有全局 require；Bun 里也能用 createRequire
const nodeRequire = createRequire(import.meta.url)

export function openSqlite(path: string, opts: OpenOptions = {}): SqliteDb {
  const db = isBun ? openBun(path, opts) : openNode(path, opts)
  try {
    db.exec(`PRAGMA busy_timeout = ${Math.max(1, Math.floor(opts.busyTimeoutMs ?? 5000))}`)
    if (!opts.readonly) db.exec("PRAGMA journal_mode = WAL")
  } catch {
    // 只读连接上设置 journal_mode 会被拒绝；busy_timeout 一般仍生效
  }
  return db
}

function openNode(path: string, opts: OpenOptions): SqliteDb {
  // 延迟 require：Bun 下没有 node:sqlite
  type NodeSqlite = {
    DatabaseSync: new (p: string, o?: { readOnly?: boolean }) => {
      prepare(sql: string): {
        all(...p: unknown[]): unknown[]
        get(...p: unknown[]): unknown
        run(...p: unknown[]): unknown
      }
      exec(sql: string): void
      close(): void
    }
  }
  const mod = nodeRequire("node:sqlite") as NodeSqlite
  const db = new mod.DatabaseSync(path, { readOnly: opts.readonly === true })
  return {
    kind: "node",
    all<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...params) as T[]
    },
    get<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).get(...params) as T | undefined
    },
    run(sql: string, params: unknown[] = []) {
      db.prepare(sql).run(...params)
    },
    exec(sql: string) {
      db.exec(sql)
    },
    close() {
      db.close()
    },
  }
}

function openBun(path: string, opts: OpenOptions): SqliteDb {
  type BunDb = {
    query(sql: string): {
      all(...p: unknown[]): unknown[]
      get(...p: unknown[]): unknown
      run(...p: unknown[]): unknown
    }
    exec(sql: string): void
    close(): void
  }
  type BunSqlite = { Database: new (p: string, o?: { readonly?: boolean; create?: boolean }) => BunDb }
  const { Database } = nodeRequire("bun:sqlite") as BunSqlite
  const db = new Database(path, { readonly: opts.readonly === true })
  return {
    kind: "bun",
    all<T>(sql: string, params: unknown[] = []) {
      return db.query(sql).all(...params) as T[]
    },
    get<T>(sql: string, params: unknown[] = []) {
      return db.query(sql).get(...params) as T | undefined
    },
    run(sql: string, params: unknown[] = []) {
      db.query(sql).run(...params)
    },
    exec(sql: string) {
      db.exec(sql)
    },
    close() {
      db.close()
    },
  }
}

export function isBusyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /SQLITE_BUSY|database is locked|SQLITE_LOCKED/i.test(msg)
}
