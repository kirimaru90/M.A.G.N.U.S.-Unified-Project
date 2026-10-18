## MODIFIED Requirements

### Requirement: Status and conditions editor

The SALUTE tab SHALL present the character's `status` as owner- and admin-editable via the existing `PATCH .../status` endpoint, laid out per the reference's *Tracciato del Logoramento*, expressed as a **health margin** rather than a raw net-wear count:

- A `SALUTE` indicator showing **health** = `margin − net wear`, where **net wear** = (sum of negative-condition weights) − (sum of positive-condition weights), a `minor` condition weighs `1`, and a `major` condition weighs `2`. The indicator SHALL render the numeric readout `{health}/{margin}` together with a horizontal depleting fill bar whose fill is `health/margin`. Positive conditions MAY push `health` **above** `margin` (overshoot): the numeric readout SHALL show the true value (which MAY exceed `margin` or be negative) while the fill bar SHALL clamp between empty and full. The readout SHALL render in the negative accent (not critical amber) when `health ≤ 0`.
- The character's `margin` is a character-document field (default `4`, per `api-character-stats`), seeded from the species at creation (per `pipboy-character-creation`) and editable here. The `MARGINE` stepper (bounded to a minimum of `1`, writing `PATCH .../status { margin }`) SHALL be presented **only in editor mode**, matching the editor-gating convention used by the S.P.E.C.I.A.L., skills, talents, and inventory editors: an owner or admin who has **not** toggled editor mode on SHALL NOT see the stepper. Because lowering `margin` can cross the critical threshold, the margin write SHALL re-derive and persist `criticalState` in the same PATCH.
- The active-condition list SHALL render as **two columns**: **negative** conditions on the **left** and **positive** conditions on the **right**. Within each column, conditions SHALL be ordered **major before minor** (weight `2` before weight `1`), stable within a weight. Each condition is a full-width row within its column carrying **only** a **signed weight value** followed by the condition name. The signed value SHALL be `−1` / `−2` for negative conditions (using the minus sign U+2212, not a hyphen) and `+1` / `+2` for positive conditions, matching the condition's weight. The row SHALL NOT show a separate sign glyph, a `BASE` / `MODERATA ×2` weight tag, or a `✕` remove control.
- The condition name SHALL render on a **single line**. When the name does not fit the width left after the signed value, it SHALL be **truncated with a trailing `…` ellipsis** rather than wrapping, so every condition row has the **same height** regardless of name length. The signed value SHALL keep its size and stay visible. The row SHALL expose the condition's **full name** through its `title` and its accessible name, so a truncated name can still be read. This is the condition-row exception to the `List row names fit their available width` requirement.
- **Activating a condition row SHALL open the condition detail card** for every viewer of the sheet, whether or not they may write the character. The card is a popup in the condition's polarity accent showing:
  - the condition's **signed weight value** and its **full name**;
  - a **polarity label** (`NEGATIVA` / `POSITIVA`) and a **severity label** (`BASE` for `minor`, `MODERATA` for `major`);
  - the condition's `description`, or the placeholder `Nessuna descrizione` when it has none.

  The description SHALL NOT be editable from the card. The card SHALL offer a `CHIUDI` button, a `✕` in its top-right corner, and backdrop dismissal, and each of these SHALL close it without any write. When the user may write the character, the card SHALL also offer a danger-style `RIMUOVI` button that **directly** removes the condition (representing rest / stimpack / RadAway) by issuing `PATCH .../status` with the condition's id in the matching collection's `deletedIds`, with no further confirmation dialog. When the user may not write the character, the card SHALL NOT show `RIMUOVI`.
