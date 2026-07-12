## MODIFIED Requirements

### Requirement: Action points stepper

The sheet header SHALL present the character's action points per the reference layout: the label `PUNTI AZIONE` and a row of `paMax` pip squares (filled and glowing when "on") **flanked by a `−` control on the left and a `+` control on the right**. The header SHALL NOT render a numeric `paCurrent` readout — the filled square count is the sole indication of the current value. Activating the `−`/`+` controls SHALL write `paCurrent` via the existing `PATCH .../action-points` endpoint.

`paMax` and `paTrackedBy` SHALL NOT be editable from the header. They are edited by the owner (or an admin) in the S.P.E.C.I.A.L. subtab's editor mode, via a `FONTE PA` selector and a `MAX PA` stepper, consistent with `api-character-stats` making both owner-writable. When `paMax` is lowered below `paCurrent`, the app SHALL clamp `paCurrent` to the new maximum and persist the clamped value.

The header SHALL also show the character's name, a bordered species chip, and a `PA · <source approach name>` line derived from `paTrackedBy`.

#### Scenario: Header renders squares flanked by steppers with no number
- **GIVEN** a character with `paMax: 5` and `paCurrent: 2`
- **WHEN** the sheet header renders
- **THEN** a `−` control, five pip squares (two filled), and a `+` control are shown in that order, and no numeric `paCurrent` value is displayed

#### Scenario: Owner spends action points
- **WHEN** the owning player activates the `−` control
- **THEN** the app issues `PATCH .../action-points { paCurrent: <new value> }` and the pips reflect the persisted result

#### Scenario: Owner changes paMax from the editor
- **WHEN** the owning player raises `MAX PA` in the S.P.E.C.I.A.L. subtab's editor mode
- **THEN** the app issues `PATCH .../action-points { paMax: <new value> }` and the header's pip row resizes

#### Scenario: Lowering paMax clamps paCurrent
- **GIVEN** a character with `paMax: 6` and `paCurrent: 6`
- **WHEN** the owner lowers `MAX PA` to `4`
- **THEN** `paCurrent` is clamped to `4` and the clamped value is persisted

### Requirement: Inventory and gear editor

The `INV` first-level tab SHALL present the character's `inventory` across four subtabs — `Armi` (`inventory.weapons`), `Armature` (`inventory.equip`), `Consumabili` (`inventory.consumables`), and `Vari` (`inventory.other`) — each owner- and admin-editable via the existing `PATCH .../inventory` endpoint. Each subtab SHALL show only its own collection's items. The `Vari` collection is the character schema's existing `other` (`GenericItem[]`) collection — the same name/description/quantity shape as consumables — which the API already accepts on `PATCH .../inventory`; no new inventory key is introduced.

- `Armi` and `Armature`: one row-card per item, each showing the item name, an amber `DANNEGGIATA` tag when any of its tags is marked damaged, and its tags as chips. `CORE` chips render with a tinted fill and solid border; `EXTRA` chips render outline-only with a dashed border. Each chip carries a small `CORE`/`EXTRA` kind-label.
- Item tags SHALL be rendered in a stable display order: all `core` tags first, then all `extra` tags, alphabetical by name within each group. This ordering is **display-only** — it SHALL NOT reorder the stored `tags` array, and per-tag edit actions (toggle damaged, rename, remove) SHALL continue to target the correct stored tag regardless of display position.
- Tapping a tag chip in **view** mode SHALL toggle that tag's `damaged` flag (struck-through, dimmed). In **editor** mode a chip's label becomes an inline text input with a `✕` remover, and `+ core` / `+ extra` dashed buttons appear to add tags.
- `Consumabili` and `Vari`: compact dashed-divider rows showing name, `×qty`, a `[−][+]` stepper, and — in editor mode only — a `✕`. In **editor** mode the name SHALL be an inline text input; in view mode it renders as static text. `Vari` rows MAY also carry a `description`.
- Each subtab SHALL offer a single add-path per the `Inventory add-item popup` requirement, available in both view and editor mode. Editor mode SHALL NOT render a separate inline `+ AGGIUNGI …` add row for inventory lists.

All item edits — including renaming a consumable and adjusting its quantity — SHALL be issued as partial `PATCH .../inventory` merges that carry only the changed field, relying on the endpoint's partial-merge guarantee to preserve the item's other fields.

#### Scenario: INV subtab shows only its collection
- **WHEN** the user selects the `Armi` subtab
- **THEN** only `inventory.weapons` items are listed, and `Armature`/`Consumabili`/`Vari` items are not shown

