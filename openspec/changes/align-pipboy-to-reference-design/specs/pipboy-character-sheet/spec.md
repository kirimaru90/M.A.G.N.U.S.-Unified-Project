## REMOVED Requirements

### Requirement: S.P.E.C.I.A.L., skills, and perks render read-only for non-admin

**Reason.** Superseded by the owner-editable model. `api-character-stats` now makes `special`, `skills`, and `perks` writable by the character's owner, so a "read-only for non-admin" sheet would contradict the API and would render the reference design's `✎` editor toggle inert. Replaced by the `Editor mode toggle` and `S.P.E.C.I.A.L. approaches tab` requirements below.

**Migration.** The "Sola lettura — modificabile solo da un admin" note and the locked-section styling are removed from `apps/pip-boy`. Owners now edit these sections through the editor toggle; admins retain the same access to any character in the campaign.

### Requirement: Client-side dice roller

**Reason.** Relocated, not deleted. The reference design specifies a substantially richer roller (approach picker, Vantaggio/Svantaggio, situational modifier, tumble animation, per-die selection and reroll-for-PA, and a `▸ REGISTRO` history) than a single requirement on this capability can carry. Its full behaviour — including the PA-refund rule preserved verbatim — now lives in the new `pipboy-dice-roller` capability.

**Migration.** No behavioural regression: `pipboy-dice-roller` restates the existing rules (rolls resolved client-side, no server-recorded roll history, PA changes persisted via `PATCH .../action-points`) and adds the reference's remaining mechanics.

## MODIFIED Requirements

### Requirement: Action points stepper

The sheet header SHALL present the character's action points per the reference layout: the label `PUNTI AZIONE`, a row of `paMax` pip squares (filled and glowing when "on"), and a `[−][+]` stepper. Adjusting the stepper SHALL write `paCurrent` via the existing `PATCH .../action-points` endpoint.

`paMax` and `paTrackedBy` SHALL NOT be editable from the header. They are edited by the owner (or an admin) in the S.P.E.C.I.A.L. tab's editor mode, via a `FONTE PA` selector and a `MAX PA` stepper, consistent with `api-character-stats` now making both owner-writable. When `paMax` is lowered below `paCurrent`, the app SHALL clamp `paCurrent` to the new maximum and persist the clamped value.

The header SHALL also show the character's name, a bordered species chip, and a `PA · <source approach name>` line derived from `paTrackedBy`.

#### Scenario: Owner spends action points
- **WHEN** the owning player decrements the PA stepper by 1
- **THEN** the app issues `PATCH .../action-points { paCurrent: <new value> }` and the pips reflect the persisted result

#### Scenario: Pip row is sized to paMax
- **GIVEN** a character with `paMax: 5` and `paCurrent: 2`
- **WHEN** the sheet header renders
- **THEN** five pip squares are shown, two of them filled

#### Scenario: Owner changes paMax from the editor
- **WHEN** the owning player raises `MAX PA` in the S.P.E.C.I.A.L. tab's editor mode
- **THEN** the app issues `PATCH .../action-points { paMax: <new value> }` and the header's pip row resizes

#### Scenario: Lowering paMax clamps paCurrent
- **GIVEN** a character with `paMax: 6` and `paCurrent: 6`
- **WHEN** the owner lowers `MAX PA` to `4`
- **THEN** `paCurrent` is clamped to `4` and the clamped value is persisted

### Requirement: Status and conditions editor

The SALUTE tab SHALL present the character's `status` as owner- and admin-editable via the existing `PATCH .../status` endpoint, laid out per the reference's *Tracciato del Logoramento*:

- A `VALORE NETTO` readout showing **net wear** = (sum of negative-condition weights) − (sum of positive-condition weights), where a `minor` condition weighs `1` and a `major` condition weighs `2`. The number renders green normally and amber+glowing when greater than `0`.
- The active-condition list, **negatives sorted before positives**, each a full-width button carrying a `−`/`+` sign glyph, the condition name, a `BASE` / `MODERATA ×2` weight tag, and a `✕`. Activating a row removes that condition (representing rest / stimpack / RadAway).
- A dashed empty state (`nessuna condizione attiva`) when both collections are empty.
- `▸ CONDIZIONI RAPIDE`: preset buttons sourced from the conditions catalog (`GET /conditions-catalog`), each showing its sign glyph, name, and an optional `×2`. A preset's `polarity` determines which collection it is added to; this routing is client-side only. When the catalog fetch fails, the app SHALL fall back to a small hardcoded preset list rather than rendering nothing.
- `▸ CONDIZIONE PERSONALIZZATA`: a freeform name input, a `NEGATIVA`/`POSITIVA` sign toggle, a `BASE ×1`/`MODERATA ×2` weight toggle, and a full-width `+ AGGIUNGI CONDIZIONE` submit.

