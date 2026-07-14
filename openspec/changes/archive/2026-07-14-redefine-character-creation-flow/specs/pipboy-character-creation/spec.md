## RENAMED Requirements

- FROM: `### Requirement: Six-step creation wizard shell`
- TO: `### Requirement: Five-step creation wizard shell`

- FROM: `### Requirement: Step 4 — Tag Skills`
- TO: `### Requirement: Step 3 — Tag Skills`

- FROM: `### Requirement: Step 5 — Equipaggiamento`
- TO: `### Requirement: Step 4 — Equipaggiamento`

- FROM: `### Requirement: Step 6 — Riepilogo and character creation`
- TO: `### Requirement: Step 5 — Riepilogo and character creation`

## MODIFIED Requirements

### Requirement: Five-step creation wizard shell

`apps/pip-boy` SHALL provide a `create` screen: a five-step character-creation wizard entered from the dossier's `+ NUOVO PERSONAGGIO` action and exited either by completing step 5 or by stepping back out of step 1.

The header SHALL show the title `CREAZIONE`, a step counter `N/5 · <STEP LABEL>`, and a five-segment progress bar in which each segment renders solid green when its index is at or before the current step, and dim green otherwise.

The footer SHALL present `◄ INDIETRO` — always enabled, moving back one step, or returning to the dossier from step 1 — and, on steps 1–4, `AVANTI ▸`, which SHALL be visibly disabled (dimmed) until that step's validation passes. On step 5 the forward control SHALL instead be `✓ CREA PERSONAGGIO`, rendered wider and with a brighter fill.

The five steps, in order, are `IDENTITÀ`, `S.P.E.C.I.A.L.`, `TAG SKILLS`, `EQUIPAGGIAMENTO`, `RIEPILOGO`. There is no longer a distinct `PUNTI AZIONE MASSIMI` step; the character's `paMax`/`paTrackedBy` are derived at submission from the S.P.E.C.I.A.L. values.

Wizard state SHALL be held client-side for the duration of the wizard. No character document SHALL exist until step 5 is submitted; abandoning the wizard SHALL leave no persisted trace.

#### Scenario: Progress bar tracks the current step
- **WHEN** the user is on step 3
- **THEN** the counter reads `3/5 · TAG SKILLS` and the first three progress segments render solid

#### Scenario: The Punti Azione Massimi step is absent
- **WHEN** the user advances through the wizard
- **THEN** no `PUNTI AZIONE MASSIMI` step is presented, and the five steps are `IDENTITÀ`, `S.P.E.C.I.A.L.`, `TAG SKILLS`, `EQUIPAGGIAMENTO`, `RIEPILOGO`

#### Scenario: Back from the first step exits to the dossier
- **WHEN** the user activates `◄ INDIETRO` on step 1
- **THEN** the wizard closes and the dossier is shown, with no character created

#### Scenario: Abandoning the wizard persists nothing
- **GIVEN** the user has completed steps 1 through 4
- **WHEN** they leave the wizard without submitting step 5
- **THEN** no character document exists for them in the campaign

#### Scenario: Forward control is a create action on the final step
- **WHEN** the user reaches step 5
- **THEN** the forward control reads `✓ CREA PERSONAGGIO` rather than `AVANTI ▸`

### Requirement: Step 3 — Tag Skills

Step `TAG SKILLS` SHALL mirror the sheet's skills-section presentation and add-flow. It SHALL present an instruction line, a running `MAESTRIA {cost}/{budget}` readout in the top-right, a section head bearing a `+` add control, and a skills list. Maestria SHALL be rendered as a fixed three-slot squares indicator (`COMPETENTE`=1, `ESPERTO`=2, `MAESTRO`=3), identical by construction to the sheet's skills squares.

When no skill has been added, the list SHALL show a single muted placeholder row `— aggiungi abilità —`. Activating the placeholder row SHALL open the add-popup, exactly as the `+` control does.

The add-popup SHALL be the shared two-tab add-popup: a "Scegli esistente" tab over the skills catalog (`GET /skills-catalog`) **excluding skills already added to the draft**, and an "Aggiungi custom" tab (skill name + initial maestria). Adding SHALL append the chosen skill to the wizard draft and persist nothing; no character document exists until step 5 is submitted.

Each added skill SHALL render as a row showing the skill name, its maestria squares, a `[−] ▪▪▫ [+]` stepper clamped to `COMPETENTE..MAESTRO`, and a `✕` control that removes the skill from the draft.

