## 1. API — `specialRequirement` field and validation

- [x] 1.1 In `apps/api/api/src/talents-catalog/schemas/talent-catalog-entry.schema.ts`, add `@Prop({ type: [Number], required: false }) specialRequirement?: number[];` to `TalentCatalogEntry`.
- [x] 1.2 In `apps/api/api/src/talents-catalog/dto/talents-catalog-patch.dto.ts`, add `specialRequirement?: number[]` to `TalentCatalogEntryDto` with `@IsOptional() @IsArray() @ArrayMinSize(7) @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(5, { each: true })`.
- [x] 1.3 In `apps/api/api/src/talents-catalog/talents-catalog.service.ts`, confirm `update` merges `specialRequirement` as a wholesale array replacement (last-write-wins on the field, same as `name`/`description`) and that omitting it from an `update`'s `entry` leaves the stored value untouched.
- [x] 1.4 Extend `talents-catalog.service.spec.ts`: `add`/`update` accept a valid 7-element `0..5` array; reject (400, via DTO validation pipeline) wrong length, non-integer, and out-of-range values; `update` omitting `specialRequirement` leaves the existing value unchanged; an entry with no `specialRequirement` ever set is returned without the field.

## 2. API — e2e and coverage gate

- [x] 2.1 Extend `apps/api/api/test/talents-catalog.e2e-spec.ts`: admin `add` with `specialRequirement` round-trips through `GET`; admin `add`/`update` with a malformed `specialRequirement` (wrong length or out-of-range value) returns HTTP 400; `rename` preserves `specialRequirement`.
- [x] 2.2 From `apps/api/api`, run `npm test` and `npm run test:e2e` and confirm all pass; run `npm run test:cov` and confirm changed files meet ≥ 80% line coverage.

## 3. CMS — types and requirement-editor dialog

- [x] 3.1 In `apps/cms/src/app/core/talents-catalog/talents-catalog.types.ts`, add `specialRequirement?: number[]` to `TalentCatalogEntryDto` and `TalentCatalogEntryShape`.
- [x] 3.2 Create a `TalentRequirementDialog` component (e.g. `apps/cms/src/app/features/talents-catalog/talent-requirement-dialog.ts`) presenting seven letter-labelled steppers (`S P E C I A L`, bounded `0`–`5`), pre-filled from the entry's current `specialRequirement` (defaulting every stat to `0` when absent), emitting the resulting 7-element array on save.
- [x] 3.3 Wire a per-row **Requisiti** button into `talents-catalog-page.ts` that opens the dialog for that row and, on save, issues `patchSchema([{ action: 'update', slug, entry: { name, description, specialRequirement } }])` and reloads the table.
- [x] 3.4 Add/extend specs: `talent-requirement-dialog.spec.ts` (steppers bound to 0–5, pre-fill from an existing array, all-zero output when never set) and `talents-catalog-page.spec.ts` (Requisiti button opens the dialog for the right row; saving issues the expected `update` op).

## 4. CMS — import/export

