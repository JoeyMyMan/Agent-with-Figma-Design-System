---
name: ds-adopt
description: Use when a project adopts a design system for the first time (a Figma file or a link into one, a Figma Community kit, the team's published library, or the designer's HTML export), or to fill in a missing design-system/ directory - initializes ds-workflow, records the source, syncs and pins a version, generates token CSS, turns on the check, and builds a legacy alias layer for existing styles.
---

# Adopt the design system (stages 0–1)

## Inputs

- **Where the design system comes from** — one of four kinds. Ask the designer which one if it is not clear:

| You have | Kind | Example |
| --- | --- | --- |
| A link to a design file, or into one (a page, section or frame) | `figma-file` | `https://www.figma.com/design/<fileKey>/<name>?node-id=<id>` |
| A public kit from the Figma Community (Material 3, platform UI kits, Tailwind / shadcn / Ant Design kits…) | `figma-community` | `https://www.figma.com/community/file/<id>/<name>` |
| Your team's library, published for other files (in the library file: Share → Copy link, or the address bar) | `figma-library` | `https://www.figma.com/design/<fileKey>/<name>` |
| A design system the designer exported as an HTML page for this project | `html` | `design-system.html` |

  In a Figma link, the part after `design/` is the file key every Figma MCP call needs; `node-id` (written `12-345` in links, `12:345` in the API) points at one node in it. A branch link (`…/branch/<branchKey>/…`) is read through the branch key.
- The project's style and component directories (default `src/styles`, `src/ui`).
- The coding agents the team uses (`--agents`), and whether the designer works only in Figma or also follows issues (`--review-channel`).

## Steps

1. **Initialize and record the source.** In the project root, run:
   ```sh
   npx ds-workflow init --name "<design system name>" --source <link | file.html> [source options] \
     --prefix <css prefix> --proposal-prefix <proposal prefix> \
     [--agents claude,cursor,copilot,gemini,cline] [--skills-dir <folder>] [--review-channel figma|issue|both]
   ```
   This creates `design-system.config.json` (with `designSystem.source`), the `design-system/` skeleton with the review ledger, a copy of these playbooks, the agent rules and CI config, and prints the next steps for the source. Existing files are not overwritten (skipped files are listed). Without `--agents`, the rules go to AGENTS.md and to every agent whose files already exist in the repo. Open `design-system.config.json` and check `check.scan`, `check.componentDirs` and `tokens.css`.

   Source options, per kind (also usable later with `npx ds-workflow source <link | file.html> …`, which updates the config and the agent rules):
   - **`figma-file`**: just the link. With a `node-id`, it tells you where to start; the whole file is still synced.
   - **`figma-community`**: tools cannot read a Community page. First pass the Community link: `source` prints what to do. Check the kit's licence on its Community page, then "Open in Figma" duplicates it into your drafts; move the copy into the team project and run `npx ds-workflow source <link of your copy> --from-community <Community link> --license "<licence + URL>"`. Never edit the Community original; your copy is the library from now on.
   - **`figma-library`**: add `--library`. If the project may not edit the library (usual for a shared team library), add `--work-file <link>` for the Figma file where this project puts proposals and screens. Its components are used as library instances there.
   - **`html`**: the file path. A file outside the repo is copied into `design-system/source/`; it is a pinned input like a Figma export. Add `--components <Figma link>` if the designer also has the components in a Figma file; without it, components cannot be reused by node id or written back as instances. Add `--work-file` too when proposals and screens must go somewhere else.

2. **Sync and pin.**
   - **Figma sources** (`figma-file`, `figma-library`, a duplicated `figma-community` kit). Choose one:
     - **Plugin export (recommended, any plan, sees unpublished styles and variables)**: through the Figma MCP `use_figma`, run the contents of `docs/ds-workflow/figma/export-design-system.js` (copied in by `init` / `rules`; read-only) on the file. Change only the `PART` / `CHUNK` / `PAGE_ID` lines at the top. Every return says `chunk` / `chunks`: repeat with the next `CHUNK` until `chunk + 1 === chunks`, and save each return verbatim:
       1. `PART = 'variables'` → `design-system/source/figma-export.variables.<CHUNK>.json`
       2. `PART = 'styles'` → `design-system/source/figma-export.styles.<CHUNK>.json`
       3. `PART = 'pages'` → lists the pages; pick the ones that hold library components (nothing to save)
       4. For each such page: `PART = 'components'`, `PAGE_ID = '<id>'` → `design-system/source/figma-export.components.<page id>.<CHUNK>.json`
       5. `npx ds-workflow sync --label <version label>` (reads `design-system/source/figma-export.*.json`)
     - **REST API**: `FIGMA_TOKEN=… npx ds-workflow sync --figma --label …`. Variables require Enterprise; only published styles and components are returned.
   - **`html`**: `npx ds-workflow sync --label <version label>` reads the page: embedded JSON (a ds-workflow export, Figma-like data or DTCG tokens) or CSS custom properties. If it reports "no design data", the page is only for people to read: ask the designer for an export that embeds tokens, or switch to the Figma file. With a components file, export its components (step 4 above, `PART = 'components'` only) and pass them in the same sync: `--export 'design-system/source/figma-export.components.*.json'`.

   For the version label, prefer the designer's release label. If there is none, use `DS-<YYYY-MM-DD>`. `design-system/lock.json` records the source (`origin`: kind, link, file key, Community origin, licence, HTML hash).

3. **Generate tokens.** `npx ds-workflow build` → the file set in `tokens.css`. Import it first in your global styles. Check that the token count per group in the output matches the number of variables / styles in the source (Figma, or the HTML page).

4. **Build a legacy layer (existing projects).** Do not delete old design variables all at once:
   - In the old token file, point old names to new tokens: `--accent: var(--ds-color-brand-6);`.
   - If there is no match, keep the literal for now and list it in `design-system/migrations/legacy-tokens.md` (the gap list). Handle it later with ds-propose.
   - Add the old token file path to `check.legacy` in the config. The number of literals in it may only go down.

5. **Turn on the check.** `npx ds-workflow check`. On an existing project, the first run reports the existing hard-coded colours. After confirming they are all legacy code, run `npx ds-workflow check --update` once to record the baseline. From then on, new code cannot add more. Lower the baseline after each migration.

6. **Commit.** Commit `design-system/`, the generated CSS, the config, AGENTS.md and the playbook copies together. CI (`.github/workflows/ds-check.yml`) runs the check on every PR.

## Done when

- `design-system/lock.json` has a label, source, origin and date; `npx ds-workflow check` passes.
- Any spec the designer handed over that is not the source itself (a PDF, a style guide page) is saved in `docs/` with where it came from. For a Community kit, its licence is recorded (`--license`).
- The handoff doc (`templates/handoff-section.md`) states the pinned version.

## Notes

- Never edit generated files (tokens, inventory, lock, names, CSS) by hand.
- A Figma design system usually has only a Primitive layer. The semantic layer (`color/text/primary`, `color/background/page`) and the spacing scale must be proposed by the project and approved by the designer (ds-propose). Until approval, proposed tokens can still be used and `check` accepts them; they are marked proposed in CSS comments.
