// audit 表：append-only 审计。CLI 的每个工具调用/审批都应落这里，桌面端「审计」页直接可见。
import type { SqliteDb } from "./sqlite.ts"
import type { AuditEntry } from "./types.ts"
import { nowTs } from "./sessions.ts"
import { randomUUID } from "node:crypto"

export const AUDIT_MAX = 2000

export class AuditRepo {
  private readonly db: SqliteDb

  constructor(db: SqliteDb) {
    this.db = db
  }

  record(actor: string, action: string, target: string, detail: unknown, ok = true): AuditEntry {
    const entry: AuditEntry = {
      id: randomUUID(),
      ts: nowTs(),
      actor,
      action,
      target,
      detail,
      ok,
    }
    this.db.run(
      "INSERT OR REPLACE INTO audit(id,ts,actor,action,target,detail,ok) VALUES(?,?,?,?,?,?,?)",
      [entry.id, entry.ts, entry.actor, entry.action, entry.target, JSON.stringify(entry.detail), ok ? 1 : 0],
    )
    this.db.run(
      `DELETE FROM audit WHERE rowid NOT IN (SELECT rowid FROM audit ORDER BY rowid DESC LIMIT ${AUDIT_MAX})`,
    )
    return entry
  }

  list(limit = 200): AuditEntry[] {
    return this.db
      .all<{ id: string; ts: string; actor: string; action: string; target: string; detail: string; ok: number }>(
        "SELECT id,ts,actor,action,target,detail,ok FROM audit ORDER BY rowid DESC LIMIT ?",
        [limit],
      )
      .map((r) => ({
        id: r.id,
        ts: r.ts,
        actor: r.actor,
        action: r.action,
        target: r.target,
        detail: safeParse(r.detail),
        ok: r.ok !== 0,
      }))
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
