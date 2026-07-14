## Why

Three small but visible rough edges on the Pip-Boy SALUTE (health) tab and the shared list surfaces around it. Each is a case where the code almost does the right thing already — the fix is to make the existing mechanism actually take effect:

1. **Negative conditions don't show red in the add-condition catalog picker.** The picker already applies the `pb-picker-row--neg` accent class and the CSS for it exists (`color: var(--neg)`), but the base `.pb-picker-row` rule is declared ~600 lines *later* in `pipboy.css` with equal specificity, so the cascade makes it win and repaints every row phosphor-green. The polarity accent is set on the element but never seen. The existing e2e test only asserts the class name and the `×1`/`×2` meta, so it passed while the colour was wrong.
2. **Long names overflow their rows.** `.pb-cond-name` on the SALUTE tab has `flex: 1` but no `min-width: 0`, so a long condition name refuses to shrink and shoves the weight tag and the `✕` remover out of (or over) the row. The repo's own convention for every other name element (`.pb-skill-name`, `.pb-consumable-name`, `.pb-approach-text`) is `flex: 1; min-width: 0;` — condition rows are the outlier. The full-screen catalog picker has a related gap: its accented rows render the name as a bare text node with no element to constrain, so a long catalog name can overflow too.
3. **The MARGINE editor shows outside edit mode.** The `pipboy-character-sheet` spec already says the `MARGINE` stepper appears "in **editor** mode", and every other editable tab computes `const inEditor = canEdit && editMode` and gates structural edits on it. `tabs/health.js` is the only tab that never computes `inEditor` — it gates the whole margin block on plain `canEdit`, so any owner/admin sees the stepper even with edit mode toggled off. This is a code-vs-spec drift; the fix aligns the implementation with the spec.

## What Changes

- **Make the catalog picker's polarity accent visible.** Order (or specificity) in `pipboy.css` is fixed so a row's caller-supplied accent class actually paints its colour/border, instead of being overridden by the base `.pb-picker-row` rule. Negative catalog entries render in the muted-red negative accent; positives stay green. No JS change to the accent path — it already sets the class.
- **Keep list-row names inside their available width, wrapping when long.** Condition names, catalog-picker names, and the other list rows (skills, talents, inventory) SHALL shrink (`min-width: 0`) and **wrap onto additional lines** rather than overflow, be clipped, or push their fixed sibling controls (sign glyph, weight tag, quantity, remove `✕`, trailing meta) out of the row. Fixed siblings keep their size; the name is the only thing that yields. Wrapping (not `…` truncation) is chosen to match the repo's existing convention.
- **Show the MARGINE stepper only in editor mode.** `tabs/health.js` computes `inEditor = canEdit && editMode` and gates the `MARGINE` stepper on it, matching the S.P.E.C.I.A.L. / skills / talents / inventory editors. The `+ AGGIUNGI CONDIZIONE` add-path and the condition remove `✕` are unchanged (they stay on plain `canEdit`, as scoped by the user).

## Capabilities

### New Capabilities
<!-- None: this refines the existing pip-boy character-sheet capability. -->

### Modified Capabilities
- `pipboy-character-sheet`: the add-condition catalog picker renders its polarity accent colour visibly (negatives red); list-row names fit their available width by wrapping rather than overflowing; and the `MARGINE` stepper is gated to editor mode only, per the existing editor-gating convention.

## Impact

- **pip-boy** (`apps/pip-boy`) only — no API or CMS changes:
  - `src/styles/pipboy.css`: reorder / raise specificity so `.pb-picker-row--neg` / `--pos` beat the base `.pb-picker-row`; add `min-width: 0` (plus wrap) to `.pb-cond-name` and `flex: none` to its fixed siblings (`.pb-cond-sign`, `.pb-cond-tag`, `.pb-cond-remove`); add a name-wrap rule for the catalog picker name element.
  - `src/tabs/catalog-picker.js`: wrap each row's name in its own element (e.g. `.pb-picker-name`) so it can be constrained/wrapped independently of the trailing meta.
  - `src/tabs/health.js`: compute `inEditor = canEdit && editMode` and gate the `MARGINE` stepper block on it.
- **Shared-surface note**: `.pb-picker-row` and the picker name element are shared by every catalog picker (tags, equipment, skills, conditions); the accent-order fix and the name-wrap rule apply uniformly and are safe for all of them.
- **Backwards compatibility**: presentation-only; no data, schema, or endpoint changes. Editor-mode gating for margin matches behaviour the spec already prescribed.

## Testing

- **pip-boy e2e** (Playwright against the stubbed environment, `apps/pip-boy/tests`):
  - The add-condition catalog picker's negative row is **rendered in the negative (red) colour** — assert the computed `color` (or border colour) is the negative accent, not phosphor green — while the positive row stays green (extends `condition-popup.spec.ts` / `health-margin.spec.ts`, which today check only the class + meta).
  - A condition with a very long name **wraps** within its column and the `−` sign, weight tag, and `✕` remain visible and un-overlapped (assert the row's controls are still within the row box / visible); the same for a long catalog-entry name in the picker with its trailing meta staying right-aligned and visible.
  - The `MARGINE` stepper is **absent** on the SALUTE tab when editor mode is off and **present** after the `✎` toggle is activated (owner/admin); the existing margin-write scenario continues to pass in editor mode.
- The final task runs `npx playwright test` from `apps/pip-boy` and confirms all pass.
