## Context

Four contained pip-boy UI issues, all client-only:

- Creation step instructions render with the shared `.pb-hint` class (`screens/create.js`), which is also used for secondary footnotes — so the primary "what is this step" line has no more emphasis than fine print.
- The Tag Skills step renders a `— aggiungi abilità —` placeholder button (`data-add-skill-row`) when empty, duplicating the section-head `+`.
- The INV resources row (`tabs/gear.js` `renderInvSubtab`) is a `position: sticky; bottom: 0` **last child** of the scrolling container, re-rendered inside every INV subtab. As the last child it settles into the end of the list rather than reliably floating above the footer.
- The S.P.E.C.I.A.L. editor (`tabs/special.js`) renders a `FONTE PA` `<select>` writing `paTrackedBy`, plus a `MAX PA` stepper writing `paMax`.

## Goals / Non-Goals

**Goals:**
- Give each creation step a prominent instruction line, distinct from secondary hints.
- Start the Tag Skills step with an empty list; the `+` is the only add affordance.
- Make the resources band structurally independent of the scroll — a fixed strip above the footer.
- Remove the `FONTE PA` control; `paTrackedBy` is creation-set, `paMax` stays editable.

**Non-Goals:**
- No API changes: `paTrackedBy` stays owner-writable server-side; only the pip-boy control is removed.
- No change to what the resources band contains or how a resource writes (`PATCH .../resources`).
- No change to the creation wizard's steps, validation, or submit sequence beyond styling one line and dropping the empty-state row.
- No new shared component extraction.

## Decisions

### 1. `.pb-step-intro` for the per-step instruction

Introduce a dedicated class for the per-step instruction line (larger font, higher contrast, more vertical breathing room than `.pb-hint`). Secondary footnotes keep `.pb-hint`. This is a styling + class-application change in `create.js`/`pipboy.css`; the requirement that every step *has* an instruction (from `redefine-character-creation-flow`) is unchanged — only its prominence is specified.

### 2. Empty Tag Skills list

Remove the `— aggiungi abilità —` placeholder branch; when `draft.skills` is empty the list renders nothing (or a minimal empty affordance consistent with the sheet), and the section-head `+` remains the add trigger. The `data-add-skill-row` handler in `bindSkills()` is deleted as dead code. No behavioural loss — the `+` already opens the same add-popup.

### 3. Resources band lifted out of the scroll

The band moves from inside each subtab's scrolling `renderInvSubtab` container to a **fixed strip owned by the sheet layout**, rendered between the scrolling `.pb-screen-content` and the footer while the INV first-level tab is active. This makes "untouched by scrolling" structural rather than dependent on `sticky` behaviour, and removes the per-subtab duplication (resources are a character-level fact, not a per-collection one). `gear.js` stops rendering the band; `sheet.js` renders it once and wires the resource steppers/inputs, calling the same `PATCH .../resources`.

**Alternative considered:** keep the band in-scroll and fix the `sticky` behaviour (e.g. a trailing spacer). Rejected — a last-child sticky is inherently fragile; pulling it out of the scroll is the robust fix and also resolves the duplication.

### 4. Drop `FONTE PA`; keep `MAX PA`

Remove the `FONTE PA` `<select>` and its change handler from `editorMode`. `paTrackedBy` is written only at creation (deriving `paMax` from the higher of Agilità/Resistenza); on the sheet it is read-only, surfaced by the header's `PA · <source>` line. `paMax` remains directly editable via the existing `MAX PA` stepper (`PATCH .../action-points { paMax }`), with the existing clamp-`paCurrent` behaviour. The API keeps `paTrackedBy` writable; we simply no longer expose a control for it.

**Note:** because `paMax` is now decoupled from `paTrackedBy` after creation, the header's `PA · <source>` label documents the original source and may not equal `paMax`; this is intended and harmless.

## Risks / Trade-offs

- **[Depends on redefine being archived]** → Threads 1–2 modify requirements that live only in the `redefine-character-creation-flow` delta. Mitigation: this change declares that dependency; its creation deltas target the five-step requirement text and should be validated/applied after redefine archives.
- **[Resources band relocation touches sheet layout]** → Moving the band from `gear.js` to `sheet.js` widens the diff into the sheet shell. Mitigation: the band's markup and handlers move largely intact; the write path (`PATCH .../resources`) is unchanged, and the change is covered by the INV e2e.
- **[Stale PA source label]** → Freezing `paTrackedBy` while `paMax` stays editable can make the `PA · <source>` line look inconsistent with a manually-set `paMax`. Mitigation: accepted per exploration; the label is an origin tag, not a live derivation.

## Migration Plan

Client-only; no persisted data changes. No migration. Rollback is reverting the pip-boy files. Deploy is the standard pip-boy static build. Sequence after `redefine-character-creation-flow` archives so the creation deltas apply cleanly.

## Open Questions

None outstanding — instruction prominence, empty-list placeholder removal, band relocation, and `FONTE PA` removal were all resolved during exploration.
