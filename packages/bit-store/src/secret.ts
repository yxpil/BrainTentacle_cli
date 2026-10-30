// 敏感文档双层加密的 TS 实现，语义对齐 crates/bit-core/src/securefile.rs + osprotect.rs：
//   BLOB = [tag u8] + payload
//     tag=0 → payload 为原样字节（非 Windows，或 DPAPI 失败时的降级）
//     tag=1 → payload 为 DPAPI 密文（CurrentUser + 固定熵）
//   payload 若是 "BITENC1:..." 文本 → 设备密钥流加密（device_key 来自 config.json）
// 注意：device_key 为空时 bit-core 走明文单层，这里同样处理。
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { configPathIn } from "./paths.ts"

export const SECRET_PREFIX = "BITENC1:"
const SALT_LEN = 16
const MAC_LEN = 32
const ENTROPY = "BIT::osprotect::v1"

export function readDeviceKey(dataDir: string): string {
  try {
    const raw = fs.readFileSync(configPathIn(dataDir), "utf8")
    const cfg = JSON.parse(raw) as { device_key?: string | null }
    return typeof cfg.device_key === "string" ? cfg.device_key : ""
  } catch {
    return ""
  }
}

function keystreamBlock(key: string, salt: Buffer, ctr: number): Buffer {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(ctr >>> 0)
  return createHash("sha256").update(key, "utf8").update(salt).update(b).digest()
}

export function bitenc1Encrypt(key: string, plain: Buffer): string {
  const salt = randomBytes(SALT_LEN)
  const cipher = Buffer.alloc(plain.length)
  for (let i = 0; i < plain.length; i++) {
    const block = keystreamBlock(key, salt, Math.floor(i / 32))
    cipher[i] = plain[i] ^ block[i % 32]
  }
  const body = Buffer.concat([salt, cipher])
  const mac = createHmac("sha256", key).update(body).digest()
  return SECRET_PREFIX + Buffer.concat([body, mac]).toString("base64")
}

export function bitenc1Decrypt(key: string, blob: string): Buffer {
  if (!blob.startsWith(SECRET_PREFIX)) throw new Error("NotEncrypted")
  const buf = Buffer.from(blob.slice(SECRET_PREFIX.length), "base64")
  if (buf.length < SALT_LEN + MAC_LEN) throw new Error("TooShort")
  const body = buf.subarray(0, buf.length - MAC_LEN)
  const mac = buf.subarray(buf.length - MAC_LEN)
  const want = createHmac("sha256", key).update(body).digest()
  if (want.length !== mac.length || !timingSafeEqual(want, mac)) throw new Error("BadMac")
  const salt = body.subarray(0, SALT_LEN)
  const cipher = body.subarray(SALT_LEN)
  const plain = Buffer.alloc(cipher.length)
  for (let i = 0; i < cipher.length; i++) {
    const block = keystreamBlock(key, salt, Math.floor(i / 32))
    plain[i] = cipher[i] ^ block[i % 32]
  }
  return plain
}

function powershellBinary(): string {
  // Windows PowerShell 5.1 固定在系统目录；PATH 被裁剪时仍能解密敏感文档
  const root = process.env.SystemRoot ?? process.env.windir ?? "C:\\Windows"
  const full = path.join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
  return fs.existsSync(full) ? full : "powershell"
}

function powershell(script: string): void {
  execFileSync(powershellBinary(), ["-NoProfile", "-NonInteractive", "-Command", script], {
    stdio: "pipe",
    windowsHide: true,
  })
}

function dpapiCall(payload: Buffer, mode: "unprotect" | "protect"): Buffer {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bit-dpapi-"))
  const inFile = path.join(dir, "in.bin")
  const outFile = path.join(dir, "out.bin")
  fs.writeFileSync(inFile, payload)
  const q = (p: string) => p.replace(/'/g, "''")
  const body =
    mode === "unprotect"
      ? `[Security.Cryptography.ProtectedData]::Unprotect($in, $ent, [Security.Cryptography.DataProtectionScope]::CurrentUser)`
      : `[Security.Cryptography.ProtectedData]::Protect($in, $ent, [Security.Cryptography.DataProtectionScope]::CurrentUser)`
  try {
    powershell(
      `$ErrorActionPreference='Stop';` +
        `Add-Type -AssemblyName System.Security;` +
        `$in=[IO.File]::ReadAllBytes('${q(inFile)}');` +
        `$ent=[Text.Encoding]::ASCII.GetBytes('${ENTROPY}');` +
        `$out=${body};` +
        `[IO.File]::WriteAllBytes('${q(outFile)}',$out);`,
    )
    return fs.readFileSync(outFile)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

export function osProtect(plain: Buffer): Buffer {
  if (process.platform === "win32") {
    try {
      return Buffer.concat([Buffer.from([1]), dpapiCall(plain, "protect")])
    } catch {
      // 与 Rust 一致：DPAPI 失败降级单层，不阻断保存
    }
  }
  return Buffer.concat([Buffer.from([0]), plain])
}

export function osUnprotect(blob: Buffer): Buffer {
  if (blob.length === 0) throw new Error("EmptyBlob")
  const tag = blob[0]
  const payload = blob.subarray(1)
  if (tag === 0) return Buffer.from(payload)
  if (tag !== 1) throw new Error(`UnknownTag:${tag}`)
  if (process.platform !== "win32") {
    // DPAPI 密文绑定 Windows 当前用户，任何其他平台都无法解开
    throw new Error(
      `此 bit.db 的敏感文档由 Windows DPAPI 保护，无法在 ${process.platform} 上解密；请在原 Windows 账户下使用`,
    )
  }
  return dpapiCall(payload, "unprotect")
}

/// 读敏感文档的明文 JSON 字节：DPAPI 层 →（可选）BITENC1 层。
export function unsealSecret(blob: Buffer, deviceKey: string): Buffer {
  const inner = osUnprotect(blob)
  const text = inner.toString("utf8")
  if (!text.startsWith(SECRET_PREFIX)) return Buffer.from(inner)
  if (!deviceKey) throw new Error("BadMac: device_key missing but document is BITENC1-encrypted")
  return bitenc1Decrypt(deviceKey, text)
}

/// 写敏感文档：key 为空走单层明文，否则 BITENC1 → DPAPI（与 put_secret_json 一致）。
export function sealSecret(json: Buffer, deviceKey: string): Buffer {
  if (!deviceKey) return osProtect(json)
  return osProtect(Buffer.from(bitenc1Encrypt(deviceKey, json), "utf8"))
}
