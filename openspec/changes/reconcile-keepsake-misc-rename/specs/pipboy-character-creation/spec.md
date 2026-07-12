## MODIFIED Requirements

### Requirement: Step 6 — Riepilogo and character creation

Step `RIEPILOGO` SHALL present a read-only summary: the name; a `{species} · PA {paMax} ({source name}) · TAPPI {luck}` line; the seven-stat mini-row reused from the dossier card; the trained-skills list; and an equipment bullet list covering the chosen weapon, armor, rolled scraps, the stimpack line, and the keepsake if set.

On `✓ CREA PERSONAGGIO` the app SHALL create the character and open its sheet directly. Creation SHALL:

1. `POST /campaigns/:cid/characters { name, species }` — for an admin, including the `userId` of the owner chosen before the wizard began; for a player, omitting it so the character is owned by them.
2. Patch the wizard's values onto the returned character through the existing section endpoints: `PATCH .../special`, `PATCH .../skills`, `PATCH .../action-points` (`paMax`, `paCurrent`, `paTrackedBy`), `PATCH .../resources` (rolled `scraps`; `caps` seeded from the character's `luck`), and `PATCH .../inventory`.
3. Instantiate the selected starter templates onto the character by **copying** them per `api-equipment-catalog` — the weapon into `inventory.weapons`, the armor into `inventory.equip`, and each starter `consumable` into `inventory.consumables` at its `defaultQuantity` — with no catalog slug persisted on the character. The keepsake, when non-blank, is added to `inventory.misc` (the renamed successor of the former `other` collection per `api-character-inventory`); the wizard SHALL NOT write the removed `other` key.
4. `PATCH .../perks` with two derived talents from the selected species-catalog entry: one named `SPECIE · {species name}` carrying its `permesso` copy, and one named `SVANTAGGIO` carrying its `svantaggio` copy.

The character SHALL be created with no conditions and `criticalState: false`.

If any step of the sequence fails after the character document has been created, the app SHALL surface an Italian, terminal-voiced error and open the (partially populated) sheet rather than silently discarding the character or retrying indefinitely.

#### Scenario: Player creates their own character
- **WHEN** a non-admin player submits step 6
- **THEN** the app POSTs without a `userId`, the character is owned by that player, and its sheet opens

#### Scenario: Admin creates a character for the chosen player
- **GIVEN** an admin picked player `P` as the owner before the wizard began
- **WHEN** the admin submits step 6
- **THEN** the app POSTs with `userId: P` and the created character is owned by `P`

#### Scenario: Species talents are derived from the catalog
- **GIVEN** the selected species entry has `name: "Ghoul"` and non-empty `permesso` and `svantaggio`
- **WHEN** the character is created
- **THEN** its `perks` contain one talent named `SPECIE · Ghoul` carrying the `permesso` copy and one named `SVANTAGGIO` carrying the `svantaggio` copy

#### Scenario: Starter equipment is copied, not referenced
- **GIVEN** the user selected the starter weapon template `pistola-10mm`
- **WHEN** the character is created
- **THEN** its `inventory.weapons` holds an item with a server-minted `id` whose name and tags match the template, and no persisted catalog slug

#### Scenario: Fixed stimpack dotazione is applied
- **GIVEN** the starter catalog holds a `stimpack` consumable with `defaultQuantity: 2`
- **WHEN** the character is created
- **THEN** its `inventory.consumables` holds a `Stimpack` item with `quantity: 2`

#### Scenario: Keepsake is stored when provided
- **GIVEN** the user entered an `OGGETTO SIGNIFICATIVO`
- **WHEN** the character is created
- **THEN** that item appears in `inventory.misc`

#### Scenario: Blank keepsake adds no item
- **GIVEN** the `OGGETTO SIGNIFICATIVO` input is empty
- **WHEN** the character is created
- **THEN** `inventory.misc` gains no item from the wizard

#### Scenario: Partial failure surfaces an error without losing the character
- **GIVEN** the character document was created but a follow-up section PATCH fails
- **WHEN** the failure is observed
- **THEN** an Italian terminal-voiced error is shown and the character's sheet is opened
