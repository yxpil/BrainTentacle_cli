# BrainTentacle CLI · 触手怪命令行

BrainTentacle（BIT，触手怪）的终端界面与命令行工具。它是 [opencode](https://github.com/anomalyco/opencode) 的**深度修改版**：品牌、图标、审批语义、配置键、升级渠道都换成了自己的，同时保留 opencode 的 agent 循环、工具面、TUI/桌面端骨架，以便继续跟得上上游。

在 TUI 里输入 `/about` 可以看到同一份身份说明。

## 原仓库说明（Upstream）

- 上游项目：**[anomalyco/opencode](https://github.com/anomalyco/opencode)**，许可证 **MIT**（`LICENSE`，Copyright (c) 2025 opencode）。本项目在代码上是它的 fork 改造，`LICENSE` 原样保留。
- 本仓库地址：**[yxpil/BrainTentacle_cli](https://github.com/yxpil/BrainTentacle_cli)**。
- **这不是 opencode 官方发行版**：命令名、配置、更新地址都改了；BrainTentacle 的问题请提到本仓库，不要提到上游的 issue 区。
- **它在 GitHub 里不是一个 network fork**（仓库是独立创建的，所以页面左上角不会有 "forked from" 标记）。上游关系只记录在这里和 `/about` 里，请以此为准。
- 桌面端（Electron 版触手怪）在 **[yxpil/BrainTentacle](https://github.com/yxpil/BrainTentacle)**。本 CLI **不**把桌面端的 `bit.db` 当作自己的数据库——只从中**只读**一个明暗主题字段，会话与配置仍写在 opencode 自己的目录下。真正与 `bit.db` 互通的是独立版命令行（本仓库的 `bit-cli` 分支）。
- 分支拓扑：
  | 分支 | 内容 |
  | --- | --- |
  | `main` | BrainTentacle 定制快照链（每个提交是一棵完整树，**不含上游历史**） |
  | `bit-cli` | 独立版命令行（直接读写 `bit.db` 的那一版），与本 CLI 是两套东西 |
- 上游基线：本 fork 从 `anomalyco/opencode` 的提交 **`304e835`** 拉出。注意这个哈希属于上游仓库，**不在 `main` 的谱系里**，所以 `git log` 克隆下来的 `main` 上看不到分叉点——带完整上游历史的开发分支（本地 `dev`）目前还没推上来。要对照上游，请直接去上游仓库看该提交，或先 `git remote add upstream https://github.com/anomalyco/opencode.git && git fetch --filter=blob:none upstream`（只取 commit/tree，不搬全部 blob）。

## 相对上游改了什么

| 方面 | BrainTentacle 的行为 |
| --- | --- |
| 品牌 | 所有面向用户的文案改成 BrainTentacle；命令名 `bt` / `braintentacle`（`opencode` 不再作为命令名出现） |
| 图标 | 全部由桌面端真实图标 `icon.ico` 转换而来：桌面图标、favicon、TUI 字符画 |
| 配置发现 | 先读 `braintentacle.json` / `braintentacle.jsonc`，仍兼容 `opencode.json(c)` |
| 新增设置 | `brain.approval`、`brain.hidden_codes`、`brain.theme_sync`（见下表） |
| 主题 | 内置 `braintentacle` 蓝色主题并成为 TUI 默认；异常回退仍是上游 `opencode` |
| 升级 | 版本来自本仓库 GitHub Releases 的 `latest`；`--method curl` 明确拒绝，因为它跑上游安装脚本会把定制覆盖回 stock opencode |
| 桌面端打包 | electron-builder 的 publish 从 `opencode.ai/update/...` 改成本仓库 GitHub Releases |
| 系统提示 | 开头声明身份，并写清自扩展路径（技能 / 插件 / MCP / 本机解释器）与审批语义 |

### `brain.*` 设置

| 键 | 取值 | 作用 |
| --- | --- | --- |
| `brain.approval` | `ask` \| `auto` | `ask` 每次写入都先确认；`auto` 放行策略未明确拒绝的调用。`--auto` 是本次启动的显式让行，优先于此 |
| `brain.hidden_codes` | `{ 键: 文本 }` | 整条输入命中键就展开成对应文本再发送（BIT 桌面端的隐藏指令语义） |
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

## 与桌面端数据的关系（务必读这段）

- 主题同步是**只读**的：只取 `bit.db` 的 `documents` 表里 `name='config'` 那一行的 `theme` 字段（Windows 上即 `%APPDATA%\com.bit.hub\bit.db`）。同一份文档还含 `client_key`、`access_password`、`device_key` 等凭据，代码不读取、不打印、不写回；`documents` 是单写者整文档模型，从 CLI 写回会覆盖桌面端设置。
- **审批模式不同步**。桌面端可能处于宽松审批，把它带进 CLI 等于开后门；CLI 的审批只看 `brain.approval` 与 `--auto`。
- 本 CLI 的会话与配置在自己的数据库里（`~/.local/share/opencode/opencode-local.db`），不写 `bit.db`，也不碰桌面端的加密文档（`ai_config`、`mcp_servers`、`hidden_codes`）。

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
