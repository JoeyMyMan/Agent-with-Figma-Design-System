# Agent with Figma Design System（ds-workflow）

[English](README.md) · 中文

Figma 设计系统 ↔ 代码的团队标准流程。**不绑定 coding agent**：Codex、Cursor、Claude Code、GitHub Copilot、Gemini CLI、Cline 或人都按同一套规则工作。规则写成纯文本，放到各家 agent 都会读的位置；状态都存在仓库文件里；真正的约束交给脚本和 CI。

来源：一个把多个产品接入同一套 Figma 设计系统的真实项目，去掉了项目专属内容。

## 包含什么

| 部分 | 内容 |
| --- | --- |
| **CLI** `npx ds-workflow` | `init` 接入 · `source` 设置设计系统来源 · `sync` 同步并锁定版本 · `build` 生成 token CSS · `check` 门禁 · `registry` 组件登记表 · `review` 评审台账 · `rules` 刷新 agent 规则 |
| **手册** `playbooks/` | 8 个任务手册（英文：接入、映射、提案、实现、写回 Figma、设计师评审回路、对齐 Ready for dev、升级）+ Figma 注意事项。每个是 `SKILL.md` 格式 |
| **Figma 导出脚本** `figma/export-design-system.js` | 通过 Figma MCP 的 `use_figma` 运行，导出 variables、样式、组件（任何套餐都能用，能看到未发布的本地样式） |
| **模板** `templates/` | AGENTS.md 规则段、配置、`design-system/` 骨架（含评审台账）、CI、交接文档段落 |

## 设计系统从哪里来（`designSystem.source`）

`init --source`，或之后 `npx ds-workflow source <链接 | 文件>`，写入配置、刷新各 agent 的规则，并打印下一步；不带参数显示当前来源。

| 你手上有 | 命令 | 说明 |
| --- | --- | --- |
| **Figma 设计文件链接**（或指向其中某个节点）：`https://www.figma.com/design/<file_key>/<file_name>?node-id=<node_id>` | `source <链接>` | 类型 `figma-file`。`design/` 后面的 file key 是所有 Figma MCP 调用需要的唯一凭证；`node-id`（链接里写 `12-345`，API 里是 `12:345`）表示从哪里看起。跟踪参数会去掉；分支链接用分支 key。 |
| **Figma Community 的公开设计系统**：Material Design 3、Apple Design Resources（iOS / macOS）、Tailwind / shadcn/ui / Ant Design 的 UI Kit 等 | 先 `source <Community 链接>`，复制后 `source <你的副本链接> --from-community <Community 链接> --license "…"` | 类型 `figma-community`。工具读不了 Community 页面：先看许可，再 “Open in Figma” 复制一份、移到团队项目里，以后都用这份副本；原件不改。Kit 发新版时重新复制、换新版本号同步。 |
| **团队自己发布的设计系统库**：打开库文件，右上角 Share → Copy link，或直接复制地址栏 | `source <链接> --library [--work-file <链接>]` | 类型 `figma-library`。项目不能改库时，提案和画面放到 `--work-file` 指定的文件，在那里以库组件实例使用。 |
| **设计师根据项目导出的 HTML 设计规范** | `source design-system.html [--components <Figma 链接>]` | 类型 `html`。复制到 `design-system/source/`，按哈希锁定。`sync` 从页面内嵌的 JSON（ds-workflow 导出、类 Figma 数据或 DTCG token）或 CSS 自定义属性读取 token；组件来自 `--components` 指定的 Figma 文件。 |

每种都可以加 `--work-file <Figma 链接>`：本项目放提案和写回画面的文件（默认就是设计系统文件）。`design-system/lock.json` 随每个锁定版本记录来源（类型、链接、file key、Community 原件、许可、HTML 哈希）。

## 各 agent 怎么拿到规则

`npx ds-workflow init`（以后 `npx ds-workflow rules`）一次写好。`AGENTS.md` 总会写；其它目标由 `--agents` / `agents.targets` 决定（默认 `auto`：仓库里已有哪些 agent 的文件就写哪些）。

| 目标 | 写到哪里 |
| --- | --- |
| `agents-md`（总是） | `AGENTS.md` 里的托管段落（硬规则 + 手册索引）；段落外的内容不动。Codex 等读 AGENTS.md 的 agent 不需要别的 |
| `cursor` | `.cursor/rules/ds-workflow.mdc`，编辑样式 / 组件文件时自动附加 |
| `copilot` | `.github/instructions/ds-workflow.instructions.md`，`applyTo` 指向样式 / 组件文件 |
| `claude` | `CLAUDE.md` 末尾加 `@AGENTS.md`（没有就新建） |
| `gemini` | `GEMINI.md` 末尾加 `@AGENTS.md`（没有就新建） |
| `cline` | `.clinerules/ds-workflow.md`，或写进 `.clinerules` 文件的托管段落 |
| 其它 agent | `agents.extraFiles`：在你指定的规则文件里写同样的托管段落 |
| skills | `--skills-dir <目录>` / `agents.skillsDirs`：把手册按 `SKILL.md` 目录复制过去，给会加载 skills 的 agent（如 `.claude/skills`） |
| 任何 agent / 人 | `docs/ds-workflow/` 下的手册副本（随包版本更新） |

各 agent 能力不同时：没有 Figma 写权限的，写完代码后交给有权限的人或 agent 做 Figma 步骤，不用截图代替；没有子 agent 的，按区域依次映射，保留最后的完整性检查；没有跨会话记忆也没关系，锁定版本、登记表、提案和评审台账都在仓库文件里，CI 门禁对谁写的代码都一样。详见 `playbooks/README.md` 的 "Working with different agents"。

不管哪个 agent 写的代码，都要过 CI 里的 `ds-workflow check`。