**Critical state** SHALL be derived by the client as `net wear ≥ 4` and persisted through `PATCH .../status { criticalState }` whenever the condition collections change. When critical, the sheet SHALL show the amber `⚠ STATO CRITICO — NON PUOI AGIRE` banner beneath the tab bar on **every tab**, flip the status-bar dot and label to amber `⚠ CRITICO`, and apply the amber inset ring specified by `pipboy-terminal-chrome`.

#### Scenario: Net wear is computed from weights
- **GIVEN** a character with two `major` negative conditions and one `minor` positive condition
- **WHEN** the SALUTE tab renders
- **THEN** `VALORE NETTO` reads `3` (2+2 − 1) and renders amber

#### Scenario: Negatives sort before positives
- **GIVEN** a character with one positive and one negative condition
- **WHEN** the active-condition list renders
- **THEN** the negative condition appears above the positive one

#### Scenario: Owner adds a condition from a catalog suggestion
- **WHEN** the owning player activates a quick-condition preset
- **THEN** the app issues `PATCH .../status` adding a condition whose `name`/`severity` match the catalog entry's `name`/`defaultSeverity`

#### Scenario: Catalog suggestion routes by polarity
- **GIVEN** the picked conditions-catalog entry has `polarity: "negative"`
- **WHEN** the owning player adds it
- **THEN** the app issues `PATCH .../status` targeting `negativeConditions` (not `positiveConditions`)

#### Scenario: Catalog fetch failure falls back to presets
- **WHEN** `GET /conditions-catalog` fails
- **THEN** the `▸ CONDIZIONI RAPIDE` row renders a hardcoded fallback preset list

#### Scenario: Owner adds a freeform condition
- **WHEN** the owning player types a condition name, chooses a sign and a weight, and submits
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
- **WHEN** the user switches to the ZAINO tab
- **THEN** the amber `⚠ STATO CRITICO — NON PUOI AGIRE` banner is still displayed beneath the tab bar

### Requirement: Inventory and gear editor

The ZAINO tab SHALL present the character's `inventory` as owner- and admin-editable via the existing `PATCH .../inventory` endpoint, laid out per the reference:

- `▸ ARMI` and `▸ ARMATURE`: one row-card per item (`inventory.weapons` and `inventory.equip` respectively), each showing the item name, an amber `DANNEGGIATA` tag when any of its tags is marked damaged, and its tags as chips. `CORE` chips render with a tinted fill and solid border; `EXTRA` chips render outline-only with a dashed border. Each chip carries a small `CORE`/`EXTRA` kind-label.
- Tapping a tag chip in **view** mode SHALL toggle that tag's `damaged` flag (struck-through, dimmed). In **editor** mode a chip's label becomes an inline text input with a `✕` remover, and `+ core` / `+ extra` dashed buttons appear to add tags.
- `▸ CONSUMABILI`: compact dashed-divider rows showing name, `×qty`, a `[−][+]` stepper, and — in editor mode only — a `✕`.
- In editor mode each list gains a dashed `+ AGGIUNGI` action and each row a `✕` remover, per the `Editor mode toggle` requirement.

#### Scenario: Owner adds a weapon
- **WHEN** the owning player adds a weapon with a name in editor mode
- **THEN** the app issues `PATCH .../inventory { weapons: { items: [{ name }] } }` and the new item (with its server-assigned id) appears in the list

#### Scenario: Owner marks a tag damaged from view mode
- **WHEN** the owning player taps a weapon's tag chip while not in editor mode
- **THEN** the app issues a `PATCH .../inventory` merge for that item setting the tag's `damaged: true`, and the chip renders struck-through

#### Scenario: Item with any damaged tag shows the DANNEGGIATA marker
- **GIVEN** a weapon with one of its two tags marked `damaged`
- **WHEN** its row-card renders
- **THEN** an amber `DANNEGGIATA` tag is shown on the card

#### Scenario: Core and extra chips render differently
- **GIVEN** an item with one `core` tag and one `extra` tag
- **WHEN** its chips render
- **THEN** the `core` chip has a tinted fill and a solid border, and the `extra` chip has a dashed, unfilled border

#### Scenario: Tag editing is gated behind editor mode
- **WHEN** editor mode is off
- **THEN** no `+ core` / `+ extra` buttons and no per-tag `✕` removers are rendered

