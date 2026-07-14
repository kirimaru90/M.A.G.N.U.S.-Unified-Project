## MODIFIED Requirements

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
