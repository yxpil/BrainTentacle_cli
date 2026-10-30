// bit-store 冒烟：真实库只读探测 + 临时库写入/合并/审计/加密回环
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { BitStore, accessHint, defaultDataDir, defaultDataDirHint, probeDataDir } from "../src/index.ts"
import { newSession, nowTs } from "../src/sessions.ts"
import { bitenc1Decrypt, bitenc1Encrypt, osProtect, osUnprotect, sealSecret, unsealSecret } from "../src/secret.ts"

const realDir = defaultDataDir()

console.log("── A. 真实数据只读 ──")
if (fs.existsSync(path.join(realDir, "bit.db"))) {
  const st = new BitStore({ dataDir: realDir, readonly: true })
  const sessions = st.sessions.loadAll()
  console.log("sessions:", sessions.length, "active:", st.sessions.activeId(), "rev:", st.sessions.rev())
  const cfg = st.config()
  console.log("config:", {
    custom_prompt: cfg.custom_prompt?.length ?? 0,
    system_prompt: cfg.system_prompt?.length ?? 0,
    minimal_prompt: cfg.minimal_prompt,
    disabled_plugins: cfg.disabled_plugins?.length ?? 0,
  })
  const ai = st.aiConfig()
  console.log(
    "providers:",
    ai?.providers?.map((p) => `${p.name ?? "?"}/${p.protocol ?? "?"}/${p.model ?? "?"}`).join(", ") ?? "(none)",
  )
  console.log("memories:", st.memories().length, "skills:", st.skills().length, "tools:", st.tools().length)
  console.log("mcp:", st.mcpServers().length, "hidden_codes:", st.hiddenCodes().length, "audit:", st.audit.list(1).length)
  if (sessions[0]) {
    const s = st.sessions.get(sessions[0].id)!
    console.log("session[0]:", { id: s.id.slice(0, 8), title: s.title, msgs: s.messages.length, updated: s.updated })
  }
  st.close()
} else {
  console.log("skip: 本机没有 com.bit.hub")
}

console.log("── B. 临时库读写 ──")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bit-store-"))
const st = new BitStore({ dataDir: tmp })
assert.equal(st.sessions.loadAll().length, 0)
assert.equal(st.sessions.rev(), 0)

const s1 = newSession("第一条")
st.sessions.upsert(s1)
assert.equal(st.sessions.rev(), 1)
assert.equal(st.sessions.loadAll().length, 1)

s1.messages.push({ role: "user", content: "你好", ts: nowTs() })
s1.updated = nowTs(new Date(Date.now() + 1000))
st.sessions.upsert(s1)
assert.equal(st.sessions.rev(), 2)
assert.equal(st.sessions.get(s1.id)?.messages.length, 1)

const memory: typeof s1[] = [s1]
const incoming = { ...s1, updated: nowTs(new Date(Date.now() + 5000)), title: "被外部改名" }
st.sessions.upsert(incoming)
assert.equal(st.sessions.mergeInto(memory), true, "更新的外部会话应合并进来")
assert.equal(memory[0].title, "被外部改名")

st.sessions.delete(s1.id)
assert.equal(st.sessions.rev(), 4)
assert.equal(st.sessions.loadAll().length, 0)
assert.equal(st.sessions.mergeInto(memory, true), true, "prune 应清掉磁盘上已删除的会话")
assert.equal(memory.length, 0)

const a = st.audit.record("cli", "tool.invoke", "shell", { cmd: "echo hi" }, true)
assert.equal(st.audit.list(10)[0].id, a.id)
assert.equal(st.audit.list(10)[0].detail && (st.audit.list(10)[0].detail as { cmd: string }).cmd, "echo hi")

// documents
st.docs.putJson("memories", [{ id: "1", ts: nowTs(), kind: "raw", content: "hi", source: "cli" }])
assert.equal(st.memories().length, 1)
st.docs.del("memories")
assert.equal(st.memories().length, 0)

// 加密回环：单层（无 device_key）与双层（有 device_key）
const plain = Buffer.from(JSON.stringify({ providers: [{ name: "p", api_key: "sk-test" }] }))
assert.deepEqual(JSON.parse(osUnprotect(osProtect(plain)).toString()), JSON.parse(plain.toString()))
assert.deepEqual(JSON.parse(unsealSecret(osProtect(plain), "").toString()), JSON.parse(plain.toString()))

const key = "device-key-for-test"
const sealed = sealSecret(plain, key)
assert.deepEqual(JSON.parse(unsealSecret(sealed, key).toString()), JSON.parse(plain.toString()))
assert.throws(() => unsealSecret(sealed, "wrong-key"), /BadMac/)
const inner = bitenc1Encrypt(key, plain)
assert.deepEqual(bitenc1Decrypt(key, inner), plain)

console.log("── C. 数据目录规则（跨平台） ──")
{
  const prev = process.env.BIT_DATA_DIR
  process.env.BIT_DATA_DIR = path.join(tmp, "custom")
  assert.equal(defaultDataDir(), path.resolve(path.join(tmp, "custom")), "BIT_DATA_DIR 覆盖")
  process.env.BIT_DATA_DIR = "~/bit-data-test"
  assert.equal(defaultDataDir(), path.join(os.homedir(), "bit-data-test"), "~ 展开")
  delete process.env.BIT_DATA_DIR
  const d = defaultDataDir()
  assert.ok(path.isAbsolute(d), "默认目录必须是绝对路径")
  assert.ok(d.endsWith("com.bit.hub"), `默认目录以 com.bit.hub 结尾：${d}`)
  assert.ok(defaultDataDirHint().length > 0)
  // 相对 dataDir 在构造时就绝对化，避免 REPL 里 cwd 漂移
  const rel = "bit-rel-test"
  const st2 = new BitStore({ dataDir: rel })
  assert.equal(st2.dataDir, path.resolve(rel))
  st2.close()
  fs.rmSync(path.resolve(rel), { recursive: true, force: true })
  if (prev !== undefined) process.env.BIT_DATA_DIR = prev

  // 跨应用权限探测：正常目录无问题，同名文件占位必须给出可执行提示
  assert.equal(probeDataDir(path.join(tmp, "nope")).problem, "", "不存在的目录首次会创建，不算故障")
  assert.equal(probeDataDir(tmp).problem, "")
  const blocked = path.join(tmp, "not-a-dir")
  fs.writeFileSync(blocked, "x")
  const rep = probeDataDir(blocked)
  assert.ok(rep.problem.includes("同名文件"), rep.problem)
  assert.throws(() => new BitStore({ dataDir: blocked }), /数据目录路径被同名文件占用/)
  assert.ok(accessHint(blocked).length > 0, "权限提示不能为空")
}

st.close()
fs.rmSync(tmp, { recursive: true, force: true })
console.log("── 全部通过 ──")
