# pipboy-character-sheet Specification

## Purpose

Character sheet screens for `apps/pip-boy`: a two-level tab layout with an owner/admin editor-mode toggle, an owner/admin-writable action-points stepper, an S.P.E.C.I.A.L. approaches subtab, abilities and talents subtabs, a status/conditions (logoramento) editor with catalog quick-pick, an inventory/gear editor with an add-item popup, and resources display/edit. Navigation (first-level tabs, the conditional subtab row, the flattened traversal order, swipe gestures, and the footer's active-tab tracking) is specified by `pipboy-sheet-navigation`. The client-side dice roller is specified by `pipboy-dice-roller`.

## Requirements

### Requirement: Action points stepper

The sheet header SHALL present the character's action points per the reference layout: the label `PUNTI AZIONE` and a row of `paMax` pip squares (filled and glowing when "on") **flanked by a `−` control on the left and a `+` control on the right**. The `−` and `+` controls SHALL sit **immediately adjacent to the pip row** — the `−` directly preceding the first pip and the `+` directly following the last pip — and SHALL NOT be pushed to opposite edges of the header. The pip row SHALL size to its content (`paMax` squares) rather than stretching to fill the header width, so that the gap between the last pip and the `+` control stays small and constant regardless of `paMax`. The header SHALL NOT render a numeric `paCurrent` readout — the filled square count is the sole indication of the current value. Activating the `−`/`+` controls SHALL write `paCurrent` via the existing `PATCH .../action-points` endpoint.

`paMax` SHALL NOT be editable from the header; it is edited by the owner (or an admin) in the S.P.E.C.I.A.L. subtab's editor mode via a `MAX PA` stepper, consistent with `api-character-stats` making it owner-writable. When `paMax` is lowered below `paCurrent`, the app SHALL clamp `paCurrent` to the new maximum and persist the clamped value. `paTrackedBy` is set once during character creation (the higher of Agilità and Resistenza) and is **not** editable from the sheet; there is no `FONTE PA` control.

The header SHALL also show the character's name, a bordered species chip, and a `PA · <source approach name>` line derived from the stored `paTrackedBy`.

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

#### Scenario: The header PA source reflects the stored paTrackedBy
- **GIVEN** a character whose stored `paTrackedBy` is `agility`
- **WHEN** the sheet header renders
- **THEN** the `PA · <source>` line reads the Agilità source, and no control to change it is offered anywhere on the sheet

### Requirement: Header PA control spacing

A margin of 2px SHALL separate the header's action-points `−`/pips/`+` control from the first-level tab bar rendered immediately below it, so the PA control reads as distinct from the tabs rather than butting against them. This spacing SHALL NOT alter the internal layout of the PA control specified by `Action points stepper`.

#### Scenario: A 2px gap sits between the PA control and the tabs
- **WHEN** the sheet header and the tab bar render
- **THEN** a 2px margin separates the PA `−`/pips/`+` control from the tab bar directly beneath it

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

The `INV` tab SHALL present `resources` as three bordered boxes in a row — `TAPPI` (caps), `ROTTAMI` (scraps), and `BOBBLEHEAD` (bobbleheads) — each with a label and a `[−] value [+]` stepper whose value is also a directly-editable numeric input. The resource band SHALL be rendered as a **fixed strip outside the scrolling item list**, positioned between the scrolling content area and the sheet footer, so it stays visible and is **untouched by scrolling** — the resource indicators SHALL NOT scroll with, or disappear at the end of, the item list. The band SHALL be a **single** element shown while the `INV` first-level tab is active, not re-rendered inside each subtab's scrolling list. The three boxes SHALL be sized to fit the device width (≈360px) without causing horizontal overflow.

All three SHALL be editable by the character's owner or an admin via the existing `PATCH .../resources` endpoint, consistent with `api-character-resources` making `bobbleheads` owner-writable. The sheet footer SHALL show `TAPPI n` reflecting the current caps value.

#### Scenario: Resource band renders once above the footer on the INV tab
- **WHEN** the user selects any of `Armi`, `Armature`, `Consumabili`, or `Vari`
- **THEN** a single `TAPPI`/`ROTTAMI`/`BOBBLEHEAD` resource band is shown as a fixed strip between the item list and the footer, not inside the scrolling list

#### Scenario: Resources stay fixed while the item list scrolls
- **GIVEN** an INV subtab whose item list is taller than the content area
- **WHEN** the user scrolls the item list
- **THEN** the resource band remains fixed above the footer, untouched by the scroll, rather than scrolling to the end of the list

#### Scenario: Resource band fits the device width
- **WHEN** the INV tab renders on a ≈360px-wide device
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

In **editor** mode the subtab SHALL instead show the header `▸ MODIFICA S.P.E.C.I.A.L.` and seven stepper rows (letter · name · `[−] value [+]`) bounded `1..5`, writing through `PATCH .../special`; followed by a `MAX PA` stepper writing `paMax`. The subtab SHALL NOT present a `FONTE PA` selector — `paTrackedBy` is set at character creation and is not editable from the sheet. The `MAX PA` stepper's bounds SHALL be independent of the SPECIAL range — narrowing SPECIAL to `1..5` SHALL NOT lower the reachable `paMax`, which retains its `0..8` range.

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

#### Scenario: No PA source selector in the editor
- **WHEN** the `S.P.E.C.I.A.L.` subtab renders in editor mode
- **THEN** no `FONTE PA` selector is present, and the only action-point control is the `MAX PA` stepper

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

Within the **Scegli esistente** picker, entries whose catalog `specialRequirement` is not met by the character's current `special` values (any positional minimum greater than the character's corresponding SPECIAL) SHALL render visually dimmed and SHALL sort after every entry with no requirement or a fully-met requirement; ordering within each of those two groups SHALL remain alphabetical. This dimming and reordering is purely informational — it SHALL NOT prevent the entry from being tapped, opened, or selected.

