## ADDED Requirements

### Requirement: S.P.E.C.I.A.L., skills, and perks render read-only for non-admin

The sheet SHALL display the character's `special` attributes, `skills`, and `perks` at all times, but SHALL NOT offer any input for editing them unless the viewing user is an admin. These three sections are admin-only at the API (`api-character-stats`); the sheet SHALL NOT attempt a write to any of them on behalf of a non-admin, and SHALL visually distinguish the locked state from editable sections (consistent with the CRT aesthetic).

#### Scenario: Player views their own SPECIAL as read-only
- **WHEN** a player opens their own character's sheet
- **THEN** the S.P.E.C.I.A.L. values are visible but present no increment/decrement or edit controls

#### Scenario: Admin can edit SPECIAL
- **WHEN** an admin opens any character's sheet
- **THEN** the S.P.E.C.I.A.L. section presents edit controls, and a change is submitted via the existing `PATCH .../special` endpoint

#### Scenario: Player views skills and perks as read-only
- **WHEN** a player opens their own character's sheet
- **THEN** the skills and perks lists are visible with no add/edit/remove controls

### Requirement: Action points stepper

The sheet SHALL present the character's action points (`paCurrent` of `paMax`) as a stepper. Any viewer who owns the character, or an admin, SHALL be able to adjust `paCurrent` via the existing `PATCH .../action-points` endpoint (sending only `paCurrent`). `paMax` and `paTrackedBy` SHALL render read-only for a non-admin owner, consistent with their admin-only write status.

#### Scenario: Owner spends action points
- **WHEN** the owning player decrements the PA stepper by 1
- **THEN** the app issues `PATCH .../action-points { paCurrent: <new value> }` and the stepper reflects the persisted result

#### Scenario: paMax is not editable by a non-admin owner
- **WHEN** the owning (non-admin) player views the PA stepper
- **THEN** no control is offered to change `paMax` or `paTrackedBy`

### Requirement: Status and conditions editor

The sheet SHALL present the character's `status` (positive/negative conditions, `criticalState`) as owner- and admin-editable, using the existing `PATCH .../status` endpoint. When adding a condition, the app SHALL offer quick-pick suggestions sourced from the conditions catalog (`GET /conditions-catalog`) that pre-fill `name`/`severity`, but SHALL also allow a fully freeform condition (matching the existing `api-character-stats` status shape, which has no persisted link to a catalog slug). A quick-pick suggestion's catalog entry `polarity` (`positive` | `negative`) determines which collection — `positiveConditions` or `negativeConditions` — the app targets; this routing is client-side only (the catalog's `polarity` has no server-side effect). For a freeform condition, the player explicitly chooses which collection to add it to.

#### Scenario: Owner adds a condition from a catalog suggestion
- **WHEN** the owning player picks a conditions-catalog suggestion and confirms
- **THEN** the app issues `PATCH .../status` adding a condition whose `name`/`severity` match the catalog entry's `name`/`defaultSeverity`

#### Scenario: Catalog suggestion routes by polarity
- **GIVEN** the picked conditions-catalog entry has `polarity: "negative"`
- **WHEN** the owning player confirms adding it
- **THEN** the app issues `PATCH .../status` targeting `negativeConditions` (not `positiveConditions`)

#### Scenario: Owner adds a freeform condition
- **WHEN** the owning player types a condition name not present in the catalog, chooses a collection, and confirms
- **THEN** the app issues `PATCH .../status` adding that condition to the chosen collection as entered, unaffected by the catalog being empty or lacking a match

#### Scenario: Critical state renders prominently
- **WHEN** a character's `criticalState` is `true`
- **THEN** the sheet displays a prominent Italian critical-state banner consistent with the reference design's "STATO CRITICO" treatment

### Requirement: Inventory and gear editor

The sheet SHALL present the character's `inventory` (weapons, equip, consumables, other) as owner- and admin-editable, using the existing `PATCH .../inventory` endpoint, including add/edit/remove per item and the `broken`/`damaged` toggle per the existing item shapes.

#### Scenario: Owner adds a weapon
- **WHEN** the owning player adds a weapon with a name
- **THEN** the app issues `PATCH .../inventory { weapons: { items: [{ name }] } }` and the new item (with its server-assigned id) appears in the list

#### Scenario: Owner marks an item damaged
- **WHEN** the owning player toggles an equip item's damaged state
- **THEN** the app issues a `PATCH .../inventory` merge for that item's `id` setting `broken: true`

### Requirement: Resources display and edit

The sheet SHALL present `resources` (caps, scraps, bobbleheads) via the existing `PATCH .../resources` endpoint. `caps` and `scraps` SHALL be editable by the owner (or admin); `bobbleheads` SHALL render read-only for a non-admin owner.

#### Scenario: Owner adjusts caps
- **WHEN** the owning player changes the caps value
- **THEN** the app issues `PATCH .../resources { caps: <new value> }`

#### Scenario: Bobbleheads not editable by a non-admin owner
- **WHEN** the owning (non-admin) player views resources
- **THEN** no control is offered to change `bobbleheads`

### Requirement: Client-side dice roller

The sheet SHALL provide a dice roller that rolls a pool of d6 sized by the relevant S.P.E.C.I.A.L. rating (or other in-scene modifier), computed and resolved entirely client-side with no server-recorded roll history. When resolving a roll that spends or refunds action points per the game rules (each `6` beyond the first refunds 1 PA; a reroll costs PA), the app SHALL apply the resulting change to `paCurrent` via the existing `PATCH .../action-points` endpoint — the same call path as the manual PA stepper.

#### Scenario: Roll refunds PA on multiple sixes
- **WHEN** a roll of a 4-die pool yields three `6`s
- **THEN** the app computes a refund of 2 PA (each `6` beyond the first) and issues `PATCH .../action-points { paCurrent: <current + 2, capped at paMax> }`

#### Scenario: Roll result is not persisted as history
- **WHEN** any roll is resolved
- **THEN** no request is made to store the roll itself; only the resulting `paCurrent` change (if any) is sent