### Requirement: Resources display and edit

The ZAINO tab SHALL present `resources` as three bordered boxes in a row — `TAPPI` (caps), `ROTTAMI` (scraps), and `BOBBLEHEAD` (bobbleheads) — each with a label and a `[−] value [+]` stepper whose value is also a directly-editable numeric input. All three SHALL be editable by the character's owner or an admin via the existing `PATCH .../resources` endpoint, consistent with `api-character-resources` now making `bobbleheads` owner-writable.

The sheet footer SHALL show `TAPPI n` reflecting the current caps value.

#### Scenario: Owner adjusts caps
- **WHEN** the owning player changes the caps value
- **THEN** the app issues `PATCH .../resources { caps: <new value> }`

#### Scenario: Owner adjusts bobbleheads
- **WHEN** the owning (non-admin) player increments the `BOBBLEHEAD` stepper
- **THEN** the app issues `PATCH .../resources { bobbleheads: <new value> }` and the persisted value reflects the change

#### Scenario: Resource value is directly editable
- **WHEN** the owning player types a value into a resource box's numeric input
- **THEN** the app issues the matching `PATCH .../resources` write

## ADDED Requirements

### Requirement: Editor mode toggle

The sheet SHALL provide a single `✎` editor-mode toggle, rendered as a fixed-width button at the far right of the tab bar. Editor mode is a client-side view state; it SHALL default to off on every sheet open and SHALL NOT be persisted.

While editor mode is **on**:
- A green `◉ EDITOR — modifica S.P.E.C.I.A.L., abilità e talenti` strip SHALL appear beneath the tab bar (yielding to the amber critical banner when both apply).
- Every editable list SHALL swap from its view layout to its edit layout: static text becomes inline `<input>`s, each row gains a `✕` remover, and each list gains a dashed `+ AGGIUNGI …` action.

Editor mode SHALL be offered only to a user who may actually write the character — its owner, or an admin. For any other viewer the `✎` toggle SHALL NOT be rendered.

Each list SHALL be implemented as a view/edit pair, never as a single mutable render.

#### Scenario: Owner sees the editor toggle
- **WHEN** the owning player opens their character's sheet
- **THEN** a `✎` toggle is rendered at the far right of the tab bar

#### Scenario: Admin sees the editor toggle on another player's sheet
- **WHEN** an admin opens a character owned by another player in the campaign
- **THEN** the `✎` toggle is rendered

#### Scenario: Editor mode reveals edit affordances
- **WHEN** the owning player activates the `✎` toggle
- **THEN** the `◉ EDITOR` strip appears and the abilities, talents, weapons, and armor lists each present a dashed `+ AGGIUNGI …` action and per-row `✕` removers

#### Scenario: Editor mode resets on reopen
- **GIVEN** a user left the sheet with editor mode on
- **WHEN** they reopen that character's sheet
- **THEN** editor mode is off

#### Scenario: Critical banner takes precedence over the editor strip
- **GIVEN** a character in critical state
- **WHEN** editor mode is on
- **THEN** the amber `⚠ STATO CRITICO — NON PUOI AGIRE` banner is displayed

### Requirement: Five-tab sheet layout

The sheet SHALL present exactly five content tabs, in order — `S.P.E`, `ABIL`, `SALUTE`, `ZAINO`, `DADI` — as equal-width flex buttons, followed by the fixed-width `✎` editor toggle. Each tab is divided from the next by a hairline right border.

The active tab SHALL render at full opacity with a tinted background and a 2px glowing green underline pinned to its bottom edge. Inactive tabs SHALL render at reduced opacity. The sheet footer SHALL show the current tab's name on the left, `TAPPI n` in the centre, and an `HH:MM` clock on the right.

The `ABIL` tab is **new**: abilities (Tag Skills with maestria) and talents (perks) move out of the S.P.E tab, which previously carried both.

#### Scenario: Five tabs plus the editor toggle render
- **WHEN** a character sheet opens
- **THEN** exactly five tab buttons labelled `S.P.E`, `ABIL`, `SALUTE`, `ZAINO`, `DADI` are rendered, plus one `✎` toggle

#### Scenario: Active tab carries the glowing underline
- **WHEN** the user selects the `SALUTE` tab
- **THEN** it renders at full opacity with a tinted background and a 2px glowing underline, and the other four render dimmed

#### Scenario: Footer tracks the active tab
- **WHEN** the user selects the `ZAINO` tab
- **THEN** the footer's left slot reads the ZAINO tab's name, its centre reads `TAPPI n`, and its right slot shows an `HH:MM` clock

