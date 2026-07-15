## 1. API — shared order-by helper and collation

- [x] 1.1 Add `apps/api/api/src/common/utils/order-by.ts` exporting `IT_COLLATION = { locale: 'it', strength: 1 }` and `parseOrderBy(orderBy, allowed)` → returns a Mongo sort spec (e.g. `{ name: 1 }`) for a whitelisted field, or `null` for an absent/empty/unrecognised value (lenient, no throw).
- [x] 1.2 Add `apps/api/api/src/common/utils/order-by.spec.ts` unit-testing the whitelist match, the lenient fallback to `null`, and that only `name` is accepted today.

## 2. API — orderBy on the four existing catalog endpoints

- [x] 2.1 Equipment: add `@Query('orderBy') orderBy?: string` to `equipment-catalog.controller.ts` `list()` and thread it into `findAll`; in `equipment-catalog.service.ts` `findAll`, when `parseOrderBy(orderBy, ['name'])` is non-null chain `.sort(spec).collation(IT_COLLATION)` before `.lean()` (compose with the existing `starter` filter).
- [x] 2.2 Conditions: same `@Query('orderBy')` + `.sort().collation()` wiring in `conditions-catalog.controller.ts` / `conditions-catalog.service.ts`.
- [x] 2.3 Skills: same wiring in `skills-catalog.controller.ts` / `skills-catalog.service.ts`.
- [x] 2.4 Tag: same wiring in `tag-catalog.controller.ts` / `tag-catalog.service.ts`.
- [x] 2.5 Add/extend unit specs (`*.service.spec.ts`) for the four services: `orderBy=name` sorts by name; unknown/absent value returns natural order; a mixed-case + accented fixture (e.g. `àncora`, `Pistola`, `pistola`, `Zaino`) proves the Italian collation folds case and accents.

## 3. API — new talents-catalog module

- [x] 3.1 Create `apps/api/api/src/talents-catalog/` by cloning the skills-catalog module: `schemas/talent-catalog-entry.schema.ts` (`slug`, `name`, `description?`), `dto/talents-catalog-patch.dto.ts`, `talents-catalog.service.ts` (`findAll` with `orderBy` + batched `patchSchema` ops), `talents-catalog.controller.ts` (auth-gated `GET` with `@Query('orderBy')`, admin `PATCH`), and `talents-catalog.module.ts`.
- [x] 3.2 Add `talents-catalog-bootstrap.service.ts` following the once-against-empty convention (seed set may be empty pending content; startup must not fail on an empty catalog). Confirm the seed decision from design's open question before implementing.
- [x] 3.3 Register `TalentsCatalogModule` in `app.module.ts`.
- [x] 3.4 Add unit specs (`talents-catalog.service.spec.ts`, `talents-catalog-bootstrap.service.spec.ts`) mirroring the skills-catalog suites (findAll + orderBy, batched ops incl. 409/ignored/400, bootstrap once-on-empty and empty-start-succeeds).

## 4. API — e2e and coverage gate

- [x] 4.1 Add e2e (`test/*.e2e-spec.ts`, `mongodb-memory-server`) for the five catalogs: `GET /<catalog>?orderBy=name` returns a sorted array; unknown `orderBy` returns 200 in natural order; anonymous GET → 401. For talents: auth-gated GET, admin PATCH add/update/rename/delete (409/ignored), player PATCH → 403, empty GET → `[]`.
- [x] 4.2 From `apps/api/api`, run `npm test` and `npm run test:e2e` and confirm all pass; run `npm run test:cov` and confirm changed files meet ≥ 80% line coverage.

## 5. Pip-Boy — picker second-line hook and defensive sort

- [x] 5.1 In `apps/pip-boy/src/tabs/catalog-picker.js`, add an optional `renderSub(entry)` hook rendering block content on a new line below `.pb-picker-name`; keep name-only rows unchanged when no hooks are supplied; ensure `renderSub` composes independently with `renderMeta`/`rowAccent`.
- [x] 5.2 In `renderList()`, sort the matched catalog entries alphabetically by display name with `localeCompare` (case/accent-insensitive) on a copy (do not mutate the source array); keep any free-text "＋ Usa …" row first, ahead of the sorted matches.
- [x] 5.3 In `apps/pip-boy/src/styles/pipboy.css`, add the picker second-line layout (`.pb-picker-name` + a below-name tag row) and reuse `pb-chip--core`/`pb-chip--extra`; verify the rich-row layout still right-aligns `renderMeta` for the conditions badge.

## 6. Pip-Boy — wire weapon/armor tags and request ordered catalogs

- [x] 6.1 In `apps/pip-boy/src/tabs/add-item-popup.js`, for `kind === 'weapon' | 'armor'` supply a `renderSub` that renders `entry.tags` as unlabeled chips (core = filled/solid, extra = transparent/dashed), core-first then extra; no second line when the entry has no tags.
- [x] 6.2 In `apps/pip-boy/src/api/equipment.js` and `apps/pip-boy/src/api/catalogs.js`, append `orderBy=name` to all catalog fetches (`/equipment-catalog`, incl. `?starter=true&orderBy=name`; `/conditions-catalog`; `/skills-catalog`; `/tag-catalog`; `/talents-catalog`), preserving the talents defensive-degradation-to-`[]`.

## 7. Pip-Boy — e2e gate

- [x] 7.1 Add/extend Playwright tests in `apps/pip-boy/tests` asserting: weapon/armor picker rows show tag chips on a second line with correct core/extra styling and no `CORE`/`EXTRA` text; a no-tag template renders name-only; picker rows are alphabetical; the conditions picker is alphabetical even when `GET /conditions-catalog` fails (fallback presets).
- [x] 7.2 From `apps/pip-boy`, run `npx playwright test` and confirm all pass.
