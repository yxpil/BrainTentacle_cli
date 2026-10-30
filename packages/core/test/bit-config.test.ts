import { expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { Info } from "@opencode/schema/config"
import { bitDocument, mcpEntries, providerEntry } from "../src/bit/config"

const decodeInfo = Schema.decodeUnknownOption(Info, { errors: "all", onExcessProperty: "ignore" })

const openai = {
  id: "cb290b81",
  name: "https://api-inference.modelscope.cn/v1/",
  protocol: "openai",
  base_url: "https://api-inference.modelscope.cn/v1",
  api_key: "sk-test-value",
  model: "Qwen/Qwen3.8-Flash-Next",
  models: ["Qwen/Qwen3.8-Flash-Next", "Qwen/Other"],
  active: true,
}

test("maps a BIT provider onto an opencode openai-compatible entry", () => {
  const entry = providerEntry(openai)
  expect(entry?.package).toBe("@opencode/ai/providers/openai-compatible")
  expect(entry?.settings).toEqual({ baseURL: "https://api-inference.modelscope.cn/v1", apiKey: "sk-test-value" })
  // name 是 URL 时取主机名，模型名去掉供应商前缀里的目录部分
  expect(entry?.name).toBe("api-inference.modelscope.cn")
  expect(Object.keys(entry?.models ?? {})).toEqual(["Qwen/Qwen3.8-Flash-Next", "Qwen/Other"])
  expect(entry?.models["Qwen/Qwen3.8-Flash-Next"]).toEqual({ modelID: "Qwen/Qwen3.8-Flash-Next", name: "Qwen3.8-Flash-Next" })
})

test("keeps an explicit provider name and drops unknown protocols", () => {
  expect(providerEntry({ ...openai, name: "DeepSeek", base_url: "https://api.deepseek.com/v1" })?.name).toBe("DeepSeek")
  expect(providerEntry({ ...openai, protocol: "gemini" })).toBeUndefined()
  expect(providerEntry({ ...openai, base_url: undefined })).toBeUndefined()
})

test("injects providers, the active model, and MCP servers as one document", () => {
  const document = bitDocument({
    ai: {
      providers: [
        openai,
        { ...openai, id: "2", name: "DeepSeek", protocol: "openai", base_url: "https://api.deepseek.com/v1", model: "deepseek-flash", active: false },
      ],
    },
    mcpServers: [
      { id: "linear", name: "Linear", transport: "http", url: "https://mcp.linear.app/sse", enabled: true },
      { id: "fs", name: "FS", transport: "stdio", command: "npx", args: ["-y", "server"], env: { TOKEN: "x" } },
      { id: "off", name: "Off", url: "https://example.test", enabled: false },
      { id: "broken", name: "Broken", transport: "stdio" },
    ],
  })
  expect(Object.keys(document?.providers ?? {})).toEqual(["bit-api-inference-modelscope-cn", "bit-deepseek"])
  expect(document?.model).toEqual({ providerID: "bit-api-inference-modelscope-cn", model: "Qwen/Qwen3.8-Flash-Next" })
  expect(document?.mcp?.servers?.linear).toEqual({ type: "remote", url: "https://mcp.linear.app/sse" })
  expect(document?.mcp?.servers?.fs).toEqual({
    type: "local",
    command: ["npx", "-y", "server"],
    environment: { TOKEN: "x" },
  })
  expect(document?.mcp?.servers?.off).toBeUndefined()
  expect(document?.mcp?.servers?.broken).toBeUndefined()
})

test("names providers by host and falls back to the key when two share a name", () => {
  const document = bitDocument({
    ai: {
      providers: [
        { ...openai, name: "same", base_url: "https://a.example.test/v1" },
        { ...openai, name: "same", base_url: "https://b.example.test/v1", active: false },
      ],
    },
  })
  expect(Object.keys(document?.providers ?? {})).toEqual(["bit-same", "bit-same-b-example-test-v1"])
})

test("returns nothing when there is nothing usable to share", () => {
  expect(bitDocument({ ai: { providers: [{ ...openai, protocol: "mystery" }] } })).toBeUndefined()
  expect(bitDocument({})).toBeUndefined()
  expect(mcpEntries([])).toEqual({})
})

test("the injected document survives opencode's real config schema", () => {
  const document = bitDocument({
    ai: { providers: [openai] },
    mcpServers: [{ id: "linear", name: "Linear", transport: "http", url: "https://mcp.linear.app/sse" }],
  })
  // 配置层拿到的是 JSON 文本，所以这里也走一遍同样的形状
  const info = Option.getOrUndefined(decodeInfo(JSON.parse(JSON.stringify(document))))
  const injected = info?.providers?.["bit-api-inference-modelscope-cn"]
  expect(injected?.package).toBe("@opencode/ai/providers/openai-compatible")
  expect(Object.keys(injected?.models ?? {})).toEqual(["Qwen/Qwen3.8-Flash-Next", "Qwen/Other"])
  // providerID / model 是 branded string，断言时按运行时的真实值比较
  expect(String(info?.model?.providerID)).toBe("bit-api-inference-modelscope-cn")
  expect(String(info?.model?.model)).toBe("Qwen/Qwen3.8-Flash-Next")
  expect((info?.mcp?.servers as any)?.linear?.url).toBe("https://mcp.linear.app/sse")
})

test("a settings document with nothing to share never reaches the schema", () => {
  expect(bitDocument({ ai: { providers: [] } })).toBeUndefined()
})
