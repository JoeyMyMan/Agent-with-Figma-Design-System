---
name: ds-upgrade
description: Use when the design system publishes a new version, a proposal is approved and merged into the library, or the designer creates new library styles or components, and before starting a new feature area - re-syncs, reads the generated diff report, migrates code and the registry, runs the check and visual regression, and updates the pinned version.
---

# Design system upgrade (ongoing)

## Steps

1. **Sync the new version** (same method as ds-adopt step 2), using the designer's release label:
   ```sh
   npx ds-workflow sync --label DS-<new version>
   ```
   Per source kind (`npx ds-workflow source` shows it):
   - `figma-file` / `figma-library`: export again from the same file.
   - `figma-community`: the kit's authors published an update. Duplicate the new version, then `npx ds-workflow source <new copy> --from-community <Community link> --license "…"` and export from it. Your proposals stay in your old copy or work file: carry over the ones still pending.
   - `html`: the designer sends a new export. Replace the file at the same path (`design-system/source/…`), then sync; the lock records the new hash.
   If a version is already pinned, `design-system/migrations/<old>→<new>.md` is generated automatically.
2. **Read the diff report** and handle each item:
   - **Token removed / renamed**: references in code make `check` fail. Replace renamed ones directly. For removed ones, find a replacement token; if there is none, propose one.
   - **Token value changed**: no code change, but run visual regression to confirm the result.
   - **Component removed / renamed / properties changed**: first mark the affected registry entries `deprecated`, write down the replacement and allow a transition period; then update code props to match the property changes.
   - **Added**: check whether it is an earlier proposal that was approved (see step 3).
3. **Approved proposals**: set the registry entry to `approved`, point `figma` to the new library node id and remove `figmaPending`; delete the matching proposals from `proposed.tokens.json` and switch code to the official token names. The designer deletes or annotates the copies on the Figma proposal page.
4. `npx ds-workflow build`, `npx ds-workflow registry`, `npx ds-workflow check`.
5. Visual regression (the verification step in ds-implement); every change must be explainable.
6. In the "Migration log" at the end of the diff report, record which code and registry entries changed and the visual regression result. Commit it as one migration PR.

## Before starting a new feature area

1. Do the ds-map mapping first.
2. If there are gaps, go through ds-propose and wait for review before writing code.
3. Delivery must include: Figma screens written back as components (ds-write-back) and sent for review (ds-review-loop), registry updates, a passing `check`, and a handoff doc stating the design system version.

## Notes

- Do not edit only the token files or hand-edit the generated CSS: every change comes from a Figma sync.
- Breaking changes (removal, rename) go through deprecated first, giving dependent pages time to migrate.
