// documents 表：普通文档（明文 JSON）与敏感文档（双层加密）。
// 语义对齐 store.rs 的 get/put/get_json/put_json/get_secret_json/put_secret_json。
import type { SqliteDb } from "./sqlite.ts"
import { sealSecret, unsealSecret } from "./secret.ts"

export class DocRepo {
  private readonly db: SqliteDb
  private readonly deviceKey: string

  constructor(db: SqliteDb, deviceKey: string) {
    this.db = db
    this.deviceKey = deviceKey
  }

  names(): string[] {
    return this.db.all<{ name: string }>("SELECT name FROM documents ORDER BY name").map((r) => r.name)
  }

  get(name: string): Uint8Array | undefined {
    const row = this.db.get<{ data: Uint8Array }>("SELECT data FROM documents WHERE name=?", [name])
    return row?.data
  }

  getJson<T>(name: string): T | undefined {
    const raw = this.get(name)
    if (!raw) return undefined
    try {
      return JSON.parse(Buffer.from(raw).toString("utf8")) as T
    } catch {
      return undefined
    }
  }

  /** 整文档覆盖写。documents 没有 rev 列，多进程同时写 = 后写者赢。 */
  put(name: string, data: Uint8Array): void {
    this.db.run(
      `INSERT INTO documents(name, data) VALUES(?,?)
       ON CONFLICT(name) DO UPDATE SET data=excluded.data, updated_at=datetime('now','localtime')`,
      [name, data],
    )
  }

  putJson(name: string, value: unknown): void {
    this.put(name, Buffer.from(JSON.stringify(value), "utf8"))
  }

  del(name: string): void {
    this.db.run("DELETE FROM documents WHERE name=?", [name])
  }

  getSecretJson<T>(name: string): T | undefined {
    const raw = this.get(name)
    if (!raw) return undefined
    try {
      return JSON.parse(unsealSecret(Buffer.from(raw), this.deviceKey).toString("utf8")) as T
    } catch (err) {
      // 与 Rust 一致：解不开就是 None（跨机拷贝 / 密钥不符 / 篡改）
      return undefined
    }
  }

  putSecretJson(name: string, value: unknown): void {
    this.put(name, sealSecret(Buffer.from(JSON.stringify(value), "utf8"), this.deviceKey))
  }
}
