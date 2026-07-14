## 1. API — species catalog margin

- [x] 1.1 Add `@Prop({ type: Number, required: true, min: 1 }) margin` to `apps/api/api/src/species-catalog/schemas/species-catalog-entry.schema.ts`.
- [x] 1.2 Add `margin` (positive integer) to the species-catalog add/update DTO and service validation: reject a non-positive `margin` on `add`/`update` with HTTP 400; require `margin` on `add`.
- [x] 1.3 Seed `margin` (default `4`) for every seeded species in `species-catalog-bootstrap.service.ts`.
- [x] 1.4 Include `margin` in the `GET /species-catalog` response shape.

## 2. API — character margin

- [x] 2.1 Add root-level `@Prop({ type: Number, min: 1, default: 4 }) margin` to `apps/api/api/src/characters/schemas/character.schema.ts`.
- [x] 2.2 Add optional `margin` (number ≥ 1) to `patch-status.dto.ts`.
- [x] 2.3 Apply `margin` in the status-merge path of `characters.service.ts` (partial-merge scalar alongside `criticalState`), and include it in the returned `status` section envelope.

## 3. API — tests

- [x] 3.1 Unit: species-catalog service accepts a valid `margin` and rejects `0`/negative (`species-catalog.service.spec.ts`); bootstrap seeds `margin`.
- [x] 3.2 Unit: character status-merge applies `margin` and leaves condition arrays untouched (`characters.service.patch.spec.ts`).
- [x] 3.3 e2e: `GET /species-catalog` returns `margin`; `PATCH /species-catalog` round-trips `margin` and rejects non-positive; `PATCH .../status { margin }` persists and echoes it; a document with no `margin` reads back `4`.
- [x] 3.4 Run `npm test` and `npm run test:e2e` from `apps/api/api`; changed files meet ≥ 80% line coverage via `npm run test:cov`.

## 4. CMS — species editor margin

- [x] 4.1 Add a `margin` column and an editable `margin` field to the species-catalog page (`apps/cms/src/app/features/species-catalog/species-catalog-page.ts`), wired into the batched `PATCH /species-catalog` `update`/`add` op.
- [x] 4.2 Include `margin` in the CMS species-catalog types/api-client mapping.
- [x] 4.3 Unit (Vitest): the page renders the `margin` column and emits an `update` op carrying the edited `margin` (`species-catalog-page.spec.ts`).
- [x] 4.4 Run `npm test` from `apps/cms` and confirm pass at ≥ 70% line coverage.

## 5. pip-boy — health model

- [x] 5.1 In `apps/pip-boy/src/sheet/model.js`, add `health(status, margin) = margin − netWear(status)`; change `isCritical` to `(status, margin) => health(status, margin) <= 0`; remove the exported `CRIT` constant (keep `CONDITION_WEIGHTS`/`netWear`).
- [x] 5.2 Update all `isCritical` callers to pass the character's `margin` (with a `4` fallback when absent).

## 6. pip-boy — SALUTE tab

- [x] 6.1 In `apps/pip-boy/src/tabs/health.js`, replace the `VALORE NETTO` box with a `SALUTE {health}/{margin}` readout plus a horizontal depleting fill bar (bar clamps at full on overshoot; numeric shows the true value, including negatives).
- [x] 6.2 Render the active-condition list as two columns — negatives left, positives right — each ordered major→minor, using the negative/positive accents.
- [x] 6.3 In editor mode, add a `MARGINE` stepper (min `1`) that writes `PATCH .../status { margin }` and re-derives+persists `criticalState` in the same PATCH.
- [x] 6.4 Derive `criticalState` on every condition/margin change as `isCritical(projected, margin)`.

## 7. pip-boy — condition catalog colour-coding

- [x] 7.1 Add an optional `renderMeta(entry)` hook and `rowAccent(entry)` class to `apps/pip-boy/src/tabs/catalog-picker.js`; when omitted, rows render name-only as today.
- [x] 7.2 In `apps/pip-boy/src/tabs/condition-popup.js`, supply `renderMeta` emitting the weight abbreviation (`×1`/`×2`) and `rowAccent` mapping `polarity` to the negative/positive colour (no polarity text).

## 8. pip-boy — creation seeds margin

- [x] 8.1 In `apps/pip-boy/src/screens/create.js` `submit()`, read the selected species' `margin` and persist it via `patchStatus(campaignId, id, { margin })` (falling back to `4` if the species has none).

## 9. pip-boy — styles

- [x] 9.1 In `apps/pip-boy/src/styles/pipboy.css`, add a desaturated negative/red accent token distinct from critical amber; style the SALUTE fill bar and the two-column condition layout; apply negative/positive accents to condition rows and catalog picker rows.

## 10. pip-boy — tests

- [x] 10.1 Unit: `model.js` health/overshoot/critical across margins, including `margin = 4` reproducing legacy behaviour.
- [x] 10.2 e2e (Playwright): SALUTE shows `{health}/{margin}` + bar; a major negative drops health by `2`, a positive raises it; reaching `0` flips the critical banner/chrome; the `MARGINE` stepper PATCHes `margin`; catalog picker rows show colour-only polarity + `×1`/`×2`; the active list renders negatives-left/positives-right, each major→minor.
- [x] 10.3 Run the pip-boy Playwright suite and confirm pass.

## 11. Verify

- [x] 11.1 Run `openspec validate add-health-margin --strict` and confirm no errors.
