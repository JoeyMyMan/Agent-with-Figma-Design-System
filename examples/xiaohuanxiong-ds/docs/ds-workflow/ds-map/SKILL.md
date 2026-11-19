---
name: ds-map
description: Use before writing UI for a new screen or feature area, or when auditing an existing UI (stage 2) - maps every element of every UI state to a design system component + variant or token, fills in the component registry, and lists missing variants, components and tokens.
---

# Inventory and mapping (stage 2)

## Inputs

- A list of UI states: every route × every state (empty, in progress, selected, correct, wrong, loading, dialog…). E2E tests and screenshot scripts are the best source. If there are none, write a list first and commit it to the repo (it is reused later for write-back to Figma and for visual regression).
- `design-system/components.inventory.json` (all components and properties in the pinned version).

## Steps

1. **Decide state by state, element by element, in this order:**
   1. **reuse**: the design system has it and its properties are sufficient.
   2. **extend**: a similar component set exists but lacks a variant (e.g. no Disabled, no Size=l).
   3. **proposed**: no matching component.
   4. Map pure visual values (colour, spacing, font size) to tokens. List missing ones as **token gaps**.
2. **Before choosing reuse, open the component and see what it really is** (`get_screenshot` / `get_design_context` on the component itself). Do not judge by name and properties alone. A component's name often promises more than it is: something called "dropdown" or "card" may be a single-purpose part built for one screen.
3. **Choose components by meaning, not by appearance.** Express states through the component's public properties, not by detaching instances or covering layers. Use property names exactly as the source component spells them (`State` / `state`, `Disabled` / `Dissabled` may both appear).
4. **Write the registry** `design-system/components.registry.json`: one entry per code component.
   ```json
   {
     "code": "ui/IconButton",
     "status": "reuse",
     "description": "Square button with one icon",
     "screens": ["1.02", "2.04"],
     "figma": { "nodeId": "120:450", "name": "icon-button", "url": "https://www.figma.com/design/<fileKey>?node-id=120-450" },
     "variants": { "Size": "s / m / l (l is new)" },
     "source": "src/ui/IconButton/IconButton.tsx",
     "note": "…"
   }
   ```
   - For `reuse` / `extend` / `approved`, `figma.nodeId` must exist in the inventory (`check` validates this).
   - For `proposed`, `code` starts with the lower-cased proposal prefix (config `proposal.prefix`, default `Proposed` → `proposed/<Area>/<Name>`, e.g. `proposed/Cart/SummaryCard`), and `variants` lists the dimensions you plan to build.
   - For each gap, state the use case and the variant dimensions needed, and attach a current screenshot or screen number.
5. Write **token gaps** into `design-system/migrations/legacy-tokens.md`: value, where it is used, suggested semantic name.
6. Run `npx ds-workflow registry` to generate a readable table; `npx ds-workflow check` passes.

## Large UIs

- Split the UI by area. If your agent can run sub-agents or parallel tasks, map the areas in parallel; otherwise one area at a time. Each area writes only its own draft file first, not the registry.
- Then one pass (one agent or person) runs a **completeness check**: compare against all UI states and the code to find missed elements; verify that referenced components and property names really exist in the inventory; merge duplicate proposals across areas. In practice this step catches many errors and duplicates. Do not skip it.
- Finally one pass merges everything into the registry (one entry per component, `screens` is the union of all mappings), and only then does code work start.

## Done when

- Every element of every UI state is assigned (a component entry or a token).
- The gap list is complete and can go straight into ds-propose.
