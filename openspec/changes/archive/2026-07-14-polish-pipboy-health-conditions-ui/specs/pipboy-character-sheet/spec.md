## MODIFIED Requirements

### Requirement: Status and conditions editor

The SALUTE tab SHALL present the character's `status` as owner- and admin-editable via the existing `PATCH .../status` endpoint, laid out per the reference's *Tracciato del Logoramento*, expressed as a **health margin** rather than a raw net-wear count:

- A `SALUTE` indicator showing **health** = `margin − net wear`, where **net wear** = (sum of negative-condition weights) − (sum of positive-condition weights), a `minor` condition weighs `1`, and a `major` condition weighs `2`. The indicator SHALL render the numeric readout `{health}/{margin}` together with a horizontal depleting fill bar whose fill is `health/margin`. Positive conditions MAY push `health` **above** `margin` (overshoot): the numeric readout SHALL show the true value (which MAY exceed `margin` or be negative) while the fill bar SHALL clamp between empty and full. The readout SHALL render in the negative accent (not critical amber) when `health ≤ 0`.
- The character's `margin` is a character-document field (default `4`, per `api-character-stats`), seeded from the species at creation (per `pipboy-character-creation`) and editable here. The `MARGINE` stepper (bounded to a minimum of `1`, writing `PATCH .../status { margin }`) SHALL be presented **only in editor mode**, matching the editor-gating convention used by the S.P.E.C.I.A.L., skills, talents, and inventory editors: an owner or admin who has **not** toggled editor mode on SHALL NOT see the stepper. Because lowering `margin` can cross the critical threshold, the margin write SHALL re-derive and persist `criticalState` in the same PATCH.
- The active-condition list SHALL render as **two columns**: **negative** conditions on the **left** and **positive** conditions on the **right**. Within each column, conditions SHALL be ordered **major before minor** (weight `2` before weight `1`), stable within a weight. Each condition is a full-width button within its column carrying a `−`/`+` sign glyph, the condition name, a `BASE` / `MODERATA ×2` weight tag, and a `✕`. Activating a row removes that condition (representing rest / stimpack / RadAway). The condition name SHALL remain within the space left after the sign glyph, weight tag, and `✕`, per the `List row names fit their available width` requirement.
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

#### Scenario: Tapping a condition removes it
- **WHEN** the owning player activates an active-condition row
- **THEN** the app issues `PATCH .../status` with that condition's id in the matching collection's `deletedIds`

#### Scenario: Long condition name stays within its row
- **GIVEN** a condition whose name is longer than the width of its column
- **WHEN** the active-condition list renders
- **THEN** the name wraps onto additional lines within the column and the `−`/`+` sign, the weight tag, and the `✕` remain visible and un-overlapped (not pushed out of the row)

#### Scenario: Critical banner appears on every tab
- **GIVEN** a character whose `criticalState` is `true`
- **WHEN** the user switches to the INV tab
- **THEN** the amber `⚠ STATO CRITICO — NON PUOI AGIRE` banner is still displayed beneath the tab bar

### Requirement: Full-screen catalog picker sheet

The sheet SHALL provide a reusable **full-screen catalog picker** used wherever an entry is selected from a catalog. It replaces the native `<datalist>` autocomplete (which is cramped and unreadable on mobile). The picker SHALL:

- open as a full-height overlay when a "choose existing" field is activated;
- present a search input at the top that filters the supplied entries by case-insensitive substring on their display name, updating as the user types;
- render the matching entries as a scrollable list of large-tap-target rows, with scrolling confined to the sheet;
- on tapping a row, return the chosen entry to the caller and close;
- offer a `✕` (and a backdrop tap) that closes the sheet without selecting anything.

