## Design system

- Version: the label in `design-system/lock.json` (e.g. DS-2025-01-15), source (plugin export / REST), date
- Gate: `npx ds-workflow check` passes (paste the last line of its output)
- Components added or changed in this batch (registry entries):
  | Code component | Status | Figma | Notes |
  | --- | --- | --- | --- |
- Proposals: components / variants / tokens awaiting designer approval, with their review links
- Screens written back to Figma: frames (or links) on the "Screens · <version>" page; v2 copies beside Ready frames
- Review loop: channel used, review-queue rows added, frames marked as in review, `pending` ledger entries (`npx ds-workflow review` output); sections that became Ready and their `codeAligned` commit
- Release: `npx ds-workflow review --strict` result before the production release
- Visual regression: which states were compared, and the reason for every change
- Known gaps: needs-designer tokens, `figmaPending` components (add their node ids after the next sync)
