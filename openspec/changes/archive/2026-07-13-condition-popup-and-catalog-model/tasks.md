## 1. API — remove `defaultQuantity` from the equipment catalog

- [x] 1.1 In `apps/api/api/src/equipment-catalog/schemas/equipment-catalog-entry.schema.ts`, remove
      the `defaultQuantity` prop; keep `description?`.
- [x] 1.2 In `dto/equipment-catalog-patch.dto.ts`, remove `defaultQuantity` from the entry DTO so
      it is no longer accepted (or is stripped) on `add`/`update`.
- [x] 1.3 In `equipment-catalog-bootstrap.service.ts`, drop `defaultQuantity` from all seed
      entries.
- [x] 1.4 In `apps/packages/api-spec/openapi.json`, remove `defaultQuantity` from the equipment
      catalog schema.
- [x] 1.5 Reconcile note: existing stored templates carrying `defaultQuantity` are harmless
      (ignored on read, dropped on next write); no character data migration is required.

## 2. API — tests

- [x] 2.1 Unit/e2e: `GET /equipment-catalog` responses contain no `defaultQuantity`; the seed
      produces entries without it; `description` round-trips for `consumable`/`misc`; an entry DTO
      no longer surfaces `defaultQuantity`.

## 3. pip-boy — instantiate consumable/misc with quantity 1

- [x] 3.1 In `apps/pip-boy/src/tabs/add-item-popup.js`, when instantiating a `consumable`/`misc`
      catalog entry, set `quantity: 1` (remove the `entry.defaultQuantity ?? 1` read); copy
      `description` when present.

## 4. pip-boy — condition add popup

- [x] 4.1 Add a condition add popup (its own module, reusing the full-screen picker sheet from
      `add-tag-catalog-with-mobile-picker` and the add-item popup's two-tab chrome): **Scegli
      esistente** (picker over `GET /conditions-catalog`, route by `polarity`, copy
      `name`/`defaultSeverity`) and **Aggiungi custom** (name + `NEGATIVA`/`POSITIVA` +
      `BASE ×1`/`MODERATA ×2`, one condition on `OK`).
- [x] 4.2 In `apps/pip-boy/src/tabs/health.js`, replace the inline `▸ CONDIZIONI RAPIDE` and
      `▸ CONDIZIONE PERSONALIZZATA` blocks with a `+ AGGIUNGI CONDIZIONE` trigger opening that
      popup. Keep the active-condition list, removal, net-wear readout, criticalState derivation,
      and the `PATCH .../status` commit path unchanged (incl. the catalog-fetch-failure fallback
      presets, now surfaced inside the popup's existing tab).

## 5. pip-boy — tests (Playwright, `apps/pip-boy/tests/`)

- [x] 5.1 `+ AGGIUNGI CONDIZIONE` opens a two-tab popup; the existing tab opens the picker over a
      stubbed conditions catalog; confirming a `negative`-polarity preset issues
      `PATCH .../status` targeting `negativeConditions` with `name`/`severity` from the entry.
- [x] 5.2 The custom tab adds a condition with the chosen sign/weight in one `PATCH .../status`;
      crossing net wear `4` still persists `criticalState: true`.
- [x] 5.3 Instantiating a `misc`/`consumable` template adds `quantity: 1`.

## 6. CMS — equipment description field, sortable tables, condition filters

- [x] 6.1 In `apps/cms/src/app/features/equipment-catalog/equipment-catalog-page.ts`, remove the
      `defaultQuantity` draft field and its column; present a `description` field for
      `consumable`/`misc`; relabel the `Tag / Quantità` column to `Tag / Descrizione`; the `add`/
      `update` op no longer carries `defaultQuantity`.
- [x] 6.2 Make each catalog table (skills, conditions, species, equipment) column-sortable via
      PrimeNG `pSortableColumn`, defaulting to ascending by `name` on load.
- [x] 6.3 Add to the conditions catalog page a **positive/negative/all** filter and a
      **minor/major/all** filter (segmented controls), applied client-side with AND alongside any
      existing filters.

## 7. CMS — tests (`ng test`, `apps/cms`)

- [x] 7.1 Equipment page: `consumable`/`misc` shows a `description` field (not quantity); an `add`
      op carries `description` and no `defaultQuantity`.
- [x] 7.2 Each catalog table sorts by a clicked column and defaults to ascending by name on load.
- [x] 7.3 Conditions page filters by polarity (positive/negative/all) and severity
      (minor/major/all), combined with AND.

## 8. Green suites (gate to archive)

- [x] 8.1 From `apps/api/api`: `npm test` and `npm run test:e2e` pass; changed files meet
      `test:cov ≥ 80%`. (268 unit + 230 e2e green; equipment-catalog service 92%, schema 100%.)
- [~] 8.2 From `apps/cms`: `ng test --no-watch` passes. All 116 specs pass; the command exits
      non-zero only on the **repo-wide global** coverage threshold (70% lines) the codebase already
      sits below (~59.8%) — a pre-existing shortfall, nudged upward by this change, not introduced.
- [x] 8.3 From `apps/pip-boy`: `npx playwright test` passes. (151 specs green.)
