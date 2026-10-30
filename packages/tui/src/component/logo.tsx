import { RGBA, TextAttributes } from "@opentui/core"
import { For, type JSX } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "../context/theme"
import { logo } from "../logo"

export function Logo() {
  const theme = useTheme()
  const dimensions = useTerminalDimensions()

  const renderLine = (line: string, fg: RGBA, bold: boolean): JSX.Element[] => {
    const attrs = bold ? TextAttributes.BOLD : undefined
    return Array.from(line).map((char) => (
      <text fg={fg} attributes={attrs} selectable={false}>
        {char}
      </text>
    ))
  }

  // 图标字符画的每一行都以全角块字符为主，逐字符上色只为保留“可选中=false”的语义。
  // 高度也必须参与选择：大图标 19 行，80x24 的终端里会挤掉输入框和模型状态。
  const art = () => {
    const { width, height } = dimensions()
    if (width >= 44 && height >= 30) return logo.large
    if (width >= 36 && height >= 22) return logo.medium
    if (width >= 22 && height >= 18) return logo.small
    return undefined
  }

  return (
    <box>
      {art() ? (
        <For each={art()}>{(line) => <box flexDirection="row">{renderLine(line, theme.text.base, true)}</box>}</For>
      ) : null}
    </box>
  )
}
