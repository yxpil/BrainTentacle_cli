import { TextAttributes } from "@opentui/core"
import { useTheme, useThemes } from "../context/theme"
import { DialogHeader, DialogLayout } from "../ui/dialog"
import { useData } from "../context/data"
import { useConfig } from "../config"
import { approvalFromDesktop, resolveApproval } from "../util/bit"
import { For, Match, Switch, Show, createMemo } from "solid-js"

export function DialogStatus() {
  const data = useData()
  const config = useConfig().data
  const theme = useTheme().surface("dialog")
  const themes = useThemes()

  // 审批的实际生效值：inherit 时看桌面端写在 bit.db 的 tool_approval，没有数据就回到 ask
  const inherited = createMemo(() => approvalFromDesktop(config.brain.approval))
  const approval = createMemo(() => resolveApproval(config.brain.approval) ?? "ask")

  const mcp = createMemo(() => data.location.mcp.server.list() ?? [])
  const color = (status: string) => {
    if (status === "connected") return theme.text.feedback.success.base
    if (status === "failed") return theme.text.feedback.error.base
    if (status === "needs_auth") return theme.text.feedback.warning.base
    return theme.text.muted
  }
  return (
    <DialogLayout header={<DialogHeader title="Status" />}>
      <box gap={0}>
        <text fg={theme.text.base} attributes={TextAttributes.BOLD}>
          BrainTentacle
        </text>
        <text fg={theme.text.muted}>
          审批 {approval()}
          {inherited() ? "（继承桌面端）" : ""} · 快捷指令 {Object.keys(config.brain.snippets).length} 条
        </text>
        <text fg={theme.text.muted}>自扩展：技能 / 插件 / MCP / 本机解释器</text>
        <text fg={theme.text.muted}>
          主题 {themes.selected} / {themes.mode()}
          {config.brain.theme_sync && !themes.locked() ? " · 跟随桌面端" : " · 本地固定"}
        </text>
      </box>
      <Show when={mcp().length > 0} fallback={<text fg={theme.text.base}>No MCP servers</text>}>
        <box>
          <text fg={theme.text.base}>
            {mcp().length} MCP server{mcp().length === 1 ? "" : "s"}
          </text>
          <For each={mcp()}>
            {(item) => (
              <box flexDirection="row" gap={1}>
                <text flexShrink={0} style={{ fg: color(item.status.status) }}>
                  •
                </text>
                <text fg={theme.text.base} wrapMode="word">
                  <b>{item.name}</b>{" "}
                  <span style={{ fg: theme.text.muted }}>
                    <Switch fallback={item.status.status}>
                      <Match when={item.status.status === "connected"}>Connected</Match>
                      <Match when={item.status.status === "failed" && item.status}>{(val) => val().error}</Match>
                      <Match when={item.status.status === "disabled"}>Disabled in configuration</Match>
                      <Match when={item.status.status === "needs_auth" && item.status}>
                        {(val) => `Needs authentication: ${val().error}`}
                      </Match>
                    </Switch>
                  </span>
                </text>
              </box>
            )}
          </For>
        </box>
      </Show>
    </DialogLayout>
  )
}
