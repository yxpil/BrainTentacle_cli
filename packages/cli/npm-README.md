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

## 与桌面端的关系

BrainTentacle 桌面端在 [yxpil/BrainTentacle](https://github.com/yxpil/BrainTentacle)。本 CLI 自带后台服务（`bt service start` / `bt serve`），任何进程都能用全局 `--server <url>` 连到同一个服务上；桌面端与本 CLI 的进一步联动仍在开发中，尚未在此版本落地。

## 反馈

Issue：https://github.com/yxpil/BrainTentacle_cli/issues