- [x] 4.1 Add an **Esporta** action to `talents-catalog-page.ts` that serializes the loaded `entries()` signal to `JSON.stringify(entries(), null, 2)` and triggers a browser download (blob + anchor `click()`, matching `apps/cms/src/app/features/terminals/export-terminal.ts`'s pattern), issuing no network request.
- [x] 4.2 Add a `zod` schema (e.g. in `apps/cms/src/app/domain/talents-catalog-import-schema.ts`) validating an array of `{ slug: string (non-empty), name: string (non-empty), description?: string, specialRequirement?: number[7], each 0..5 }`.
- [x] 4.3 Create an `ImportTalentsDialog` component (e.g. `apps/cms/src/app/features/talents-catalog/import-talents-dialog.ts`) with paste-text and `.json` file-upload inputs, following `import-terminal-dialog.ts`'s structure (parse → zod-validate → surface errors, or show a pre-import confirmation).
- [x] 4.4 In the import dialog (or a shared helper it calls), diff the validated array against the currently loaded catalog by `slug`: a `slug` absent from the loaded catalog becomes one `add` op (first occurrence wins if the file repeats a `slug`); a `slug` already present in the loaded catalog, or a repeat within the file, is recorded as skipped. Issue a single `patchSchema(addOps)` call, then display a summary of added vs. skipped (with skipped slugs named and their reason).
- [x] 4.5 Wire an **Importa** trigger into `talents-catalog-page.ts` that opens the dialog and reloads the table after a successful import.
- [x] 4.6 Add specs covering: valid file → correct `add`-only ops and summary counts; a slug already in the catalog → skipped, no `update` issued; a slug duplicated within the file → only the first occurrence added; invalid JSON → validation error, no `PATCH`; malformed entry (missing `name`, wrong-length `specialRequirement`) → validation error, no `PATCH`.

## 5. CMS — coverage gate

- [x] 5.1 From `apps/cms`, run `npm test` and confirm all pass, meeting ≥ 70% line coverage on changed files.

## 6. Pip-Boy — catalog-picker hooks

- [x] 6.1 In `apps/pip-boy/src/tabs/catalog-picker.js`, add an optional `rowRank(entry) => number` hook applied as the primary sort key (ascending; entries without an explicit rank sort as `0`) before the existing alphabetical `localeCompare` pass in `renderList()`.
- [x] 6.2 In the same file, add an optional `detail(entry) => string` hook: when supplied, tapping a `[data-pick]` row opens a nested detail popup (rendered above the picker overlay, list left mounted underneath) whose body is `detail(entry)`'s HTML, with fixed chrome — an `✕` (top-right) that closes only the detail popup and returns to the list with its search input/results untouched, and a **Seleziona** button that calls `onPick(entry)` and closes both the detail popup and the picker. When `detail` is omitted, tapping a row keeps today's immediate-pick behavior unchanged.
- [x] 6.3 In `apps/pip-boy/src/styles/pipboy.css`, add styling for the new detail popup (reusing `.pb-popup`/overlay conventions) and a `pb-picker-row--unmet` dim accent class alongside the existing `--pos`/`--neg` row accents.

## 7. Pip-Boy — wire the talents picker

- [x] 7.1 In `apps/pip-boy/src/tabs/skills.js` `renderTalentsTab`, compute per-catalog-entry whether `character.special` meets `entry.specialRequirement` (using the `APPROACHES` order from `sheet/model.js`); pass `rowRank` (`1` when unmet, `0` otherwise) and `rowAccent` (adding `pb-picker-row--unmet` when unmet) into the `openAddPopup`/`openCatalogPicker` call for the talents catalog.
- [x] 7.2 In the same call, pass a `detail(entry)` renderer producing the talent's name, description, and — only for stats with a non-zero requirement — a compact `LETTERA · N` list drawn from `APPROACHES`; an entry with no requirement renders no requirement line.
- [x] 7.3 Confirm `getTalentsCatalog()` in `apps/pip-boy/src/api/catalogs.js` needs no change (it already passes catalog entries through unmodified, so `specialRequirement` flows through as-is).

## 8. Pip-Boy — e2e gate

- [x] 8.1 Extend `apps/pip-boy/tests/skills-talents-add.spec.ts` and/or `apps/pip-boy/tests/catalog-picker.spec.ts`: tapping a talent row opens the detail popup instead of picking immediately; **Seleziona** commits the pick and the subsequent `OK` issues the same `PATCH .../perks` as before; **✕** returns to the list with search text and results preserved and issues no `PATCH`; a talent whose requirement isn't met by the current character's SPECIAL renders dimmed and sorts after satisfied/unconstrained entries, and remains selectable end-to-end via its detail popup.
- [x] 8.2 From `apps/pip-boy`, run `npm test` (Playwright) and confirm all pass.
