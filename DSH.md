---
name: figma-design-system
description: 在 DeepSeek Harness 中接入 Figma 设计系统，锁定设计令牌，复用组件，检查样式和评审状态，或把页面回写成 Figma 组件实例。
---

# Figma 设计系统 · DeepSeek Harness

将原项目的 `ds-workflow` CLI 和 Figma 工作流接入 DSH。插件负责加载这份工作流，目标代码仓库保留设计系统配置、锁文件、组件登记表和 CI 检查。

## 安装与调用

使用 DSH CLI 安装到桌面配置，然后重启 DSH Desktop。

```sh
dsh plugin --profile desktop add github:JoeyMyMan/Agent-with-Figma-Design-System
```

打开目标代码仓库，在 DSH 对话中调用 `figma-design-system`，例如「用 Figma 设计系统接入当前项目，这是设计库链接」或「检查当前项目有没有硬编码样式，并给出组件复用建议」。

## 先确定任务与项目状态

1. 在目标代码仓库中运行命令。先读 `design-system.config.json` 和 `design-system/lock.json`（如存在），再检查当前改动。对于已配置的项目，优先使用仓库已有的 `ds-workflow` 版本和包管理器。
2. 首次接入时，使用项目现有包管理器把本 fork 安装为开发依赖并保存锁文件。例如 `npm install -D github:JoeyMyMan/Agent-with-Figma-Design-System`。本文中的 `npx --no-install` 也可替换成项目包管理器对应的本地执行命令。
3. 首次配置执行 `npx --no-install ds-workflow init --name "<设计系统名>" --prefix "<令牌前缀>" --source "<Figma 链接或本地 HTML 路径>"`。如果团队提供独立的 Figma 工作文件，用 `ds-workflow source` 的 `--work-file` 参数记录它。现有项目保留原配置，只有任务要求更换来源时才运行 `source`。

## 按任务选流程

优先读取目标仓库内 `docs/ds-workflow/<流程>/SKILL.md`。如果项目没有生成副本，使用插件资源中的 `playbooks/<流程>/SKILL.md`。

| 任务 | 流程 |
| --- | --- |
| 接入或更新设计库、导出变量和样式 | `ds-adopt` / `ds-upgrade` |
| 把设计稿映射到已有组件和令牌 | `ds-map` |
| 缺少组件、变体或令牌 | `ds-propose` |
| 修改项目 UI | `ds-implement` |
| 回写组件实例和提交设计评审 | `ds-write-back` / `ds-review-loop` |
| 对齐设计师标为 Ready 的区块 | `ds-align-ready-for-dev` |

- **导入和锁定。** Figma 来源使用已配置的 Figma MCP 及 `use_figma` 运行随包提供的 `figma/export-design-system.js`，按 playbook 分批保存结果。本地 HTML 来源由 CLI 读取。导出完成后执行 `npx --no-install ds-workflow sync --label "<版本>"`、`build` 和 `check`。对齐或升级时先核对迁移差异。
- **复用和检查。** 优先复用已有组件，再扩展变体，最后提议新组件。维护组件登记表，使用锁定的令牌。代码变更后执行 `npx --no-install ds-workflow check`，保留原有 CI 校验。只有明确要求迁移基线时才用 `check --update`。
- **回写和评审。** 在已确认的 Figma 工作文件中通过 `use_figma` 创建真实组件实例，已完成的屏幕保留，新版本放在旁边。回写成功后记录页面、节点和评审状态。生产发布前按团队流程执行 `npx --no-install ds-workflow review --strict`。
- **Figma 工具。** 可复用 DSH 中现有的 `dsh-figma-mcp` 连接。执行 Figma 操作前检查工具是否可用、目标文件及权限是否匹配。缺少连接或权限时，继续可完成的本地操作，明确列出待执行的 Figma 步骤。只有收到成功结果才记录回写完成。
