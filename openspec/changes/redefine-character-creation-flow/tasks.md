## 1. Wizard shell — five steps

- [x] 1.1 In `apps/pip-boy/src/screens/create.js`, drop `STEP_LABELS` to five entries (`IDENTITÀ`, `S.P.E.C.I.A.L.`, `TAG SKILLS`, `EQUIPAGGIAMENTO`, `RIEPILOGO`) and update the header counter to `N/5` and the progress bar to five segments.
- [x] 1.2 Update `draw()`'s `STEP_BODIES` array, `stepValid()`, `stepWarning()`, and `bind()`'s per-step dispatch to the new step indices (Tag Skills = 3, Equipaggiamento = 4, Riepilogo = 5); the create action fires on step 5.
- [x] 1.3 Remove `stepPa`, `bindPa`, and the `PA_PANELS` constant.

## 2. Derive PA at submit

- [x] 2.1 Remove `paTrackedBy` from the initial `draft` and the `paMax()` helper's dependence on it.
- [x] 2.2 In `submit()`, compute `paTrackedBy = special.agility >= special.endurance ? 'agility' : 'endurance'` and `paMax = special[paTrackedBy]`, and pass them to `patchActionPoints` (`paMax`, `paCurrent: paMax`, `paTrackedBy`).
- [x] 2.3 In `stepSummary()`, derive the `{source name}` label from the computed `paTrackedBy` for the `PA {paMax} ({source})` line.

## 3. Tag Skills step — mirror the sheet skills section

- [x] 3.1 Change `draft.skills` from three fixed `{slug, level}` rows to a growable `[{id, level}]` list initialized empty.
- [x] 3.2 Rewrite `stepSkills()` to render an instruction line, a `MAESTRIA {cost}/{budget}` readout, a section head with a `+` add control, and either a muted `— aggiungi abilità —` placeholder row (when empty) or the added-skill rows using maestria squares (`pips()`) + a `[−] ▪▪▫ [+]` stepper + a `✕` remove — matching `renderAbilitaTab` in `apps/pip-boy/src/tabs/skills.js`.
- [x] 3.3 Rewrite `bindSkills()` to: open `openAddPopup` from both the `+` control and the placeholder row (catalog tab = `skillsCatalog` minus already-added, custom tab = name + maestria toggle), append `{id, level}` to `draft.skills` on add, wire the `−/+` stepper (clamped `COMPETENTE..MAESTRO`) and `✕` remove, then redraw.
- [x] 3.4 Make the budget advisory: `stepValid()` no longer fails on cost; in the step-3 forward handler, when `maestriaCost(draft.skills) > budget()` show a non-blocking `MAESTRIA OLTRE IL BUDGET (n)` confirm popup (`ANNULLA` / `CONTINUA`) and only advance on `CONTINUA`; advance directly when within budget.
- [x] 3.5 Delete the `ABILITÀ DUPLICATE` guard and `hasDuplicates` usage (the add-popup already excludes added skills).
- [x] 3.6 Update the submit `patchSkills` mapping and `stepSummary()`'s skills list to read the new `{id, level}` shape.

## 4. Equipaggiamento step — no scraps

- [x] 4.1 Remove the `ROTTAMI INIZIALI · 1d6 / TIRA` row from `stepEquipment()` and its handler in `bindEquipment()`; remove the injected `rollScraps` option.
- [x] 4.2 Keep `draft.scraps = 0` fixed; in `submit()` send `patchResources({ scraps: 0, caps: special.luck })`.
- [x] 4.3 Remove the `Rottami iniziali · N` line from `stepSummary()`'s equipment list.
- [x] 4.4 Add an instruction line to `stepEquipment()`.

## 5. Per-step instructions

- [x] 5.1 Add a consistent instruction/`.pb-hint` block to every step body that lacks one (`stepIdentita`, `stepEquipment`, `stepSummary`); confirm `stepSpecial` and `stepSkills` retain theirs.

## 6. Tests

- [x] 6.1 Update `apps/pip-boy/tests/character-creation.spec.ts`: change `N/6` counter assertions to `N/5`, remove PA-step navigation, and assert the `PUNTI AZIONE MASSIMI` step is absent.
- [x] 6.2 Add e2e coverage for PA derivation: `paMax = max(agility, endurance)`, `paTrackedBy` = higher stat, tie → `agility`.
- [x] 6.3 Replace the fixed-row skills tests with add-popup-flow coverage: placeholder and `+` open the popup, catalog excludes added skills, added rows show squares/stepper/remove, and submit PATCHes `skills` with the added items.
- [x] 6.4 Add advisory-budget coverage: readout may exceed budget with `AVANTI ▸` enabled; over-budget forward shows the confirm popup and `CONTINUA` advances.
- [x] 6.5 Replace the scraps-roll test with assertions that no `ROTTAMI INIZIALI` row exists and `resources` PATCH sends `scraps: 0` with `caps` = `luck`.
- [x] 6.6 Assert each of the five steps renders an instruction block.

## 7. Verify

- [x] 7.1 Run the pip-boy Playwright suite and confirm it passes.
- [x] 7.2 Run `openspec validate redefine-character-creation-flow --strict` and confirm no errors.
