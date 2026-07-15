## MODIFIED Requirements

### Requirement: Full-screen catalog picker sheet

The sheet SHALL provide a reusable **full-screen catalog picker** used wherever an entry is selected from a catalog. It replaces the native `<datalist>` autocomplete (which is cramped and unreadable on mobile). The picker SHALL:

- open as a full-height overlay when a "choose existing" field is activated;
- present a search input at the top that filters the supplied entries by case-insensitive substring on their display name, updating as the user types;
- render the matching entries as a scrollable list of large-tap-target rows, with scrolling confined to the sheet;
- present those matching entries in **ascending alphabetical order of display name**, case- and accent-insensitive (via `localeCompare`), regardless of the order in which the caller supplied them. This client-side ordering is a **defensive safety net**: it guarantees every picker list is alphabetical even when its entries are sourced client-side (e.g. hardcoded fallback presets) or fetched without server-side ordering. When a free-text "use my typed text" affordance is present, it SHALL remain **first**, ahead of the alphabetical matches;
- on tapping a row, return the chosen entry to the caller and close;
- offer a `✕` (and a backdrop tap) that closes the sheet without selecting anything.

The picker SHALL accept **optional** per-row presentation hooks supplied by the caller: a `renderMeta(entry)` returning trailing per-row metadata (e.g. a weight abbreviation), a `rowAccent(entry)` returning a colour-accent class for the row, and a `renderSub(entry)` returning content rendered on a **new line below** the entry's display name (e.g. a row of tag chips). When a caller omits these hooks, each row SHALL render its display name only, exactly as before; these hooks change presentation only and never alter which entry is returned. `renderSub` content SHALL appear beneath the name (not trailing on the name's line, which is `renderMeta`'s slot), and a caller MAY supply `renderSub` and `renderMeta` independently. When a `rowAccent` is supplied, its accent SHALL be **visibly rendered** on the row — the accent's colour and border SHALL actually apply and SHALL NOT be overridden by the picker's base row style. The picker owns no persistence and imposes no catalog-specific behaviour — it only changes **how** an entry is chosen and displayed. It SHALL be theme-consistent with the rest of the Pip-Boy shell and safe-area aware. Each row's display name SHALL stay within the space left after any trailing metadata, per the `List row names fit their available width` requirement.

#### Scenario: Picker opens full-screen and filters as you type
- **GIVEN** a catalog with several entries
- **WHEN** the user activates a "choose existing" field and types into the picker's search input
- **THEN** a full-height sheet is shown and its list narrows to entries whose name contains the typed text, case-insensitively

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

#### Scenario: Rows render name-only when no presentation hooks are given
- **GIVEN** a caller opens the picker without `renderMeta`/`rowAccent`/`renderSub`
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

### Requirement: Inventory add-item popup

Each `INV` subtab SHALL offer a single add-path: a `+` trigger (available in both view and editor mode) that opens a modal popup with an `OK` action and a small red `✕` that cancels without any write. The popup owns no persistence — on `OK` it hands the assembled item body to its caller, which issues the `PATCH .../inventory`.

The popup SHALL present two inner tabs:
- **Scegli esistente** — a selection over `GET /equipment-catalog` filtered to the subtab's `kind`, presented via the **full-screen catalog picker sheet** (not a native `<datalist>`): activating the field opens the picker, and choosing an entry copies the chosen template onto the character (copy-on-use). Instantiating a `consumable`/`misc` template SHALL always add `quantity: 1` (templates carry no default quantity); `description` is copied when present. This tab SHALL be present for **all four** subtabs, including `Vari`, whose kind is `misc`. For the `Armi` and `Armature` subtabs (kinds `weapon`/`armor`), the picker SHALL supply a `renderSub` hook that renders the template's **tags on a second line beneath the name** as chips: each `core` tag chip SHALL render with a tinted fill and solid border, each `extra` tag chip SHALL render transparent with a dashed border, and neither SHALL carry a `CORE`/`EXTRA` text label (reusing the existing `pb-chip--core`/`pb-chip--extra` visual language, differentiating type by background/border only). A template with no tags SHALL render name-only. The tags SHALL be shown `core`-first then `extra`, alphabetical within each group, matching the order the catalog persists.
- **Aggiungi custom** — a kind-shaped custom entry form: name + `core`/`extra` tags for `Armi`/`Armature`; name + description + quantity for `Consumabili` and `Vari`. In the tag portion, adding or renaming a tag SHALL autocomplete from the tag catalog via the picker sheet (per the gear editor requirement).

Because every subtab now has a catalog kind (`weapon`, `armor`, `consumable`, `misc`), the popup SHALL default to the **Scegli esistente** tab for all four subtabs.

#### Scenario: Vari popup offers Scegli esistente from the misc catalog via the picker
- **GIVEN** the equipment catalog holds one or more `misc` entries
- **WHEN** the owning player opens the add-item popup on the `Vari` subtab and activates the Scegli esistente field
- **THEN** the full-screen catalog picker opens listing the `misc` catalog entries

#### Scenario: Weapon picker rows show tags on a second line, differentiated by background with no label
- **GIVEN** a `weapon` catalog entry with a `core` tag `energia` and an `extra` tag `automatica`
- **WHEN** the owning player opens the add-item popup on the `Armi` subtab and activates the Scegli esistente field
- **THEN** the picker row shows the weapon name on the first line and, on a second line beneath it, an `energia` chip with a tinted fill/solid border and an `automatica` chip that is transparent with a dashed border, neither carrying a `CORE`/`EXTRA` text label

#### Scenario: A weapon template with no tags renders name-only in the picker
- **GIVEN** a `weapon` catalog entry that carries no tags
- **WHEN** the owning player opens the `Armi` add-item picker
- **THEN** that entry's row shows the weapon name only, with no second line

#### Scenario: Selecting a misc template copies it onto inventory.misc with quantity one
- **GIVEN** a `misc` catalog entry `{ name: "Chiave inglese", description: "Attrezzo" }`
- **WHEN** the owning player selects it in the `Vari` popup's picker and confirms
- **THEN** the app issues `PATCH .../inventory { misc: { items: [{ name: "Chiave inglese", description: "Attrezzo", quantity: 1 }] } }`

#### Scenario: Cancel writes nothing
- **WHEN** the owning player opens the popup and taps the red `✕`
- **THEN** the popup closes and no `PATCH` is issued
