/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { ConfigProvider } from "../../src/config"
import { DialogAbout } from "../../src/component/dialog-about"
import { Keymap } from "../../src/context/keymap"
import { TuiAppProvider } from "../../src/context/runtime"
import { ThemeProvider } from "../../src/context/theme"
import { DialogProvider } from "../../src/ui/dialog"
import { ToastProvider } from "../../src/ui/toast"
import { emptyThemeSource, tmpdir } from "../fixture/fixture"
import { TestTuiContexts } from "../fixture/tui-environment"
import { createTuiResolvedConfig } from "../fixture/tui-runtime"

test("about names opencode as the forked base and points at this build's repo", async () => {
  await using temporary = await tmpdir()
  const app = await testRender(
    () => (
      <TestTuiContexts directory={temporary.path} paths={{ state: temporary.path }}>
        <TuiAppProvider value={{ name: "braintentacle", version: "1.2.3", channel: "test" }}>
          <ConfigProvider config={createTuiResolvedConfig()}>
            <ThemeProvider mode="dark" source={emptyThemeSource}>
              <Keymap.Provider>
                <ToastProvider>
                  <DialogProvider>
                    <DialogAbout />
                  </DialogProvider>
                </ToastProvider>
              </Keymap.Provider>
            </ThemeProvider>
          </ConfigProvider>
        </TuiAppProvider>
      </TestTuiContexts>
    ),
    { width: 80, height: 26, kittyKeyboard: true },
  )

  try {
    app.renderer.start()
    const frame = await app.waitForFrame((value) => value.includes("About"))
    expect(frame).toContain("1.2.3")
    expect(frame).toContain("fork")
    expect(frame).toContain("anomalyco/opencode")
    expect(frame).toContain("MIT License")
    expect(frame).toContain("github.com/yxpil/BrainTentacle_cli")
  } finally {
    app.renderer.destroy()
  }
})
