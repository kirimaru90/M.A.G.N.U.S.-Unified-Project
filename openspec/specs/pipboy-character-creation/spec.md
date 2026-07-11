# pipboy-character-creation Specification

## Purpose

The `apps/pip-boy` six-step character-creation wizard: a client-side flow (Identità, S.P.E.C.I.A.L., Punti Azione Massimi, Tag Skills, Equipaggiamento, Riepilogo) driven by the species, skills, and equipment catalogs that persists nothing until final submission, then creates and populates the character through the existing section endpoints.

## Requirements

### Requirement: Six-step creation wizard shell

`apps/pip-boy` SHALL provide a `create` screen: a six-step character-creation wizard entered from the dossier's `+ NUOVO PERSONAGGIO` action and exited either by completing step 6 or by stepping back out of step 1.

The header SHALL show the title `CREAZIONE`, a step counter `N/6 · <STEP LABEL>`, and a six-segment progress bar in which each segment renders solid green when its index is at or before the current step, and dim green otherwise.

The footer SHALL present `◄ INDIETRO` — always enabled, moving back one step, or returning to the dossier from step 1 — and, on steps 1–5, `AVANTI ▸`, which SHALL be visibly disabled (dimmed) until that step's validation passes. On step 6 the forward control SHALL instead be `✓ CREA PERSONAGGIO`, rendered wider and with a brighter fill.

The six steps, in order, are `IDENTITÀ`, `S.P.E.C.I.A.L.`, `PUNTI AZIONE MASSIMI`, `TAG SKILLS`, `EQUIPAGGIAMENTO`, `RIEPILOGO`.

Wizard state SHALL be held client-side for the duration of the wizard. No character document SHALL exist until step 6 is submitted; abandoning the wizard SHALL leave no persisted trace.

#### Scenario: Progress bar tracks the current step
- **WHEN** the user is on step 3
- **THEN** the counter reads `3/6 · PUNTI AZIONE MASSIMI` and the first three progress segments render solid

#### Scenario: Back from the first step exits to the dossier
- **WHEN** the user activates `◄ INDIETRO` on step 1
- **THEN** the wizard closes and the dossier is shown, with no character created

#### Scenario: Abandoning the wizard persists nothing
- **GIVEN** the user has completed steps 1 through 5
- **WHEN** they leave the wizard without submitting step 6
- **THEN** no character document exists for them in the campaign

#### Scenario: Forward control is a create action on the final step
- **WHEN** the user reaches step 6
- **THEN** the forward control reads `✓ CREA PERSONAGGIO` rather than `AVANTI ▸`

### Requirement: Step 1 — Identità

Step `IDENTITÀ` SHALL present a character-name text input and a species picker rendered as a 2×2 grid of buttons, one per entry in the species catalog (`GET /species-catalog`), with the selected species rendered with an active-green fill.

Beneath the picker, a bordered info box SHALL show the selected species' `permesso` copy in green, labelled `PERMESSO —`, and its `svantaggio` copy in amber with an amber glow, labelled `SVANTAGGIO —`.

`AVANTI ▸` SHALL be disabled until the name is non-blank.

#### Scenario: Species picker is driven by the catalog
- **GIVEN** the species catalog holds four entries
- **WHEN** step 1 renders
- **THEN** four species buttons are shown, labelled with the catalog entries' `name` values

#### Scenario: Info box reflects the selected species
- **WHEN** the user selects the `Ghoul` species
- **THEN** the info box shows that catalog entry's `permesso` in green and its `svantaggio` in amber

#### Scenario: Blank name blocks progress
- **GIVEN** the name input is empty or whitespace-only
- **WHEN** step 1 renders
- **THEN** `AVANTI ▸` is disabled

### Requirement: Step 2 — S.P.E.C.I.A.L. point buy

Step `S.P.E.C.I.A.L.` SHALL present the hint `18 punti · min 1 · max 4 per attributo`, a `N rimasti` counter in the top-right, and one stepper row per approach.

Each attribute SHALL be clamped to `1..4`. An increment SHALL be blocked once all 18 points are spent. The remaining counter SHALL render amber while greater than `0` and glowing green at exactly `0`.

`AVANTI ▸` SHALL be disabled until exactly `0` points remain.

This 18-point build rule is enforced **client-side only**; per `api-character-stats` the API accepts any attribute in `0..8` and does not enforce the build.

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

### Requirement: Step 3 — Punti Azione Massimi

Step `PUNTI AZIONE MASSIMI` SHALL explain that this is a permanent choice tied to either Agilità or Resistenza, and present two side-by-side selectable panels showing each of those attributes' current value from step 2.

The selected attribute SHALL be previewed as `PA MASSIMI` in a bordered box below, rendering the chosen attribute's value.

The selection determines the character's `paTrackedBy` (`agility` or `endurance`), and `paMax` SHALL be initialised to the chosen attribute's value, with `paCurrent` initialised equal to `paMax`.

#### Scenario: Panels show the step-2 values
- **GIVEN** the user set Agilità to `3` and Resistenza to `2` in step 2
- **WHEN** step 3 renders
- **THEN** the two panels show `3` and `2` respectively

#### Scenario: Selecting a source previews PA massimi
- **WHEN** the user selects the Resistenza panel and Resistenza is `2`
- **THEN** the `PA MASSIMI` box reads `2`

#### Scenario: Selection maps to paTrackedBy
- **WHEN** the user selects the Agilità panel and completes the wizard
- **THEN** the created character has `paTrackedBy: "agility"`, and `paMax` equal to its `agility` value

