## 1. API: codex domain

- [x] 1.1 Create `src/codex/schemas/codex-entry.schema.ts`: `CODEX_TYPES` enum, every field from `api-codex`, collection `codex_entries`, indexes `(campaignId, id)` unique, `(campaignId, isDeleted)` and `(campaignId, visibleToCharacterIds)`, and a `toJSON` that drops `_id`/`__v`
- [x] 1.2 Create `src/codex/codex-projection.ts`: pure `isVisibleTo(entry, chid)`, `projectForCharacter(entry, chid)` (null or the player DTO, with no secret, access lists or delete fields, plus `isOwn`) and `canWrite(entry, chid, isAdmin)`
- [x] 1.3 Unit specs `codex-projection.spec.ts`: public, listed and unlisted; made private again; deleted; secret stripped; `isOwn`; `canWrite` matrix (editable/locked × visible/invisible × admin)
- [x] 1.4 Create DTOs `dto/codex-entry.dto.ts` (admin create and update including `visibleToCharacterIds`, `isEditable`, `secretDescription`, `isDeleted`) and `dto/player-codex.dto.ts` (only `type`, `name`, `description`, `imageUrl`, `isPublic`, `mapPlaceSlug`), with `@IsUrl({ protocols: ['http','https'], require_protocol: true })` on `imageUrl`
- [x] 1.5 Create `codex-import.ts`: pure `planCodexImport(existing, incoming, campaignCharacterIds)` with normalized name key, id and name collisions, in-file duplicates, invalid items, filtering of foreign character ids, and `isEditable` defaulting to false
- [x] 1.6 Unit specs `codex-import.spec.ts` covering every skip reason, the deleted-entry collision, accent and whitespace normalization, and id reuse versus re-mint
- [x] 1.7 Create `codex.service.ts`: admin list/get/create/update (restore and soft delete via `isDeleted`)/hard delete/export/import; character list/create/update (204 when no longer visible)/soft delete; `visibleToCharacterIds` validation against non-deleted characters of the campaign; Italian-collated name sort
- [x] 1.8 Unit specs `codex.service.spec.ts`: create defaults (master vs player), 403 vs 404 decisions, restore clearing the delete fields, soft delete stamping `deletedByCharacterId`
- [x] 1.9 Create `codex.controller.ts` (admin: `JwtRequiredGuard`, `CampaignAccessGuard`, `AdminGuard`; `export` and `import` routes declared before `:entryId`) and `character-codex.controller.ts` (`JwtRequiredGuard`, `CampaignAccessGuard`, `CharacterOwnerGuard`), with Swagger decorators
- [x] 1.10 Create `codex.module.ts` and register it in `app.module.ts`
- [x] 1.11 e2e `test/codex.e2e-spec.ts`: admin CRUD, restore, hard delete; cross-campaign 404; player projection scenarios; player create/edit/toggle/403/404/204; soft delete then 404 and still present in the admin list; export and import round trip plus a cross-campaign import dropping foreign ids

## 2. API: map link

- [x] 2.1 Add optional `codexEntryId` to `MapPlace` in `campaign-map.schema.ts` and to the place DTO (`@IsOptional() @IsString() @IsNotEmpty()`)
- [x] 2.2 Unit or DTO spec: a place without `codexEntryId` validates; one with it round-trips through the projection for admins and players
- [x] 2.3 e2e: map PUT and GET with and without `codexEntryId`; a dangling id is accepted
- [x] 2.4 Regenerate `apps/packages/api-spec/openapi.json` with `scripts/generate-openapi.ts`
- [x] 2.5 Run `npm test`, `npm run test:e2e` and `npm run test:cov` from `apps/api/api`; all green, changed files ≥ 80% line coverage

## 3. CMS: codex section

- [x] 3.1 Run `npm run api:gen` in `apps/cms` to refresh `openapi-types.ts`
- [x] 3.2 Create `core/codex/codex.types.ts` and `core/codex/codex-api.service.ts` (list, get, create, update, remove, restore, export, import, plus the character and place lookups)
- [x] 3.3 Spec `codex-api.service.spec.ts`: URLs, methods and bodies, including restore as `PATCH { isDeleted: false }`
- [x] 3.4 Create `features/codex/codex-list.ts`: campaign selector, empty states, table columns per `cms-codex`, text filter, Tipo select, `Mostra eliminate` checkbox (default off), deleted rows dimmed with `Eliminata da … · date`, row actions (edit/delete, or Ripristina/Elimina definitivamente), page-head actions Esporta/Importa/Nuova voce
- [x] 3.5 Spec `codex-list.spec.ts`: deleted rows hidden by default and shown when checked, type filter, Visibilità cell text, delete confirmations, restore call
- [x] 3.6 Create `features/codex/codex-entry-dialog.ts`: fields per spec, image preview with error hide, character multi-select (deleted marked), map-place select with `Luogo non trovato (<slug>)`, required name and type, changed-fields-only PATCH, vertical-only textareas
- [x] 3.7 Spec `codex-entry-dialog.spec.ts`: submit disabled without name, create body, PATCH diff, place link and dangling display, visibility ids
- [x] 3.8 Create `features/codex/import-codex-dialog.ts`: file pick, local JSON-array validation, POST import, summary with Italian reasons; export download as `codex-<campaign>.json`
- [x] 3.9 Spec `import-codex-dialog.spec.ts`: malformed file issues no request, summary rendering
- [x] 3.10 Add the `/codex` route in `app.routes.ts` and the always-enabled `Codex` sidebar entry after `Quest`; extend `sidebar.spec.ts`

