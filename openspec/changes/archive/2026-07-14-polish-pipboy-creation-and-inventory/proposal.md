## Why

Three small, unrelated `apps/pip-boy` UI rough edges, grouped because they are all contained client polish with no data-model or API impact:

1. **The per-step instruction text in the creation wizard is too quiet.** Each step opens with a `.pb-hint` line, but it renders at the same muted size/contrast as secondary footnotes, so players skim past the one sentence that tells them what the step is for.
2. **The empty Tag Skills step shows a `— aggiungi abilità —` placeholder row.** It duplicates the `+` add control and adds visual noise; the step reads cleaner starting empty.
3. **The INV resources row only pins unreliably.** It is `position: sticky; bottom: 0` as the **last child of the scrolling list**, so it tends to settle at the end of the item list instead of floating above the footer — the exact "it's at the end of the items list" symptom.
4. **The S.P.E.C.I.A.L. editor still asks the player to pick the PA source.** `FONTE PA` (Agilità vs Resistenza) is a superficial control: the source is decided once at creation, and after that Max PA is just a value edited directly with the `MAX PA` stepper.

## Dependency

Threads 1 and 2 modify creation-wizard requirements introduced by `redefine-character-creation-flow` (the five-step shell, the Tag Skills placeholder, and the per-step instruction requirement). That change is implemented in code but **not yet archived**, so those requirements are not in the base spec. **This change depends on `redefine-character-creation-flow` being archived first**; its creation deltas are written against the post-redefine (five-step) requirement text.

## What Changes

- **Make each creation step's instruction line prominent.** The per-step instruction block SHALL render with visibly larger, higher-contrast styling than secondary hints (a dedicated style, e.g. `.pb-step-intro`), so it is the first thing read on the step. Secondary footnotes (e.g. the equipment "Dotazione fissa" note) stay small.
- **Remove the Tag Skills empty-state placeholder.** When no skill has been added, the skills list renders **empty**; the section-head `+` control is the sole add affordance. The now-dead `data-add-skill-row` placeholder handler is removed.
- **Pin the INV resources row above the footer, out of the scroll.** The `TAPPI`/`ROTTAMI`/`BOBBLEHEAD` band SHALL be rendered as a fixed strip **outside** the scrolling item list — between the scrolling content and the sheet footer — so it is untouched by scrolling. It is a single band shown while the INV tab is active, not re-rendered per subtab.
- **Remove the `FONTE PA` selector from the S.P.E.C.I.A.L. editor.** `paTrackedBy` is set once at creation (seeding `paMax` from the higher of Agilità/Resistenza) and is no longer editable from the sheet. After creation, `paMax` remains directly editable via the existing `MAX PA` stepper. The header's `PA · <source>` line continues to reflect the stored `paTrackedBy`.

## Capabilities

### New Capabilities
<!-- None: contained UI polish over existing pip-boy capabilities. -->

### Modified Capabilities
- `pipboy-character-creation`: the per-step instruction block is prominent; the Tag Skills step starts with an empty list (no placeholder row).
- `pipboy-character-sheet`: the INV resources band is a fixed strip above the footer, outside the scroll; the S.P.E.C.I.A.L. editor drops the `FONTE PA` selector (`paTrackedBy` is creation-set and no longer sheet-editable), keeping the `MAX PA` stepper.

## Impact

- **pip-boy** (`apps/pip-boy`):
  - `screens/create.js`: `.pb-step-intro` styling for the per-step instruction; delete the empty-state placeholder row and its `data-add-skill-row` handler.
  - `screens/sheet.js` + `tabs/gear.js`: lift the resources band out of the per-subtab `renderInvSubtab` container into a fixed strip owned by the sheet layout, rendered above the footer while the INV tab is active; remove the per-subtab duplication.
  - `tabs/special.js`: remove the `FONTE PA` `<select>` and its change handler from `editorMode`; keep the `MAX PA` stepper.
  - `styles/pipboy.css`: `.pb-step-intro`; relocate `.pb-resource-row` from a sticky in-scroll element to a fixed band above the footer.
- **No API or CMS changes.** `paTrackedBy` remains owner-writable at the API level (`api-character-stats`); only the pip-boy control is removed. `PATCH .../action-points` is still used for `paMax`.

## Testing

- **pip-boy e2e** (Playwright against the stubbed environment):
  - Creation: each step's instruction block is present and rendered in the prominent style; the Tag Skills step with no skills shows **no** `— aggiungi abilità —` row while the `+` control still opens the add-popup.
  - INV: the resources band renders once, outside the scrolling list, and remains fixed above the footer while a long item list scrolls; adjusting a resource still issues `PATCH .../resources`.
  - S.P.E.C.I.A.L. editor: no `FONTE PA` selector is present; the `MAX PA` stepper still writes `PATCH .../action-points { paMax }`; the header `PA · <source>` line reflects the stored `paTrackedBy`.
- Existing `apps/pip-boy/tests/character-creation.spec.ts` assertions touching the placeholder row and any `FONTE PA`/resources-position expectations are updated to match.
