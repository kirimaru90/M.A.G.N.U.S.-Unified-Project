## 1. Shared CMS helpers

- [x] 1.1 Create `apps/cms/src/app/core/catalog/catalog-ops.ts` with `catalogEditOps(original, slug, entry)` → `add` | `update` | `[rename, update(newSlug)]` (design D3)
- [x] 1.2 Add `catalogErrorMessage(err, { slug, action, inUseMessage })` to the same file. 409 names the slug; delete+`inUseMessage` returns the override; 400 → `Dati non validi`; otherwise `Errore imprevisto` (design D4)
- [x] 1.3 Unit spec `catalog-ops.spec.ts` covering every branch of both functions, including the exact rename+update op order
- [x] 1.4 Add `classifyStateSchemaError(err)` in `core/state/` (design D5), with a unit spec: 409 with a valid conflict body → `conflict`; a 409 with an invalid body, a 500, or no status → `error`
- [x] 1.5 Replace `handleSchemaError` internals in `features/campaigns/campaign-global-schema-panel.ts` and `campaign-state-panel.ts` with `classifyStateSchemaError`; the existing panel specs still pass

## 2. Shared dialog footer

- [x] 2.1 Create `apps/cms/src/app/shared/dialog-actions/dialog-actions.ts` (`<app-dialog-actions>`) with the inputs `error`, `saving`, `submitLabel`, `savingLabel`, `cancelLabel`, `disabled` and `submitType`; the outputs `cancel` and `submitted`; and `<ng-content>` for extra buttons (design D6)
- [x] 2.2 Unit spec: renders the error; the submit button is disabled and shows `savingLabel` while saving; `disabled` also disables it; cancel emits; `submitType: 'submit'` submits an enclosing form; `submitType: 'button'` emits `submitted`; projected buttons render before the primary button
- [x] 2.3 Retrofit `features/users/create-user-dialog.ts`, `edit-user-dialog.ts` and `reset-password-dialog.ts`, keeping the labels and error strings identical
- [x] 2.4 Retrofit `features/campaigns/create-campaign-dialog.ts` and `edit-campaign-dialog.ts`
- [x] 2.5 Retrofit `features/terminals/create-terminal-dialog.ts` and `import-terminal-dialog.ts`. The import dialog uses `cancelLabel="Chiudi"`, `submitLabel="Importa"`, `submitType="button"`, `disabled` when the text is empty, and a projected `Controlla JSON` button; the zod error list stays in the body
- [x] 2.6 Run `npm test` in `apps/cms`; all the existing users, campaigns and terminals dialog specs pass unchanged

## 3. Tag catalog (reference implementation)

- [x] 3.1 Create `features/tag-catalog/tag-entry-dialog.ts`: reactive form `{ slug, name }`; `entry: null` means create; reset on open via `ngOnChanges`; save via `catalogEditOps` + `TagCatalogApiService.patchSchema`; errors via `catalogErrorMessage` with the form kept; `<app-dialog-actions>`; emits `saved('created' | 'updated')` / `closed`
- [x] 3.2 Rewrite `tag-catalog-page.ts`: remove `draft`, `editingSlug`, `addRowVisible`, `rowError`, the inline row templates and `errorMessage`; `+ Aggiungi` is always visible; the row edit button opens the dialog with the entry; on `saved`, reload and show a toast; delete is unchanged
- [x] 3.3 Dialog spec `tag-entry-dialog.spec.ts`: create → `add`; edit with the same slug → `update`; slug and name changed → `[rename, update]` with the new name; a 409 keeps the values and shows `Slug "x" già esistente`; cancel issues no request
- [x] 3.4 Rewrite `tag-catalog-page.spec.ts`: no inline inputs in the table; add/edit open the dialog with null or the entry; `saved` triggers a reload; delete still confirms

## 4. Skills, conditions and talents catalogs

- [x] 4.1 `features/skills-catalog/skills-entry-dialog.ts` (`slug`, `name`, `description`), and rewrite `skills-catalog-page.ts` following section 3
- [x] 4.2 Skills dialog spec and rewritten page spec (same coverage as 3.3/3.4)
- [x] 4.3 `features/conditions-catalog/conditions-entry-dialog.ts` (`slug`, `name`, `defaultSeverity` minor/major, `polarity` positive/negative, `description`), and rewrite `conditions-catalog-page.ts`, keeping its polarity/severity filters and default name sort
- [x] 4.4 Conditions dialog spec (including the severity/polarity `update` payloads) and rewritten page spec (the filters still work)
- [x] 4.5 Move the `APPROACHES` constant out of `talent-requirement-dialog.ts` into `features/talents-catalog/special-approaches.ts`, and add `specialRequirementPreview(req)` (design D7) with a unit spec: `[0,2,0,0,0,3,0]` → `P2 A3`; undefined or all zeros → `—`
- [x] 4.6 `features/talents-catalog/talent-entry-dialog.ts`: `slug`, `name`, `description` plus seven `p-inputnumber` steppers (0–5, S P E C I A L order). Create starts at all zeros; edit starts from `specialRequirement` (or zeros). `specialRequirement` is always sent in the `add`/`update` entry
- [x] 4.7 Rewrite `talents-catalog-page.ts`: dialog wiring as in section 3; add the read-only Requisiti preview column; remove the per-row Requisiti button, `requirementDialogVisible`/`requirementEntry` and the requirement save method; keep Importa/Esporta unchanged
- [x] 4.8 Delete `talent-requirement-dialog.ts` and `talent-requirement-dialog.spec.ts`
- [x] 4.9 Talent dialog spec (create with Agility 2 → `add` with `[0,0,0,0,0,2,0]`; edit Endurance 3 → `update`; clear to zeros; rename+update) and rewritten page spec (preview column renders; rows offer only edit and delete; import still works)

