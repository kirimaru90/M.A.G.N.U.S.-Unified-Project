## Context

`apps/pip-boy/src/screens/create.js` is a self-contained six-step wizard: all state lives in a local `draft`, nothing persists until step 6 submits, and each step has a `stepX()` renderer plus a `bindX()` handler. Step 3 (`PUNTI AZIONE MASSIMI`) lets the player pick Agilità vs Resistenza as the AP source; step 4 (`TAG SKILLS`) uses three fixed `{slug, level}` rows rendered as `<select>` + a four-way segmented control, gated by a client-side maestria budget with `ABILITÀ DUPLICATE` / `OLTRE IL BUDGET` blocking; step 5 (`EQUIPAGGIAMENTO`) rolls `1d6` initial scraps.

The normal sheet skills section (`apps/pip-boy/src/tabs/skills.js`, `renderAbilitaTab`) presents skills very differently: a `+` add control opening the shared `openAddPopup` (`apps/pip-boy/src/tabs/add-popup.js`), maestria rendered as squares via `pips()` (`apps/pip-boy/src/sheet/pips.js`), a `[−] ▪▪▫ [+]` stepper, and `✕` removal. `openAddPopup` is fully generic and **never persists** — it only calls back `onAdd(item)` — so it is reusable inside the wizard against the local `draft`.

This design reconciles the two: the wizard's skills step should reuse the sheet's presentation and add-flow, the superficial PA step is removed, and the scraps roll is dropped.

## Goals / Non-Goals

**Goals:**
- Shrink the wizard to five steps, deriving `paMax`/`paTrackedBy` instead of asking.
- Make the Tag Skills step visually and interactively identical to the sheet skills section, reusing `openAddPopup`, `pips()`, and the stepper/remove idiom rather than duplicating them.
- Turn the maestria budget into an advisory (non-blocking) signal with a confirm-to-continue popup.
- Remove initial-scraps randomness; scraps are always `0`.
- Give every step a consistent instruction block.

**Non-Goals:**
- No API/endpoint changes — the same section PATCH sequence runs at submit; only client-computed payloads change.
- No change to the S.P.E.C.I.A.L. point-buy step, the Identità step, or the Riepilogo layout beyond what removing PA/scraps and adding instructions requires.
- No new "custom maestria budget" authoring; the budget still comes from the species catalog's `tagSkillBudget`.
- No shared extraction of a skills-row component across `sheet.js`/`create.js` in this change — the wizard reuses `openAddPopup` and `pips()`, but its rows stay local to `create.js` to keep the blast radius small.

## Decisions

### 1. Derive PA at submit instead of a dedicated step

Remove `stepPa`, `bindPa`, the `PA_PANELS` constant, and `draft.paTrackedBy` as a user-set field. At submit, compute:

```js
const paTrackedBy = draft.special.agility >= draft.special.endurance ? 'agility' : 'endurance';
const paMax = draft.special[paTrackedBy]; // == max(agility, endurance)
```

Tie resolves to `agility` (Fallout convention ties Action Points to Agility). `STEP_LABELS` drops to five entries; the header counter becomes `N/5`; the progress bar maps over five segments; `stepValid()`/`bind()` dispatch shift their indices (old step 4→3, 5→4, 6→5). The Riepilogo's `PA {paMax} ({source label})` line derives the source label from the computed `paTrackedBy`.

**Alternative considered:** keep the step but pre-select the higher stat. Rejected — the choice is still a no-op click; removing the step is the point.

### 2. Reuse `openAddPopup` against the local draft

The skills step renders a section head (`TAG SKILLS · MAESTRIA` + budget readout + `+`), then either one placeholder row (when empty) or the added-skill rows. Both the `+` and the placeholder row open `openAddPopup` configured exactly like `renderAbilitaTab`'s: a catalog tab over unused skills (`skillsCatalog` minus already-added), and a custom tab (name + maestria toggle). Its `onAdd(item)` pushes `{ id, level }` onto `draft.skills` and redraws — no network call, honoring the wizard's "persist nothing until submit" invariant.

`draft.skills` changes shape: from a fixed 3-element `[{slug, level}]` to a growable `[{id, level}]` list, aligning with the sheet's `{id, level}` model so submit maps them directly (`items: draft.skills.map(r => ({ id: r.id, level: r.level }))`).

**Alternative considered:** extract a shared skills-list module used by both sheet and wizard. Deferred to a future refactor (Non-Goal) — reusing `openAddPopup` + `pips()` already removes the meaningful duplication; a full component extraction widens the diff into `sheet.js` for no behavior gain here.

### 3. Advisory budget with a confirm-to-continue popup

The `MAESTRIA n/budget` readout stays and may exceed budget. `stepValid()` no longer returns false for over-budget (the skills step becomes always-valid). Instead, the step-3 forward handler checks the budget: if `maestriaCost(draft.skills) > budget()`, open a small confirm popup (`OLTRE IL BUDGET (n)` / `ANNULLA` · `CONTINUA`) before advancing; `CONTINUA` advances, `ANNULLA` stays. When within budget, forward advances directly. The duplicate guard is deleted entirely — `openAddPopup`'s catalog tab already filters out added skills, so two rows can never share a skill.

**Alternative considered:** a lightweight inline warning banner that still allows AVANTI. Rejected — the user asked specifically for a confirm-on-continue popup so over-budget is a deliberate, acknowledged choice rather than silently ignored.

### 4. Drop the scraps roll

Delete the `ROTTAMI INIZIALI · 1d6` row, its `TIRA` handler, and the injected `rollScraps` option. `draft.scraps` is initialized to `0` and never mutated by the UI. Submit still calls `patchResources({ scraps: 0, caps: draft.special.luck })` — `caps` seeding is unchanged and was never shown in this step. The Riepilogo's `Rottami iniziali · N` line is removed.

### 5. Per-step instruction block

Each step renderer emits a leading instruction element (reuse the existing `.pb-hint` idiom already present on the point-buy and skills steps). Steps that lacked one (Identità, Equipaggiamento, Riepilogo) gain a short Italian, terminal-voiced instruction describing the step's action.

## Risks / Trade-offs

- **[Existing Playwright suite breaks]** → `apps/pip-boy/tests/character-creation.spec.ts` asserts `N/6`, navigates the PA step, drives the fixed skills rows, and rolls scraps. Mitigation: update the suite as part of this change (it is the change's e2e coverage); the spec deltas define the new expected behavior scenario-by-scenario.
- **[`draft.skills` reshape ripples into submit]** → the submit mapping and the Riepilogo skills list both read the old `{slug, level}` shape. Mitigation: change both call sites together; the field rename from `slug`→`id` is mechanical and localized to `create.js`.
- **[Budget silently exceeded]** → making the budget advisory means characters can be created over budget. Mitigation: this is the intended product behavior (GM-mediated table); the confirm popup ensures it is deliberate, and the readout stays visible on the sheet afterward.
- **[Tie-break surprises]** → deriving `paTrackedBy` hides a decision the player used to make. Mitigation: `paMax` is identical either way on a tie, so only the sheet's source label differs; documented in the spec.

## Migration Plan

Client-only change to a pre-submit wizard; no persisted data migration. Already-created characters are unaffected (their `paTrackedBy`, skills, and scraps are stored). Rollback is reverting `create.js` and the test file. Deploy is the standard pip-boy static build.

## Open Questions

None outstanding — PA tie-break (agility), placeholder-as-add-button, advisory-budget-with-confirm, and duplicate-guard removal were all resolved during exploration.