The **budget** SHALL be read from the selected species' `tagSkillBudget` in the species catalog — not hardcoded — which yields `4` for Umano and `3` for the other seeded species. The budget is **advisory**: `AVANTI ▸` SHALL NOT be disabled by the total maestria cost. When the user activates `AVANTI ▸` while the total maestria cost exceeds the budget, a **non-blocking** confirmation popup `MAESTRIA OLTRE IL BUDGET ({budget})` SHALL be shown, offering `ANNULLA` (stay on the step) and `CONTINUA` (advance anyway). When the total cost is within budget, `AVANTI ▸` SHALL advance directly.

Because the catalog tab excludes skills already added, two rows can never select the same skill; no duplicate-skills warning is shown.

#### Scenario: Empty step shows a placeholder that opens the add-popup
- **WHEN** step 3 first renders with no skills added
- **THEN** a single muted `— aggiungi abilità —` row is shown, and activating it opens the add-popup

#### Scenario: The + control opens the add-popup
- **WHEN** the user activates the `+` add control
- **THEN** the shared add-popup opens with a catalog tab and a custom tab

#### Scenario: The catalog tab excludes already-added skills
- **GIVEN** the skill `Scasso` has already been added to the draft
- **WHEN** the add-popup's catalog tab renders
- **THEN** `Scasso` is not offered in the catalog list

#### Scenario: An added skill renders squares, a stepper, and a remove control
- **WHEN** a skill is added at `ESPERTO`
- **THEN** its row shows two filled maestria squares, a `[−] ▪▪▫ [+]` stepper, and a `✕` remove control

#### Scenario: The budget is advisory and does not block progress
- **GIVEN** a budget of `3`
- **WHEN** the added skills' total maestria cost is `5`
- **THEN** the readout shows `MAESTRIA 5/3` and `AVANTI ▸` remains enabled

#### Scenario: Over-budget forward asks for confirmation
- **GIVEN** the total maestria cost exceeds the budget
- **WHEN** the user activates `AVANTI ▸`
- **THEN** a `MAESTRIA OLTRE IL BUDGET (N)` confirmation popup is shown, and only `CONTINUA` advances to step 4

#### Scenario: Within-budget forward advances directly
- **GIVEN** the total maestria cost is within the budget
- **WHEN** the user activates `AVANTI ▸`
- **THEN** the wizard advances to step 4 with no confirmation popup

### Requirement: Step 4 — Equipaggiamento

Step `EQUIPAGGIAMENTO` SHALL present an instruction line and SHALL source its options from the equipment catalog, requesting only starter templates (`GET /equipment-catalog?starter=true`), and SHALL present:

- a vertical list of selectable **weapon** rows (`kind: weapon`), each showing the template name and a summary of its tags;
- a vertical list of selectable **armor** rows (`kind: armor`), same pattern;
- a free-text `OGGETTO SIGNIFICATIVO` input for the character's keepsake;
- the footnote `Dotazione fissa: Stimpack incluso.`, reflecting the starter `consumable` templates (each instantiated at `quantity: 1`, since templates carry no default quantity).

The step SHALL NOT present initial scraps or any resource control: there is no `ROTTAMI INIZIALI` row and no roll. Starting scraps are always `0`.

The wizard SHALL NOT permit authoring new equipment; templates are authored only in the CMS per `api-equipment-catalog`.

#### Scenario: Starter options come from the catalog
- **WHEN** step 4 renders
- **THEN** the app has requested `GET /equipment-catalog?starter=true` and lists only templates flagged `isStarter`

#### Scenario: Weapon and armor lists are split by kind
- **GIVEN** the starter catalog holds four `weapon` and three `armor` templates
- **WHEN** step 4 renders
- **THEN** four rows appear under the weapon list and three under the armor list

#### Scenario: No initial-scraps control is present
- **WHEN** step 4 renders
- **THEN** no `ROTTAMI INIZIALI` row and no scraps roll control are shown, and the character's starting scraps are `0`

#### Scenario: Equipment cannot be authored from the wizard
- **WHEN** step 4 renders
- **THEN** no control is offered to create, rename, or retag an equipment template

### Requirement: Step 5 — Riepilogo and character creation

Step `RIEPILOGO` SHALL present an instruction line and a read-only summary: the name; a `{species} · PA {paMax} ({source name}) · TAPPI {luck}` line; the seven-stat mini-row reused from the dossier card; the trained-skills list; and an equipment bullet list covering the chosen weapon, armor, the stimpack line, and the keepsake if set. The summary SHALL NOT list initial scraps.

