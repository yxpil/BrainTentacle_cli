// 建表语句与 store.rs::open 完全一致（IF NOT EXISTS，与桌面端互为幂等）。
// CLI 可能先于桌面端启动，必须能自己把库建出来。
import type { SqliteDb } from "./sqlite.ts"

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS documents(
    name TEXT PRIMARY KEY,
    data BLOB NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS sessions(
    id TEXT PRIMARY KEY,
    ord INTEGER NOT NULL,
    updated TEXT NOT NULL,
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta(
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS goals(
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL DEFAULT '',
    updated_ts TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    source TEXT NOT NULL DEFAULT '',
    session_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_goals_session ON goals(session_id);
CREATE TABLE IF NOT EXISTS todos(
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL DEFAULT '',
    goal_id TEXT,
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT '',
    session_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_todos_goal ON todos(goal_id);
CREATE INDEX IF NOT EXISTS idx_todos_session ON todos(session_id);
CREATE TABLE IF NOT EXISTS audit(
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    detail TEXT NOT NULL,
    ok INTEGER NOT NULL DEFAULT 1
);
`

export function ensureSchema(db: SqliteDb): void {
  db.exec(SCHEMA_SQL)
}
