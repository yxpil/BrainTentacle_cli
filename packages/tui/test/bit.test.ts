import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { bitApproval, bitThemeMode } from "../src/util/bit"

async function database(config: Record<string, unknown>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bit-tui-"))
  const db = new DatabaseSync(path.join(dir, "bit.db"))
  db.exec("create table documents (name text primary key, data blob not null)")
  db.prepare("insert into documents (name, data) values ('config', ?)").run(Buffer.from(JSON.stringify(config), "utf8"))
  db.close()
  return dir
}

test("follows the desktop app's theme and approval", async () => {
  const dir = await database({ theme: "light", tool_approval: "allow_all" })
  try {
    expect(bitThemeMode(dir)).toBe("light")
    expect(bitApproval(dir)).toBe("auto")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("stays silent without a desktop install", () => {
  const missing = path.join(os.tmpdir(), "no-such-bit-home-tui")
  expect(bitThemeMode(missing)).toBeUndefined()
  expect(bitApproval(missing)).toBeUndefined()
})
