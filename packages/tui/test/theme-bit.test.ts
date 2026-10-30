import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { bitHubDirectory, readBitTheme } from "../src/theme/bit"

async function database(data: Uint8Array) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "bit-theme-"))
  const db = new DatabaseSync(path.join(directory, "bit.db"))
  db.exec("create table documents (name text primary key, data blob)")
  db.prepare("insert into documents (name, data) values ('config', ?)").run(data)
  db.close()
  return directory
}

const json = (value: unknown) => Buffer.from(JSON.stringify(value))

test("reads the desktop app's theme mode from bit.db", async () => {
  const directory = await database(json({ theme: "dark", client_key: "not read" }))
  try {
    expect(readBitTheme(directory)).toBe("dark")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("accepts auto and ignores other or missing modes", async () => {
  const auto = await database(json({ theme: "auto" }))
  const other = await database(json({ theme: "blue", language: "zh" }))
  const missing = await database(json({ language: "zh" }))
  try {
    expect(readBitTheme(auto)).toBe("auto")
    expect(readBitTheme(other)).toBeUndefined()
    expect(readBitTheme(missing)).toBeUndefined()
  } finally {
    await Promise.all([auto, other, missing].map((dir) => rm(dir, { recursive: true, force: true })))
  }
})

test("stays silent when the config document is not plain JSON", async () => {
  const directory = await database(Buffer.from([0x00, 0x01, 0x02, 0x03]))
  try {
    expect(readBitTheme(directory)).toBeUndefined()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("stays silent when the desktop app was never installed", () => {
  expect(readBitTheme(path.join(os.tmpdir(), "no-such-bit-home"))).toBeUndefined()
})

test("points at the desktop app's data directory", () => {
  expect(bitHubDirectory().endsWith(path.join("com.bit.hub"))).toBe(true)
})
