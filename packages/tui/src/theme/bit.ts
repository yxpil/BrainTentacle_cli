import { existsSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import path from "node:path"
import os from "node:os"

export type BitTheme = "dark" | "light" | "auto"

// 桌面端把主题存在共用数据库的 documents.config 里；同一份文档还有 client_key、access_password 这类凭据，
// 所以这里只取 theme 一个字段，其余内容不读、不打印、也不写回。
export function readBitTheme(directory = bitHubDirectory()): BitTheme | undefined {
  const file = path.join(directory, "bit.db")
  if (!existsSync(file)) return
  let db: DatabaseSync | undefined
  try {
    db = new DatabaseSync(file, { readOnly: true })
    const row = db.prepare("select data from documents where name = 'config'").get() as { data?: unknown } | undefined
    const raw = row?.data instanceof Uint8Array ? Buffer.from(row.data).toString("utf8") : undefined
    if (!raw) return
    const theme: unknown = JSON.parse(raw).theme
    return theme === "dark" || theme === "light" || theme === "auto" ? theme : undefined
  } catch {
    return undefined
  } finally {
    db?.close()
  }
}

export function bitHubDirectory() {
  return path.join(
    process.platform === "win32"
      ? process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming")
      : process.platform === "darwin"
        ? path.join(os.homedir(), "Library", "Application Support")
        : process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"),
    "com.bit.hub",
  )
}
