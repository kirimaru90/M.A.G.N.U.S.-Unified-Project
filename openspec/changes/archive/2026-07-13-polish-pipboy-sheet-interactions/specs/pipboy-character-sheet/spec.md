## ADDED Requirements

### Requirement: Header PA control spacing

A margin of 2px SHALL separate the header's action-points `−`/pips/`+` control from the first-level tab bar rendered immediately below it, so the PA control reads as distinct from the tabs rather than butting against them. This spacing SHALL NOT alter the internal layout of the PA control specified by `Action points stepper`.

#### Scenario: A 2px gap sits between the PA control and the tabs
- **WHEN** the sheet header and the tab bar render
- **THEN** a 2px margin separates the PA `−`/pips/`+` control from the tab bar directly beneath it

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

## MODIFIED Requirements

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

## ADDED Requirements

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
