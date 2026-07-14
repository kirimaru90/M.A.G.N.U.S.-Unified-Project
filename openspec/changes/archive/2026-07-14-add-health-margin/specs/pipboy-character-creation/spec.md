## ADDED Requirements

### Requirement: Creation seeds the character's health margin

When a character is created, the wizard SHALL seed the new character's `margin` from the selected species-catalog entry's `margin` (per `api-species-catalog`), persisting it through `PATCH .../status { margin }` as part of the creation sequence. When the selected species entry carries no `margin`, the wizard SHALL fall back to `4`.

The margin is **copied**, not linked: after creation the character's `margin` lives on the character document and is edited independently of the species (per `api-character-stats` and `pipboy-character-sheet`). Seeding the margin SHALL NOT introduce a new wizard step or control — it is derived at submit from the species already chosen in the Identità step, exactly as `paMax`/`paTrackedBy` and the species talents are.

#### Scenario: Margin is seeded from the selected species
- **GIVEN** the selected species entry has `margin: 6`
- **WHEN** the character is created
- **THEN** the app issues `PATCH .../status` seeding `margin: 6` onto the new character

#### Scenario: Missing species margin falls back to four
- **GIVEN** the selected species entry carries no `margin`
- **WHEN** the character is created
- **THEN** the new character's `margin` is seeded as `4`

#### Scenario: No margin control appears in the wizard
- **WHEN** the user steps through the wizard
- **THEN** no step or control for choosing the health margin is presented; it is derived from the chosen species at submit
