---
name: ds-implement
description: Use for any change to UI code - styles, components or pages (stages 5, 7) - so that the component library uses only design system tokens, props map one-to-one to Figma variants and pages only compose components, then run the check, e2e tests and visual regression.
---

# Implementation and verification (stages 5, 7)

## Rules

- **Component library** (config `check.componentDirs`, default `src/ui/<Component>/`):
  - One directory per component: component file + style file. Styles use only `var(--<prefix>-*)`; no px, colours or font names. For combined values, build them from tokens with `calc()`, or define a local variable in the component (`--entry-indent: calc(var(--ds-space-24) + var(--ds-space-8));`).
  - Props map one-to-one to Figma component properties: variant → enum prop; BOOLEAN → boolean prop; TEXT → string or children; INSTANCE_SWAP → slot (ReactNode, etc.).
  - The file header comment gives the matching Figma component name, node id and status (reuse / extend / proposed), consistent with the registry.
  - Put hover states inside `@media (hover: hover) and (pointer: fine)`. Every interaction must work with clicks alone.
- **Pages** only compose components and handle layout. Page styles also use tokens. Literals in legacy code may only go down, never up (the check counts per file).
- **Icons and images**: use the original assets from the design (download the assets returned by `get_design_context` into the project). Do not redraw them or substitute look-alike icons. For single-colour icons that should follow the text colour, change the paths to `currentColor`.
- **Values the design system lacks**: do not hard-code them. Propose a token with ds-propose.
- After adding or changing a component, update the registry (`source`, `variants`, `screens`) and run `npx ds-workflow registry`.

## Several people / agents in parallel

- Split work by file (in parallel only if your agent supports it); each person or agent changes only their own files. Shared export files (such as `src/ui/index.ts`) and the registry are written in a final merge step.
- After merging, one pass reviews the whole diff: are deleted styles rebuilt in components; are class names and accessible names that tests depend on preserved; does a change in style load order break old override rules.

## Verification (every time)

1. `npx ds-workflow check` passes.
2. Type check, unit tests, build and e2e pass.
3. **Visual regression**:
   1. Check out the pre-change code with `git worktree add <dir> <base commit>` and start it on another port.
   2. Screenshot the same UI state list on both (the list from ds-map).
   3. Compare image by image (any pixel-diff tool works). **Every change must be explainable**: rounding to a token, or a planned change. Anything you cannot explain is a regression: fix it before committing.
4. The handoff doc states the design system version, proposal status and visual regression result (templates/handoff-section.md).
5. Any change to the UI then goes to the designer (ds-write-back → ds-review-loop).

## Common pitfalls

- The `font` shorthand in component styles resets `font-feature-settings` and similar properties. Apply font features that must hold globally on the content container and its descendants.
- Migration exposes style bugs that cascade order used to hide (for example, a wide dialog that a later generic rule had always narrowed). The migrated version then looks different on purpose: call such changes out in the commit message.
- Turn off or reduce shared animations under `prefers-reduced-motion: reduce`.
