# 小浣熊教育版设计系统 · dsh-figma-ds 示例工程

这是「把 Figma 设计系统接进代码仓库」的可运行示例，数据来自真实设计文件：

- Figma 文件：[小浣熊教育版](https://www.figma.com/design/lmbRXNuIp0ZsJ4LI32T2ZK/小浣熊教育版?node-id=290-16856)（页面 `web端`，node `290:16856`）
- 导出方式：Figma MCP `use_figma` 运行 `ds-workflow/figma/export-design-system.js`，分 5 块落盘到 `design-system/source/`
- 锁定版本：`DS-2026-11-15` —— 268 个变量 / 10 paint / 29 text / 17 effect 样式 / 265 个组件
- 生成 410 个 CSS 变量（前缀 `--xhx-`）

配套教程：[dsh-figma-ds 使用教程](../../integrations/dsh-figma-ds/docs/tutorial-xiaohuanxiong.md)

## 快速验证

```bash
# 门禁：示例里 src/ui/LoginButton.tsx 故意留了一处硬编码颜色，应当报 1 个错
node ../../bin/ds-workflow.mjs check

# 组件登记表：5 条，覆盖 reuse / approved / extend / proposed / deprecated
node ../../bin/ds-workflow.mjs registry

# 评审台账：1 ready / 1 unconfirmed / 1 pending；--strict 时退出码 1
node ../../bin/ds-workflow.mjs review
node ../../bin/ds-workflow.mjs review --strict
```

把 `src/ui/LoginButton.tsx` 里的 `background: '#7C4DFF'` 换成
`background: 'var(--xhx-color-primary-action)'`，`check` 就会变成
`3 files checked · 0 literal(s) · 0 error(s)`。

## 目录

```
design-system.config.json     名称/前缀/来源/门禁范围
design-system/lock.json       钉住的版本与数量
design-system/tokens/         DTCG token、names.json（410 个变量）、proposed
design-system/components.inventory.json   265 个组件的 node id 白名单
design-system/components.registry.json    5 条登记
design-system/figma-review.json           评审台账
design-system/source/         Figma MCP 导出的原始 JSON（5 个文件）
src/styles/xhx-tokens.css     build 生成，勿手改
src/styles/topbar.css         合规写法示例
src/ui/TopBar.tsx             合规组件
src/ui/LoginButton.tsx        故意漂移，供门禁演示
docs/design/component-registry.md         registry 生成的表格
docs/ds-workflow/             8 个 agent 手册 + 导出脚本副本
AGENTS.md                     agent 规则托管段
```

在插件页面里打开它：侧边栏「设计系统」→ 项目选择器选「小浣熊教育版设计系统」；
若列表里没有，把本目录的绝对路径粘进右上角路径框点「打开」。
