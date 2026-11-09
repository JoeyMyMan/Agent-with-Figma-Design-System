---
name: ds-review-loop
description: Use whenever new or changed UI goes to Figma for the designer to review - runs automatically after any UI change (new screen, new state, changed layout, interaction or copy position, new variant), reads which sections the designer marked Ready, never overwrites them (adds a v2 beside them), reminds the designer where they work, and records everything in the review ledger.
---

# Review loop with the designer

The designer owns the screens in Figma. The project (you and your agent) proposes; the designer decides. This loop makes sure every UI change reaches the designer, that finished screens are never overwritten, and that everyone — any agent, any person — can see the review state in the repo.

## When it runs

**Automatically, whenever this project creates or changes UI.** Nobody has to ask. That includes a new feature or screen, a new UI state, a bug fix that changes layout, interaction or the position of copy, and a new component variant.

It does not run for changes that leave the UI as it is: content or data fixes, business logic, audio or other media.

## Where the state lives

- **The review ledger** (config `review.ledger`, default `design-system/figma-review.json`), committed to the repo. Never keep review state only in an agent's memory, a chat or a local note: the next person or agent will not see it.
  - `ready`: sections the designer marked Ready for dev (`section`, `nodeId`, `frames`, `since`, and `codeAligned` = the commit that aligned the code).
  - `unconfirmed`: sections the designer made or edited whose status nobody has confirmed. **Treat them exactly like `ready`.**
  - `pending`: changes waiting for the designer (`added`, `what`, `code` = issue or PR references, `nodes.screens`, `nodes.components`).
  - `reviewQueue`: the board in Figma that lists `pending`.
- `npx ds-workflow check` validates the ledger, including that nothing in `pending` is a node from `ready` or `unconfirmed`. `npx ds-workflow review` prints it.

## Steps

### 1. Find out what is final

The Figma plugin API and MCP **cannot read the Ready-for-dev mark**. So the team agrees on a signal any agent can read:

- **The designer puts the ready marker (config `review.readyMarker`, default "✅ Ready") at the start of the section name** when marking it Ready for dev.
- Before writing to Figma, read the ledger, then read the section and frame names on the screens page (`get_metadata`). A section whose name starts with the marker but is missing from `ready` → add it to the ledger. A section someone forwards as a Ready-for-dev link → add it too.

### 2. Write to Figma (ds-write-back for how)

| What you change | What you do |
| --- | --- |
| A new screen or state | Add a new frame in the matching section on the screens page. |
| A frame **this project created** that is not ready / unconfirmed | Edit it in place: it is still a draft. |
| A frame in a `ready` or `unconfirmed` section, or anything the designer made or edited | **Never edit it.** Duplicate it to the right, name it "<original name> — v2 · <date> · proposal", make the change in the copy. The designer archives or deletes the original after accepting. |
| A component used in a `ready` screen | **Only add**: new variants or new properties. Changing how an existing variant looks needs a v2 component on the proposal page (ds-propose). |

When unsure whether a frame is the designer's, treat it as the designer's.

### 3. Remind the designer where they work (config `review.channel`)

**`figma`** (default — for designers who do not use the code host), all three:
1. **Review queue board**: on the screens page, a frame named after `review.queueName`, with the designer's three steps written on it (review → mark the section Ready with the marker → move the rows to "Done"). Add one group per batch: date, issue / PR reference, one row per screen or component with a link to the node and one line on what changed. Record its node id in `reviewQueue`.
2. **Name marker**: add `review.pendingMarker` (default "· 🟡 In review") after the name of every changed frame and proposal. Append it; never change the start of the name (numbers, the ready marker).
3. **Annotations**: on each changed layer, a Figma annotation in the category `review.annotationCategory`: one sentence on what changed and which issue it belongs to.

**`issue`**: one issue or PR comment per batch listing the same rows, with the label your team uses for design review. **`both`**: do both.

Then add a `pending` entry to the ledger with the node ids of every new or changed screen and component.

### 4. The designer reviews

The designer edits in Figma, then marks the section Ready for dev, puts the ready marker before its name, removes the pending marker and moves the queue rows to "Done". An agent never does any of this on the designer's behalf.

### 5. Close the loop

The next time anyone works with Figma (or someone forwards a Ready link):
- Move the section from `pending` / `unconfirmed` to `ready` in the ledger.
- Align the code with the final design (ds-align-ready-for-dev) and record the commit as `codeAligned`.

### 6. Releases

- A preview or staging deployment can go out while the review is pending, so reviewers can try the change.
- **A production release waits until the related screens are Ready.** Put `npx ds-workflow review --strict` (fails while anything is pending) in the production branch's CI, or run it before releasing.

## If your agent cannot write to Figma

Some agents connect only to Figma's read tools, or have no Figma MCP at all. Do not substitute screenshots, HTML-to-design imports or a written description for the frames. Instead:
- Finish and verify the code, then hand the write-back to someone (person or agent) with write access: an issue or a note in the PR saying which states need frames, with the screenshots from your verification attached.
- Leave the ledger unchanged until the frames exist: `pending` entries always carry real node ids.
- Whoever has write access runs steps 2–3 and adds the `pending` entry. The production release still waits for step 6.

## Done when

- Every changed screen and component is in Figma, in a draft frame of this project or a v2 beside the designer's.
- The designer has been reminded through the configured channel.
- The ledger lists the batch under `pending`; `npx ds-workflow check` passes.
