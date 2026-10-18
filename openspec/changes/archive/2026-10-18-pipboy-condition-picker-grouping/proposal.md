## Why

On the SALUTE tab, the condition catalog picker lists every preset alphabetically in one flat list. Positive and negative conditions are mixed together, and so are BASE and MODERATA ones. The only distinctions are a red/green border and a faint `×1`/`×2`, and each preset's description is never shown. Choosing a condition at the table means scanning the whole list.

Two more problems touch the same flow:
- On a phone, every catalog picker raises the keyboard as soon as it opens, which hides half the list.
- Tapping an active condition shows only a bare remove confirmation, so there is nowhere to read what the condition does.

The agreed direction was explored with a clickable mockup (https://claude.ai/artifact/QdQXvDGEZCjdQvFSmeh7Lo).

## What Changes

- **Split add entry point (BREAKING, UI)**: the single `+ AGGIUNGI CONDIZIONE` trigger is replaced by two triggers under the condition columns: `− NEGATIVA` (negative accent) and `+ POSITIVA` (positive accent).
  - Each trigger opens the add-condition popup **for that polarity**. The title reads `AGGIUNGI · − NEGATIVA` or `AGGIUNGI · + POSITIVA`.
  - The **Scegli esistente** tab lists only catalog presets of that polarity.
  - The **Aggiungi custom** tab drops the `NEGATIVA`/`POSITIVA` sign toggle, because the trigger fixes the polarity. The tab keeps the `BASE`/`MODERATA` weight toggle, relabelled with signed values (`BASE −1` / `MODERATA −2`, or `+1` / `+2`).
- **Grouped catalog picker**: the shared full-screen catalog picker gains an optional, generic **section grouping** hook.
  - Sections appear in a caller-defined order, and entries stay alphabetical within each section.
  - Each section has a header showing its label and match count, and headers stay pinned while scrolling.
  - Sections with no matches are hidden while searching.
  - The condition picker uses two sections: **BASE** (`minor`, weight 1) first, then **MODERATA** (`major`, weight 2).
- **Condition picker rows**: each row shows the **signed weight** (`−1`/`−2`/`+1`/`+2`, matching the sheet) in place of the `×1`/`×2` abbreviation. The preset's `description` appears on a second line under the name.
- **No keyboard on open (all catalog pickers)**: the picker's search input is no longer focused automatically on touch devices. It is focused on open only when the primary pointer is fine (mouse or trackpad). This applies to every catalog picker:
  - conditions, skills and talents;
  - inventory add-item;
  - the tag pickers in add-item and in the gear editor;
  - character-creation skills.

  Login, map search and the note editor are unchanged.
- **Condition detail card (BREAKING, interaction)**: tapping an active condition opens a detail card instead of the remove confirmation.
  - The card shows the signed weight, the full name, polarity and severity labels, and the description, or `Nessuna descrizione` when there is none.
  - Its buttons are `CHIUDI` and `RIMUOVI`. `RIMUOVI` removes the condition straight away, because the card itself is the confirmation step. `CHIUDI`, the `✕` and a backdrop tap write nothing.
  - Users who may not write the character can now open the card too (read-only, without `RIMUOVI`). Before this change their rows were not interactive.
- **Custom condition description**: the **Aggiungi custom** tab gains an optional `descrizione` field. A non-empty value is sent as the condition's `description`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `pipboy-character-sheet`:
  - **Status and conditions editor** changes: the split polarity entry point, the polarity-scoped add popup without a sign toggle, grouped and described picker rows with signed values, a description on custom conditions, and the detail card replacing the remove confirmation, now also open to read-only viewers.
  - **Full-screen catalog picker sheet** gains the optional section-grouping hook and the touch-aware search focus rule.

## Impact

- **Code (Pip-Boy front end only)**:
  - `apps/pip-boy/src/tabs/catalog-picker.js`: grouping hook, section headers, focus rule.
  - `apps/pip-boy/src/tabs/condition-popup.js`: polarity parameter, filtering, grouping, signed and described rows, custom description.
  - `apps/pip-boy/src/tabs/add-popup.js`: passes the grouping hook through.
  - `apps/pip-boy/src/tabs/health.js`: the two triggers and the detail card, replacing `openConfirm`.
  - A new condition detail-card module, or reuse of the `.pb-info-popup` shell.
  - `apps/pip-boy/src/styles/pipboy.css`: section headers, description sub-line, detail card, split triggers.
- **No API or data changes**: `Condition.description` and `ConditionItemDto.description` already exist, and conditions picked from the catalog already copy the preset's description. The remove call is still `PATCH .../status { <collection>: { deletedIds } }`.
- **Dependency**: this change builds on `pipboy-condition-row-compact` (complete, not yet archived), which rewrote the same `Status and conditions editor` requirement. Archive that change first so this delta applies on top of its text.
- **Fallback presets**: the hardcoded fallback list holds negatives only. When the catalog fetch fails, the positive popup therefore has no presets. It opens on the custom tab, using the add popup's existing empty-catalog behaviour.

## Testing

All behaviour is verified with e2e Playwright specs (`npx playwright test` from `apps/pip-boy`) against the stubbed API fixtures, asserting on the live DOM:

- **Split triggers**:
  - `− NEGATIVA` opens a popup whose picker lists only negative presets, and `+ POSITIVA` only positive ones.
  - The custom tab has no sign toggle.
  - OK writes to the collection that matches the trigger.
- **Grouping and order**:
  - BASE appears before MODERATA, and names are alphabetical within each section.
  - Headers show the right counts.
  - Searching hides empty sections.
  - A caller without the grouping hook still gets the flat alphabetical list (the existing picker specs stay green).
- **Row content**: picker rows show `−1`/`+2`-style signed values (no `×1`/`×2`) and the description sub-line.
- **Focus rule**:
  - In a touch-emulated mobile context (`hasTouch`, coarse pointer), the search input is not the active element after the picker opens.
  - In a desktop context, it is.
- **Detail card**:
  - Tapping a condition opens the card with its name, signed value, labels and description, or `Nessuna descrizione`.
  - `CHIUDI`, the `✕` and the backdrop write nothing.
  - `RIMUOVI` issues the `deletedIds` PATCH.
  - A read-only viewer sees the card without `RIMUOVI`.
- **Custom description**: a custom condition with a description sends `description` in the PATCH item. An empty field sends no `description` key.
- **Updated specs**: `condition-popup.spec.ts`, `delete-confirmations.spec.ts`, `health-margin.spec.ts` and `sheet-layout.spec.ts` move from `#pb-cond-add` and the confirm dialog to the new triggers and the card.
