// npm 发布用的包名。workspace 内部仍叫 @opencode/cli，否则 bun 的 workspace 依赖解析会断；
// 只有 dist/ 里生成的发布产物换成 BrainTentacle 的名字。
// 平台包名必须保留结尾的 -<platform>-<arch>[-baseline][-musl]：postinstall.mjs 按后缀挑选运行平台。
export const npmName = "braintentacle_cli"
export const npmPrefix = `${npmName}-`
export const npmCommand = "braintentacle"
export const npmLegacyCommand = "bt"
export const npmRepository = "git+https://github.com/yxpil/BrainTentacle_cli.git"

// dist 目录沿用 build.ts 的 cli-<target> 命名，发布包名由它换算。
export const platformName = (directory: string) => `${npmPrefix}${directory.replace(/^cli-/, "")}`
