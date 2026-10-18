## MODIFIED Requirements

### Requirement: Status and conditions editor

The SALUTE tab SHALL present the character's `status` as owner- and admin-editable via the existing `PATCH .../status` endpoint, laid out per the reference's *Tracciato del Logoramento*, expressed as a **health margin** rather than a raw net-wear count:

- A `SALUTE` indicator showing **health** = `margin − net wear`, where **net wear** = (sum of negative-condition weights) − (sum of positive-condition weights), a `minor` condition weighs `1`, and a `major` condition weighs `2`. The indicator SHALL render the numeric readout `{health}/{margin}` together with a horizontal depleting fill bar whose fill is `health/margin`. Positive conditions MAY push `health` **above** `margin` (overshoot): the numeric readout SHALL show the true value (which MAY exceed `margin` or be negative) while the fill bar SHALL clamp between empty and full. The readout SHALL render in the negative accent (not critical amber) when `health ≤ 0`.
- The character's `margin` is a character-document field (default `4`, per `api-character-stats`), seeded from the species at creation (per `pipboy-character-creation`) and editable here. The `MARGINE` stepper (bounded to a minimum of `1`, writing `PATCH .../status { margin }`) SHALL be presented **only in editor mode**, matching the editor-gating convention used by the S.P.E.C.I.A.L., skills, talents, and inventory editors: an owner or admin who has **not** toggled editor mode on SHALL NOT see the stepper. Because lowering `margin` can cross the critical threshold, the margin write SHALL re-derive and persist `criticalState` in the same PATCH.
- The active-condition list SHALL render as **two columns**: **negative** conditions on the **left** and **positive** conditions on the **right**. Within each column, conditions SHALL be ordered **major before minor** (weight `2` before weight `1`), stable within a weight. Each condition is a full-width row within its column carrying **only** a **signed weight value** followed by the condition name. The signed value SHALL be `−1` / `−2` for negative conditions (using the minus sign U+2212, not a hyphen) and `+1` / `+2` for positive conditions, matching the condition's weight. The row SHALL NOT show a separate sign glyph, a `BASE` / `MODERATA ×2` weight tag, or a `✕` remove control.
- The condition name SHALL render on a **single line**. When the name does not fit the width left after the signed value, it SHALL be **truncated with a trailing `…` ellipsis** rather than wrapping, so every condition row has the **same height** regardless of name length. The signed value SHALL keep its size and stay visible. The row SHALL expose the condition's **full name** through its `title` and its accessible name, so a truncated name can still be read. This is the condition-row exception to the `List row names fit their available width` requirement.
- When the user may write the character, **activating a condition row SHALL open the shared confirmation dialog** in the danger style. The dialog's message names the condition's full name and signed value (`Rimuovere {name} ({value})?`), its buttons are `ANNULLA` and `RIMUOVI`, and it is not a direct removal. Only `RIMUOVI` SHALL remove the condition (representing rest / stimpack / RadAway) by issuing `PATCH .../status` with the condition's id in the matching collection's `deletedIds`. `ANNULLA` or a tap on the dialog backdrop SHALL dismiss it without any write. When the user may not write the character, the rows SHALL render identically but SHALL NOT be interactive (no dialog and no write).
- The two columns SHALL be **colour-coded**: negative conditions use a **muted negative (red-family) accent**, positive conditions a green accent. This negative accent SHALL be visually distinct from the full-glow critical amber, which stays reserved for the critical state alone (banner/ring/LED per `pipboy-terminal-chrome`).
- A dashed empty state (`nessuna condizione attiva`) when both collections are empty; a per-column empty affordance when only one collection is empty.
- A single add-path: a `+ AGGIUNGI CONDIZIONE` trigger that opens a **two-tab add-condition popup** mirroring the inventory add-item popup (an `OK` action and a small red `✕` that cancels without any write; the popup owns no persistence and hands the assembled condition to its caller, which issues the `PATCH .../status`). The popup SHALL present:
  - **Scegli esistente** — a selection over the conditions catalog (`GET /conditions-catalog`), presented via the full-screen catalog picker sheet; choosing a preset copies its `name`/`defaultSeverity` and routes it to the collection its `polarity` implies (client-side). When the catalog fetch fails, the picker SHALL fall back to a small hardcoded preset list rather than being empty. In this picker, each catalog row SHALL show its **polarity by colour only** — the negative/positive accents above, **with no `NEGATIVA`/`POSITIVA` text** — and its **weight as an abbreviation** (`×1` for `minor`, `×2` for `major`). The polarity accent SHALL be **visibly rendered** on the row (negatives in the muted-red negative colour, positives green), not merely carried as a class — per the `Full-screen catalog picker sheet` requirement.
  - **Aggiungi custom** — a freeform `nome condizione` input, a `NEGATIVA`/`POSITIVA` sign toggle, and a `BASE ×1`/`MODERATA ×2` weight toggle. `OK` adds exactly one condition (no multiselect).