#### Scenario: Owner marks a tag damaged from view mode
- **WHEN** the owning player taps a weapon's tag chip while not in editor mode
- **THEN** the app issues a `PATCH .../inventory` merge for that item setting the tag's `damaged: true`, and the chip renders struck-through, while the item's name is unchanged

#### Scenario: Tags render core-first then extra then alphabetical
- **GIVEN** a weapon whose stored tags are `[{name:"Zeta",type:"extra"},{name:"Alfa",type:"core"},{name:"Beta",type:"core"}]`
- **WHEN** its chips render
- **THEN** they appear in the order `Alfa` (core), `Beta` (core), `Zeta` (extra)

#### Scenario: Editing a reordered tag targets the correct stored tag
- **GIVEN** the displayed tag order differs from the stored order per the ordering rule
- **WHEN** the owner toggles the damaged flag on a displayed chip
- **THEN** the `PATCH .../inventory` merge targets the stored tag that chip represents, not the tag at the same stored index as the display position

#### Scenario: Adjusting consumable quantity keeps the name
- **GIVEN** a consumable named `Stimpak` with `quantity: 3`
- **WHEN** the owning player increments its quantity stepper
- **THEN** the app issues `PATCH .../inventory { consumables: { items: [{ id, quantity: 4 }] } }` and the row shows `Stimpak ×4` — the name is unchanged

#### Scenario: Vari items are stored under inventory.other
- **WHEN** the owning player adds a custom item under the `Vari` subtab
- **THEN** the app issues `PATCH .../inventory { other: { items: [{ name, description?, quantity }] } }` and the new item appears under `Vari`

#### Scenario: Editor mode has no inline add row for inventory
- **WHEN** editor mode is on and an INV subtab is shown
- **THEN** no dashed `+ AGGIUNGI …` inline add row is rendered; the add-item `+` popup trigger is the only add-path

### Requirement: Resources display and edit

The `INV` subtabs SHALL present `resources` as three bordered boxes in a row — `TAPPI` (caps), `ROTTAMI` (scraps), and `BOBBLEHEAD` (bobbleheads) — each with a label and a `[−] value [+]` stepper whose value is also a directly-editable numeric input. The resource row SHALL be rendered at the **bottom** of every INV subtab (below the item list), not at the top. The three boxes SHALL be sized to fit the device width (≈360px) without causing horizontal overflow.

All three SHALL be editable by the character's owner or an admin via the existing `PATCH .../resources` endpoint, consistent with `api-character-resources` making `bobbleheads` owner-writable. The sheet footer SHALL show `TAPPI n` reflecting the current caps value.

#### Scenario: Resources appear at the bottom of every INV subtab
- **WHEN** the user selects any of `Armi`, `Armature`, `Consumabili`, or `Vari`
- **THEN** the `TAPPI`/`ROTTAMI`/`BOBBLEHEAD` resource row is rendered below that subtab's item list

#### Scenario: Resource row fits the device width
- **WHEN** an INV subtab renders on a ≈360px-wide device
- **THEN** the three resource boxes fit within the case width with no horizontal overflow

#### Scenario: Owner adjusts caps
- **WHEN** the owning player changes the caps value
- **THEN** the app issues `PATCH .../resources { caps: <new value> }`

#### Scenario: Owner adjusts bobbleheads
- **WHEN** the owning (non-admin) player increments the `BOBBLEHEAD` stepper
- **THEN** the app issues `PATCH .../resources { bobbleheads: <new value> }` and the persisted value reflects the change

### Requirement: Editor mode toggle

The sheet SHALL provide a single `✎` editor-mode toggle, rendered in the **case status bar** alongside the `◄ DOSSIER` and `ESCI` controls (per `pipboy-app-shell`), styled with the same status-bar control theme — not in the tab bar. Editor mode is a client-side view state; it SHALL default to off on every sheet open and SHALL NOT be persisted.

While editor mode is **on**:
- A green `◉ EDITOR — modifica S.P.E.C.I.A.L., abilità e talenti` strip SHALL appear beneath the tab bar (yielding to the amber critical banner when both apply).
- The screen SHALL carry the green editor-mode ring specified by `pipboy-terminal-chrome`, giving an always-visible signal that edits are live.
- The status-bar `✎` toggle SHALL render in an active/pressed state.
- Each **skills** and **perks** list SHALL swap from its view layout to its edit layout: static text becomes inline `<input>`s, each row gains a `✕` remover, and each list gains a dashed `+ AGGIUNGI …` action.
- Each **inventory** list SHALL swap static item names to inline `<input>`s and gain per-row `✕` removers and per-tag edit affordances, but SHALL NOT gain a dashed `+ AGGIUNGI …` add row — adding an inventory item is always done through the `+` popup, in both view and editor mode.

