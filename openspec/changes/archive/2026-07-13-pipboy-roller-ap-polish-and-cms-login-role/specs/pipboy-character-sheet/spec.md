## MODIFIED Requirements

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