**Critical state** SHALL be derived by the client as `health ≤ 0` (equivalently `net wear ≥ margin`) and persisted through `PATCH .../status { criticalState }` whenever the condition collections or the margin change. When critical, the sheet SHALL show the amber `⚠ STATO CRITICO — NON PUOI AGIRE` banner beneath the tab bar on **every tab**, flip the status-bar dot and label to amber `⚠ CRITICO`, and apply the amber inset ring specified by `pipboy-terminal-chrome`. A character whose `health` is above `0` — including above `margin` — is not critical.

#### Scenario: Health is margin minus net wear
- **GIVEN** a character with `margin: 6`, two `major` negative conditions, and one `minor` positive condition
- **WHEN** the SALUTE tab renders
- **THEN** the `SALUTE` readout shows `3/6` (net wear `2+2−1 = 3`; health `6−3 = 3`) and the fill bar is filled to half

#### Scenario: Positives can overshoot the margin
- **GIVEN** a character with `margin: 6`, no negative conditions, and one `major` positive condition
- **WHEN** the SALUTE tab renders
- **THEN** the readout shows `8/6` and the fill bar is clamped at full

#### Scenario: Negatives and positives render in two colour-coded columns
- **GIVEN** a character with two negative and one positive condition
- **WHEN** the active-condition list renders
- **THEN** the negative conditions appear in the left column with the negative accent and the positive condition appears in the right column with the positive accent

#### Scenario: Each column is ordered major before minor
- **GIVEN** the negative column holds a `minor` and a `major` condition
- **WHEN** the list renders
- **THEN** the `major` condition appears above the `minor` one in that column

#### Scenario: Condition rows show only a signed value and the name
- **GIVEN** a `major` negative condition `STREMATO` and a `minor` positive condition `BEN NUTRITO`
- **WHEN** the active-condition list renders
- **THEN** the negative row shows `−2` (U+2212) followed by `STREMATO`, and the positive row shows `+1` followed by `BEN NUTRITO`
- **AND** neither row contains `BASE`, `MODERATA`, `×2`, or a `✕`

#### Scenario: A long condition name truncates with an ellipsis at constant row height
- **GIVEN** a column holding a condition with a short name and a condition whose name is longer than the column's width
- **WHEN** the active-condition list renders
- **THEN** the long name renders on a single line ending in `…`, the signed value stays visible, and the row does not overflow its column horizontally
- **AND** the long-named row's height equals the short-named row's height
- **AND** the long-named row's `title` holds the full, untruncated name

#### Scenario: Tapping a condition asks for confirmation before removing it
- **GIVEN** the owning player is viewing an active condition `STREMATO` of weight `−2`
- **WHEN** they activate its row
- **THEN** a confirmation dialog opens reading `Rimuovere STREMATO (−2)?` with `ANNULLA` and `RIMUOVI` buttons, and no `PATCH` has been issued yet

#### Scenario: Confirming removes the condition
- **GIVEN** the condition-removal confirmation dialog is open
- **WHEN** the owning player activates `RIMUOVI`
- **THEN** the app issues `PATCH .../status` with that condition's id in the matching collection's `deletedIds`

#### Scenario: Cancelling keeps the condition
- **GIVEN** the condition-removal confirmation dialog is open
- **WHEN** the owning player activates `ANNULLA` or taps the dialog backdrop
- **THEN** the dialog closes, no `PATCH .../status` is issued, and the condition row remains

#### Scenario: Read-only condition rows are not interactive
- **GIVEN** a user who may not write the character is viewing its SALUTE tab
- **WHEN** they tap an active-condition row
- **THEN** the row shows the same signed value and name, but no confirmation dialog opens and no write is issued

#### Scenario: Critical derives from the character's margin
- **GIVEN** a character with `margin: 3` whose net wear is `2` and `criticalState` is `false`
- **WHEN** the owner adds a `minor` negative condition, taking net wear to `3` (health `0`)
- **THEN** the app issues `PATCH .../status` setting `criticalState: true` alongside the new condition

#### Scenario: A different margin moves the critical threshold
- **GIVEN** a character with `margin: 6` and net wear `4`
- **WHEN** the SALUTE tab renders
- **THEN** the character is **not** critical (health `2`), unlike the legacy fixed threshold of `4`

#### Scenario: Owner edits the margin in editor mode
- **GIVEN** a character with `margin: 6` in editor mode
- **WHEN** the owner raises `MARGINE` to `7`
- **THEN** the app issues `PATCH .../status { margin: 7 }` (with the re-derived `criticalState`) and the `SALUTE` readout denominator becomes `7`

