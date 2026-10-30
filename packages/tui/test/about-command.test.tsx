import { expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { Global } from "@opencode/util/global"
import { Effect, FileSystem } from "effect"
import { createEventStream, createFetch } from "./fixture/tui-client"
import { tmpdir } from "./fixture/fixture"
import { takeDraft } from "../src/component/prompt/draft-stash"

test("/about opens the fork identity dialog", async () => {
  takeDraft(undefined)
  await using state = await tmpdir()
  const setup = await createTestRenderer({ width: 120, height: 30, kittyKeyboard: true })
  await setup.renderer.setupTerminal()
  setup.renderer.start()
  const calls = createFetch(() => undefined, createEventStream())
  const server = Bun.serve({ port: 0, idleTimeout: 0, fetch: (request) => calls.fetch(request) })
  const { run } = await import("../src/app")
  const task = Effect.runPromise(
    run({
      app: { name: "braintentacle", version: "9.9.9", channel: "test" },
      server: { endpoint: { url: server.url.toString() } },
      config: {
        get: async () => ({ animations: false, tabs: { mode: "off" }, theme: { name: "braintentacle" } }),
        update: async () => ({}),
      },
      packages: { prepare: async () => ({ directory: "" }) },
      terminalHandoff: async () => ({ renderer: setup.renderer, mode: "dark", complete: () => {} }),
      args: {},
      log: () => {},
    }).pipe(Effect.provide(Global.layerWith({ state: state.path })), Effect.provide(FileSystem.layerNoop({}))),
  )

  try {
    await setup.waitForFrame((frame) => frame.includes("commands"))
    await setup.mockInput.typeText("/about")
    setup.mockInput.pressEnter()
    const opened = await setup.waitForFrame((value) => value.includes("anomalyco/opencode"))
    expect(opened).toContain("About")
    expect(opened).toContain("MIT License")
    expect(opened).toContain("9.9.9")
    expect(opened).toContain("fork")
    expect(opened).toContain("github.com/yxpil/BrainTentacle_cli")
    setup.mockInput.pressEscape()
    await setup.waitForFrame((value) => !value.includes("anomalyco/opencode"))
  } finally {
    setup.renderer.destroy()
    await task.finally(() => server.stop(true))
  }
})