- The two columns SHALL be **colour-coded**: negative conditions use a **muted negative (red-family) accent**, positive conditions a green accent. This negative accent SHALL be visually distinct from the full-glow critical amber, which stays reserved for the critical state alone (banner/ring/LED per `pipboy-terminal-chrome`).
- A dashed empty state (`nessuna condizione attiva`) when both collections are empty; a per-column empty affordance when only one collection is empty.
- **Two polarity add triggers**, shown when the user may write the character, placed beneath the condition columns side by side:
  - `− NEGATIVA`, in the negative accent;
  - `+ POSITIVA`, in the positive accent.

  They replace the former single `+ AGGIUNGI CONDIZIONE` trigger. Each opens a **two-tab add-condition popup scoped to its polarity**, which mirrors the inventory add-item popup. The popup has an `OK` action and a small red `✕` that cancels without any write. It owns no persistence: it hands the assembled condition to its caller, which issues `PATCH .../status` against the collection that matches the trigger's polarity. The popup title SHALL name the polarity (`AGGIUNGI · − NEGATIVA` / `AGGIUNGI · + POSITIVA`). The popup SHALL present:
  - **Scegli esistente**: a selection over the conditions catalog (`GET /conditions-catalog`), presented via the full-screen catalog picker sheet and **filtered to presets of the trigger's polarity**.
    - Choosing a preset copies its `name` and `defaultSeverity`, and its `description` when present.
    - When the catalog fetch fails, the picker SHALL fall back to a small hardcoded preset list (filtered to the same polarity) rather than being empty.
    - When no preset of that polarity is available, the popup SHALL open on the **Aggiungi custom** tab, per the shared add-popup empty-catalog convention.
    - The picker SHALL group the presets into two sections via the picker's section-grouping hook: **`BASE`** (`minor`) first, then **`MODERATA`** (`major`). Entries are alphabetical within each section.
    - Each picker row SHALL show the preset's **signed weight value** (`−1`/`−2` for negatives, `+1`/`+2` for positives; the same notation as the sheet, replacing the former `×1`/`×2` abbreviation) followed by its name. Its `description`, when present, SHALL appear on a second line beneath the name.
    - The row SHALL carry the polarity accent, **visibly rendered** (negatives in the muted-red negative colour, positives green), per the `Full-screen catalog picker sheet` requirement.
  - **Aggiungi custom**: a freeform `nome condizione` input, an **optional** `descrizione` text field, and a weight toggle labelled with signed values (`BASE −1` / `MODERATA −2` for negatives, `BASE +1` / `MODERATA +2` for positives).
    - There SHALL be **no** `NEGATIVA`/`POSITIVA` sign toggle; the trigger fixes the polarity.
    - `OK` adds exactly one condition (no multiselect). It carries a `description` only when the field is non-empty after trimming; an empty field sends no `description` key.

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

#### Scenario: Tapping a condition opens its detail card
- **GIVEN** the owning player is viewing an active `major` negative condition `STREMATO` whose description is `Endurance e azioni prolungate`
- **WHEN** they activate its row
- **THEN** a detail card opens showing `−2`, `STREMATO`, the labels `NEGATIVA` and `MODERATA`, and the text `Endurance e azioni prolungate`, with `CHIUDI` and `RIMUOVI` buttons
- **AND** no `PATCH` has been issued yet

#### Scenario: A condition without a description shows a placeholder
- **GIVEN** an active condition with no `description`
- **WHEN** its detail card opens
- **THEN** the card shows `Nessuna descrizione` in place of the description

#### Scenario: RIMUOVI removes the condition directly
- **GIVEN** the owning player has a condition's detail card open
- **WHEN** they activate `RIMUOVI`
- **THEN** the card closes and the app issues `PATCH .../status` with that condition's id in the matching collection's `deletedIds`, with no further confirmation dialog

#### Scenario: Closing the detail card keeps the condition
- **GIVEN** a condition's detail card is open
- **WHEN** the user activates `CHIUDI`, the `✕`, or taps the card's backdrop
- **THEN** the card closes, no `PATCH .../status` is issued, and the condition row remains

#### Scenario: Read-only viewers can open the card without RIMUOVI
- **GIVEN** a user who may not write the character is viewing its SALUTE tab
- **WHEN** they activate an active-condition row
- **THEN** the detail card opens with the condition's value, name, labels, and description and a `CHIUDI` button, but no `RIMUOVI` button, and no write is possible

