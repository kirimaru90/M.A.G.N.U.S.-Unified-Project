## Why

The SALUTE tab's condition rows are cluttered and fragile. Each row carries a `−`/`+` glyph, the name, a `BASE` / `MODERATA ×2` tag and a `✕`. The two columns are half-width, so long names wrap and the rows end up with uneven heights. A single tap also deletes the condition immediately, with no confirmation, whereas skill, talent and item deletion already ask first.

## What Changes

- Each active-condition row shows **only a signed weight value and the name**: `−1` / `−2` for negatives and `+1` / `+2` for positives, using the true minus sign U+2212. This label **replaces** the separate sign glyph and the `BASE` / `MODERATA ×2` tag. The `✕` is removed.
- Condition names stay on **one line** and are **truncated with `…`** when they don't fit, so every row has the same height. This is an explicit **exception** to the `List row names fit their available width` wrapping rule. The catalog picker, skills, talents and inventory rows **keep wrapping**.
- Each row exposes the full condition name through `title` and its accessible name, so a truncated name can still be read.
- **BREAKING (interaction)**: activating a row no longer removes the condition immediately. It opens the shared confirmation dialog (`openConfirm`, danger style) with the message `Rimuovere {full name} ({value})?` and the buttons `ANNULLA` / `RIMUOVI`. Only `RIMUOVI` issues the `PATCH .../status` delete. Cancelling or tapping the backdrop writes nothing.
- Read-only viewers see the same compact row (value and truncated name), but it is not interactive.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `pipboy-character-sheet`: the **Status and conditions editor** requirement changes the condition row's content (signed value and name only, no tag, no `✕`), its overflow behaviour (single-line ellipsis) and removal, which now requires confirmation. The **List row names fit their available width** requirement now excludes SALUTE condition rows from the wrapping rule.

## Impact

- **Code**: `apps/pip-boy/src/tabs/health.js` (row markup and remove handler, which now uses `openConfirm` from `tabs/confirm-dialog.js`) and `apps/pip-boy/src/styles/pipboy.css` (`.pb-cond-*` rules: new value label, name ellipsis; tag and remove rules dropped).
- **No API or data changes**: the delete still uses the same `PATCH .../status { <collection>: { deletedIds } }` call.
- **Tests**: `apps/pip-boy/tests/health-margin.spec.ts` (the long-name test changes from wrap to ellipsis), `apps/pip-boy/tests/sheet-layout.spec.ts` (old tag and immediate-remove assertions updated) and `apps/pip-boy/tests/delete-confirmations.spec.ts` (new condition-removal confirm/cancel cases).

## Testing

Everything is covered by e2e Playwright tests (`npx playwright test` from `apps/pip-boy`), run against the stubbed API fixtures and asserting on the live DOM:

- **Row content**: a `major` negative row shows `−2` and its name, a `minor` positive row shows `+1` and its name, and no row contains `BASE`, `MODERATA`, `×2` or `✕`.
- **Ellipsis and constant height**: a long, unbroken name renders on one line with `text-overflow: ellipsis`, the name overflows its box (`scrollWidth > clientWidth`), the row does not overflow horizontally, and its height equals a short-named row's height. The row's `title` holds the full name.
- **Wrapping elsewhere is unchanged**: the existing catalog-picker long-name wrap test still passes unchanged.
- **Confirm removal**: tapping a row opens the confirm dialog with the full name and value. `ANNULLA` keeps the row and issues no `PATCH`, and `RIMUOVI` issues the `PATCH` with the id in `deletedIds`.
- **Read-only**: for a non-editing viewer, the rows render the value and name, and tapping them opens no dialog.
