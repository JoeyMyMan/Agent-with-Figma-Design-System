# Changelog

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