#### Scenario: Two polarity triggers replace the single add trigger
- **GIVEN** the owning player is viewing the SALUTE tab
- **WHEN** the tab renders
- **THEN** a `− NEGATIVA` trigger in the negative accent and a `+ POSITIVA` trigger in the positive accent are shown beneath the columns, and no `+ AGGIUNGI CONDIZIONE` trigger is shown

#### Scenario: Add triggers are hidden from read-only viewers
- **GIVEN** a user who may not write the character is viewing its SALUTE tab
- **WHEN** the tab renders
- **THEN** neither the `− NEGATIVA` nor the `+ POSITIVA` trigger is shown

#### Scenario: The negative trigger's picker lists only negative presets
- **GIVEN** the conditions catalog holds both negative and positive presets
- **WHEN** the owning player activates `− NEGATIVA` and opens the **Scegli esistente** picker
- **THEN** the popup title reads `AGGIUNGI · − NEGATIVA` and the picker lists only `negative` presets

#### Scenario: The positive trigger's picker lists only positive presets
- **GIVEN** the conditions catalog holds both negative and positive presets
- **WHEN** the owning player activates `+ POSITIVA` and opens the **Scegli esistente** picker
- **THEN** the picker lists only `positive` presets

#### Scenario: Picker groups presets BASE then MODERATA, alphabetical within each
- **GIVEN** the negative presets `STREMATO` (`minor`), `AVVELENATO` (`major`), `CIECO` (`minor`), and `MUTILATO` (`major`)
- **WHEN** the owning player opens the negative picker
- **THEN** a `BASE` section header precedes `CIECO`, `STREMATO`, then a `MODERATA` section header precedes `AVVELENATO`, `MUTILATO`
- **AND** each header shows its section's entry count

#### Scenario: Picker rows show signed weight and description
- **GIVEN** a `negative`/`major` preset `AVVELENATO` with a description, and a `positive`/`minor` preset `ISPIRATO`
- **WHEN** each polarity's picker renders
- **THEN** the `AVVELENATO` row shows `−2`, its name, and its description on a second line, rendered in the muted-red negative colour, and the `ISPIRATO` row shows `+1` rendered in the green positive colour
- **AND** no row shows `×1` or `×2`

#### Scenario: Owner adds a condition from a catalog suggestion via the popup
- **WHEN** the owning player activates `− NEGATIVA`, opens the **Scegli esistente** tab, and selects a catalog entry in the picker
- **THEN** the app issues `PATCH .../status` adding to `negativeConditions` a condition whose `name`/`severity` match the catalog entry's `name`/`defaultSeverity`, carrying the entry's `description` when it has one

#### Scenario: Catalog fetch failure falls back to presets in the popup
- **WHEN** `GET /conditions-catalog` fails and the owning player activates `− NEGATIVA` and opens the **Scegli esistente** tab
- **THEN** the picker lists the hardcoded fallback negative presets rather than being empty

#### Scenario: A polarity with no presets opens on the custom tab
- **GIVEN** no preset of the positive polarity is available (e.g. the catalog fetch failed and the fallback list holds only negatives)
- **WHEN** the owning player activates `+ POSITIVA`
- **THEN** the popup opens with the **Aggiungi custom** tab active

#### Scenario: The custom tab has no sign toggle
- **WHEN** the owning player opens either polarity's **Aggiungi custom** tab
- **THEN** it shows a name input, a `descrizione` field, and a `BASE`/`MODERATA` weight toggle labelled with that polarity's signed values, and no `NEGATIVA`/`POSITIVA` toggle

#### Scenario: Owner adds a freeform condition with a description
- **WHEN** the owning player activates `+ POSITIVA`, opens **Aggiungi custom**, types a name and the description `Charisma e tiri sociali`, chooses `MODERATA`, and confirms
- **THEN** the app issues `PATCH .../status` adding to `positiveConditions` a `major` condition with that name and `description: "Charisma e tiri sociali"`

#### Scenario: An empty custom description sends no description
- **WHEN** the owning player adds a custom condition leaving `descrizione` blank or whitespace-only
- **THEN** the PATCH item carries no `description` key

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

