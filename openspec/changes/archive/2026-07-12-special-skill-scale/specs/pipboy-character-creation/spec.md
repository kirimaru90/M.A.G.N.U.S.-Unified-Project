## MODIFIED Requirements

### Requirement: Step 2 — S.P.E.C.I.A.L. point buy

Step `S.P.E.C.I.A.L.` SHALL present the hint `18 punti · min 1 · max 4 per attributo`, a `N rimasti` counter in the top-right, and one stepper row per approach.

Each attribute SHALL be clamped to `1..4` during the build. An increment SHALL be blocked once all 18 points are spent. The remaining counter SHALL render amber while greater than `0` and glowing green at exactly `0`.

`AVANTI ▸` SHALL be disabled until exactly `0` points remain.

This 18-point build rule is enforced **client-side only**; per `api-character-stats` the API accepts any attribute in `1..5` and does not enforce the build. The build's per-attribute cap of `4` sits inside the stored `1..5` range, leaving headroom for later advancement to `5` via the sheet editor.

#### Scenario: Attributes start at the minimum
- **WHEN** step 2 first renders
- **THEN** each of the seven attributes is `1` and the counter reads `11 rimasti` (18 − 7)

#### Scenario: Attribute cannot exceed 4
- **GIVEN** an attribute at `4`
- **WHEN** the step renders
- **THEN** that attribute's `+` control is disabled

#### Scenario: Increments blocked when points are exhausted
- **GIVEN** `0` points remain
- **WHEN** the step renders
- **THEN** every attribute's `+` control is disabled, while `−` controls remain enabled

#### Scenario: Progress requires spending every point
- **GIVEN** `2` points remain
- **WHEN** step 2 renders
- **THEN** the counter renders amber and `AVANTI ▸` is disabled

#### Scenario: Exactly zero remaining unblocks progress
- **WHEN** the last point is spent
- **THEN** the counter renders `0` with a green glow and `AVANTI ▸` becomes enabled
