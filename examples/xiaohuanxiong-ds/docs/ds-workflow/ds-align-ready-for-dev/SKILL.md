---
name: ds-align-ready-for-dev
description: Use when the designer has changed screens in Figma and marked sections Ready for dev - reads the screens and new components in those sections, compares them item by item with the current code, updates the code to match the design, verifies with screenshots, and updates token proposals and the registry.
---

# Align with the designer's Ready for dev changes

## 0. Set the scope

- **The Figma plugin API and MCP cannot read the Ready for dev mark.** Do not guess. The signals you can read: the ready marker at the start of a section name (config `review.readyMarker`, default "✅ Ready"), the `ready` list in the review ledger, and section links a person forwards (`…?node-id=<id>`). Anything else is not final: ask.
- Handle only the screens within the linked scope. Changes to shared components (such as the page header) affect other pages; report them when done.

## 1. Read the design

1. `get_metadata` on the section: list the screen frames and the components the designer created (usually placed next to the section, with names that lack the proposal prefix).
2. `get_design_context` (with screenshot) for each screen. The returned code is React + Tailwind **reference** code and cannot be used directly — replace it with the project's components and tokens.
3. For new and changed components, read the component set itself to get every variant (`get_design_context` on the component set node), especially states not visible on screens, such as Hover / Disabled.
4. When the designer used styles or variables that are not in the pinned version (for example, a new shadow style), read their name, key and values with `use_figma`.
5. Download icon assets from the design (the temporary links in the response expire after 7 days). For single-colour icons that need to change colour, set the colour to `currentColor`. Icons the designer newly drew can be obtained with `use_figma` via `exportAsync({ format: 'SVG' })` on the node.

## 2. Compare with the current state

- Run the project's screenshots (e2e or screenshot script) and view them side by side with the design screenshots.
- Write a diff list: size, spacing, font size and weight, colour, shadow, corner radius, element position, copy, interaction states.

## 3. Change the code

- Change components (ds-implement rules): all sizes and colours use tokens.
- **A value in the design is not a token**:
  - A library style / variable the designer created → write it into `proposed.tokens.json` with `use` set to "style <name> (key …) created by the designer after <version>; becomes an official token after the next sync", then run `build`.
  - A raw value in the design (not bound to a style) → first look for the closest existing token. If there really is none, propose it as needs-designer and list it in the report.
- Copy follows the design; update every language file for i18n at the same time.
- When a component the designer created replaces a previously reused component: update the registry. If it is not yet in the pinned inventory, record it in `figmaPending`. Never invent a `figma.nodeId`.
- When structure that tests depend on (class, accessible name, role) changes, update the tests and mention it in the report.

## 4. Verify

- `npx ds-workflow check`, type check, unit tests, build and e2e all pass.
- Compare screenshots with the design screen by screen: at desktop width and at least one narrow width.

## 5. Report

- What changed on each screen; other pages affected by shared components.
- New proposed tokens, `figmaPending` components, copy changes.
- Remaining differences from the design and why (for example, the design is a static illustration, while the code hides a button according to the component's Disabled definition).
- Pushing and deploying wait for a person's confirmation.

## 6. Update the ledger

Move the section to `ready` in the review ledger (if it is not there yet), set `codeAligned` to the commit that aligned the code, and remove the matching `pending` entries. `npx ds-workflow check` passes.