#### Scenario: Critical banner appears on every tab
- **GIVEN** a character whose `criticalState` is `true`
- **WHEN** the user switches to the INV tab
- **THEN** the amber `⚠ STATO CRITICO — NON PUOI AGIRE` banner is still displayed beneath the tab bar

### Requirement: Full-screen catalog picker sheet

The sheet SHALL provide a reusable **full-screen catalog picker** used wherever an entry is selected from a catalog. It replaces the native `<datalist>` autocomplete (which is cramped and unreadable on mobile). The picker SHALL:

- open as a full-height overlay when a "choose existing" field is activated;
- present a search input at the top that filters the supplied entries by case-insensitive substring on their display name, updating as the user types;
- **not raise the on-screen keyboard on open on touch devices**: the search input SHALL receive focus automatically on open **only** when the device's primary pointer is fine (`(pointer: fine)`, e.g. mouse or trackpad). On a coarse/touch primary pointer the picker SHALL open with **no** element focused that would summon the keyboard, and the user focuses the search input by tapping it. This applies to every picker instance (conditions, skills, talents, inventory items, tag pickers, character-creation skills);
- render the matching entries as a scrollable list of large-tap-target rows, with scrolling confined to the sheet;
- present those matching entries in **ascending alphabetical order of display name**, case- and accent-insensitive (via `localeCompare`), regardless of the order in which the caller supplied them. This client-side ordering is a **defensive safety net**: it guarantees every picker list is alphabetical even when its entries are sourced client-side (e.g. hardcoded fallback presets) or fetched without server-side ordering. When a section-grouping hook is supplied, this alphabetical ordering applies **within each section**. When a free-text "use my typed text" affordance is present, it SHALL remain **first**, ahead of the alphabetical matches (and ahead of any section);
- on tapping a row, return the chosen entry to the caller and close;
- offer a `✕` (and a backdrop tap) that closes the sheet without selecting anything.

The picker SHALL accept **optional** per-row presentation hooks supplied by the caller: a `renderLead(entry)` returning content rendered **before** the display name on its line (e.g. a signed weight value), a `renderMeta(entry)` returning trailing per-row metadata (e.g. a weight abbreviation), a `rowAccent(entry)` returning a colour-accent class for the row, and a `renderSub(entry)` returning content rendered on a **new line below** the entry's display name (e.g. a row of tag chips or a description). When a caller omits these hooks, each row SHALL render its display name only, exactly as before; these hooks change presentation only and never alter which entry is returned. `renderSub` content SHALL appear beneath the name (not trailing on the name's line, which is `renderMeta`'s slot), and a caller MAY supply `renderSub` and `renderMeta` independently. When a `rowAccent` is supplied, its accent SHALL be **visibly rendered** on the row — the accent's colour and border SHALL actually apply and SHALL NOT be overridden by the picker's base row style. The picker owns no persistence and imposes no catalog-specific behaviour — it only changes **how** an entry is chosen and displayed. It SHALL be theme-consistent with the rest of the Pip-Boy shell and safe-area aware. Each row's display name SHALL stay within the space left after any trailing metadata, per the `List row names fit their available width` requirement.

The picker SHALL also accept an **optional section-grouping hook** that assigns each entry to a section and gives each section a display label and a sort order. When it is supplied:

- the matching entries SHALL be rendered in **sections ordered by the section order** (ascending), each preceded by a **section header** showing the section's label and the number of matching entries in it;
- entries within a section SHALL be ordered alphabetically as above;
- a section with no matching entries (e.g. while searching) SHALL NOT be rendered, header included;
- section headers SHALL stay pinned to the top of the scrolling list while their section is in view;
- the hook changes grouping and order only and never alters which entry a tap returns.

When the hook is omitted, the list SHALL render flat, with no section headers, exactly as before.

#### Scenario: Picker opens full-screen and filters as you type
- **GIVEN** a catalog with several entries
- **WHEN** the user activates a "choose existing" field and types into the picker's search input
- **THEN** a full-height sheet is shown and its list narrows to entries whose name contains the typed text, case-insensitively

