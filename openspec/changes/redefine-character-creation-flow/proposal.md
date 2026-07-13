## Why

The `apps/pip-boy` character-creation wizard carries steps and controls that no longer earn their place. The "Punti Azione Massimi" step asks the player to pick Agilità vs Resistenza, but the choice is superficial — the higher stat is almost always the intended source, so the step is a click that decides nothing. The Tag Skills step uses a bespoke fixed-row `<select>` + segmented control that looks and behaves nothing like the skills section players already know from normal sheet use. And the initial-scraps `1d6` roll injects resource randomness into creation that the table does not want. This change trims the flow to what matters and makes the skills step consistent with the rest of the app.

## What Changes

- **Remove the `PUNTI AZIONE MASSIMI` step.** The wizard drops from **six steps to five**. `paMax` and `paTrackedBy` are derived automatically at submission: `paMax = max(agility, endurance)` and `paTrackedBy` is whichever of the two is higher, with a tie resolving to `agility`. **BREAKING** to the wizard's step numbering (all step indices, the `N/6` counter, and the six-segment progress bar shift to five).
- **Rework the `TAG SKILLS` step to mirror the normal Abilità section.** Replace the three fixed `<select>` + segmented rows with the sheet's skills presentation: a `+` add control opening the shared add-popup (catalog + custom tabs), `[−] ▪▪▫ [+]` maestria steppers with squares, and `✕` removal. The step starts with one muted `— aggiungi abilità —` placeholder row that opens the add-popup when tapped, exactly like the `+`.
- **Make the maestria budget advisory, not blocking.** Keep the `MAESTRIA n/budget` readout, but `AVANTI ▸` is never disabled by it. Going forward while over budget raises a **non-blocking** `OLTRE IL BUDGET` confirmation popup (`ANNULLA` / `CONTINUA`); `CONTINUA` proceeds.
- **Drop the `ABILITÀ DUPLICATE` guard.** The reused add-popup already hides skills already on the draft, so duplicate selections are structurally impossible and the guard is dead weight.
- **Remove initial-scraps rolling from `EQUIPAGGIAMENTO`.** Delete the `ROTTAMI INIZIALI · 1d6` row and its `TIRA` control. Starting scraps are always `0`; resources do not appear in the wizard. Submission still seeds `caps` from `luck`.
- **Show an instruction line on every creation step.** Each of the five steps gains a consistent instruction/hint block describing what to do on that step (steps 1 and the equipment/summary steps currently have none).

## Capabilities

### New Capabilities
<!-- None: this reshapes an existing wizard capability. -->

### Modified Capabilities
- `pipboy-character-creation`: the wizard shrinks from six to five steps (the Punti Azione Massimi step is removed and its outputs derived); the Tag Skills step is redefined to reuse the normal skills add-flow with an advisory (non-blocking) budget and no duplicate guard; the Equipaggiamento step no longer rolls or shows initial scraps; and every step must present instructions.

## Impact

- **Code**: `apps/pip-boy/src/screens/create.js` (step list, progress/counter, `stepPa`/`bindPa` removal, PA derivation at submit, skills step rewrite reusing `openAddPopup` from `apps/pip-boy/src/tabs/add-popup.js` and the maestria-squares presentation from `apps/pip-boy/src/tabs/skills.js`, over-budget confirm popup, equipment step scraps removal, per-step instructions). The `rollScraps` injected option is removed.
- **Behavior/state**: `draft.skills` changes from three fixed `{slug, level}` rows to a growable list of added skills; `draft.paTrackedBy` is no longer user-set; `draft.scraps` is fixed at `0`.
- **No API changes.** The same section endpoints (`special`, `skills`, `action-points`, `resources`, `inventory`, `perks`) are called; only the client-computed payloads change.
- **Tests**: `apps/pip-boy/tests/character-creation.spec.ts` must be updated — the `N/6` assertions, the PA-step navigation, the fixed-row skills interactions, and the scraps-roll scenario all change.

## Testing

Playwright e2e against the stubbed environment (`apps/pip-boy/tests/character-creation.spec.ts`), loading the wizard and asserting on the live DOM. Behaviors under test:

- **Five-step shell** (e2e): counter reads `N/5`, five progress segments, `PUNTI AZIONE MASSIMI` step is absent, and stepping forward/back traverses the five steps.
- **PA derivation** (e2e): after S.P.E.C.I.A.L. point-buy, submission PATCHes `action-points` with `paMax = max(agility, endurance)`, `paTrackedBy` = the higher stat, and `agility` on a tie.
- **Skills step add-flow** (e2e): the placeholder row and `+` both open the add-popup; adding a catalog skill and a custom skill produces `[−] ▪▪▫ [+]` rows; the popup omits already-added skills; `✕` removes; submission PATCHes `skills` with the added items.
- **Advisory budget** (e2e): the `MAESTRIA n/budget` readout updates and may exceed budget; `AVANTI ▸` stays enabled; over-budget forward raises the `OLTRE IL BUDGET` confirm popup, and `CONTINUA` advances.
- **Equipaggiamento without scraps** (e2e): no `ROTTAMI INIZIALI` row or `TIRA` control is present; submission PATCHes `resources` with `scraps: 0` and `caps` seeded from `luck`.
- **Per-step instructions** (e2e): each of the five steps renders a visible instruction block.
