# Figma gotchas (lessons from practice)

## Reading

- **The plugin API and MCP cannot read a section's Ready for dev mark** (`devStatus` is not supported). Agree on a marker the designer puts in the section name, keep the review ledger, and accept forwarded links (ds-review-loop).
- `get_metadata` on a whole page can be very large: read down to the section first, then read frame by frame.
- A link's `node-id` is written `12-345`; the API wants `12:345`. A branch link (`/design/<fileKey>/branch/<branchKey>/…`) must be read through the branch key.
- A Figma Community page is not a file the MCP or REST API can read. Duplicate the kit first ("Open in Figma") and use the copy's file key.
- Kits from the Community often ship only styles (no variables), or variables without scopes. Sync what is there and propose the missing semantic layer (ds-propose) instead of inventing values.
- `get_design_context` returns React + Tailwind reference code and temporary asset links (valid for 7 days). Replace the code with the project's components and tokens, and download the assets into the project.
- Open a component and look at it before deciding to reuse it: names and properties are often misleading (for example, a component called "dropdown" may be one specific settings panel, not a general menu).
- Property names in design system components are spelled inconsistently (`State` / `state`, `Disabled` / `Dissabled`). Use the source component's actual property names.
- Styles the designer creates may be local only (unpublished): the REST API styles endpoint cannot see them; the plugin export can.

## Building components and screens

- After duplicating a variant to make a new one, component property references (TEXT / BOOLEAN) do not follow. Rebind them. Look up property keys by property-name prefix, not by position (variant properties come first).
- When you copy a component set to extend it, the TEXT / BOOLEAN properties of the original set are not carried over to the new set. Recreate the properties, or edit the text directly in instances.
- Library components do not always bind text to a property in every variant. In that case, edit the text directly in the instance and flag it for the designer in the proposal notes.
- A fill bound to a variable can lose its opacity in instances. For a translucent tint, use a separate layer with layer opacity.
- After switching a component set copied from the library to auto-layout, variants that were FILL get squashed. Set each one to a fixed width and HUG height.
- Figma has no free-form slots: build a container's content area as a fixed placeholder layer plus a BOOLEAN toggle.
- Text cannot contain instances: show an inline control inside running text as styled text.
- needs-designer tokens must also exist as Figma variables so proposal components can bind them. Do not substitute literals.

## Acceptance

- Check screenshots screen by screen, not only the structure: width overflow, unreplaced default text and lost property references only show up visually.
- When a design shows a state only as a static illustration (for example, a pager's first page that still shows a "Previous" button), follow the component definition (Disabled = hidden) and say so in the report.

## Connection

- The Figma MCP occasionally disconnects (connection reset, timeout). Retry read-only calls directly. When a write call fails, read the canvas first to see what changed, then continue.
- Keep page switches to at most one per call. Split large reads into smaller ones.