## 快速开始

```sh
# 1. 安装
npm i -D github:Tuzibaobaobai/Agent-with-Figma-Design-System

# 2. 接入
npx ds-workflow init --name "Acme DS" --prefix acme --source <Figma 链接 | design-system.html> --agents cursor,copilot,claude

# 3. 同步（init 已按来源打印步骤）
#    Figma：让 agent 按 docs/ds-workflow/ds-adopt/SKILL.md 通过 Figma MCP 运行导出脚本，存到 design-system/source/，然后
npx ds-workflow sync --label DS-2025-01-15
#    HTML 导出：同一条命令直接读页面。有 Enterprise 和 FIGMA_TOKEN 时可加 --figma

# 4. 生成 token、打开门禁
npx ds-workflow build
npx ds-workflow check            # 已有项目第一次：确认后 --update 记下基线
```

之后的日常：写 UI 前 agent 读 AGENTS.md 和手册；提交前 `check`；设计师发版走 ds-upgrade；设计师标 Ready for dev 走 ds-align-ready-for-dev。

## 与设计师的评审回路（ds-review-loop）

- **自动触发**：只要新生成或改动了 UI（新画面、新状态、版式 / 交互 / 文案位置变化、组件新 variant），就把改动写回 Figma 请设计师评审，不等人提醒。只改数据、逻辑、媒体的修复不触发。
- **定稿信号**：Figma 接口读不到 Ready for dev 标记。设计师标 Ready 时在 section 名称前加「✅ Ready」（`review.readyMarker`），评审台账 `design-system/figma-review.json` 记录 `ready` / `unconfirmed` / `pending`。
- **不覆盖定稿**：`ready`、`unconfirmed` 或设计师做过的画面不原地改，在右侧加 v2；定稿画面用到的组件只能加 variant / 属性。`check` 会拦住改动定稿节点的 `pending` 条目。
- **在设计师工作的地方提醒**（`review.channel`）：`figma` 为待评审面板 + 名称后缀「· 🟡 In review」+ 批注；`issue` 为 issue；`both` 两者都做。
- **发布**：预览环境可以先上；生产发布前 `npx ds-workflow review --strict` 必须通过（没有待评审项）。

## 配置 `design-system.config.json`

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `designSystem.name` | — | 设计系统名 |
| `designSystem.source` | — | 设计系统来源，用 `source` 命令设置（`kind`、`url`、`fileKey`、`nodeId`、`communityUrl`、`license`、`html`、`components`、`workFile`）。0.1 只写了 `figmaFileKey` 的配置照常可用 |
| `designSystem.proposalPage` / `screensPage` | `Proposed` / `Screens · {label}` | 提案页、写回画面的页面（`{label}` = 锁定版本） |
| `proposal.prefix` | `Proposed` | 提案组件前缀：Figma `Proposed/<领域>/<名称>`，代码 id `proposed/…` |
| `tokens.prefix` / `css` / `proposed` | `ds` / `src/styles/ds-tokens.css` / `design-system/tokens/proposed.tokens.json` | CSS 变量前缀、生成的 CSS、提案 token 文件 |
| `check.scan` / `componentDirs` / `legacy` / `extensions` / `ignore` | `src` / `src/ui` / `[]` / 常见前端扩展名 / 测试和 stories | 门禁范围；组件库更严格（不许 px）；旧 token 文件的字面量只减不增 |
| `registry.markdown` | `docs/design/component-registry.md` | 生成的登记表 |
| `playbooks.dir` | `docs/ds-workflow` | 手册副本位置 |
| `agents.targets` / `skillsDirs` / `extraFiles` | `auto` / `[]` / `[]` | 给哪些 agent 写规则；skills 目录；其它规则文件 |
| `review.channel` | `figma` | 在哪里提醒设计师：`figma`、`issue` 或 `both` |
| `review.ledger` / `readyMarker` / `pendingMarker` / `annotationCategory` / `queueName` | `design-system/figma-review.json` / `✅ Ready` / `· 🟡 In review` / `Design review` / `Review queue` | 评审台账和 Figma 里用的名称 |

## 门禁规则（`check`）

- 引用了锁定版本里不存在的 `var(--<prefix>-*)` → 失败。
- `font-family` 不是 `var(…)`（`@font-face` 除外）→ 失败。
- 组件库里写 px（0 和 `@media` 条件除外），或用了非 token 且非本文件定义的自定义属性 → 失败。
- 硬编码颜色和旧 token 文件里的字面量按文件计数，只能减少（`--update` 只在迁移后使用）。
- 登记表：状态有效；`reuse` / `extend` / `approved` 的 node id 必须在锁定的组件清单里；`proposed` 以提案前缀命名；不重复。锁定版本之后设计师新建的组件写在 `figmaPending`。
- 评审台账：格式正确；待评审条目不能是设计师已定稿或未确认的节点（这些要在旁边加 v2）。

## 已知限制

- Figma 插件接口和 MCP 读不到 section 的 Ready for dev 标记（`devStatus`），所以靠设计师在名称前加「✅ Ready」并记在评审台账里。
- `use_figma` 单次返回最多约 48 KB，所以导出分部分、分块；agent 要把每块原样存成文件。大的库要跑多次。
- REST API 的 styles / components 接口只返回已发布的内容；variables 需要 Enterprise。
- 视觉回归只给出做法（手册 ds-implement），不带截图对比工具；各项目用自己的 e2e / 截图工具。
- Code Connect 未接入（需要 Figma Organization / Enterprise 的 Dev 席位）；登记表不依赖它也能把代码和 Figma 对应起来。

## 开发

```sh
npm test    # node --test，无依赖
```

改了手册或模板后升版本号；各项目 `npm update` 后运行 `npx ds-workflow rules` 刷新副本。
