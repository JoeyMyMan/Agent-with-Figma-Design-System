# design-system/

The design system this project uses, managed by [ds-workflow](https://github.com/Tuzibaobaobai/Agent-with-Figma-Design-System). The process is in `docs/ds-workflow/`.

| File | Written by | Contents |
| --- | --- | --- |
| `lock.json` | `ds-workflow sync` | The pinned design-system version: label, how it was read, its origin (kind, link, file key, Community origin, licence, HTML hash), Figma version, date, sha256 of every artifact |
| `tokens/design-system.tokens.json` | `ds-workflow sync` | The design system's variables and colour / text / effect styles (DTCG) |
| `tokens/proposed.tokens.json` | by hand (proposals) | Tokens this project proposes (semantic layer, spacing…), awaiting designer approval |
| `tokens/names.json` | `ds-workflow build` | Every generated CSS variable → Figma path and status, used by `check` |
| `components.inventory.json` | `ds-workflow sync` | Every component / component set in the design system, with properties and node ids |
| `components.registry.json` | by hand (mapping) | Code component ↔ design-system component, status reuse / extend / proposed / approved / deprecated |
| `figma-review.json` | by hand (review loop) | Review ledger: sections the designer marked Ready, unconfirmed sections, changes waiting for review (`ds-review-loop`) |
| `check-baseline.json` | `ds-workflow check --update` | Gate baseline: literal counts per file, which may only go down |
| `source/` | export script / designer | Raw JSON exported from the Figma plugin API (`figma/export-design-system.js`), or the designer's HTML export |
| `migrations/` | `sync` + by hand | Diff report and migration notes for every upgrade |

Never edit generated files by hand: change Figma or the proposal file, then run `sync` / `build` again.
