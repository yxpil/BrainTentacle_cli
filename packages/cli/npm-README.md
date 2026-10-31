# BrainTentacle CLI（触手怪命令行）

BrainTentacle（BIT，触手怪）的终端界面与命令行工具。

**它是 [opencode](https://github.com/anomalyco/opencode) 的深度定制版**：品牌、图标、审批语义、配置键、升级渠道都换成了 BrainTentacle 自己的，同时保留 opencode 的 agent 循环、工具面与 TUI 骨架，以便继续跟得上上游。它**不是 opencode 官方发行版** —— 命令名、配置和更新地址都改了，BrainTentacle 的问题请提到 [yxpil/BrainTentacle_cli](https://github.com/yxpil/BrainTentacle_cli)，不要提到上游的 issue 区。上游许可证为 MIT，`LICENSE` 原样保留。

## 安装

```bash
npm install -g braintentacle_cli
```

装完得到两个等价命令：

```bash
braintentacle        # 完整名
bt                   # 简写
bt --version
```

安装时 `postinstall` 会按当前平台从下面 12 个可选依赖里挑一个真正的可执行文件并链接到位，所以 wrapper 本身只有几 KB：

| 平台 | 包 |
| --- | --- |
| Linux（glibc） | `braintentacle_cli-linux-{x64,x64-baseline,arm64}` |
| Linux（musl） | `braintentacle_cli-linux-{x64,x64-baseline,arm64}-musl` |
| macOS | `braintentacle_cli-darwin-{arm64,x64,x64-baseline}` |
| Windows | `braintentacle_cli-windows-{x64,x64-baseline,arm64}` |

x64 机器上会优先选 `-baseline`（不带 AVX2 也能跑）。

## 签名说明

macOS 产物是 **ad-hoc 签名**（没有 Apple Developer ID，也没有公证）。通过 npm 安装不触发 Gatekeeper，可以正常直接用；只有用浏览器把独立压缩包下载到本地时才会被拦。Windows 产物同样未签名，部分杀软会报可疑，属正常。

## 与桌面端联动

桌面端（Electron 版触手怪）在 [yxpil/BrainTentacle](https://github.com/yxpil/BrainTentacle)。两者不是各配一套，而是**共用桌面端那份 `bit.db`**：

- CLI 启动时从 `bit.db` 读**模型与密钥、MCP 服务器、审批策略、明暗主题**，所以桌面端配过一次，命令行里直接可用，不用再配 provider。
- 存储层实现在 `packages/core/src/bit/store`，与 Rust 侧的 `securefile.rs` / `osprotect.rs` 逐字节对齐（`tag=0` 明文 / `tag=1` DPAPI + 固定熵，内层可选 `BITENC1:` 设备密钥流 + HMAC）。
- 数据目录按桌面端规则解析：Windows `%APPDATA%\com.bit.hub`、macOS `~/Library/Application Support/com.bit.hub`、Linux `$XDG_DATA_HOME/com.bit.hub`，可用 `BIT_DATA_DIR` 覆盖；与桌面端同时打开时带 `busy_timeout=5000`。
- **只读优先**：CLI 不打印、不写回 `client_key` / `access_password`，也不写 `documents` 文档（桌面端是整文档覆盖写的单写者模型，写回会互相盖掉）。
- **审批默认跟随桌面端**：`brain.approval` 默认 `inherit`，取桌面端 `config.tool_approval`；只有 `allow_all` 算放行，读不到数据就回到 `ask`，绝不因读不到而放行。可用 `brain.approval: ask` / `auto` 本地钉死。
- **主题**默认跟随桌面端（`brain.theme_sync`）。
- 尚未接：`config.system_prompt` / `minimal_prompt`（系统提示接管）、`runtimes` + `skills`（解释器与技能注册）、隐藏码脱敏。

另外两个方向的联动也现成可用：

- **别的进程连 CLI**：`bt service start` 起后台服务后，会在 `~/.local/state/opencode/service.json`（权限 0600）写入 `{id, version, url, pid, password}`；HTTP Basic 用户名固定为 `opencode`，健康检查 `GET /api/info`，端口默认 `49374`（`local` 通道 `49375`）。`bt service status` 打印地址，任何客户端都能用全局 `--server <url>` 接到同一个服务、同一批会话上。
- **CLI 用桌面端的工具**：`bt mcp add --url <桌面端地址>/mcp` 可以把桌面端的 MCP 挂进来（需要桌面端开启远程访问并拿到 `client_key`）。

注意：桌面端目前在设置里只做「检测 / 安装 npm 全局 `braintentacle_cli`」，不会自动拉起 CLI；数据目录名仍是 `opencode`（本 fork 没有改名，见仓库 README）。

## 反馈

Issue：https://github.com/yxpil/BrainTentacle_cli/issues