### Requirement: Step 4 — Tag Skills

Step `TAG SKILLS` SHALL present the hint `Competente 1 · Esperto 2 · Maestro 3 · budget N (Umano +1) · «—» azzera`, a running `MAESTRIA {cost}/{budget}` readout in the top-right, and three skill row-cards. Each row-card SHALL offer a `<select>` of the skills catalog (`GET /skills-catalog`) and a four-way segmented control: `—` (clears the row), `COMP`, `ESP`, `MAE`.

Maestria costs are `COMPETENTE` = 1, `ESPERTO` = 2, `MAESTRO` = 3. The **budget** SHALL be read from the selected species' `tagSkillBudget` in the species catalog — not hardcoded — which yields `4` for Umano and `3` for the other seeded species.

`AVANTI ▸` SHALL be disabled, with an amber warning shown, when either:
- two rows select the same skill — warning `ABILITÀ DUPLICATE`; or
- total maestria cost exceeds the budget — warning `MAESTRIA OLTRE IL BUDGET (N)`.

A row left at `—` contributes no skill and no cost.

#### Scenario: Budget comes from the species catalog
- **GIVEN** the user selected a species whose `tagSkillBudget` is `3`
- **WHEN** step 4 renders
- **THEN** the readout shows `MAESTRIA 0/3`

#### Scenario: Duplicate skills block progress
- **WHEN** two rows select the same catalog skill
- **THEN** an amber `ABILITÀ DUPLICATE` warning is shown and `AVANTI ▸` is disabled

#### Scenario: Exceeding the budget blocks progress
- **GIVEN** a budget of `3`
- **WHEN** the user selects two `MAESTRO` rows (cost `6`)
- **THEN** an amber `MAESTRIA OLTRE IL BUDGET (3)` warning is shown and `AVANTI ▸` is disabled

#### Scenario: Cleared rows cost nothing
- **GIVEN** two rows are set to `—`
- **WHEN** the third row is set to `ESPERTO`
- **THEN** the readout shows a cost of `2` and `AVANTI ▸` is enabled

### Requirement: Step 5 — Equipaggiamento

Step `EQUIPAGGIAMENTO` SHALL source its options from the equipment catalog, requesting only starter templates (`GET /equipment-catalog?starter=true`), and SHALL present:

- a vertical list of selectable **weapon** rows (`kind: weapon`), each showing the template name and a summary of its tags;
- a vertical list of selectable **armor** rows (`kind: armor`), same pattern;
- a bordered `ROTTAMI INIZIALI · 1d6` row with a live value and a `TIRA` control that rolls `1..6`;
- a free-text `OGGETTO SIGNIFICATIVO` input for the character's keepsake;
- the footnote `Dotazione fissa: 2 Stimpack inclusi.`, reflecting the starter `consumable` templates.

The wizard SHALL NOT permit authoring new equipment; templates are authored only in the CMS per `api-equipment-catalog`.

#### Scenario: Starter options come from the catalog
- **WHEN** step 5 renders
- **THEN** the app has requested `GET /equipment-catalog?starter=true` and lists only templates flagged `isStarter`

#### Scenario: Weapon and armor lists are split by kind
- **GIVEN** the starter catalog holds four `weapon` and three `armor` templates
- **WHEN** step 5 renders
- **THEN** four rows appear under the weapon list and three under the armor list

#### Scenario: Rolling initial scraps
- **WHEN** the user activates `TIRA` on the `ROTTAMI INIZIALI · 1d6` row
- **THEN** a value between `1` and `6` inclusive is shown and retained as the character's starting scraps

#### Scenario: Equipment cannot be authored from the wizard
- **WHEN** step 5 renders
- **THEN** no control is offered to create, rename, or retag an equipment template

### Requirement: Step 6 — Riepilogo and character creation

Step `RIEPILOGO` SHALL present a read-only summary: the name; a `{species} · PA {paMax} ({source name}) · TAPPI {luck}` line; the seven-stat mini-row reused from the dossier card; the trained-skills list; and an equipment bullet list covering the chosen weapon, armor, rolled scraps, the stimpack line, and the keepsake if set.

On `✓ CREA PERSONAGGIO` the app SHALL create the character and open its sheet directly. Creation SHALL:

1. `POST /campaigns/:cid/characters { name, species }` — for an admin, including the `userId` of the owner chosen before the wizard began; for a player, omitting it so the character is owned by them.
2. Patch the wizard's values onto the returned character through the existing section endpoints: `PATCH .../special`, `PATCH .../skills`, `PATCH .../action-points` (`paMax`, `paCurrent`, `paTrackedBy`), `PATCH .../resources` (rolled `scraps`; `caps` seeded from the character's `luck`), and `PATCH .../inventory`.
3. Instantiate the selected starter templates onto the character by **copying** them per `api-equipment-catalog` — the weapon into `inventory.weapons`, the armor into `inventory.equip`, and each starter `consumable` into `inventory.consumables` at its `defaultQuantity` — with no catalog slug persisted on the character. The keepsake, when non-blank, is added to `inventory.other`.
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
- **THEN** that item appears in `inventory.other`

#### Scenario: Blank keepsake adds no item
- **GIVEN** the `OGGETTO SIGNIFICATIVO` input is empty
- **WHEN** the character is created
- **THEN** `inventory.other` gains no item from the wizard

#### Scenario: Partial failure surfaces an error without losing the character
- **GIVEN** the character document was created but a follow-up section PATCH fails
- **WHEN** the failure is observed
- **THEN** an Italian terminal-voiced error is shown and the character's sheet is opened
