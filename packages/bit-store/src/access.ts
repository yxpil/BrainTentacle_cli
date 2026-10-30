// 跨应用访问 bit.db 的权限自检与申请指引。
// 桌面端与 CLI 是两个进程，操作系统可能禁止二者共用一个数据目录：
//   macOS → TCC（完全磁盘访问权限）；Linux → 目录属主/权限；Windows → 文件 ACL。
// 这里只做只读探测，不修改权限；macOS 会拉起「完全磁盘访问」设置页让用户授权。
import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { dbPathIn } from "./paths.ts"

export interface AccessReport {
  dataDir: string
  /** 目录存在且确实是目录 */
  exists: boolean
  readable: boolean
  writable: boolean
  dbExists: boolean
  dbReadable: boolean
  dbWritable: boolean
  /** 空串 = 可正常读写 */
  problem: string
}

export class DataAccessError extends Error {
  readonly report: AccessReport
  readonly hint: string
  constructor(report: AccessReport, hint: string) {
    super(`${report.problem}：${report.dataDir}`)
    this.name = "DataAccessError"
    this.report = report
    this.hint = hint
  }
}

function denyMsg(e: unknown): string {
  const err = e as NodeJS.ErrnoException
  return err?.code ?? (e instanceof Error ? e.message : String(e))
}

function can(p: string, mode: number): boolean {
  try {
    fs.accessSync(p, mode)
    return true
  } catch {
    return false
  }
}

export function probeDataDir(dataDir: string): AccessReport {
  const db = dbPathIn(dataDir)
  let isDir = false
  let statError = ""
  try {
    isDir = fs.statSync(dataDir).isDirectory()
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code !== "ENOENT") statError = denyMsg(e)
  }
  const dbExists = isDir && fs.existsSync(db)
  const readable = isDir && can(dataDir, fs.constants.R_OK | fs.constants.X_OK)
  const writable = isDir && can(dataDir, fs.constants.W_OK | fs.constants.X_OK)
  const dbReadable = dbExists && can(db, fs.constants.R_OK)
  const dbWritable = dbExists && can(db, fs.constants.W_OK)
  let problem = ""
  if (statError !== "") problem = `无法访问数据目录（${statError}）`
  else if (fs.existsSync(dataDir) && !isDir) problem = "数据目录路径被同名文件占用"
  else if (!isDir) problem = ""
  else if (!readable) problem = "没有数据目录的读取权限"
  else if (dbExists && !dbReadable) problem = "没有 bit.db 的读取权限"
  else if (dbExists && !dbWritable) problem = "没有 bit.db 的写入权限"
  else if (!writable) problem = "没有数据目录的写入权限（桌面端可能以更高权限运行）"
  return { dataDir, exists: isDir, readable, writable, dbExists, dbReadable, dbWritable, problem }
}

/** 按平台给出可执行的授权步骤（"申请"入口） */
export function accessHint(dataDir: string): string {
  const db = dbPathIn(dataDir)
  const exe = process.execPath
  if (process.platform === "darwin") {
    return [
      "macOS 把其它应用的数据当作受保护资源，需要给终端授权：",
      "  1. 系统设置 → 隐私与安全性 → 完全磁盘访问权限",
      "  2. 勾选启动本命令的终端（Terminal / iTerm / VS Code）或直接添加：",
      `     ${exe}`,
      "  3. 完全退出终端后重开，再运行 `bit access` 复查",
      `目标文件：${db}`,
      "提示：macOS 的弹窗只会在真正访问受保护目录时出现；没弹窗并不代表已授权。",
    ].join("\n")
  }
  if (process.platform === "win32") {
    const user = process.env.USERNAME ?? "%USERNAME%"
    return [
      "Windows 下两个进程共用 bit.db 需要文件 ACL 允许当前用户读写：",
      `  1. 右键 ${dataDir} → 属性 → 安全 → 编辑，给 ${user} 勾选「读取和执行 / 修改」`,
      "  2. 若桌面端以管理员身份运行、CLI 不是，请用同一权限级别启动",
      "  3. 仍失败时确认没有安全软件独占锁住 bit.db",
      `目标文件：${db}`,
    ].join("\n")
  }
  return [
    "Linux 下需要数据目录对当前用户可读写：",
    `  sudo chown -R "$USER" "${dataDir}"`,
    `  chmod u+rwx "${dataDir}" && chmod u+rw "${db}"`,
    `当前用户：${process.env.USER ?? "?"}，目标文件：${db}`,
  ].join("\n")
}

/** macOS：打开「完全磁盘访问权限」设置页。返回是否已发起打开动作。 */
export function openPrivacySettings(): boolean {
  if (process.platform !== "darwin") return false
  try {
    const child = spawn(
      "open",
      ["x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"],
      { stdio: "ignore", detached: true },
    )
    child.on("error", () => {})
    child.unref()
    return true
  } catch {
    return false
  }
}

/** 打开文件所在位置（Finder/资源管理器/xdg-open），便于用户就地改权限 */
export function revealInFileManager(target: string): boolean {
  const dir = path.dirname(target)
  try {
    const p =
      process.platform === "win32"
        ? spawn("explorer.exe", [dir], { stdio: "ignore", detached: true })
        : process.platform === "darwin"
          ? spawn("open", [dir], { stdio: "ignore", detached: true })
          : spawn("xdg-open", [dir], { stdio: "ignore", detached: true })
    p.on("error", () => {})
    p.unref()
    return true
  } catch {
    return false
  }
}