`paMax` and `paTrackedBy` SHALL be **derived** from the S.P.E.C.I.A.L. values, not chosen by the user: `paTrackedBy` is `agility` when `agility >= endurance` and `endurance` otherwise (a tie resolving to `agility`), and `paMax` equals the value of the tracked attribute — i.e. `max(agility, endurance)`. The `{source name}` shown in the summary reflects the derived `paTrackedBy`.

On `✓ CREA PERSONAGGIO` the app SHALL create the character and open its sheet directly. Creation SHALL:

1. `POST /campaigns/:cid/characters { name, species }` — for an admin, including the `userId` of the owner chosen before the wizard began; for a player, omitting it so the character is owned by them.
2. Patch the wizard's values onto the returned character through the existing section endpoints: `PATCH .../special`, `PATCH .../skills`, `PATCH .../action-points` (derived `paMax`, `paCurrent` equal to `paMax`, derived `paTrackedBy`), `PATCH .../resources` (`scraps: 0`; `caps` seeded from the character's `luck`), and `PATCH .../inventory`.
3. Instantiate the selected starter templates onto the character by **copying** them per `api-equipment-catalog` — the weapon into `inventory.weapons`, the armor into `inventory.equip`, and each starter `consumable` into `inventory.consumables` at `quantity: 1` (templates carry no default quantity per `api-equipment-catalog`) — with no catalog slug persisted on the character. The keepsake, when non-blank, is added to `inventory.misc` (the renamed successor of the former `other` collection per `api-character-inventory`); the wizard SHALL NOT write the removed `other` key.
4. `PATCH .../perks` with two derived talents from the selected species-catalog entry: one named `SPECIE · {species name}` carrying its `permesso` copy, and one named `SVANTAGGIO` carrying its `svantaggio` copy.

The character SHALL be created with no conditions and `criticalState: false`.

If any step of the sequence fails after the character document has been created, the app SHALL surface an Italian, terminal-voiced error and open the (partially populated) sheet rather than silently discarding the character or retrying indefinitely.

#### Scenario: PA is derived as the higher of Agilità and Resistenza
- **GIVEN** the user set Agilità to `3` and Resistenza to `2` in the S.P.E.C.I.A.L. step
- **WHEN** the character is created
- **THEN** it has `paTrackedBy: "agility"` and `paMax: 3` (with `paCurrent: 3`)

#### Scenario: A tie resolves to Agilità
- **GIVEN** Agilità and Resistenza are both `2`
- **WHEN** the character is created
- **THEN** it has `paTrackedBy: "agility"` and `paMax: 2`

#### Scenario: Starting scraps are zero
- **WHEN** the character is created
- **THEN** `PATCH .../resources` is sent with `scraps: 0` and `caps` equal to the character's `luck`

#### Scenario: Player creates their own character
- **WHEN** a non-admin player submits step 5
- **THEN** the app POSTs without a `userId`, the character is owned by that player, and its sheet opens

#### Scenario: Admin creates a character for the chosen player
- **GIVEN** an admin picked player `P` as the owner before the wizard began
- **WHEN** the admin submits step 5
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
- **GIVEN** the starter catalog holds a `stimpack` consumable template
- **WHEN** the character is created
- **THEN** its `inventory.consumables` holds a `Stimpack` item with `quantity: 1`

#### Scenario: Keepsake is stored when provided
- **GIVEN** the user entered an `OGGETTO SIGNIFICATIVO`
- **WHEN** the character is created
- **THEN** that item appears in `inventory.misc`

#### Scenario: Partial failure surfaces an error without losing the character
- **GIVEN** the character document was created but a follow-up section PATCH fails
- **WHEN** the failure is observed
- **THEN** an Italian terminal-voiced error is shown and the character's sheet is opened

## ADDED Requirements

### Requirement: Every creation step shows instructions

Each of the five wizard steps SHALL present a visible instruction block, in Italian terminal voice, describing the action required on that step. No step SHALL render without such guidance.

#### Scenario: Every step renders an instruction block
- **WHEN** the user is on any of the five steps
- **THEN** that step renders a visible instruction/hint block describing what to do

#### Scenario: The Identità step is instructed
- **WHEN** the user is on step 1
- **THEN** an instruction block is shown alongside the name input and species picker

## REMOVED Requirements

### Requirement: Step 3 — Punti Azione Massimi

**Reason**: The choice between Agilità and Resistenza as the AP source was superficial — the intended source is the higher of the two. The dedicated step is removed and the wizard shrinks from six steps to five.

**Migration**: `paMax` and `paTrackedBy` are now derived at submission: `paTrackedBy` is `agility` when `agility >= endurance` (tie → `agility`) and `endurance` otherwise, with `paMax = max(agility, endurance)`. See the updated "Step 5 — Riepilogo and character creation" requirement.