## 4. CMS: map codex link

- [x] 4.1 Add the `Voce del codex` select to the place selection card in `campaign-map-page.ts` (loads the campaign codex, marks deleted entries, clear action, `Voce non trovata` for dangling ids)
- [x] 4.2 Make `place-import.ts` keep a non-empty string `codexEntryId` and drop other values; keep `exportPlaces` unchanged (it already serializes the field)
- [x] 4.3 Specs: the place card links and clears `codexEntryId`; a legacy file without the field imports unchanged; the field survives an export and import round trip
- [x] 4.4 Run `npm test` from `apps/cms`; all green with ≥ 70% line coverage

## 5. Pip-Boy: navigation and map

- [x] 5.1 `screens/sheet.js`: INFO subtabs become `Codex · Quest · Note` (Codex first); add `goToMap(slug)` and `goToCodex(entryId)` with one-shot `pendingMapFocus` and `pendingCodexEntry` passed as `focusPlaceSlug` and `openEntryId` in the render context
- [x] 5.2 `tabs/map.js`: apply `focusPlaceSlug` once after places load; fetch the character codex once per mount; add a `CODEX` popup button when `codexEntryId` is in the fetched list, calling `goToCodex`
- [x] 5.3 Update `tests/fixtures.ts` `gotoTab` and every spec that depends on INFO positions or flat order (navigation, quests-tab, notes-tab, swipe)
- [x] 5.4 Playwright: the new flat-order scenarios (`DADI → Codex → Quest → Note → MAPPA`, INFO lands on Codex); the map popup `CODEX` button appears only for a visible linked entry and opens its detail; the focus intent is one-shot

## 6. Pip-Boy: codex subtab

- [x] 6.1 Create `src/api/codex.js`: `getCharacterCodex`, `createCodexEntry`, `updateCodexEntry` (handles a 204 response), `deleteCodexEntry`
- [x] 6.2 Create `src/tabs/codex.js`: lazy fetch with skeleton and error; search, type select and `+ NUOVA VOCE`; grouped categories collapsed by default, empty groups hidden, auto-expanded while searching; `PUBBLICA` marker; empty and no-result messages; detail with contained, capped image and `onerror` removal, header, `Luogo:` line and `MAPPA` (resolved against the map read), description, `MODIFICA`/`ELIMINA` only when editable; `◀` back with preserved state; `openEntryId` intent
- [x] 6.3 Create `src/tabs/codex-editor.js`: quest-editor-style popup with type toggles, name, image URL, description, public toggle, map-place field via `openCatalogPicker`, required checks, dirty-close confirmation, and the unpublish warning for entries that aren't the character's own
- [x] 6.4 Wire `ELIMINA` through `confirm-dialog.js` (`Eliminare questa voce?`)
- [x] 6.5 Add codex styles to `styles/pipboy.css` (rows, group heads, image block with `max-height: 40vh; object-fit: contain`, detail header) in the existing phosphor language
- [x] 6.6 Add `./src/tabs/codex.js`, `./src/tabs/codex-editor.js` and `./src/api/codex.js` to the `sw.js` precache list
- [x] 6.7 Playwright `tests/codex-tab.spec.ts`: hidden empty categories, collapsed by default, expand on tap, search auto-expand, type select, empty state, detail with image size cap and broken-image removal, back preserving state, create, edit, required name, place picker sets the slug, unpublish warning, delete confirmation, no controls on non-editable entries, `MAPPA` jump focuses the place, hidden place shows no map line
- [x] 6.8 Run `npm test` (Playwright) from `apps/pip-boy`; all green

## 7. Wrap-up

- [x] 7.1 Manual pass on a phone-width viewport: image proportions, popup scrolling, swipe across INFO
- [x] 7.2 Re-run the API (unit, e2e, coverage), CMS and Pip-Boy suites; confirm all pass before archiving
