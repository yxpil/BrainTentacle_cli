import os from "node:os"
import path from "node:path"

// 桌面端可能装在同一台机器上：TUI 测试不能看见真的 bit.db，否则主题与审批的默认值会随开发环境变化。
process.env.BIT_DATA_DIR ??= path.join(os.tmpdir(), "opencode-tui-test-no-bit-db")

import { NativeError, NativeStatus, OptimizedBuffer } from "@opentui/core"

// Workaround: OpenTUI's test renderer can read a frame while the native writer is still flushing
// output, which throws OutputBusy until the event loop runs. Frame reads poll, so fall back to the
// last frame read from the buffer. Remove once captureCharFrame waits for output idle upstream.
const frames = new WeakMap<OptimizedBuffer, Uint8Array>()
const getRealCharBytes = OptimizedBuffer.prototype.getRealCharBytes
OptimizedBuffer.prototype.getRealCharBytes = function (addLineBreaks) {
  try {
    const bytes = getRealCharBytes.call(this, addLineBreaks)
    frames.set(this, bytes)
    return bytes
  } catch (error) {
    if (!(error instanceof NativeError) || error.status !== NativeStatus.OutputBusy) throw error
    return frames.get(this) ?? new Uint8Array()
  }
}
