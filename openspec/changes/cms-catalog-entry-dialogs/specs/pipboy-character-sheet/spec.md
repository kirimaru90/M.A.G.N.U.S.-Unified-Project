## ADDED Requirements

### Requirement: Header species chip shows the catalog name

The sheet header's bordered species chip SHALL display the species' display `name`, resolved by looking up the character's stored `species` slug in the species catalog (`GET /species-catalog`) that the app already loads at startup. It SHALL NOT display the raw slug when a matching catalog entry exists. When no catalog entry matches the slug, or the catalog failed to load, the chip SHALL fall back to the raw slug.

The label is resolved each time the sheet renders. A species renamed in the CMS SHALL therefore appear on existing characters' sheets the next time the app loads the catalog, with no change to the character document. This applies only to the label. Species data copied onto the character at creation (`permesso`/`svantaggio` perks, `margin`) SHALL NOT be affected.

#### Scenario: Chip shows the catalog name
- **GIVEN** a character with `species: "human"` and a species catalog entry `{ slug: "human", name: "Umano" }`
- **WHEN** the sheet header renders
- **THEN** the species chip reads `Umano`

#### Scenario: Chip falls back to the slug for an unknown species
- **GIVEN** a character with `species: "deathclaw"` and no catalog entry with that slug
- **WHEN** the sheet header renders
- **THEN** the species chip reads `deathclaw`

#### Scenario: A renamed species shows its new name on existing sheets
- **GIVEN** an existing character with `species: "ghoul"` and the catalog entry for `ghoul` renamed in the CMS from `Ghoul` to `Ghoul ferale`
- **WHEN** the app is reloaded and that character's sheet renders
- **THEN** the species chip reads `Ghoul ferale`, while the character's `SPECIE · Ghoul` perk keeps its creation-time text