#### Scenario: Margin editor is hidden outside editor mode
- **GIVEN** the owner (or an admin) is viewing the SALUTE tab with editor mode **off**
- **WHEN** the tab renders
- **THEN** no `MARGINE` stepper is shown; it appears only after the `✎` editor-mode toggle is activated

#### Scenario: Margin stepper is bounded at one
- **GIVEN** a character with `margin: 1` in editor mode
- **WHEN** the SALUTE tab renders its `MARGINE` stepper
- **THEN** the `−` control is disabled at `1`

#### Scenario: Catalog picker rows show colour-coded polarity and abbreviated weight
- **GIVEN** the conditions catalog holds a `negative`/`major` entry and a `positive`/`minor` entry
- **WHEN** the owner opens the add-condition popup's **Scegli esistente** picker
- **THEN** the negative entry's row is **rendered in the muted-red negative colour** (not phosphor green) and shows `×2`, and the positive entry's row is rendered in the green positive colour and shows `×1`, with no `NEGATIVA`/`POSITIVA` text on either

#### Scenario: Owner adds a condition from a catalog suggestion via the popup
- **WHEN** the owning player opens the add-condition popup's **Scegli esistente** tab and selects a catalog entry in the picker
- **THEN** the app issues `PATCH .../status` adding a condition whose `name`/`severity` match the catalog entry's `name`/`defaultSeverity`

#### Scenario: Catalog suggestion routes by polarity
- **GIVEN** the picked conditions-catalog entry has `polarity: "negative"`
- **WHEN** the owning player adds it
- **THEN** the app issues `PATCH .../status` targeting `negativeConditions` (not `positiveConditions`)

#### Scenario: Catalog fetch failure falls back to presets in the popup
- **WHEN** `GET /conditions-catalog` fails and the owning player opens the add-condition popup's **Scegli esistente** tab
- **THEN** the picker lists a hardcoded fallback preset list rather than being empty

#### Scenario: Owner adds a freeform condition via the custom tab
- **WHEN** the owning player opens the add-condition popup's **Aggiungi custom** tab, types a condition name, chooses a sign and a weight, and confirms
- **THEN** the app issues `PATCH .../status` adding that condition to the chosen collection as entered

#### Scenario: Critical banner appears on every tab
- **GIVEN** a character whose `criticalState` is `true`
- **WHEN** the user switches to the INV tab
- **THEN** the amber `⚠ STATO CRITICO — NON PUOI AGIRE` banner is still displayed beneath the tab bar

### Requirement: List row names fit their available width

Every list-row control that pairs a display name with adjacent fixed controls — a sign glyph, a weight tag, a quantity, a remove `✕`, or trailing metadata — SHALL keep the name within the horizontal space left over after those controls. The name element SHALL be allowed to shrink below its content's intrinsic width (`min-width: 0`) and SHALL **wrap onto additional lines** rather than overflow the row, be clipped, or push its sibling controls out of (or over) the row. A single unbroken long token SHALL also break rather than overflow. The fixed sibling controls SHALL retain their size and SHALL NOT be compressed to make room for the name.

This applies to the rows of the full-screen catalog picker and the skill / talent / inventory list rows. On these surfaces, wrapping (not `…` ellipsis truncation) is the chosen behaviour.

**Exception:** the active-condition rows on the SALUTE tab SHALL NOT wrap. They keep the name within its available width (`min-width: 0`, never overflowing the row or displacing the signed value), but they truncate it on a single line with a trailing `…` so the rows of the two half-width columns keep a constant height, per the `Status and conditions editor` requirement.

#### Scenario: A long name wraps instead of overflowing
- **GIVEN** a catalog picker, skill, talent, or inventory row whose name is longer than the width available after its fixed controls
- **WHEN** the row renders
- **THEN** the name wraps onto additional lines and does not overflow the row or overlap its controls

#### Scenario: Fixed controls keep their size and stay visible
- **GIVEN** a list row with a long name and a trailing control (e.g. a remove `✕`, a weight tag, or a quantity)
- **WHEN** the row renders
- **THEN** the trailing control retains its size and remains visible within the row; only the name yields space

#### Scenario: A single unbroken long token breaks
- **GIVEN** a catalog picker, skill, talent, or inventory row whose name is one long token with no spaces, wider than the available space
- **WHEN** the row renders
- **THEN** the token breaks across lines rather than overflowing the row horizontally

#### Scenario: SALUTE condition rows truncate instead of wrapping
- **GIVEN** a SALUTE active-condition row whose name is longer than its column
- **WHEN** the row renders
- **THEN** the name stays on one line ending in `…`, does not overflow the row, and leaves the signed value visible