Editor mode SHALL be offered only to a user who may actually write the character — its owner, or an admin. For any other viewer the `✎` toggle SHALL NOT be rendered.

Each list SHALL be implemented as a view/edit pair, never as a single mutable render.

#### Scenario: Owner sees the editor toggle
- **WHEN** the owning player opens their character's sheet
- **THEN** a `✎` toggle is rendered in the case status bar beside `◄ DOSSIER` and `ESCI`

#### Scenario: Editor mode reveals edit affordances and the ring
- **WHEN** the owning player activates the `✎` toggle
- **THEN** the `◉ EDITOR` strip appears, the green editor-mode ring is shown, the `✎` toggle renders active, the skills and talents lists each present a dashed `+ AGGIUNGI …` action and per-row `✕` removers, and inventory rows present inline name inputs and `✕` removers

#### Scenario: Inventory add stays on the popup in editor mode
- **WHEN** editor mode is on and an INV subtab is shown
- **THEN** the inventory list presents no dashed inline add row, and the `+` popup trigger remains the add-path

#### Scenario: Editor mode resets on reopen
- **GIVEN** a user left the sheet with editor mode on
- **WHEN** they reopen that character's sheet
- **THEN** editor mode is off and the editor-mode ring is not shown

### Requirement: Abilities tab

The `Abilità` subtab (under `STATS`) SHALL present one editable section and one read-only reference block.

- `▸ TAG SKILLS · MAESTRIA`: one row-card per entry in `skills`, showing the skill's catalog name and, to the right of the name, a three-slot competence square row rendering its maestria as `COMPETENTE`=1 filled, `ESPERTO`=2, `MAESTRO`=3 — in the same visual language as the SPECIAL pip row. Skill rows SHALL be rendered in alphabetical order by catalog name; this ordering is **display-only** and does not change stored data. In editor mode the level becomes a `<select>` (`COMPETENTE` / `ESPERTO` / `MAESTRO`) and a `✕` remover appears, with a dashed `+ ABILITÀ` action adding a row backed by the skills catalog. Writes go through `PATCH .../skills`.
- A view-only `▸ SPESA PA` block listing three dashed-divider lines: `RITIRA FALLITI` (1 PA, requires the relevant Tag Skill), `RUBA LA SCENA` (1 PA, act out of turn or again), and `V.A.T.S.` (1 PA, exploit an advantage or targeted effect).

Talents (perks) are no longer part of this subtab; they move to the `Talents` subtab. The competence squares are a display of the existing maestria enum, not a new stored field. Maestria tiers remain **narrative**: `COMPETENTE` raises the Risk a GM applies by one grade, `ESPERTO` leaves it unchanged, and `MAESTRO` lowers it by one grade. The app SHALL NOT apply any mechanical dice effect from maestria.

#### Scenario: Skills render alphabetically
- **GIVEN** skills whose catalog names are `Sopravvivenza`, `Armi da fuoco`, and `Medicina`
- **WHEN** the `Abilità` subtab renders
- **THEN** the rows appear in the order `Armi da fuoco`, `Medicina`, `Sopravvivenza`

#### Scenario: Skill renders maestria as competence squares
- **GIVEN** a skill at maestria `ESPERTO`
- **WHEN** the `Abilità` subtab renders in view mode
- **THEN** a three-slot square row with two of three slots filled is shown to the right of the skill name

#### Scenario: Owner adds a tag skill
- **WHEN** the owning player activates `+ ABILITÀ`, picks a catalog skill and a level, and confirms
- **THEN** the app issues `PATCH .../skills { items: [{ id: <slug>, level: <level> }] }` and the row appears

#### Scenario: SPESA PA block is never editable
- **WHEN** editor mode is on
- **THEN** the `▸ SPESA PA` block presents no inputs, removers, or add actions

#### Scenario: Talents are not shown on the Abilità subtab
- **WHEN** the `Abilità` subtab renders
- **THEN** no perks/talents section is present

## ADDED Requirements

### Requirement: Talents subtab

The `Talents` subtab (under `STATS`) SHALL present the character's `perks`: one row-card per entry, showing name and description. In editor mode both become inputs, a `✕` remover appears, and a dashed `+ TALENTO` action adds a row. Writes go through `PATCH .../perks`.

#### Scenario: Talents render on their own subtab
- **WHEN** the user selects the `Talents` subtab
- **THEN** each perk is shown with its name and description, and no skills section is present

