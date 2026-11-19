---
name: ds-write-back
description: Use to write UI states back to Figma as components (stage 6) - builds each screen from design system and proposal component instances with the Figma MCP use_figma and places them on the Screens page for the designer, without touching screens the designer marked Ready; never use HTML-to-design imports or full-screen screenshots.
---

# Write back to Figma as components (stage 6)

Goal: the designer gets screens they can edit directly — switch variants, change text, adjust spacing — instead of a pile of loose layers.

## Steps

1. **Prepare**: call `create_session` first (if your Figma MCP provides it) and read the use_figma instructions bundled with the Figma MCP. Work in the **work file** (`designSystem.source.workFile`, otherwise the design system file — `npx ds-workflow source` prints it). Make sure the Screens page (config `designSystem.screensPage`, with `{label}` replaced by the pinned version) exists; create it if not.
   - An HTML source without a components file has no components to instance: ask the designer for the library file (`source … --components`) before writing back.
   - **Read the review ledger and the section names first** (ds-review-loop step 1). Frames in `ready` or `unconfirmed` sections, or made by the designer, are never edited: your change goes in a v2 beside them.
2. **One frame per UI state** (the state list from ds-map), sized at the design width (e.g. 1440 × 900):
   - Use only **component instances**: import library components with `importComponentSetByKeyAsync` / `importComponentByKeyAsync` (keys are in the inventory); take proposal components from the proposal page.
   - Set text through component properties (`setProperties`); do not reach into instance layers. Only when a component does not expose its text as a property, edit the text in the instance directly and flag it for the designer in the proposal notes.
   - Use auto-layout for layout; bind spacing, colour and corner radius to variables.
   - Containers such as panels and cards that have no component: build them as frames bound to tokens, with component instances inside.
3. **Annotate**: above each frame, add a note: source route and state, proposal components used, extended components, reused components. Put a "Proposed" label next to proposal components.
4. **Group frames into sections by area** (e.g. "Checkout › Summary") so the designer can mark Ready for dev per section.
5. **Accept every frame**:
   - Structure: read the layer tree and confirm it consists mainly of instances, with no full-screen images and no unbound colours.
   - **Check screenshots screen by screen**: width overflow, unreplaced default text ("Button", "Title"), lost property references — these only show up visually.
   - Compare against screenshots of the real page.
6. **Ask for review** (ds-review-loop steps 3 and the ledger): review queue, name marker and annotations in Figma (or the issue, per `review.channel`), and a `pending` entry with every new node id. List the frames in the handoff doc too.

## Notes

- Switch pages at most once per `use_figma` call. Split multi-page work into several calls (in parallel if your agent can).
- Write calls return the ids of all created / modified nodes. Use those ids in later calls; do not look nodes up by name again.
- Figma has no free-form slots: build the content area of dialogs and panels as a fixed placeholder layer plus a BOOLEAN toggle. Text cannot contain instances: show an inline control inside running text (an inline input, chip or link button) as styled text, and use a real instance wherever it stands on its own.
- More gotchas in reference/figma-gotchas.md.