### Requirement: S.P.E.C.I.A.L. approaches tab

The `S.P.E` tab SHALL present, in **view** mode, the header `▸ APPROCCI · TOCCA PER TIRARE` and the hint `Il valore = numero di d6 nel pool`, followed by seven full-width approach rows. Each row SHALL show the approach's display letter, its name, its one-line description, and a five-slot pip row rendering that attribute's value.

Activating an approach row SHALL switch to the `DADI` tab with that approach preselected as the dice-pool source.

Beneath the rows, a bordered legend box SHALL render the dice-outcome reference: `6 = Successo Pieno · 4/5 = Successo con Costo · 1/2/3 = Fallimento. Ogni 6 oltre il primo restituisce 1 PA.`

In **editor** mode the tab SHALL instead show the header `▸ MODIFICA S.P.E.C.I.A.L.` and seven stepper rows (letter · name · `[−] value [+]`) bounded `0..8`, writing through `PATCH .../special`; followed by a `FONTE PA` selector writing `paTrackedBy` and a `MAX PA` stepper (`0..8`) writing `paMax`.

#### Scenario: Approach rows render with pips
- **WHEN** the `S.P.E` tab renders in view mode
- **THEN** seven rows are shown, each with a display letter, name, description, and a pip row reflecting that attribute's value

#### Scenario: Tapping an approach jumps to the dice tab preselected
- **WHEN** the user activates the `PERCEZIONE` row
- **THEN** the `DADI` tab is shown with `PERCEZIONE` preselected as the pool source

#### Scenario: Owner edits an attribute
- **WHEN** the owning player increments `FORZA` in editor mode
- **THEN** the app issues `PATCH .../special { strength: <new value> }` and the persisted value reflects the change

#### Scenario: Attribute steppers are bounded 0..8
- **GIVEN** an attribute at value `8`
- **WHEN** the sheet renders its stepper in editor mode
- **THEN** the `+` control is disabled, and at value `0` the `−` control is disabled

#### Scenario: Owner changes the PA source
- **WHEN** the owning player selects `Resistenza` in the `FONTE PA` selector
- **THEN** the app issues `PATCH .../action-points { paTrackedBy: "endurance" }` and the header's `PA · <source>` line updates

### Requirement: Abilities tab

The `ABIL` tab SHALL present two editable sections and one read-only reference block.

- `▸ TAG SKILLS · MAESTRIA`: one row-card per entry in `skills`, showing the skill's catalog name and its maestria level. In editor mode the level becomes a `<select>` (`COMPETENTE` / `ESPERTO` / `MAESTRO`) and a `✕` remover appears, with a dashed `+ ABILITÀ` action adding a row backed by the skills catalog. Writes go through `PATCH .../skills`.
- `▸ TALENTI`: one row-card per entry in `perks`, showing name and description. In editor mode both become inputs, a `✕` remover appears, and a dashed `+ TALENTO` action adds a row. Writes go through `PATCH .../perks`.
- A view-only `▸ SPESA PA` block listing three dashed-divider lines: `RITIRA FALLITI` (1 PA, requires the relevant Tag Skill), `RUBA LA SCENA` (1 PA, act out of turn or again), and `V.A.T.S.` (1 PA, exploit an advantage or targeted effect).

Maestria tiers are **narrative**: `COMPETENTE` raises the Risk a GM applies by one grade, `ESPERTO` leaves it unchanged, and `MAESTRO` lowers it by one grade. The app SHALL NOT apply any mechanical dice effect from maestria.

#### Scenario: Owner adds a tag skill
- **WHEN** the owning player activates `+ ABILITÀ`, picks a catalog skill and a level, and confirms
- **THEN** the app issues `PATCH .../skills { items: [{ id: <slug>, level: <level> }] }` and the row appears

#### Scenario: Owner changes a maestria level
- **WHEN** the owning player changes a skill's level select in editor mode
- **THEN** the app issues `PATCH .../skills` with that skill's slug and the new level

#### Scenario: Owner removes a talent
- **WHEN** the owning player activates a talent row's `✕`
- **THEN** the app issues `PATCH .../perks { deletedIds: [<id>] }` and the row disappears

#### Scenario: SPESA PA block is never editable
- **WHEN** editor mode is on
- **THEN** the `▸ SPESA PA` block presents no inputs, removers, or add actions

#### Scenario: Maestria has no mechanical dice effect
- **GIVEN** a character with a `MAESTRO` tag skill
- **WHEN** a dice pool is computed for any approach
- **THEN** the pool size is unaffected by that skill's maestria tier