#### Scenario: Picker does not raise the keyboard on touch devices
- **GIVEN** a device whose primary pointer is coarse (touch)
- **WHEN** any catalog picker opens
- **THEN** the search input is not the focused element, so no on-screen keyboard is raised
- **AND** tapping the search input focuses it and filtering works as usual

#### Scenario: Picker focuses search on open with a fine pointer
- **GIVEN** a device whose primary pointer is fine (mouse or trackpad)
- **WHEN** a catalog picker opens
- **THEN** the search input is the focused element, so the user can type immediately

#### Scenario: Entries render in alphabetical order regardless of supplied order
- **GIVEN** a caller opens the picker with entries supplied in non-alphabetical order (including mixed-case and accented names)
- **WHEN** the list renders
- **THEN** the rows appear in ascending alphabetical order of display name, case- and accent-insensitive

#### Scenario: A free-text affordance stays first, ahead of the alphabetical matches
- **GIVEN** a picker configured with a free-text "use my typed text" affordance and a non-empty typed term
- **WHEN** the list renders
- **THEN** the free-text row appears first, followed by the catalog matches in alphabetical order

#### Scenario: Selecting a row returns the entry and closes
- **WHEN** the user taps a row in the picker
- **THEN** the sheet closes and the chosen entry is handed back to the caller

#### Scenario: Dismissing the picker selects nothing
- **WHEN** the user taps the picker's `✕` or the backdrop
- **THEN** the sheet closes and no selection is made

#### Scenario: A renderLead hook adds content before the name
- **GIVEN** a caller supplies a `renderLead` hook returning a signed value per row
- **WHEN** the list renders
- **THEN** each row shows the caller's lead content immediately before its display name on the same line, while tapping the row still returns the same entry

#### Scenario: Rows render name-only when no presentation hooks are given
- **GIVEN** a caller opens the picker without `renderLead`/`renderMeta`/`rowAccent`/`renderSub`
- **WHEN** the list renders
- **THEN** each row shows its display name only, with no accent, trailing metadata, or second line

#### Scenario: Per-row hooks add accent and trailing metadata
- **GIVEN** a caller supplies `renderMeta` and `rowAccent`
- **WHEN** the list renders
- **THEN** each row shows the caller's trailing metadata and carries the caller's accent class, while tapping it still returns the same entry

#### Scenario: A renderSub hook adds a second line below the name
- **GIVEN** a caller supplies a `renderSub` hook returning per-row content
- **WHEN** the list renders
- **THEN** each row shows its display name on the first line and the caller's `renderSub` content on a new line beneath it, while tapping the row still returns the same entry

#### Scenario: A supplied accent is visibly rendered on the row
- **GIVEN** a caller supplies a `rowAccent` returning a negative (red-family) accent class
- **WHEN** the list renders
- **THEN** the row's rendered text/border colour is the negative accent colour — the base row style does not override it

#### Scenario: A long entry name stays within its row
- **GIVEN** an entry whose display name is longer than the row width and a caller-supplied trailing meta
- **WHEN** the list renders
- **THEN** the name wraps onto additional lines within the row and the trailing meta stays right-aligned and visible

#### Scenario: A grouping hook renders ordered sections with counts
- **GIVEN** a caller supplies a section-grouping hook placing entries `B2`, `A2` in section order `2` labelled `SECOND` and `B1`, `A1` in section order `1` labelled `FIRST`
- **WHEN** the list renders
- **THEN** the header `FIRST` with count `2` is followed by `A1`, `B1`, then the header `SECOND` with count `2` is followed by `A2`, `B2`

#### Scenario: Searching hides sections with no matches
- **GIVEN** a grouped picker where only entries of one section contain the typed text
- **WHEN** the user types that text into the search input
- **THEN** only that section's header and matching rows are shown, its count reflects the matches, and the other section's header is not rendered

#### Scenario: Without a grouping hook the list stays flat
- **GIVEN** a caller opens the picker without a section-grouping hook
- **WHEN** the list renders
- **THEN** no section header is rendered and the rows form a single alphabetical list
