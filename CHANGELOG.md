# Changelog

## Unreleased

**DeepSeek Harness plugin** (`integrations/dsh-figma-ds`)
- The workflow as a page in the Harness Web UI: sidebar 「设计系统」 entry plus a main panel with 概览 / 门禁 / Token / 组件 / 评审 / 手册 / 命令 tabs. It reads the same repository state the CLI writes, runs `check` / `build` / `registry` / `review` / `rules` / `init` / `source` / `sync` in-process, and shows structured output instead of terminal text.
- Host half only, no new runtime dependency: `index.js` imports `lib/*.mjs` from this repository, `cordis.patch.yml` adds one Loader row, and the client half is a plain-JS bundle with no build step. Installed as a linked local bundle (`dsh plugin add <repo>/integrations/dsh-figma-ds`); restart Harness once so the Host half loads.
- The page may only open directories inside an allowlist (registered Harness workspaces plus `DSW_PROJECT_DIR` / `DSW_PROJECT_DIRS`); commands are serialised per directory because the toolkit writes without a lock.
- The Figma side stays an MCP operation; the 手册 tab shows the playbook for each step.
- `node integrations/dsh-figma-ds/tests/smoke.mjs` (also run by CI) exercises the allowlist, the state reader, the nine commands and the playbook reader without Harness.

**Worked example** (`examples/xiaohuanxiong-ds`)
- A real project pinned to a Figma library: 268 variables / 10 paint / 29 text / 17 effect styles / 265 components exported through `use_figma`, a `DS-2026-11-15` lock, 410 generated `--xhx-*` tokens, a five-entry component registry and a review ledger; the gate reports one intentionally drifting component.
- `integrations/dsh-figma-ds/docs/tutorial-xiaohuanxiong.md` walks the whole flow with screenshots of the plugin page.

## 0.2.0

**Four kinds of design-system source** (`designSystem.source`, `ds-workflow source`)
- `figma-file` (a design file, or a link into one with `node-id`), `figma-community` (a Community kit: duplicate it, then `--from-community` + `--license`), `figma-library` (`--library`, the team's published library), `html` (the designer's HTML export, copied into the repo, optionally `--components <Figma link>`). Any kind can name a `--work-file` for proposals and screens.
- Links are parsed and cleaned (tracking parameters dropped, `node-id` → `12:345`, branch links use the branch key); FigJam, Slides, Make and plugin links are rejected with an explanation.
- `sync` with no flags reads the configured source; new `--html <file>`, combinable with a components `--export`. The HTML reader takes embedded JSON (ds-workflow export, Figma-like data, DTCG tokens with typography / shadow composites) or CSS custom properties, and never runs the page.
- `lock.json` records the origin (kind, link, file key, Community origin, licence, HTML hash). `init --source`; `--file-key` and 0.1 configs with only `figmaFileKey` still work.
- Fixed: ds-adopt described a `PART = 'tokens'` export the script does not have; it now matches the script (`variables`, `styles`, chunks).

**Designer review loop** (`playbooks/ds-review-loop`)
- Every UI change goes back to the designer automatically; changes that leave the UI unchanged do not.
- The Ready-for-dev mark cannot be read through the Figma API, so the designer puts a marker before the section name (`review.readyMarker`, default "✅ Ready") and the review ledger `design-system/figma-review.json` records `ready`, `unconfirmed` and `pending`.
- Screens the designer marked Ready, sections whose status is unconfirmed and anything the designer made are never edited in place: a v2 goes beside them. Components used in Ready screens only gain variants or properties.
- Reminders go where the designer works (`review.channel`): `figma` (review-queue board, `review.pendingMarker` after names, annotations in `review.annotationCategory`), `issue`, or `both`. `ds-propose` follows the same channel instead of always opening a GitHub issue.
- `check` validates the ledger and rejects pending changes to Ready / unconfirmed nodes. New command `review [--strict]`; `--strict` fails while anything waits for review, for the production branch (the CI template runs it there).

**Any coding agent**
- Agent targets (`--agents` / `agents.targets`): `agents-md` (always), `claude`, `gemini`, `cursor`, `copilot`, `cline`; default `auto` writes AGENTS.md plus the agents whose files already exist in the repo. **Changed:** a clean `init` no longer writes the Cursor rule unless Cursor is detected or listed.
- `agents.extraFiles` puts the managed block into any other instruction file; `--skills-dir` / `agents.skillsDirs` copies the playbooks into any skill folder. `--claude-skills` still works (= `--skills-dir .claude/skills`).
- Playbooks no longer assume one agent's features: "Working with different agents" in `playbooks/README.md` covers agents without Figma write access, sub-agents or memory. New hard rules: shared state lives in the repo; only people approve, mark Ready or release.

**Other**
- Examples, test fixtures and docs use neutral names only.
- Removed an undocumented legacy alias key for `$extensions.proposal` in proposed tokens: use `proposal`.
- Known limits: Code Connect needs Figma Dev seats (Organization / Enterprise).

## 0.1.0

First release: `init`, `sync` (plugin export or REST), `build`, `check`, `registry`, `rules`; seven playbooks.
