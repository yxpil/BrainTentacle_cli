import { useConfig } from "../config"
import { resolveApproval } from "../util/bit"
import { useArgs } from "./args"
import { createSimpleContext } from "./helper"

export type PermissionMode = "prompt" | "autoaccept"

export const { use: usePermission, provider: PermissionProvider } = createSimpleContext({
  name: "Permission",
  init: () => {
    const args = useArgs()
    const config = useConfig()
    return {
      get mode(): PermissionMode {
        // --auto 是本次启动的显式让行；brain.approval 定在 ask/auto 时以本地设置为准，
        // inherit 才去读桌面端写在 bit.db 里的 tool_approval。
        if (args.auto) return "autoaccept"
        const approval = resolveApproval(config.data.brain.approval)
        if (approval === "auto") return "autoaccept"
        if (approval === "ask") return "prompt"
        // inherit 而桌面端没有数据时，回落到会话自己的默认
        return config.data.session.permissions
      },
    }
  },
})
