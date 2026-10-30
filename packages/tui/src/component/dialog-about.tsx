import { TextAttributes } from "@opentui/core"
import { createMemo, For } from "solid-js"
import { useConfig } from "../config"
import { useTuiApp } from "../context/runtime"
import { useTheme, useThemes } from "../context/theme"
import { DialogHeader, DialogLayout } from "../ui/dialog"

const UPSTREAM_URL = "https://github.com/anomalyco/opencode"
const REPO_URL = "https://github.com/yxpil/BrainTentacle_cli"

export function DialogAbout() {
  const app = useTuiApp()
  const config = useConfig().data
  const themes = useThemes()
  const theme = useTheme().surface("dialog")

  const rows = createMemo(() => [
    {
      label: "来历",
      value: `${app.name} ${app.version}（${app.channel}）：opencode 的修改版（fork），非官方发行`,
    },
    { label: "上游", value: `anomalyco/opencode · MIT License · ${UPSTREAM_URL}` },
    { label: "本版", value: REPO_URL },
    { label: "改动", value: "品牌与图标换成触手怪；新增 brain.* 设置；升级只看本版仓库的 Release" },
    { label: "数据", value: "只读桌面端 bit.db 的 config.theme，其余字段与凭据一律不读不写" },
    {
      label: "当前",
      value: `主题 ${themes.selected} / ${themes.mode()}${
        config.brain.theme_sync && !themes.locked() ? "（跟随桌面端）" : "（本地固定）"
      } · 审批 ${config.brain.approval}`,
    },
  ])

  return (
    <DialogLayout header={<DialogHeader title="About" />}>
      <box gap={1}>
        <text fg={theme.text.base} attributes={TextAttributes.BOLD}>
          BrainTentacle · 触手怪
        </text>
        <text fg={theme.text.muted} wrapMode="word">
          可自我扩展的工具型助手：在 opencode 之上接上自己的审批语义、隐藏指令与配色，并与桌面端共用同一份数据。
        </text>
        <For each={rows()}>
          {(row) => (
            <box flexDirection="row" gap={1}>
              <text flexShrink={0} fg={theme.text.muted}>
                {row.label}
              </text>
              <text fg={theme.text.base} wrapMode="word">
                {row.value}
              </text>
            </box>
          )}
        </For>
        <text fg={theme.text.muted}>/status 看运行状态 · /settings 改这些开关 · /update 检查本版 Release</text>
      </box>
    </DialogLayout>
  )
}