Tapping a row in the **Scegli esistente** picker SHALL NOT select it immediately. Instead it SHALL open a nested detail popup showing the talent's name, description, and — for any stat with a non-zero `specialRequirement` minimum — that stat's letter and minimum value (a talent with no requirement shows no requirement line). The detail popup SHALL present a **Seleziona** button that commits the entry (equivalent to the previous immediate-pick behavior: closes the picker and the add popup's existing-tab selection reflects the chosen entry) and an **✕** in its top-right corner that closes only the detail popup, returning to the underlying catalog list with its search text and results preserved and no selection made.

Each row in the **Scegli esistente** picker SHALL also show its `specialRequirement` inline, beneath the talent's name, as one compact `LETTERA · N` chip per stat with a non-zero minimum (no chip row at all when the talent has no requirement). This inline chip row is independent of, and additive to, the tap-through detail popup above — it SHALL NOT change tap behavior (a tap still opens the detail popup, not an immediate pick) and SHALL NOT change the row's dimming or sort order, which continue to be driven solely by whether the requirement is met.

#### Scenario: Talents catalog 400 degrades to an empty selection tab
- **GIVEN** the talents catalog endpoint responds `400` (or is absent)
- **WHEN** the owning player opens the talents add popup's **Scegli esistente** tab
- **THEN** the tab lists no entries, no error banner is shown, and the **Aggiungi custom** tab remains fully usable

#### Scenario: Adding a custom talent through the popup
- **WHEN** the owning player opens the talents add popup's **Aggiungi custom** tab, enters a name and description, and confirms
- **THEN** the app issues `PATCH .../perks { items: [{ name, description }] }` and the row appears

#### Scenario: Unmet-requirement talents render dimmed and sort last
- **GIVEN** the talents catalog contains a talent requiring Endurance ≥ 3 and the character's current Endurance is 2, alongside other talents with no requirement
- **WHEN** the owning player opens the talents add popup's **Scegli esistente** tab
- **THEN** the Endurance-requiring talent is shown visually dimmed and appears after every talent with no requirement or a met requirement in the list

#### Scenario: Tapping a talent opens its detail popup instead of picking immediately
- **WHEN** the owning player taps a talent row in the **Scegli esistente** picker
- **THEN** a detail popup opens showing that talent's name, description, and any non-zero SPECIAL requirement, and no selection has been made yet

#### Scenario: Seleziona commits the detail popup's talent
- **WHEN** the owning player opens a talent's detail popup and taps **Seleziona**
- **THEN** the picker and detail popup close, the add popup's existing-tab field shows the chosen talent's name, and confirming the add popup's `OK` issues `PATCH .../perks { items: [{ name, description? }] }` for that talent

#### Scenario: Closing the detail popup returns to the list
- **GIVEN** the owning player has typed a search term into the **Scegli esistente** picker and tapped a matching talent row
- **WHEN** they tap the detail popup's **✕**
- **THEN** the detail popup closes, the underlying catalog list reappears with the same search term and results, and no `PATCH` is issued

#### Scenario: A dimmed talent can still be selected
- **GIVEN** a talent's requirement is not met by the character's current SPECIAL
- **WHEN** the owning player taps that dimmed row, opens its detail popup, and taps **Seleziona**
- **THEN** the talent is selected exactly as any other entry would be — the dimming does not block the pick

#### Scenario: A talent's requirement renders as inline chips on its row
- **GIVEN** the talents catalog contains a talent requiring Endurance ≥ 3 and Intelligence ≥ 2
- **WHEN** the owning player opens the talents add popup's **Scegli esistente** tab
- **THEN** that talent's row shows an `E · 3` chip and an `I · 2` chip beneath its name, with no chip for any of the other five SPECIAL stats

#### Scenario: A talent with no requirement shows no chip row
- **GIVEN** a talent in the catalog has no `specialRequirement` set
- **WHEN** the owning player opens the talents add popup's **Scegli esistente** tab
- **THEN** that talent's row shows only its name, with no chip row beneath it

#### Scenario: Inline chips do not change tap behavior
- **GIVEN** a talent row is showing one or more requirement chips
- **WHEN** the owning player taps that row
- **THEN** the detail popup opens exactly as it would for a talent with no chips — the chip row never causes an immediate pick

### Requirement: NOTES tab

The `NOTES` first-level tab SHALL render a two-section screen backed by the already-deployed per-character notes and background endpoints. It SHALL be populated only for a user who may write the character (its owner, or an admin); for any other viewer the notes/background reads return `404` and the tab SHALL show its empty states with **no** error banner. The tab render is synchronous, so the screen SHALL paint a loading skeleton first and fill each section after its fetch resolves.

**BACKGROUND section** — a `BACKGROUND` section head with **no** `+` control, followed by a **single dedicated row**, visually separated from the note list as its own thing. The row is backed by `GET /campaigns/:cid/characters/:id/background` (returning `{ background }`, a markdown string or `null`). When a background is set the row SHALL show a first-line text **snippet** of it; when unset the row SHALL show an add-prompt (e.g. `Nessun background — tocca per aggiungere`). Activating the row opens the shared editor in **background mode**.

**NOTE section** — a `NOTE` section head carrying a `+` add control, followed by one **row per note** from `GET /campaigns/:cid/characters/:id/notes`. Each row SHALL show the note's **title** and its **last-update date** (`updatedAt`). Activating the `+` opens the shared editor empty (a new note); activating a row opens the shared editor populated with that note. After any create/update/delete the tab SHALL re-fetch (or otherwise refresh) the affected section and re-render.

**Shared editor** — a modal popup occupying approximately **80% of the screen surface** (the `.pb-info-popup` shell made editable), used for both notes and the background. It presents a formatting **toolbar** (bold, italic, heading, bullet list, quote) above a `contenteditable` body. The user SHALL NOT need to type or see markdown syntax: the toolbar applies formatting as **visible rich text**, on open the stored markdown is parsed into the editable DOM (`mdToDom`), and on save the DOM is serialized back to **markdown** (`domToMd`) over a constrained subset (bold, italic, heading, bullet list, quote, paragraphs). Content pasted into the body SHALL be sanitized down to that same subset. The stored value SHALL be plain markdown, byte-compatible with the terminal app's `marked` rendering; the Pip-Boy SHALL NOT bundle or load any markdown-rendering library.

- **Note mode**: an editable **title** input at the top and an `ELIMINA` control. Saving requires a non-empty title.
- **Background mode**: a fixed `BACKGROUND` label in place of the title (the background has no title) and **no** delete control; the background is cleared by saving an empty body.

**Persistence** is explicit via a `SALVA` button:
- a new note → `POST /campaigns/:cid/characters/:id/notes { title, note }` (blocked while the title is empty); once created, further saves in the same session → `PATCH .../notes/:noteId`;
- an existing note → `PATCH .../notes/:noteId { title, note }`;
- the background → `PATCH .../background { background }` (an empty body clears it).

The editor SHALL track a **dirty** state by comparing the current `{ title, domToMd(body) }` against the snapshot taken on open (reset to clean on each successful save). Closing the editor (its `✕` or a backdrop tap) while dirty SHALL open a **discard-changes confirmation** (`Chiudere senza salvare?`): confirming discards and closes, cancelling returns to the editor. A clean close SHALL skip the prompt.

**Delete** — activating `ELIMINA` (note mode only) SHALL open a **delete confirmation** (`Eliminare questa nota?`); confirming issues `DELETE .../notes/:noteId`, closes the editor, and refreshes the list; cancelling returns to the editor.

Both confirmations SHALL use a **reusable confirm dialog** whose two buttons are visually separated by a real gap (they SHALL NOT share an edge), so a mis-tap cannot land on the destructive action.

#### Scenario: Notes tab shows a background section and a note list
- **WHEN** the owner selects the `NOTES` tab
- **THEN** a `BACKGROUND` section with exactly one dedicated row and no `+` is shown, followed by a separated `NOTE` section whose head carries a `+`, with one row per note showing its title and last-update date

#### Scenario: Adding a note opens the shared editor empty
- **WHEN** the owner activates the `NOTE` section's `+`
- **THEN** the shared editor opens in note mode with an empty title input and an empty body, and no persistence request is issued yet

#### Scenario: Tapping a note row opens the same editor populated
- **WHEN** the owner taps a note row
- **THEN** the shared editor opens in note mode with the note's title and its body (parsed from stored markdown into formatted text), showing no raw markdown markers

#### Scenario: Saving a new note creates it
- **GIVEN** the empty editor with a title entered
- **WHEN** the owner presses `SALVA`
- **THEN** the app issues `POST .../notes { title, note }`, the editor closes, and the new row appears with its title and date

#### Scenario: Saving without a title is blocked
- **GIVEN** the note editor with an empty title
- **WHEN** the owner presses `SALVA`
- **THEN** no request is issued and the editor stays open

#### Scenario: Saving an existing note updates it
- **WHEN** the owner edits an existing note and presses `SALVA`
- **THEN** the app issues `PATCH .../notes/:noteId { title, note }` and the row reflects the new title and last-update date

#### Scenario: Deleting a note asks for confirmation first
- **WHEN** the owner presses `ELIMINA` in the note editor
- **THEN** a confirm dialog `Eliminare questa nota?` opens with two clearly separated buttons, and only on confirming does the app issue `DELETE .../notes/:noteId`, close the editor, and remove the row

#### Scenario: Background row opens the editor in background mode
- **WHEN** the owner activates the single background row
- **THEN** the shared editor opens with a fixed `BACKGROUND` label (no title input) and no `ELIMINA` control

#### Scenario: Saving the background persists it
- **WHEN** the owner writes text in background mode and presses `SALVA`
- **THEN** the app issues `PATCH .../background { background }` and the background row shows a first-line snippet of the saved text

#### Scenario: Clearing the background by saving empty
- **GIVEN** a character with a set background
- **WHEN** the owner empties the body in background mode and presses `SALVA`
- **THEN** the app issues `PATCH .../background { background: "" }` and the background row returns to its add-prompt

#### Scenario: Formatting is applied without visible markdown
- **WHEN** the owner selects text and taps the toolbar's bold control
- **THEN** the text renders as bold in the editor with no `**` markers shown, and on save the stored value contains the corresponding markdown

#### Scenario: Closing with unsaved changes prompts to discard
- **GIVEN** the editor with unsaved edits
- **WHEN** the owner taps the editor's `✕` or the backdrop
- **THEN** a confirm dialog `Chiudere senza salvare?` opens; confirming discards the edits and closes, and cancelling returns to the editor with the edits intact

#### Scenario: Closing with no changes skips the prompt
- **GIVEN** the editor opened and left unchanged
- **WHEN** the owner taps the editor's `✕` or the backdrop
- **THEN** the editor closes immediately with no confirmation and no request

#### Scenario: Non-owner viewer sees an empty screen without errors
- **GIVEN** a viewer who does not own the character, whose notes/background reads return `404`
- **WHEN** they select the `NOTES` tab
- **THEN** the background row shows its add-prompt and the note list is empty, with no error banner shown

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
