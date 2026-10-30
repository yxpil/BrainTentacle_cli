# BrainTentacle CLI · 触手怪命令行

BrainTentacle（BIT，触手怪）的终端界面与命令行工具。它是 [opencode](https://github.com/anomalyco/opencode) 的**深度修改版**：品牌、图标、审批语义、配置键、升级渠道都换成了自己的，同时保留 opencode 的 agent 循环、工具面、TUI/桌面端骨架，以便继续跟得上上游。

在 TUI 里输入 `/about` 可以看到同一份身份说明。

## 原仓库说明（Upstream）

- 上游项目：**[anomalyco/opencode](https://github.com/anomalyco/opencode)**，许可证 **MIT**（`LICENSE`，Copyright (c) 2025 opencode）。本项目在代码上是它的 fork 改造，`LICENSE` 原样保留。
- 本仓库地址：**[yxpil/BrainTentacle_cli](https://github.com/yxpil/BrainTentacle_cli)**。
- **这不是 opencode 官方发行版**：命令名、配置、更新地址都改了；BrainTentacle 的问题请提到本仓库，不要提到上游的 issue 区。
- **它在 GitHub 里不是一个 network fork**（仓库是独立创建的，所以页面左上角不会有 "forked from" 标记）。上游关系只记录在这里和 `/about` 里，请以此为准。
- 桌面端（Electron 版触手怪）在 **[yxpil/BrainTentacle](https://github.com/yxpil/BrainTentacle)**。本 CLI 的配置面**接在同一份 `bit.db` 上**，目标是"只配一次"：模型与 key、审批、技能、解释器、主题、语言都以桌面端的数据为准，不再维护一份平行的 opencode 配置。详见下面「与桌面端同源」。
- 分支拓扑：远端**只有 `main`**。
  | 位置 | 内容 |
  | --- | --- |
  | 远端 `main` | BrainTentacle 定制快照链（每个提交是一棵完整树，**不含上游历史**） |
  | 本地 `dev` | 同一批改动带上游完整历史的开发分支，目前没推上来 |

  早先那个直接读写 `bit.db` 的独立版命令行（自带 bit-engine 与 52 个测试）以前另开在 `bit-cli` 分支上，现在那条分支已从远端删除，代码只剩本地一份存档（`Desktop/OpenCode/bit-cli`，HEAD `1732357`）。要重新发布：`cd Desktop/OpenCode/bit-cli && git push origin HEAD:refs/heads/bit-cli`。它的**存储层**已经移植进本仓库（见下面「与桌面端同源」），**引擎层没有**——独立版用自研 agent 循环，这一版用 opencode 的。
- 上游基线：本 fork 从 `anomalyco/opencode` 的提交 **`304e835`** 拉出。注意这个哈希属于上游仓库，**不在 `main` 的谱系里**，所以 `git log` 克隆下来的 `main` 上看不到分叉点——带完整上游历史的开发分支（本地 `dev`）目前还没推上来。要对照上游，请直接去上游仓库看该提交，或先 `git remote add upstream https://github.com/anomalyco/opencode.git && git fetch --filter=blob:none upstream`（只取 commit/tree，不搬全部 blob）。

## 相对上游改了什么

| 方面 | BrainTentacle 的行为 |
| --- | --- |
| 品牌 | 所有面向用户的文案改成 BrainTentacle；命令名 `bt` / `braintentacle`（`opencode` 不再作为命令名出现） |
| 图标 | 全部由桌面端真实图标 `icon.ico` 转换而来：桌面图标、favicon、TUI 字符画 |
| 配置来源 | 模型与密钥、MCP、审批、主题读自桌面端的 `bit.db`；文件配置先读 `braintentacle.json` / `braintentacle.jsonc`，仍兼容 `opencode.json(c)` |
| 新增设置 | `brain.approval`、`brain.snippets`、`brain.theme_sync`（见下表） |
| 主题 | 内置 `braintentacle` 蓝色主题并成为 TUI 默认；异常回退仍是上游 `opencode` |
| 升级 | 版本来自本仓库 GitHub Releases 的 `latest`；`--method curl` 明确拒绝，因为它跑上游安装脚本会把定制覆盖回 stock opencode |
| 桌面端打包 | electron-builder 的 publish 从 `opencode.ai/update/...` 改成本仓库 GitHub Releases |
| 系统提示 | 开头声明身份，并写清自扩展路径（技能 / 插件 / MCP / 本机解释器）与审批语义 |

### `brain.*` 设置

| 键 | 取值 | 作用 |
| --- | --- | --- |
| `brain.approval` | `inherit` \| `ask` \| `auto` | 默认 `inherit`：跟随桌面端 `config.tool_approval`（只有 `allow_all` 算放行；读不到数据时回到 ask，绝不因为读不到就放行）。`ask` / `auto` 是本地钉死；`--auto` 只影响本次启动 |
| `brain.snippets` | `{ 键: 文本 }` | 整条输入命中键就展开成对应文本再发送（本 CLI 自己的快捷指令，不是桌面端的隐藏码） |
| `brain.theme_sync` | `true` \| `false` | 未锁定 Color mode 时，跟随桌面端写在 `bit.db` 里的明暗主题 |

```jsonc
// 配置与数据仍在 `~/.config/opencode/`、`~/.local/share/opencode/` 这些上游目录下
// （本 fork 没有改名数据目录，只有 `bit.db` 的 theme 字段是从桌面端数据里只读来的）。
// TUI 设置写在 `~/.config/opencode/cli.json`，项目级配置读 `braintentacle.json(c)`，兼容 `opencode.json(c)`。
{
  "theme": { "name": "braintentacle", "mode": "system" },
  "brain": {
    "approval": "ask",
    "hidden_codes": { "rr": "review the diff and point out risk" },
    "theme_sync": true
  }
}
```

`bt debug paths` 会打印这台机器上的实际路径。

## 与桌面端同源（bit.db）

存储层已经搬进来：`packages/core/src/bit/store`（从上面那个独立版移植过来的同一份实现，逐字节对齐 Rust 的 `securefile.rs` + `osprotect.rs`：`tag=0` 明文 / `tag=1` DPAPI CurrentUser + 固定熵，内层可选 `BITENC1:` 设备密钥流 + HMAC）。数据目录按桌面端规则解析（Windows `%APPDATA%\com.bit.hub`、macOS `~/Library/Application Support`、Linux `$XDG_DATA_HOME`，可用 `BIT_DATA_DIR` 覆盖），共享同一个库时带 `busy_timeout=5000`。

本机 `bit.db` 实测（只看编码和形状，值不落文档）：

| documents | 实测编码 | 内容 |
| --- | --- | --- |
| `config` | 明文 JSON，53 键 | `theme`、`language`、`tool_approval`、`system_prompt`、`custom_prompt`、`minimal_prompt`、`workspace_root`、`default_shell`、`hidden_code_enabled`、`revision`；同一行里还有 `client_key`、`access_password` |
| `ai_config` | DPAPI 单层（这台机器 `device_key` 为 `null`，所以没有 `BITENC1` 内层） | `providers[]`：`protocol=openai` + `base_url` + `api_key` + `model` + `active`，另有 `reasoning_effort`、`temperature`、`model_context` |
| `tools` | **明文 JSON 数组**（首字节 `[`，并未加密） | 21 个 `kind=builtin` 工具；这台机器上**没有** `mcp` / `remote` 条目 |
| `runtimes` | 明文 JSON 数组 | 7 个解释器：Node.js、Python、Bun、PowerShell、Java、Rust、C# |
| `skills` / `memories` | 明文 JSON 数组 | 各 1 条 |
| `mcp_servers` / `hidden_codes` | **这个版本没有这两个文档** | MCP 类工具挂在 `tools[].kind = { kind: "mcp" \| "remote" }` 上；隐藏指令只有 `config.hidden_code_enabled` 开关 |

**已接好**（注入点在 `packages/core/src/config.ts` 的 entries 组装里，排在 wellknown 之后、本机与项目配置之前，所以显式配置永远盖得住）：

- `ai_config.providers` → `providers.<id>`（`settings.baseURL` / `settings.apiKey` / `models`），`active` 那条同时成为默认模型
- `mcp_servers` → `mcp.servers`（`stdio` → local，`http` → remote；缺 command 或 url 的条目跳过）
- `config.theme` → 明暗模式；`config.tool_approval` → 审批默认值

实测（这台机器装着桌面端）：`bt models --standalone` 里出现 `bit-api-inference-modelscope-cn/…` 与 `bit-deepseek/deepseek-flash`；`bt run` 不带 `-m` 时，落库的 `session_message` 是 `bit-api-inference-modelscope-cn / Qwen/Qwen3.8-Flash-Next`，正是 `ai_config` 里 `active: true` 那条。整个过程中 `~/.config/opencode` 下没配过任何 provider 或密钥。

**还没接**：`config.system_prompt` / `minimal_prompt`（系统提示接管）、`runtimes` + `skills`（解释器与技能注册）、隐藏码脱敏（桌面端把 `hidden_codes` 用作敏感值 → 别名的替换表，CLI 要接的是同一套替换，而不是我自己那个 `brain.snippets`）。

同源不等于没有底线：

- **只读优先**。`documents` 没有 rev 列，是"整文档覆盖写"的单写者模型，CLI 写回会和桌面端互相盖掉；`config` 行里装着 `client_key`、`access_password`，只按白名单取用需要的键，其余不读、不打印、不写回。
- **凭据只进不出**：`ai_config` 解密后喂给 opencode 的 provider 配置，不写回 `bit.db`，也不进任何日志或会话记录。
- **审批不被静默放开**。桌面端的 `tool_approval` 想作为 CLI 默认值，必须走显式的 `brain.approval: inherit`，`/status` 与 `/about` 会写出当前审批来自哪里；环境变量不再是放行通道。

## 快速开始

要求 [Bun](https://bun.sh) `1.4.4`（`packageManager` 已锁）。

```bash
bun install
bun run dev            # = bun run --cwd packages/cli src/index.ts，直接起 TUI
bun run dev -- --help  # 命令行入口是 bt / braintentacle
```

发布渠道还没接上：本仓库目前没有任何 Release，所以 `bt upgrade` 会如实回答"这个仓库还没有发布版本"，不会偷偷去装上游。要真正能升级，需要在这个仓库打 tag 并挂上各平台产物。

## 开发

多包 workspace，改动最常落在这几个：

```
packages/cli        命令入口、服务、升级器（updater.ts 读我们的 Releases）
packages/tui        终端界面、主题、配置、审批；bt mini 也在这
packages/core       会话/工具/模型请求、配置发现、系统提示
packages/app        网页与桌面端渲染层（i18n、设置页）
packages/desktop    Electron 打包与安装器
packages/ui         设计系统与主题（含应用端主题名）
packages/theme      主题 schema 与解析
packages/plugin     插件与技能 API
```

```bash
bun run typecheck                          # turbo 全量；单包用下面这条更快
bun run --cwd packages/tui typecheck
bun run --cwd packages/tui test            # 注意：测试脚本带 --timeout 30000
bun test --cwd packages/cli test/updater-install.test.ts
bun run lint
```

根目录的 `test` 脚本是故意失败的（`do not run tests from root`）——测试要按包跑。

### Windows 上的已知环境性失败

不是回归，只是本机环境：

- 插件/watcher 类测试要建符号链接，没开开发者模式时报 `EPERM`
- 临时目录清理偶发 `EBUSY: resource locked`
- 子进程类测试必须用仓库脚本的 30s 超时；用默认 5s 会跑出假失败
- 这份 checkout 是 blobless + sparse 克隆：仓库里 43 个 git 符号链接（`packages/app/public/*`、`packages/app/src/custom-elements.d.ts` 等）在 Windows 上被物化成了文本桩，`packages/app` / `packages/desktop` 的 typecheck 因此在本地会报 `TS1128`，与本次改动无关

## 许可

MIT，随上游 `LICENSE` 一并保留。上游版权：Copyright (c) 2025 opencode。
