## ADDED Requirements

### Requirement: Full-screen catalog picker sheet

The sheet SHALL provide a reusable **full-screen catalog picker** used wherever an entry is selected from a catalog. It replaces the native `<datalist>` autocomplete (which is cramped and unreadable on mobile). The picker SHALL:

- open as a full-height overlay when a "choose existing" field is activated;
- present a search input at the top that filters the supplied entries by case-insensitive substring on their display name, updating as the user types;
- render the matching entries as a scrollable list of large-tap-target rows, with scrolling confined to the sheet;
- on tapping a row, return the chosen entry to the caller and close;
- offer a `✕` (and a backdrop tap) that closes the sheet without selecting anything.

The picker owns no persistence and imposes no catalog-specific behaviour — it only changes **how** an entry is chosen. It SHALL be theme-consistent with the rest of the Pip-Boy shell and safe-area aware.

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

## MODIFIED Requirements

### Requirement: Inventory add-item popup

Each `INV` subtab SHALL offer a single add-path: a `+` trigger (available in both view and editor mode) that opens a modal popup with an `OK` action and a small red `✕` that cancels without any write. The popup owns no persistence — on `OK` it hands the assembled item body to its caller, which issues the `PATCH .../inventory`.

The popup SHALL present two inner tabs:
- **Scegli esistente** — a selection over `GET /equipment-catalog` filtered to the subtab's `kind`, presented via the **full-screen catalog picker sheet** (not a native `<datalist>`): activating the field opens the picker, and choosing an entry copies the chosen template onto the character (copy-on-use). This tab SHALL be present for **all four** subtabs, including `Vari`, whose kind is `misc`.
- **Aggiungi custom** — a kind-shaped custom entry form: name + `core`/`extra` tags for `Armi`/`Armature`; name + description + quantity for `Consumabili` and `Vari`. In the tag portion, adding or renaming a tag SHALL autocomplete from the tag catalog via the picker sheet (per the gear editor requirement).

Because every subtab now has a catalog kind (`weapon`, `armor`, `consumable`, `misc`), the popup SHALL default to the **Scegli esistente** tab for all four subtabs.

#### Scenario: Vari popup offers Scegli esistente from the misc catalog via the picker
- **GIVEN** the equipment catalog holds one or more `misc` entries
- **WHEN** the owning player opens the add-item popup on the `Vari` subtab and activates the Scegli esistente field
- **THEN** the full-screen catalog picker opens listing the `misc` catalog entries

#### Scenario: Selecting a misc template copies it onto inventory.misc
- **GIVEN** a `misc` catalog entry `{ name: "Chiave inglese", defaultQuantity: 1 }`
- **WHEN** the owning player selects it in the `Vari` popup's picker and confirms
- **THEN** the app issues `PATCH .../inventory { misc: { items: [{ name: "Chiave inglese", quantity: 1 }] } }`

#### Scenario: Cancel writes nothing
- **WHEN** the owning player opens the popup and taps the red `✕`
- **THEN** the popup closes and no `PATCH` is issued

### Requirement: Inventory and gear editor

The `INV` first-level tab SHALL present the character's `inventory` across four subtabs — `Armi` (`inventory.weapons`), `Armature` (`inventory.equip`), `Consumabili` (`inventory.consumables`), and `Vari` (`inventory.misc`) — each owner- and admin-editable via the existing `PATCH .../inventory` endpoint. Each subtab SHALL show only its own collection's items. The `Vari` collection is the character schema's `misc` (`GenericItem[]`) collection — the renamed successor of the former `other` collection, with the same name/description/quantity shape as consumables — which the API accepts on `PATCH .../inventory { misc: … }`.

- `Armi` and `Armature`: one row-card per item, each showing the item name, an amber `DANNEGGIATA` tag when any of its tags is marked damaged, and its tags as chips. `CORE` chips render with a tinted fill and solid border; `EXTRA` chips render outline-only with a dashed border. Each chip carries a small `CORE`/`EXTRA` kind-label.
- Item tags SHALL render all `core` tags first, then all `extra` tags, alphabetical by name within each group. This order is now **guaranteed by the server** (`api-character-inventory` persists tags canonically), so the client MAY render the stored array directly and per-tag edit actions (toggle damaged, rename, remove) target tags by their stored index.
- Tapping a tag chip in **view** mode SHALL toggle that tag's `damaged` flag (struck-through, dimmed). In **editor** mode a chip's label becomes editable and carries a `✕` remover, and `+ core` / `+ extra` dashed buttons appear to add tags. Adding a tag or editing a tag's name SHALL autocomplete against the tag catalog (`api-tag-catalog`, read via `GET /tag-catalog`) through the full-screen picker sheet: selecting a catalog entry fills the tag's **name** with the entry's `name`. The `core`/`extra` **type** is decided by which affordance was used (`+ core` vs `+ extra`), not by the catalog, which carries no type. Typing a tag name that is not in the catalog SHALL remain valid.
- `Consumabili` and `Vari`: compact dashed-divider rows showing name, `×qty`, a `[−][+]` stepper, and — in editor mode only — a `✕`. In **editor** mode the name SHALL be an inline text input; in view mode it renders as static text. `Vari` rows MAY also carry a `description`.
- Each subtab SHALL offer a single add-path per the `Inventory add-item popup` requirement, available in both view and editor mode. Editor mode SHALL NOT render a separate inline `+ AGGIUNGI …` add row for inventory lists.

All item edits — including renaming a consumable and adjusting its quantity — SHALL be issued as partial `PATCH .../inventory` merges that carry only the changed field, relying on the endpoint's partial-merge guarantee to preserve the item's other fields. Writes to the `Vari` collection SHALL target the `misc` key (`PATCH .../inventory { misc: … }`); the former `other` key is no longer accepted.

#### Scenario: Owner adds a weapon
- **WHEN** the owning player adds a weapon with a name
- **THEN** the app issues `PATCH .../inventory { weapons: { items: [{ name }] } }` and the new item (with its server-assigned id) appears under `Armi`

#### Scenario: Owner adds a custom Vari item
- **WHEN** the owning player adds a custom item under `Vari` with a name, description, and quantity
- **THEN** the app issues `PATCH .../inventory { misc: { items: [{ name, description, quantity }] } }` and the item appears under `Vari`

#### Scenario: Tag name autocompletes from the tag catalog
- **GIVEN** the tag catalog contains an entry `{ name: "Automatica" }`
- **WHEN** the owning player, in editor mode, activates `+ core` (or edits an existing tag's name) and selects `Automatica` in the picker
- **THEN** the tag's name is filled with `Automatica` and its type is `core` (from the affordance used), and the change is persisted via `PATCH .../inventory`

#### Scenario: A non-catalog tag name is still accepted
- **WHEN** the owning player types a tag name that is not present in the tag catalog
- **THEN** the tag is accepted as typed and persisted normally

#### Scenario: Tags render core-first then extra, alphabetical
- **GIVEN** a weapon whose stored tags are `[{name:"Beta",type:"core"},{name:"Zeta",type:"core"},{name:"Alfa",type:"extra"}]`
- **WHEN** its row-card renders
- **THEN** the chips appear in the order `Beta`, `Zeta`, `Alfa`

#### Scenario: Item with any damaged tag shows the DANNEGGIATA marker
- **GIVEN** a weapon with one of its two tags marked `damaged`
- **WHEN** its row-card renders
- **THEN** an amber `DANNEGGIATA` tag is shown on the card
