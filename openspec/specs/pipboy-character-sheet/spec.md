# pipboy-character-sheet Specification

## Purpose

Character sheet screens for `apps/pip-boy`: a two-level tab layout with an owner/admin editor-mode toggle, an owner/admin-writable action-points stepper, an S.P.E.C.I.A.L. approaches subtab, abilities and talents subtabs, a status/conditions (logoramento) editor with catalog quick-pick, an inventory/gear editor with an add-item popup, and resources display/edit. Navigation (first-level tabs, the conditional subtab row, the flattened traversal order, swipe gestures, and the footer's active-tab tracking) is specified by `pipboy-sheet-navigation`. The client-side dice roller is specified by `pipboy-dice-roller`.

## Requirements

### Requirement: Action points stepper

The sheet header SHALL present the character's action points per the reference layout: the label `PUNTI AZIONE` and a row of `paMax` pip squares (filled and glowing when "on") **flanked by a `−` control on the left and a `+` control on the right**. The `−` and `+` controls SHALL sit **immediately adjacent to the pip row** — the `−` directly preceding the first pip and the `+` directly following the last pip — and SHALL NOT be pushed to opposite edges of the header. The pip row SHALL size to its content (`paMax` squares) rather than stretching to fill the header width, so that the gap between the last pip and the `+` control stays small and constant regardless of `paMax`. The header SHALL NOT render a numeric `paCurrent` readout — the filled square count is the sole indication of the current value. Activating the `−`/`+` controls SHALL write `paCurrent` via the existing `PATCH .../action-points` endpoint.

`paMax` and `paTrackedBy` SHALL NOT be editable from the header. They are edited by the owner (or an admin) in the S.P.E.C.I.A.L. subtab's editor mode, via a `FONTE PA` selector and a `MAX PA` stepper, consistent with `api-character-stats` making both owner-writable. When `paMax` is lowered below `paCurrent`, the app SHALL clamp `paCurrent` to the new maximum and persist the clamped value.

The header SHALL also show the character's name, a bordered species chip, and a `PA · <source approach name>` line derived from `paTrackedBy`.

#### Scenario: Header renders squares flanked by steppers with no number
- **GIVEN** a character with `paMax: 5` and `paCurrent: 2`
- **WHEN** the sheet header renders
- **THEN** a `−` control, five pip squares (two filled), and a `+` control are shown in that order, and no numeric `paCurrent` value is displayed

#### Scenario: Plus control sits next to the squares, not at the header edge
- **GIVEN** a character with `paMax: 5` on a wide viewport
- **WHEN** the sheet header renders
- **THEN** the `+` control is positioned immediately after the last pip (a small, constant gap), rather than pushed to the right edge of the header with the pip row stretched across the intervening space

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

### Requirement: Header PA control spacing

A margin of 2px SHALL separate the header's action-points `−`/pips/`+` control from the first-level tab bar rendered immediately below it, so the PA control reads as distinct from the tabs rather than butting against them. This spacing SHALL NOT alter the internal layout of the PA control specified by `Action points stepper`.

#### Scenario: A 2px gap sits between the PA control and the tabs
- **WHEN** the sheet header and the tab bar render
- **THEN** a 2px margin separates the PA `−`/pips/`+` control from the tab bar directly beneath it

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

### Requirement: Inventory and gear editor

The `INV` first-level tab SHALL present the character's `inventory` across four subtabs — `Armi` (`inventory.weapons`), `Armature` (`inventory.equip`), `Consumabili` (`inventory.consumables`), and `Vari` (`inventory.misc`) — each owner- and admin-editable via the existing `PATCH .../inventory` endpoint. Each subtab SHALL show only its own collection's items. The `Vari` collection is the character schema's `misc` (`GenericItem[]`) collection — the renamed successor of the former `other` collection, with the same name/description/quantity shape as consumables — which the API accepts on `PATCH .../inventory { misc: … }`.

- `Armi` and `Armature`: one row-card per item, each showing the item name, an amber `DANNEGGIATA` tag when any of its tags is marked damaged, and its tags as chips. `CORE` chips render with a tinted fill and solid border; `EXTRA` chips render outline-only with a dashed border. Each chip carries a small `CORE`/`EXTRA` kind-label.
- Item tags SHALL render all `core` tags first, then all `extra` tags, alphabetical by name within each group. This order is now **guaranteed by the server** (`api-character-inventory` persists tags canonically), so the client MAY render the stored array directly and per-tag edit actions (toggle damaged, rename, remove) target tags by their stored index.
- Tapping a tag chip in **view** mode SHALL toggle that tag's `damaged` flag (struck-through, dimmed). In **editor** mode a chip's label becomes editable and carries a `✕` remover, and `+ core` / `+ extra` dashed buttons appear to add tags. Adding a tag or editing a tag's name SHALL autocomplete against the tag catalog (`api-tag-catalog`, read via `GET /tag-catalog`) through the full-screen picker sheet: selecting a catalog entry fills the tag's **name** with the entry's `name`. The `core`/`extra` **type** is decided by which affordance was used (`+ core` vs `+ extra`), not by the catalog, which carries no type. Typing a tag name that is not in the catalog SHALL remain valid.
- `Consumabili` and `Vari`: compact dashed-divider rows showing the item name, `×qty`, and a `[−][+]` quantity stepper. The quantity stepper SHALL be **right-aligned** within the row. The row SHALL NOT render the item's description inline — the description is surfaced only through the `Inventory item detail popup` opened by tapping the name. In **editor** mode the name SHALL be an inline text input carrying the name-tap detail affordance only in view mode; in view mode the name renders as an activatable static control. In editor mode only, a `✕` remover appears.
- Each subtab SHALL offer a single add-path per the `Inventory add-item popup` requirement, available in both view and editor mode. Editor mode SHALL NOT render a separate inline `+ AGGIUNGI …` add row for inventory lists.

All item edits — including renaming a consumable and adjusting its quantity — SHALL be issued as partial `PATCH .../inventory` merges that carry only the changed field, relying on the endpoint's partial-merge guarantee to preserve the item's other fields. Writes to the `Vari` collection SHALL target the `misc` key (`PATCH .../inventory { misc: … }`); the former `other` key is no longer accepted.

#### Scenario: Owner adds a weapon
- **WHEN** the owning player adds a weapon with a name
- **THEN** the app issues `PATCH .../inventory { weapons: { items: [{ name }] } }` and the new item (with its server-assigned id) appears under `Armi`

#### Scenario: Owner adds a custom Vari item
- **WHEN** the owning player adds a custom item under `Vari` with a name, description, and quantity
- **THEN** the app issues `PATCH .../inventory { misc: { items: [{ name, description, quantity }] } }` and the item appears under `Vari`

#### Scenario: Consumable quantity stepper is right-aligned with no inline description
- **GIVEN** a consumable `{ name: "Stimpak", description: "Cura ferite", quantity: 3 }`
- **WHEN** the `Consumabili` subtab renders
- **THEN** the `[−][+]` stepper is right-aligned in the row and no description text is shown inline

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

### Requirement: Inventory item detail popup

On the `Consumabili` and `Vari` subtabs, an item's name SHALL be an activatable control that opens a read-only detail popup showing the item's **name** and full **description**. The popup SHALL NOT present any edit control and SHALL issue no persistence request — it is display-only.

The popup SHALL occupy a fixed size of approximately 80% of the screen's surface area, and its description body SHALL scroll internally when the text exceeds the available height (the popup itself SHALL NOT grow to fit the text). A backdrop tap and a `✕` control SHALL both close it.

When an item has no description, the popup SHALL still open and present the name with an empty/placeholder description body rather than failing to open.

#### Scenario: Tapping an item name opens its detail popup
- **GIVEN** a `Vari` item `{ name: "Chiave inglese", description: "Attrezzo multiuso lungo 30cm." }`
- **WHEN** the user taps the item's name on the `Vari` subtab
- **THEN** a read-only popup opens showing `Chiave inglese` and its description, with no edit controls

#### Scenario: Long description scrolls inside the fixed popup
- **GIVEN** a consumable whose description overflows the popup's body height
- **WHEN** its detail popup is open
- **THEN** the popup stays at ~80% of the screen and its description body scrolls internally

#### Scenario: Detail popup closes without writing
- **WHEN** the user taps the popup's `✕` or the backdrop
- **THEN** the popup closes and no `PATCH` is issued

### Requirement: Resources display and edit

The `INV` subtabs SHALL present `resources` as three bordered boxes in a row — `TAPPI` (caps), `ROTTAMI` (scraps), and `BOBBLEHEAD` (bobbleheads) — each with a label and a `[−] value [+]` stepper whose value is also a directly-editable numeric input. The resource row SHALL be rendered at the **bottom** of every INV subtab (below the item list) and SHALL be **pinned** to the bottom of the subtab's viewport so it stays visible while the item list above it scrolls — the resource indicators SHALL NOT scroll out of view when the list is longer than the screen. The three boxes SHALL be sized to fit the device width (≈360px) without causing horizontal overflow.

All three SHALL be editable by the character's owner or an admin via the existing `PATCH .../resources` endpoint, consistent with `api-character-resources` making `bobbleheads` owner-writable. The sheet footer SHALL show `TAPPI n` reflecting the current caps value.

#### Scenario: Resources appear at the bottom of every INV subtab
- **WHEN** the user selects any of `Armi`, `Armature`, `Consumabili`, or `Vari`
- **THEN** the `TAPPI`/`ROTTAMI`/`BOBBLEHEAD` resource row is rendered below that subtab's item list

#### Scenario: Resources stay visible while the item list scrolls
- **GIVEN** an INV subtab whose item list is taller than the content area
- **WHEN** the user scrolls the item list
- **THEN** the resource row remains pinned in view at the bottom of the subtab

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

The sheet SHALL provide a single `✎` editor-mode toggle, rendered in the **bottom-right of the case bezel** (per `pipboy-terminal-chrome`), styled with the case control theme — not in the tab bar and no longer in the status bar. Activating it toggles editor mode. Editor mode is a client-side view state; it SHALL default to off on every sheet open and SHALL NOT be persisted.

While editor mode is **on**:
- A green `◉ EDITOR — modifica S.P.E.C.I.A.L., abilità e talenti` strip SHALL appear beneath the tab bar (yielding to the amber critical banner when both apply).
- The screen SHALL carry the green editor-mode ring specified by `pipboy-terminal-chrome`, giving an always-visible signal that edits are live.
- The bezel `✎` toggle SHALL render in an active/pressed state, and the green editor-mode case LED specified by `pipboy-terminal-chrome` SHALL light.
- Each **skills** and **perks** list SHALL swap from its view layout to its edit layout: static text becomes inline controls (a `<input>` for perk name/description, a `[−] ▪▪▫ [+]` maestria stepper for a skill level) and each row gains a `✕` remover.
- Adding a skill or a talent SHALL use the `+`-triggered two-tab add popup specified by `Skills tag add popup` and `Talents add popup`, available whenever the user may write the character — the skills and perks lists SHALL NOT present a dashed inline `+ AGGIUNGI …` add row.
- Each **inventory** list SHALL swap static item names to inline `<input>`s and gain per-row `✕` removers and per-tag edit affordances, but SHALL NOT gain a dashed `+ AGGIUNGI …` add row — adding an inventory item is always done through the `+` popup, in both view and editor mode.

Editor mode SHALL be offered only to a user who may actually write the character — its owner, or an admin. For any other viewer the `✎` toggle SHALL NOT be rendered.

Each list SHALL be implemented as a view/edit pair, never as a single mutable render.

#### Scenario: Owner sees the editor toggle in the bezel
- **WHEN** the owning player opens their character's sheet
- **THEN** a `✎` toggle is rendered in the bottom-right of the case bezel, and none is rendered in the status bar

#### Scenario: Editor mode reveals edit affordances, the ring, and the LED
- **WHEN** the owning player activates the `✎` toggle
- **THEN** the `◉ EDITOR` strip appears, the green editor-mode ring is shown, the green case LED lights, the `✎` toggle renders active, the skills and talents lists present `+` popup triggers and per-row `✕` removers (no dashed inline add row), and inventory rows present inline name inputs and `✕` removers

#### Scenario: Inventory add stays on the popup in editor mode
- **WHEN** editor mode is on and an INV subtab is shown
- **THEN** the inventory list presents no dashed inline add row, and the `+` popup trigger remains the add-path

#### Scenario: Editor mode resets on reopen
- **GIVEN** a user left the sheet with editor mode on
- **WHEN** they reopen that character's sheet
- **THEN** editor mode is off, and neither the editor-mode ring nor the lit case LED is shown

### Requirement: S.P.E.C.I.A.L. approaches subtab

The `S.P.E.C.I.A.L.` subtab SHALL present, in **view** mode, the header `▸ APPROCCI · TOCCA PER TIRARE` and the hint `Il valore = numero di d6 nel pool`, followed by seven full-width approach rows. Each row SHALL show the approach's display letter, its name, its one-line description, and a five-slot pip row rendering that attribute's value (`1..5`).

Activating an approach row SHALL switch to the `DADI` tab with that approach preselected as the dice-pool source.

Beneath the rows, a bordered legend box SHALL render the dice-outcome reference: `6 = Successo Pieno · 4/5 = Successo con Costo · 1/2/3 = Fallimento. Ogni 6 oltre il primo restituisce 1 PA.`

In **editor** mode the subtab SHALL instead show the header `▸ MODIFICA S.P.E.C.I.A.L.` and seven stepper rows (letter · name · `[−] value [+]`) bounded `1..5`, writing through `PATCH .../special`; followed by a `FONTE PA` selector writing `paTrackedBy` and a `MAX PA` stepper writing `paMax`. The `MAX PA` stepper's bounds SHALL be independent of the SPECIAL range — narrowing SPECIAL to `1..5` SHALL NOT lower the reachable `paMax`, which retains its `0..8` range.

#### Scenario: Approach rows render with pips
- **WHEN** the `S.P.E.C.I.A.L.` subtab renders in view mode
- **THEN** seven rows are shown, each with a display letter, name, description, and a pip row reflecting that attribute's value

#### Scenario: Tapping an approach jumps to the dice tab preselected
- **WHEN** the user activates the `PERCEZIONE` row
- **THEN** the `DADI` tab is shown with `PERCEZIONE` preselected as the pool source

#### Scenario: Owner edits an attribute
- **WHEN** the owning player increments `FORZA` in editor mode
- **THEN** the app issues `PATCH .../special { strength: <new value> }` and the persisted value reflects the change

#### Scenario: Attribute steppers are bounded 1..5
- **GIVEN** an attribute at value `5`
- **WHEN** the sheet renders its stepper in editor mode
- **THEN** the `+` control is disabled, and at value `1` the `−` control is disabled

#### Scenario: MAX PA stepper is decoupled from the SPECIAL range
- **GIVEN** a character with `paMax` at `6`
- **WHEN** the owner raises `MAX PA` in editor mode
- **THEN** the stepper continues past `5` toward its own `0..8` bound, unaffected by the SPECIAL maximum of `5`

#### Scenario: Owner changes the PA source
- **WHEN** the owning player selects `Resistenza` in the `FONTE PA` selector
- **THEN** the app issues `PATCH .../action-points { paTrackedBy: "endurance" }` and the header's `PA · <source>` line updates

### Requirement: Abilities tab

The `Abilità` subtab (under `STATS`) SHALL present one editable section and one read-only reference block.

- `▸ TAG SKILLS · MAESTRIA`: one row-card per entry in `skills`, showing the skill's catalog name and, to the right of the name, a three-slot competence square row rendering its maestria as `COMPETENTE`=1 filled, `ESPERTO`=2, `MAESTRO`=3 — in the same visual language as the SPECIAL pip row. Skill rows SHALL be rendered in alphabetical order by catalog name; this ordering is **display-only** and does not change stored data.
  - In **editor** mode the level SHALL be edited by a clamped `[−] ▪▪▫ [+]` stepper that wraps the three maestria squares — the catalog name on the left as a lateral label, the `[−]`/squares/`[+]` grouped to the right, and a `✕` remover — bounded `COMPETENTE` (1) .. `MAESTRO` (3), replacing the former `<select>`. The enum string SHALL remain available as a lateral indicator of the current level; `−`/`+` map to the adjacent enum tier and persist it. Writes go through `PATCH .../skills`.
  - Adding a skill SHALL use the `+`-triggered two-tab add popup specified by `Skills tag add popup`, in place of the former dashed `+ ABILITÀ` inline add row.
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

#### Scenario: Skill level is edited by a bounded square stepper
- **GIVEN** a skill at maestria `ESPERTO` in editor mode
- **WHEN** the owning player activates the skill row's `+`
- **THEN** the filled-square count rises to three, the lateral indicator reads `MAESTRO`, `PATCH .../skills { items: [{ id: <slug>, level: "MAESTRO" }] }` is issued, and the `+` is disabled at `MAESTRO` (the `−` is disabled at `COMPETENTE`)

#### Scenario: No dropdown remains for skill level
- **WHEN** the `Abilità` subtab renders in editor mode
- **THEN** no `<select>` is used for skill level; the level is controlled by the `[−] ▪▪▫ [+]` stepper

#### Scenario: SPESA PA block is never editable
- **WHEN** editor mode is on
- **THEN** the `▸ SPESA PA` block presents no inputs, removers, or add actions

#### Scenario: Talents are not shown on the Abilità subtab
- **WHEN** the `Abilità` subtab renders
- **THEN** no perks/talents section is present

### Requirement: Skills tag add popup

The `Abilità` subtab SHALL offer a single skill add-path consistent with the inventory and condition add flows: a `+` trigger, available whenever the user may write the character, that opens the shared two-tab add popup with an `OK` action and a small red `✕` that cancels without any write. The popup owns no persistence — on `OK` it hands the assembled skill body to its caller, which issues the `PATCH .../skills`.

The popup SHALL present two inner tabs:
- **Scegli esistente** — a selection over the skills catalog (`GET /skills-catalog`), presented via the full-screen catalog picker sheet, listing catalog skills not already on the character. Choosing an entry adds a skill keyed by its catalog `slug`.
- **Aggiungi custom** — a freeform skill entry: a `nome abilità` input and an initial maestria selection. Confirming adds one skill. Because a custom skill has no catalog slug, the client SHALL supply an identity the `PATCH .../skills` contract accepts (a client-derived slug from the typed name); if the backend contract cannot accept a slug-less/custom skill, this tab's behaviour is a backend follow-up and the selection tab remains fully functional.

Both tabs default per the shared popup convention (the **Scegli esistente** tab is shown first when its catalog is non-empty).

#### Scenario: Adding a skill from the catalog
- **WHEN** the owning player activates the skills `+`, opens **Scegli esistente**, and picks a catalog skill
- **THEN** the app issues `PATCH .../skills { items: [{ id: <slug>, level: <level> }] }` and the row appears

#### Scenario: Skills add popup cancels without writing
- **WHEN** the owning player opens the skills add popup and taps the red `✕`
- **THEN** the popup closes and no `PATCH` is issued

### Requirement: Talents subtab

The `Talents` subtab (under `STATS`) SHALL present the character's `perks`: one row-card per entry, showing name and description. In editor mode both become inputs and a `✕` remover appears. Adding a talent SHALL use the `+`-triggered two-tab add popup specified by `Talents add popup`, in place of the former dashed `+ TALENTO` inline add row. Writes go through `PATCH .../perks`.

#### Scenario: Talents render on their own subtab
- **WHEN** the user selects the `Talents` subtab
- **THEN** each perk is shown with its name and description, and no skills section is present

#### Scenario: Owner removes a talent
- **WHEN** the owning player activates a talent row's `✕` in editor mode
- **THEN** the app issues `PATCH .../perks { deletedIds: [<id>] }` and the row disappears

#### Scenario: Owner adds a talent through the add popup
- **WHEN** the owning player activates the talents `+` trigger, enters a custom talent name (and optional description) in the popup's **Aggiungi custom** tab, and confirms
- **THEN** the app issues `PATCH .../perks { items: [{ name, description }] }` and the row appears

### Requirement: Talents add popup

The `Talents` subtab SHALL offer a single talent add-path consistent with the other add flows: a `+` trigger, available whenever the user may write the character, that opens the shared two-tab add popup with an `OK` action and a small red `✕` that cancels without any write. The popup owns no persistence — on `OK` it hands the assembled talent body to its caller, which issues the `PATCH .../perks`.

The popup SHALL present two inner tabs:
- **Scegli esistente** — a selection over the talents catalog, presented via the full-screen catalog picker sheet. The talents catalog MAY NOT yet exist server-side; the app SHALL fetch it defensively and treat a `400` (or any failure/absent endpoint) as an empty catalog, so this tab simply lists nothing and surfaces **no** error banner. Populating this tab is a backend follow-up.
- **Aggiungi custom** — a freeform talent entry: a `nome talento` input and an optional `descrizione` input. Confirming adds one talent as `{ name, description }`.

When the talents catalog is empty (the current state), the popup SHALL open directly usable via the **Aggiungi custom** tab.

#### Scenario: Talents catalog 400 degrades to an empty selection tab
- **GIVEN** the talents catalog endpoint responds `400` (or is absent)
- **WHEN** the owning player opens the talents add popup's **Scegli esistente** tab
- **THEN** the tab lists no entries, no error banner is shown, and the **Aggiungi custom** tab remains fully usable

#### Scenario: Adding a custom talent through the popup
- **WHEN** the owning player opens the talents add popup's **Aggiungi custom** tab, enters a name and description, and confirms
- **THEN** the app issues `PATCH .../perks { items: [{ name, description }] }` and the row appears

### Requirement: NOTES tab

The `NOTES` first-level tab SHALL render a static placeholder. In this change it SHALL NOT read from or write to any backend, and SHALL NOT present editable fields.

#### Scenario: Notes shows a placeholder
- **WHEN** the user selects the `NOTES` tab
- **THEN** a placeholder is shown and no persistence request is issued

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