## 5. Species catalog

- [x] 5.1 `features/species-catalog/species-entry-dialog.ts`: `slug`, `name`, `permesso`, `svantaggio`, `tagSkillBudget`, `margin`, `description`, with defaults matching today's `emptyDraft` (budget 3, margin 4). Keep the existing positive-integer checks as field errors. In edit mode the slug control is disabled and saving always sends a single `update`
- [x] 5.2 Rewrite `species-catalog-page.ts` with the dialog wiring; the delete error uses `catalogErrorMessage(err, { action: 'delete', inUseMessage: 'Specie in uso da un personaggio' })`
- [x] 5.3 Species dialog spec: the slug is read-only in edit; a name change → `update` only (never `rename`); the margin/budget validations; a 409 on add names the slug
- [x] 5.4 Rewritten species page spec: a 409 on delete shows the in-use message and the entry stays listed

## 6. Equipment catalog

- [x] 6.1 `features/equipment-catalog/equipment-entry-dialog.ts`: `slug`, `name`, `kind` (with `misc` labelled "Vari"), tags as a `FormArray` of `{ name, type }` with `+ core` / `+ extra` / remove (weapon/armor only), `description` (consumable/misc only), `isStarter` checkbox (hidden for `misc`). Switching kind switches the fields; there is no quantity field
- [x] 6.2 Rewrite `equipment-catalog-page.ts`: dialog wiring; the starter column stays a read-only indicator; name/kind/tag/starter filters and the default sort are unchanged; remove `addTag`/`removeTag`/`draftIsTagged` from the page
- [x] 6.3 Equipment dialog spec: add a starter weapon with core+extra tags; add a misc item with a description and no starter editor; a consumable shows the description and no tag editor; promote to starter in edit → `update` with `isStarter: true`; rename+update; a 409 names the slug
- [x] 6.4 Rewritten equipment page spec: the filters are unchanged; the starter indicator is not togglable from the row; add/edit open the dialog

## 7. Pip-Boy species label

- [x] 7.1 Add `speciesLabel(slug, catalog)` to `apps/pip-boy/src/sheet/model.js` (design D8)
- [x] 7.2 In `src/main.js`, pass `speciesCatalog: state.speciesCatalog` to `renderSheet` and `renderCharacterSelect`
- [x] 7.3 `src/screens/sheet.js`: the species chip renders `speciesLabel(character.species, speciesCatalog)`
- [x] 7.4 `src/screens/character-select.js`: the meta line renders `speciesLabel(c.species, speciesCatalog)`
- [x] 7.5 Update `tests/sheet-layout.spec.ts`: the chip reads `Umano`; add a test where the species slug is not in the catalog and the chip shows the slug
- [x] 7.6 Add a dossier Playwright test: the card meta line starts with the catalog name (e.g. `Umano`), and falls back to the slug when there is no catalog match
- [x] 7.7 Run `npm test` in `apps/pip-boy`; the full Playwright suite passes

## 8. Verification

- [x] 8.1 Run `npm test` and `npm run lint` in `apps/cms`; everything is green
  - Done 2026-10-14: 46 test files / 396 tests pass. Lint still reports errors that predate this change, all in files it does not touch (`import-talents-dialog.spec.ts`, terminal editor, sidebar, `terminal-form.spec.ts`, `terminals-api.service.ts`, `campaign-map-page.spec.ts`) plus the existing empty arrow in the talents export test. This change adds no new lint errors.
- [x] 8.2 Grep `apps/cms/src/app/features/*-catalog` for `addRowVisible`, `editingSlug`, `rowError` and `private errorMessage`; there are no matches
- [ ] 8.3 Manual smoke in the running CMS:
  - add/edit/delete on each catalog;
  - change the slug and name together on skills and confirm both persist;
  - species edit shows a read-only slug;
  - the talents preview column updates after a requirement edit
- [ ] 8.4 Manual smoke in the Pip-Boy: rename a species' display name in the CMS, reload the Pip-Boy, and confirm the sheet chip and dossier show the new name
- [x] 8.5 Run `openspec validate cms-catalog-entry-dialogs --strict`; it passes
