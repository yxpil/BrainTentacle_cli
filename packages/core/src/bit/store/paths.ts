// 数据目录规则：与 state::default_data_dir() 对齐（Windows APPDATA / macOS Application Support /
// Linux XDG_DATA_HOME），各平台环境变量缺失时回退到该平台的常规位置，保证 CLI 与桌面端读写同一个 bit.db。
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

function expandHome(raw: string): string {
  const s = raw.trim()
  if (s === "~") return os.homedir()
  if (s.startsWith("~/") || s.startsWith("~\\")) return path.join(os.homedir(), s.slice(2))
  return s
}

export function defaultDataDir(): string {
  const env = process.env.BIT_DATA_DIR?.trim()
  if (env) return path.resolve(expandHome(env))
  if (process.platform === "win32") {
    const appData = process.env.APPDATA?.trim()
    const base = appData !== undefined && appData !== "" ? appData : path.join(os.homedir(), "AppData", "Roaming")
    return path.join(base, "com.bit.hub")
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "com.bit.hub")
  }
  // XDG 规范：相对路径无效，忽略后用默认位置
  const xdg = process.env.XDG_DATA_HOME?.trim()
  const base = xdg !== undefined && path.isAbsolute(xdg) ? xdg : path.join(os.homedir(), ".local", "share")
  return path.join(base, "com.bit.hub")
}

/** 帮助/提示文本里的默认目录：按各平台习惯写法展示，不展开成绝对路径 */
export function defaultDataDirHint(): string {
  if (process.env.BIT_DATA_DIR?.trim()) return `$BIT_DATA_DIR（当前 ${defaultDataDir()}）`
  if (process.platform === "win32") return "%APPDATA%\\com.bit.hub"
  if (process.platform === "darwin") return "~/Library/Application Support/com.bit.hub"
  return "$XDG_DATA_HOME/com.bit.hub（默认 ~/.local/share/com.bit.hub）"
}

/** CLI/桌面端的数据目录候选：macOS 另找沙盒版桌面端的容器目录（有 bit.db 才算） */
export function dataDirCandidates(): string[] {
  const list = [defaultDataDir()]
  if (process.platform === "darwin") {
    list.push(
      path.join(
        os.homedir(),
        "Library",
        "Containers",
        "com.bit.hub",
        "Data",
        "Library",
        "Application Support",
        "com.bit.hub",
      ),
    )
  }
  return [...new Set(list)]
}

/** 真正使用的目录：显式 env 优先；否则第一个已有 bit.db 的候选，都没有则用平台默认 */
export function resolveDataDir(): string {
  if (process.env.BIT_DATA_DIR?.trim()) return defaultDataDir()
  for (const dir of dataDirCandidates()) {
    try {
      if (fs.statSync(path.join(dir, "bit.db")).isFile()) return dir
    } catch {
      // 候选不存在：继续
    }
  }
  return defaultDataDir()
}

export function dbPathIn(dataDir: string): string {
  return path.join(dataDir, "bit.db")
}

export function configPathIn(dataDir: string): string {
  return path.join(dataDir, "config.json")
}

export function toolhomesDir(dataDir: string): string {
  return path.join(dataDir, "toolhomes")
}

export function pluginsDir(dataDir: string): string {
  return path.join(toolhomesDir(dataDir), "plugins")
}
