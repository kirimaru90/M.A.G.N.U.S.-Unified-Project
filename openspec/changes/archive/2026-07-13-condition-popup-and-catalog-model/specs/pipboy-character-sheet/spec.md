## MODIFIED Requirements

### Requirement: Status and conditions editor

The SALUTE tab SHALL present the character's `status` as owner- and admin-editable via the existing `PATCH .../status` endpoint, laid out per the reference's *Tracciato del Logoramento*:

- A `VALORE NETTO` readout showing **net wear** = (sum of negative-condition weights) − (sum of positive-condition weights), where a `minor` condition weighs `1` and a `major` condition weighs `2`. The number renders green normally and amber+glowing when greater than `0`.
- The active-condition list, **negatives sorted before positives**, each a full-width button carrying a `−`/`+` sign glyph, the condition name, a `BASE` / `MODERATA ×2` weight tag, and a `✕`. Activating a row removes that condition (representing rest / stimpack / RadAway).
- A dashed empty state (`nessuna condizione attiva`) when both collections are empty.
- A single add-path: a `+ AGGIUNGI CONDIZIONE` trigger that opens a **two-tab add-condition popup** mirroring the inventory add-item popup (an `OK` action and a small red `✕` that cancels without any write; the popup owns no persistence and hands the assembled condition to its caller, which issues the `PATCH .../status`). The popup SHALL present:
  - **Scegli esistente** — a selection over the conditions catalog (`GET /conditions-catalog`), presented via the full-screen catalog picker sheet; choosing a preset copies its `name`/`defaultSeverity` and routes it to the collection its `polarity` implies (client-side). When the catalog fetch fails, the picker SHALL fall back to a small hardcoded preset list rather than being empty.
  - **Aggiungi custom** — a freeform `nome condizione` input, a `NEGATIVA`/`POSITIVA` sign toggle, and a `BASE ×1`/`MODERATA ×2` weight toggle. `OK` adds exactly one condition (no multiselect).

**Critical state** SHALL be derived by the client as `net wear ≥ 4` and persisted through `PATCH .../status { criticalState }` whenever the condition collections change. When critical, the sheet SHALL show the amber `⚠ STATO CRITICO — NON PUOI AGIRE` banner beneath the tab bar on **every tab**, flip the status-bar dot and label to amber `⚠ CRITICO`, and apply the amber inset ring specified by `pipboy-terminal-chrome`.

#### Scenario: Net wear is computed from weights
- **GIVEN** a character with two `major` negative conditions and one `minor` positive condition
- **WHEN** the SALUTE tab renders
- **THEN** `VALORE NETTO` reads `3` (2+2 − 1) and renders amber

#### Scenario: Negatives sort before positives
- **GIVEN** a character with one positive and one negative condition
- **WHEN** the active-condition list renders
- **THEN** the negative condition appears above the positive one

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

#### Scenario: Crossing the critical threshold persists criticalState
- **GIVEN** a character whose net wear is `3` and `criticalState` is `false`
- **WHEN** the owner adds a `minor` negative condition, taking net wear to `4`
- **THEN** the app issues `PATCH .../status` setting `criticalState: true` alongside the new condition

#### Scenario: Critical banner appears on every tab
- **GIVEN** a character whose `criticalState` is `true`
- **WHEN** the user switches to the INV tab
- **THEN** the amber `⚠ STATO CRITICO — NON PUOI AGIRE` banner is still displayed beneath the tab bar

### Requirement: Inventory add-item popup

Each `INV` subtab SHALL offer a single add-path: a `+` trigger (available in both view and editor mode) that opens a modal popup with an `OK` action and a small red `✕` that cancels without any write. The popup owns no persistence — on `OK` it hands the assembled item body to its caller, which issues the `PATCH .../inventory`.

The popup SHALL present two inner tabs:
- **Scegli esistente** — a selection over `GET /equipment-catalog` filtered to the subtab's `kind`, presented via the **full-screen catalog picker sheet** (not a native `<datalist>`): activating the field opens the picker, and choosing an entry copies the chosen template onto the character (copy-on-use). Instantiating a `consumable`/`misc` template SHALL always add `quantity: 1` (templates carry no default quantity); `description` is copied when present. This tab SHALL be present for **all four** subtabs, including `Vari`, whose kind is `misc`.
- **Aggiungi custom** — a kind-shaped custom entry form: name + `core`/`extra` tags for `Armi`/`Armature`; name + description + quantity for `Consumabili` and `Vari`. In the tag portion, adding or renaming a tag SHALL autocomplete from the tag catalog via the picker sheet (per the gear editor requirement).

Because every subtab now has a catalog kind (`weapon`, `armor`, `consumable`, `misc`), the popup SHALL default to the **Scegli esistente** tab for all four subtabs.

#### Scenario: Vari popup offers Scegli esistente from the misc catalog via the picker
- **GIVEN** the equipment catalog holds one or more `misc` entries
- **WHEN** the owning player opens the add-item popup on the `Vari` subtab and activates the Scegli esistente field
- **THEN** the full-screen catalog picker opens listing the `misc` catalog entries

#### Scenario: Selecting a misc template copies it onto inventory.misc with quantity one
- **GIVEN** a `misc` catalog entry `{ name: "Chiave inglese", description: "Attrezzo" }`
- **WHEN** the owning player selects it in the `Vari` popup's picker and confirms
- **THEN** the app issues `PATCH .../inventory { misc: { items: [{ name: "Chiave inglese", description: "Attrezzo", quantity: 1 }] } }`

#### Scenario: Cancel writes nothing
- **WHEN** the owning player opens the popup and taps the red `✕`
- **THEN** the popup closes and no `PATCH` is issued
