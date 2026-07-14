## Context

Three UI polish items on the SALUTE tab and the list surfaces around it. All three are small; two are "the mechanism exists but a later rule / the wrong flag defeats it." This note records the root causes and the two decisions that shape the change, so the implementation doesn't re-open them.

## Root causes

### 1. Catalog picker polarity accent is invisible (CSS cascade order)

`condition-popup.js` supplies `rowAccent` → `catalog-picker.js` applies `pb-picker-row--neg` to the row → CSS exists:

```
line  855:  .pb-picker-row--neg { border-color: var(--neg-border); color: var(--neg); }   /* red  */
line 1449:  .pb-picker-row      { … color: var(--phosphor); border: 1px solid var(--green-border); }  /* green */
```

Both selectors are a single class (specificity `0,1,0`). With equal specificity the **later** source rule wins, and the plain `.pb-picker-row` is declared far below the accent rule, so it repaints `color`/`border-color` on every row. The accent class is present on the element (the current test asserts exactly that and passes) but its colour never shows.

The sibling `.pb-cond-row--neg` (health-tab condition rows) does **not** have this bug because it is declared *after* `.pb-cond-row` — correct order there.

**Fix options:** (a) move the `--neg` / `--pos` accent rules to *after* the base `.pb-picker-row` rule, or (b) raise their specificity (`.pb-picker-row.pb-picker-row--neg`). Either works; (b) is order-independent and therefore more robust to future reshuffling. Implementation may pick either — the spec only requires the accent colour to be visibly applied.

### 2. Name overflow (missing `min-width: 0`)

In a flex row a flex item will not shrink below its content's intrinsic width unless `min-width: 0` is set. `.pb-cond-name` has `flex: 1` but no `min-width: 0`, so long names don't yield and push the weight tag / `✕` out. Every other name element in the repo (`.pb-skill-name`, `.pb-consumable-name`, `.pb-approach-text`) already pairs `flex: 1` with `min-width: 0` — condition rows are the outlier.

`min-width: 0` alone lets the box shrink and lets multi-word text wrap at spaces; a single unbroken long token still needs `overflow-wrap: anywhere` to break. The fix adds `min-width: 0` to the name and `flex: none` to the fixed siblings so only the name yields.

The catalog picker's accented rows render the name as a **bare text node** beside the meta (`…${esc(e.name)}${meta}`), so there is no element to hang `min-width: 0` / wrapping on. Wrapping the name in its own element (`.pb-picker-name`) gives it something to constrain while the meta stays right-aligned via `margin-left: auto`.

### 3. Margin editor gated on the wrong flag (code-vs-spec drift)

The spec already says the `MARGINE` stepper appears "in **editor** mode". The app distinguishes `canEdit` (owner/admin permission) from `editMode` (the `✎` view-state toggle, default off), and every editable tab computes `const inEditor = canEdit && editMode` and gates structural edits on it. `tabs/health.js` never computes `inEditor` and gates the margin block on plain `canEdit`, so it shows to any owner even with edit mode off. Fix = compute `inEditor` and gate the margin block on it. `editMode` is already passed into the tab's ctx and toggling it already triggers `renderActiveTab()`, so no extra wiring is needed; the stepper's click handlers live under the existing `if (!canEdit) return` guard and simply won't be wired when the stepper isn't rendered.

## Decisions

- **Overflow behaviour: wrap, not ellipsis.** Chosen to match the repo's existing `min-width: 0` convention; keeps full text visible at the cost of taller rows. (`…` truncation was the alternative — rejected to stay consistent and avoid hiding condition/item names.)
- **Edit-mode scope: MARGINE stepper only.** The condition remove `✕` and `+ AGGIUNGI CONDIZIONE` keep their current `canEdit` gating. Aligning those to `inEditor` as well (to fully match `gear.js`) was considered and deliberately left out of scope for this change.

## Non-goals

- No change to the health arithmetic, critical-state derivation, condition catalog, or any API/CMS surface.
- No switch of any existing list from wrap to ellipsis.
