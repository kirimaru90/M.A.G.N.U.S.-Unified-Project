<!--
  NOTE: These deltas modify requirements introduced by `redefine-character-creation-flow`
  (the five-step wizard, the Tag Skills placeholder, and the per-step instruction
  requirement), which is implemented but not yet archived. This change DEPENDS ON
  `redefine-character-creation-flow` being archived first; validate/apply after it lands.
-->

## MODIFIED Requirements

### Requirement: Step 3 — Tag Skills

Step `TAG SKILLS` SHALL mirror the sheet's skills-section presentation and add-flow. It SHALL present an instruction line, a running `MAESTRIA {cost}/{budget}` readout in the top-right, a section head bearing a `+` add control, and a skills list. Maestria SHALL be rendered as a fixed three-slot squares indicator (`COMPETENTE`=1, `ESPERTO`=2, `MAESTRO`=3), identical by construction to the sheet's skills squares.

When no skill has been added, the list SHALL render **empty** — no placeholder row is shown. The section-head `+` control SHALL be the sole affordance for adding the first skill.

The add-popup SHALL be the shared two-tab add-popup: a "Scegli esistente" tab over the skills catalog (`GET /skills-catalog`) **excluding skills already added to the draft**, and an "Aggiungi custom" tab (skill name + initial maestria). Adding SHALL append the chosen skill to the wizard draft and persist nothing; no character document exists until step 5 is submitted.

Each added skill SHALL render as a row showing the skill name, its maestria squares, a `[−] ▪▪▫ [+]` stepper clamped to `COMPETENTE..MAESTRO`, and a `✕` control that removes the skill from the draft.

The **budget** SHALL be read from the selected species' `tagSkillBudget` in the species catalog — not hardcoded — which yields `4` for Umano and `3` for the other seeded species. The budget is **advisory**: `AVANTI ▸` SHALL NOT be disabled by the total maestria cost. When the user activates `AVANTI ▸` while the total maestria cost exceeds the budget, a **non-blocking** confirmation popup `MAESTRIA OLTRE IL BUDGET ({budget})` SHALL be shown, offering `ANNULLA` (stay on the step) and `CONTINUA` (advance anyway). When the total cost is within budget, `AVANTI ▸` SHALL advance directly.

Because the catalog tab excludes skills already added, two rows can never select the same skill; no duplicate-skills warning is shown.

#### Scenario: Empty step shows no placeholder row
- **WHEN** step 3 first renders with no skills added
- **THEN** the skills list is empty, with no `— aggiungi abilità —` placeholder row

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

### Requirement: Every creation step shows instructions

Each of the five wizard steps SHALL present a visible instruction block, in Italian terminal voice, describing the action required on that step. No step SHALL render without such guidance.

The instruction block SHALL be **prominent**: rendered in a dedicated style with a larger font size and higher contrast than secondary hints/footnotes on the same step, so it reads as the primary guidance for the step rather than fine print. Secondary notes (e.g. the equipment step's fixed-dotazione footnote) SHALL remain in the lesser hint style.

#### Scenario: Every step renders a prominent instruction block
- **WHEN** the user is on any of the five steps
- **THEN** that step renders a visible instruction block in the prominent style, larger and higher-contrast than any secondary hint on the step

#### Scenario: The Identità step is instructed
- **WHEN** the user is on step 1
- **THEN** a prominent instruction block is shown alongside the name input and species picker

#### Scenario: Secondary footnotes stay in the lesser style
- **GIVEN** the equipment step shows both a step instruction and a fixed-dotazione footnote
- **WHEN** the step renders
- **THEN** the instruction uses the prominent style and the footnote uses the lesser hint style
