import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { readBitSettings } from "../src/bit/config"

/// 敏感文档的信封：tag=0 是明文单层（osprotect.rs 的非 Windows / 降级分支）。
/// 测试不能依赖 DPAPI，否则换台机器或换个用户就跑不动。
const plain = (value: unknown) => Buffer.concat([Buffer.from([0]), bytes(value)])
/// documents 里的普通文档没有信封，直接就是 JSON 字节
const json = (value: unknown) => bytes(value)
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8")

async function database(rows: Record<string, Buffer>, tables = true) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bit-shared-"))
  const db = new DatabaseSync(path.join(dir, "bit.db"))
  if (tables) db.exec("create table documents (name text primary key, data blob not null)")
  else db.exec("create table other (id text)")
  for (const [name, data] of Object.entries(rows)) db.prepare("insert into documents (name, data) values (?, ?)").run(name, data)
  db.close()
  return dir
}

const providers = [
  {
    id: "p1",
    name: "DeepSeek",
    protocol: "openai",
    base_url: "https://api.deepseek.com/v1",
    api_key: "sk-ds",
    model: "deepseek-flash",
    models: ["deepseek-flash"],
    active: true,
  },
]

test("reads models, keys, MCP, theme and approval from a shared bit.db", async () => {
  const dir = await database({
    config: json({ theme: "dark", language: "zh", tool_approval: "allow_all", system_prompt: "你是触手怪", revision: 41 }),
    ai_config: plain({ providers }),
    mcp_servers: plain([{ id: "linear", name: "Linear", transport: "http", url: "https://mcp.linear.app/sse", enabled: true }]),
    hidden_codes: plain([{ id: "rr", kind: "value", label: "custom", value: "review" }]),
  })
  try {
    const settings = readBitSettings(dir)
    expect(settings?.theme).toBe("dark")
    expect(settings?.approval).toBe("auto")
    expect(settings?.systemPrompt).toBe("你是触手怪")
    expect(settings?.hiddenCodes).toEqual(["rr"])
    expect(Object.keys(settings?.document?.providers ?? {})).toEqual(["bit-deepseek"])
    expect(settings?.document?.model).toEqual({ providerID: "bit-deepseek", model: "deepseek-flash" })
    expect(Object.keys(settings?.document?.mcp?.servers ?? {})).toEqual(["linear"])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("treats anything but an explicit allow_all as ask", async () => {
  const dir = await database({
    config: json({ theme: "light", tool_approval: "approve" }),
    ai_config: plain({ providers }),
  })
  try {
    const settings = readBitSettings(dir)
    expect(settings?.theme).toBe("light")
    expect(settings?.approval).toBe("ask")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("keeps working when the shared data is missing or unreadable", async () => {
  const noTable = await database({}, false)
  const garbage = await database({ config: Buffer.from([0, 1, 2, 3]), ai_config: Buffer.from([9]) })
  try {
    expect(readBitSettings(path.join(noTable, "absent"))).toBeUndefined()
    // config 行坏掉时整个共用配置按不存在处理；provider 密文解不开时只丢 provider，不连带丢主题
    expect(readBitSettings(garbage)?.theme).toBeUndefined()
    expect(readBitSettings(garbage)?.document).toBeUndefined()
  } finally {
    await Promise.all([noTable, garbage].map((dir) => rm(dir, { recursive: true, force: true })))
  }
})