The picker SHALL accept **optional** per-row presentation hooks supplied by the caller: a `renderMeta(entry)` returning trailing per-row metadata (e.g. a weight abbreviation) and a `rowAccent(entry)` returning a colour-accent class for the row. When a caller omits these hooks, each row SHALL render its display name only, exactly as before; these hooks change presentation only and never alter which entry is returned. When a `rowAccent` is supplied, its accent SHALL be **visibly rendered** on the row — the accent's colour and border SHALL actually apply and SHALL NOT be overridden by the picker's base row style. The picker owns no persistence and imposes no catalog-specific behaviour — it only changes **how** an entry is chosen and displayed. It SHALL be theme-consistent with the rest of the Pip-Boy shell and safe-area aware. Each row's display name SHALL stay within the space left after any trailing metadata, per the `List row names fit their available width` requirement.

#### Scenario: Picker opens full-screen and filters as you type
- **GIVEN** a catalog with several entries
- **WHEN** the user activates a "choose existing" field and types into the picker's search input
- **THEN** a full-height sheet is shown and its list narrows to entries whose name contains the typed text, case-insensitively

#### Scenario: Selecting a row returns the entry and closes
- **WHEN** the user taps a row in the picker
- **THEN** the sheet closes and the chosen entry is handed back to the caller

#### Scenario: Dismissing the picker selects nothing
- **WHEN** the user taps the picker's `✕` or the backdrop
- **THEN** the sheet closes and no selection is made

#### Scenario: Rows render name-only when no presentation hooks are given
- **GIVEN** a caller opens the picker without `renderMeta`/`rowAccent`
- **WHEN** the list renders
- **THEN** each row shows its display name only, with no accent or trailing metadata

#### Scenario: Per-row hooks add accent and trailing metadata
- **GIVEN** a caller supplies `renderMeta` and `rowAccent`
- **WHEN** the list renders
- **THEN** each row shows the caller's trailing metadata and carries the caller's accent class, while tapping it still returns the same entry

#### Scenario: A supplied accent is visibly rendered on the row
- **GIVEN** a caller supplies a `rowAccent` returning a negative (red-family) accent class
- **WHEN** the list renders
- **THEN** the row's rendered text/border colour is the negative accent colour — the base row style does not override it

#### Scenario: A long entry name stays within its row
- **GIVEN** an entry whose display name is longer than the row width and a caller-supplied trailing meta
- **WHEN** the list renders
- **THEN** the name wraps onto additional lines within the row and the trailing meta stays right-aligned and visible

## ADDED Requirements

### Requirement: List row names fit their available width

Every list-row control that pairs a display name with adjacent fixed controls — a sign glyph, a weight tag, a quantity, a remove `✕`, or trailing metadata — SHALL keep the name within the horizontal space left over after those controls. The name element SHALL be allowed to shrink below its content's intrinsic width (`min-width: 0`) and SHALL **wrap onto additional lines** rather than overflow the row, be clipped, or push its sibling controls out of (or over) the row. A single unbroken long token SHALL also break rather than overflow. The fixed sibling controls SHALL retain their size and SHALL NOT be compressed to make room for the name.

This applies to the condition rows on the SALUTE tab, the rows of the full-screen catalog picker, and the skill / talent / inventory list rows. Wrapping (not `…` ellipsis truncation) is the chosen behaviour, consistent across these surfaces.

#### Scenario: A long name wraps instead of overflowing
- **GIVEN** a list row whose name is longer than the width available after its fixed controls
- **WHEN** the row renders
- **THEN** the name wraps onto additional lines and does not overflow the row or overlap its controls

#### Scenario: Fixed controls keep their size and stay visible
- **GIVEN** a list row with a long name and a trailing control (e.g. a remove `✕`, a weight tag, or a quantity)
- **WHEN** the row renders
- **THEN** the trailing control retains its size and remains visible within the row; only the name yields space

#### Scenario: A single unbroken long token breaks
- **GIVEN** a name that is one long token with no spaces, wider than the available space
- **WHEN** the row renders
- **THEN** the token breaks across lines rather than overflowing the row horizontally
