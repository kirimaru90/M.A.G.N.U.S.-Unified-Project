## Context

`apps/pip-boy/src/tabs/health.js` renders each active condition through `conditionRow(cond, neg, canEdit)`. The current markup is a `<button>` (or a `<div>` when read-only) with four spans: `.pb-cond-sign` (`−`/`+`), `.pb-cond-name`, `.pb-cond-tag` (`BASE` / `MODERATA ×2`, from `weightTag()`) and `.pb-cond-remove` (`✕`). A delegated click handler on `[data-remove-condition]` commits the delete straight away through `commit()`, which also re-derives `criticalState`.

In `pipboy.css`, `.pb-cond-name` uses `flex: 1; min-width: 0; overflow-wrap: anywhere`, so long names wrap. The columns (`.pb-cond-col`) are `flex: 1 1 0; min-width: 0`, so they already have equal widths.

A reusable `openConfirm({ message, confirmLabel, cancelLabel, danger, onConfirm })` already exists in `tabs/confirm-dialog.js`. It is used for skill, talent, item, character and note deletion. Cancelling or tapping the backdrop dismisses it, and only the confirm button runs `onConfirm`.

## Goals / Non-Goals

**Goals:**
- Compact rows showing `{signed value} {name}`, where the value carries both polarity and weight.
- Single-line names with an ellipsis, so every condition row has the same height.
- Removal goes through the shared confirmation dialog.
- The full name stays readable (`title`, accessible name, and the confirm message).

**Non-Goals:**
- Changing the wrapping behaviour of the catalog picker, skills, talents or inventory rows.
- Changing the add-condition popup, its picker rows (`×1`/`×2`), or the custom tab's `BASE ×1`/`MODERATA ×2` toggle.
- Any API or data-model change. The delete payload is unchanged.
- A tap-to-expand or tooltip for truncated names beyond the native `title`.

## Decisions

**1. One `.pb-cond-value` span replaces both the sign glyph and the weight tag.**
The label is built as `(neg ? '−' : '+') + conditionWeight(cond)` (U+2212 for the minus). `conditionWeight` already maps `minor → 1` and `major → 2`, so no second mapping is needed. `weightTag()` becomes unused in this file and is deleted.
*Alternative considered:* keep `.pb-cond-sign` and change its text to `−2`. Rejected: that class name now describes something else, and a fresh class keeps the CSS honest. Its styling follows the display-font look of the old sign, but it is sized to fit two characters (`flex: none`, no fixed `12px` width).

**2. Pure-CSS truncation on `.pb-cond-name`.**
`white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1`, replacing `overflow-wrap: anywhere`. The parent row is already a flex container and the columns already allow shrinking (`min-width: 0`), so the ellipsis engages without JS measuring. With every row on a single line at the same font size and padding, row height is constant without fixing a `height` value, which would break if the font or padding changes.
*Alternative considered:* a fixed `height` with `overflow: hidden`. Rejected: brittle, and a clipped second line would show partially instead of an ellipsis.

**3. The full name goes in `title` and `aria-label`.**
Each row gets `title="{name}"` and `aria-label="{value} {name}"`, both escaped with `esc()`. This lets mouse and desktop users hover to read the name, and screen readers announce it untruncated. On touch devices, the confirm dialog is the way to read the full name, which is why its message carries the full name and value.

**4. The click handler wraps `commit()` in `openConfirm`.**
```js
openConfirm({
    message: `Rimuovere ${name} (${value})?`,
    confirmLabel: 'RIMUOVI',
    cancelLabel: 'ANNULLA',
    danger: true,
    onConfirm: () => commit(...),   // same projection + deletedIds as today
});
```
The handler reads `name` and `value` from `data-*` attributes on the button (`data-name`, `data-value`), so it doesn't have to search the status arrays again. `openConfirm` passes the message through `esc()`, so the raw name goes in safely. The projection and `criticalState` derivation are unchanged.

**5. Read-only rows stay as `<div>` with the same inner markup.**
There are no `data-remove-condition` attributes, so no handler is attached. They keep `title` and `aria-label` too. The `cursor: pointer` / hover styles should apply only to the `<button>` variant (`button.pb-cond-row`), so read-only rows don't look clickable. Today they get `cursor: pointer` from the shared `.pb-cond-row` rule, which is a small existing bug this change fixes along the way.

**6. Dead CSS is deleted.**
`.pb-cond-sign`, `.pb-cond-tag` and `.pb-cond-remove` are removed from `pipboy.css` once they are no longer emitted. A grep confirms nothing else references them.

## Risks / Trade-offs

- [Truncation hides information on touch devices: two conditions sharing a long prefix look the same.] → Mitigation: the confirm dialog shows the full name before anything is deleted, so a mistaken tap costs only `ANNULLA`.
- [Removal now takes two taps.] → This is intended, and it matches skill, talent and item deletion. The dialog's buttons are separate and spaced, so a mis-tap can't land on `RIMUOVI`.
- [The spec now treats condition rows differently from other list rows.] → The exception is written into the `List row names fit their available width` requirement and justified there by the half-width two-column layout, so it won't look accidental later.
- [Tests that clicked a row and expected an immediate `PATCH` will fail.] → Only `health-margin.spec.ts` has the remove/wrap assertions. Its long-name test is rewritten and the confirm cases go in `delete-confirmations.spec.ts`. The full suite runs before archiving.
