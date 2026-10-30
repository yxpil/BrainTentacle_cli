import os from "node:os"
import path from "node:path"

// 桌面端可能装在同一台机器上：测试不能看见真的 bit.db，否则 Config 的条目数会随开发环境变化。
// BIT_DATA_DIR 与桌面端共用同一个约定，这里指向一个不存在的目录，等价于"没有桌面端"。
process.env.BIT_DATA_DIR ??= path.join(os.tmpdir(), "opencode-core-test-no-bit-db")
process.env.OPENCODE_DB = ":memory:"
process.env.NPM_CONFIG_AUDIT = "false"