#### Scenario: Owner removes a talent
- **WHEN** the owning player activates a talent row's `✕` in editor mode
- **THEN** the app issues `PATCH .../perks { deletedIds: [<id>] }` and the row disappears

#### Scenario: Owner adds a talent
- **WHEN** the owning player types a talent name into the `+ TALENTO` add row and confirms
- **THEN** the app issues `PATCH .../perks { items: [{ name }] }` and the row appears

### Requirement: NOTES tab

The `NOTES` first-level tab SHALL render a static placeholder. In this change it SHALL NOT read from or write to any backend, and SHALL NOT present editable fields.

#### Scenario: Notes shows a placeholder
- **WHEN** the user selects the `NOTES` tab
- **THEN** a placeholder is shown and no persistence request is issued

### Requirement: Inventory add-item popup

Each INV subtab SHALL present a `+` add trigger, available in **both view and editor mode**, that opens a modal popup for adding an item to that subtab's collection. The popup SHALL present two tabs — `Scegli esistente` and `Aggiungi custom` — an `OK` confirm action, and a small red `✕` in the top-right that cancels without any write.

- `Scegli esistente`: an autocomplete selection populated from `GET /equipment-catalog`, filtered to the entries whose `kind` matches the active subtab (`Armi`→`weapon`, `Armature`→`armor`, `Consumabili`→`consumable`). Confirming SHALL **copy** the chosen template onto the character (its `name`, and for weapons/armor its `tags` with `damaged: false`; for consumables its `defaultQuantity`) via `PATCH .../inventory`, per `api-equipment-catalog` copy-on-use semantics. For the `Vari` subtab there is no matching catalog `kind` yet, so the `Scegli esistente` tab SHALL be hidden (the popup opens directly on `Aggiungi custom`).
- `Aggiungi custom`: a kind-shaped custom-entry form. For `Armi` and `Armature` it SHALL offer a name and custom `core`/`extra` tags (mirroring the inventory editor's tag affordances). For `Consumabili` and `Vari` it SHALL offer only name, description, and quantity. Confirming SHALL issue `PATCH .../inventory` adding the item to the active subtab's collection.

#### Scenario: Popup opens in view mode
- **WHEN** the owning player taps the `+` trigger on the `Armi` subtab while not in editor mode
- **THEN** the popup opens with `Scegli esistente` and `Aggiungi custom` tabs

#### Scenario: Choosing an existing template copies it
- **GIVEN** the equipment catalog holds a `weapon` template `Pistola 10mm` with a `core` tag `Affidabile`
- **WHEN** the owner picks it in `Scegli esistente` on the `Armi` subtab and confirms
- **THEN** the app issues `PATCH .../inventory` adding a `weapons` item named `Pistola 10mm` with the `Affidabile` core tag and `damaged: false`

#### Scenario: Custom weapon carries tags
- **WHEN** the owner adds a custom item on `Armi` with a name and a `core` tag and confirms
- **THEN** the app issues `PATCH .../inventory { weapons: { items: [{ name, tags: [...] }] } }`

#### Scenario: Custom consumable and misc have only name, description, quantity
- **WHEN** the owner opens `Aggiungi custom` on `Consumabili` or `Vari`
- **THEN** the form offers only name, description, and quantity fields — no tag affordances

#### Scenario: Vari hides the existing-item tab
- **WHEN** the owner taps `+` on the `Vari` subtab
- **THEN** the popup opens directly on `Aggiungi custom` and no `Scegli esistente` tab is shown

#### Scenario: Red cancel writes nothing
- **WHEN** the owner opens the popup and taps the red `✕`
- **THEN** the popup closes and no `PATCH .../inventory` request is issued

## REMOVED Requirements

### Requirement: Five-tab sheet layout

**Reason**: Replaced by the two-level tab structure. The sheet is no longer a flat five-tab layout; navigation (first-level tabs, the conditional subtab row, the flattened traversal order, swipe gestures, and the footer's active-tab tracking) now lives in the new `pipboy-sheet-navigation` capability.

**Migration**: See `pipboy-sheet-navigation` for the two-level layout (`STATS · SALUTE · INV · DADI · NOTES` with STATS/INV subtabs) and the footer requirement. The former `S.P.E` tab becomes the `S.P.E.C.I.A.L.` subtab under `STATS`; the former `ABIL` tab splits into the `Abilità` and `Talents` subtabs; the former `ZAINO` tab becomes the `INV` tab with `Armi`/`Armature`/`Consumabili`/`Vari` subtabs; `SALUTE` and `DADI` are unchanged in content; `NOTES` is new.
