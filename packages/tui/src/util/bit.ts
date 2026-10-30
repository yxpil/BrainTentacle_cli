import { readBitSettings } from "@opencode/core/bit/config"

// 桌面端写在共用 bit.db 里的设置，TUI 这边只按需取用；core 的桥负责白名单与解密，
// 同一份文档里的 client_key、access_password 之类的凭据不会从这里流出去。
export function bitThemeMode(dataDir?: string): "dark" | "light" | undefined {
  const theme = readBitSettings(dataDir)?.theme
  return theme === "dark" || theme === "light" ? theme : undefined
}

/// 桌面端 tool_approval 的审批语义；没有桌面端数据时返回 undefined，让本地设置说话。
export function bitApproval(dataDir?: string): "ask" | "auto" | undefined {
  return readBitSettings(dataDir)?.approval
}

export type ApprovalSetting = "ask" | "auto" | "inherit"

/// 设置里的 inherit 表示"以桌面端为准"；桌面端没数据时返回 undefined，
/// 让 session.permissions 这些既有默认继续说话——读不到东西绝不等于可以放行。
export function resolveApproval(setting: ApprovalSetting): "ask" | "auto" | undefined {
  return setting === "inherit" ? bitApproval() : setting
}

export function approvalFromDesktop(setting: ApprovalSetting) {
  return setting === "inherit" && bitApproval() !== undefined
}
