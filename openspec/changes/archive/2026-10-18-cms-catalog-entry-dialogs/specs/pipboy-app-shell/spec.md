## ADDED Requirements

### Requirement: Dossier card species shows the catalog name

The species shown in each DOSSIER card's species/PA/tappi meta line SHALL be the species' display `name`, resolved by looking up the character's stored `species` slug in the species catalog the app already loads at startup. When no catalog entry matches, or the catalog failed to load, it SHALL fall back to the raw slug. Resolution SHALL be the same as the sheet header's species chip (`pipboy-character-sheet`), so a character's species reads identically on its dossier card and on its sheet.

#### Scenario: Dossier meta line uses the catalog name
- **GIVEN** a character with `species: "super_mutant"` and a catalog entry `{ slug: "super_mutant", name: "Supermutante" }`
- **WHEN** the dossier lists that character
- **THEN** its meta line begins with `Supermutante`, not `super_mutant`

#### Scenario: Dossier meta line falls back to the slug
- **GIVEN** a character whose `species` slug has no catalog entry
- **WHEN** the dossier lists that character
- **THEN** its meta line shows the raw slug
