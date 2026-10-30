import { useConfig } from "../config"
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
        // --auto 是本次启动的显式让行；否则以 brain.approval（BIT 的审批模式）覆盖会话默认值。
        if (args.auto) return "autoaccept"
        if (config.data.brain.approval === "auto") return "autoaccept"
        if (config.data.brain.approval === "ask") return "prompt"
        return config.data.session.permissions
      },
    }
  },
})
