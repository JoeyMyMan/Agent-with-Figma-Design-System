---
name: ds-propose
description: Use when the design system lacks a component, variant or token (stages 3–4) - builds marked component sets, extension copies and proposed variables on the Figma proposal page with the Figma MCP use_figma, asks the designer for review through the project's review channel and waits, instead of hard-coding the missing value in code.
---

# Figma proposals and review (stages 3–4)

Proposals go on the proposal page (config `designSystem.proposalPage`, default "Proposed") of the **work file**: `designSystem.source.workFile` if set, otherwise the design system file itself (for a Community kit: your duplicate; for an HTML source: its components file). `npx ds-workflow source` prints which file that is. **Do not modify the original component library.** Names start with the config's `proposal.prefix` (default `Proposed`; written `<prefix>` below).

## New component (proposed)

Use `use_figma` to build the component set `<prefix>/<Area>/<Name>` (e.g. `Proposed/Cart/SummaryCard`):
- **Variants by business dimension**: State (Default / Hover / Pressed / Disabled), Selected, Validation, Size… One property per dimension; never `Property 1`.
- **Build structure with auto-layout.** **Bind** fills, strokes, corner radii, spacing and text styles **to variables or styles** (library Primitives, or this project's proposed variables). Do not hard-code values.
- **Expose content as component properties**: TEXT (text), BOOLEAN (optional parts), INSTANCE_SWAP (icons, etc.).
- **Nest instances of existing components inside** where possible (buttons, icons). Do not redraw them.
- **description**: `Status: Proposed (<project>) — pending approval. Code: <source file>. Use: <use case>. Registry: <registry path>`.
- Put the standard "PROPOSED · <prefix>/…" label above the component on the canvas.

## New variant (extend)

Do not change the original component set directly. Copy it to the proposal page, add the new variants, and name it "<original name> (EXTENDS <library>/<original name>)". In the description, give the original component's node id, what was added, and how to merge after approval ("add these variants to the original component set, then delete this copy").

## Proposed tokens

- In Figma, create variable collections "<prefix> Semantic (proposed)", "<prefix> Spacing (proposed)", and so on. Semantic variables are **aliases** to Primitives, with `scopes` limited to their use (e.g. TEXT_FILL only).
- Also write them into `design-system/tokens/proposed.tokens.json`:
  ```json
  { "variables": { "color": { "text": { "primary": {
    "$type": "color", "$value": "rgba(0, 0, 0, 0.88)",
    "$extensions": { "proposal": { "status": "proposed", "alias": "paint/Gray/900", "use": "Primary body text colour", "review": "<Figma link or issue>" } }
  } } } } }
  ```
  `status: needs-designer` means no suitable value exists in the design system; keep the current value until the designer decides. needs-designer tokens must also be created as Figma variables (description says needs-designer) so proposal components can bind them.
- Run `npx ds-workflow build`. The tokens are then usable in code (CSS comments mark them proposed).

## Ask for review

Ask where the designer works (config `review.channel`, see ds-review-loop step 3): with `figma`, add the proposals to the review queue board, add the pending marker to their names and annotate them; with `issue`, open one issue listing every proposal in this round. Either way, give for each item the Figma link, use case, variant dimensions, matching code component and a current screenshot, and add a `pending` entry to the review ledger. In the registry entry, set `figmaProposal` to the proposal node and `review` to the link or issue.

## Review (stage 4)

- The designer comments on, edits or approves the proposal in Figma. After approval the designer merges it into the library and publishes → the project re-syncs (ds-upgrade), the registry entry becomes `approved`, `figma` points to the new library node id, and code switches to the official component / token.
- Rejected proposals: record the reason in the registry, revise according to the feedback, and propose again.
- **An agent must never mark a proposal approved itself.** Only change it after the designer approves.

## Done when

- Every gap has a proposal node (with label and description) and a review request (queue row or issue, plus a `pending` ledger entry); proposed tokens match between Figma and `proposed.tokens.json`; `check` passes.
- Each proposal component has been checked by screenshot: no text overflow, no lost property references, variants laid out neatly (see reference/figma-gotchas.md).
