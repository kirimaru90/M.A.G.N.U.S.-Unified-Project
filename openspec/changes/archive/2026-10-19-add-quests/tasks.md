## 1. API — model and validation

- [x] 1.1 Create `src/quests/` module (`quests.module.ts`) and register it in `app.module.ts`
- [x] 1.2 Add Mongoose schema `Quest` with embedded `QuestStage` subdocuments (fields, enums `kind` / `status`, timestamps, `toJSON` stripping `_id` / `__v` and exposing `id` on quest and stages)
- [x] 1.3 Add DTOs: `CreateQuestDto` (header + required `stage`), `UpdateQuestDto`, `CreateStageDto`, `UpdateStageDto` with class-validator rules (non-empty stage title, status enum, optional free-text fields)
- [x] 1.4 Implement kind validation in the service: personal ⇒ non-empty unique `characterIds` of non-deleted characters in the same campaign; story ⇒ `characterIds` empty; personal ⇒ `isPublic` false; kind switch validated against the resulting kind (400 on violation)

## 2. API — admin endpoints

- [x] 2.1 `QuestsService` admin methods: list, get, create (with first stage), patch header, delete; campaign-scoped lookups returning 404 for foreign `qid`
- [x] 2.2 Stage methods: append (`$push`), patch any stage, delete last-only (409 for non-last or only stage, 404 for unknown `sid`)
- [x] 2.3 `revealedAt` logic: set on first transition to public (create or patch), never rewritten, untouched on unpublish
- [x] 2.4 Resolve `characters: [{ id, name, deleted }]` on every admin read
- [x] 2.5 `QuestsController` under `/campaigns/:campaignId/quests` with `JwtRequiredGuard`, `CampaignAccessGuard`, `AdminGuard`, Swagger decorators

## 3. API — player projection

- [x] 3.1 Pure function `projectForCharacter(quest, characterId, charactersById)` implementing visibility, public-stage filtering, `current`, derived `updatedAt`, and `involved` (others only, non-deleted, `{ id, name }`)
- [x] 3.2 Player controller `GET /campaigns/:campaignId/characters/:characterId/quests` with `JwtRequiredGuard`, `CampaignAccessGuard`, `CharacterOwnerGuard`; service query `story ∧ isPublic ∨ characterIds ∋ id`, then project
- [x] 3.3 Unit specs: projection (all visibility cases, draft leaves no trace, current from last public stage, milestone lost, involved excludes viewer and deleted), kind validation, `revealedAt`, delete-last-only
- [x] 3.4 E2E `test/quests.e2e-spec.ts`: admin CRUD round-trip, non-admin rejected on admin routes, owner reads correct set, other player 404, unauthenticated 401, appending a hidden stage leaves the player response byte-identical
- [x] 3.5 Regenerate the OpenAPI document and the CMS typed client

## 4. CMS — service and routing

- [x] 4.1 `core/quests/quests.types.ts` (`Quest`, `QuestStage`, `QuestCharacterRef`, status/kind enums with Italian labels) and `QuestsApiService` (quest + stage endpoints, `campaignCharacters(cid)`) with spec
- [x] 4.2 Routes `/quests` and `/quests/:questId`; always-enabled `Quest` sidebar entry

## 5. CMS — pages and dialogs

- [x] 5.1 `features/quests/quests-list.ts`: campaign selector, select-campaign empty state, `p-table` with the nine columns, sorting, loading and empty states, `Nuova quest` action; spec
- [x] 5.2 Create-quest dialog: kind switch toggling Pubblica vs Personaggi multi-select, first-stage fields, submit guards, navigate to detail on success; spec
- [x] 5.3 `features/quests/quest-detail.ts`: title header with delete, Intestazione form (kind / isPublic / characters with deleted markers) saving via PATCH; spec
- [x] 5.4 Stage list (newest first, `Bozza` badge, ★, created / revealed dates, `Modifica`, `Elimina` on last stage only when >1 stage)
- [x] 5.5 Stage dialog: create pre-filled from last stage with public off, edit sends changed fields only, confirmation when unpublishing the last public stage; spec
- [x] 5.6 Confirm dialogs for quest delete and last-stage delete

## 6. Pip-Boy — navigation rearrangement

- [x] 6.1 Re-shape `TAB_TREE` in `screens/sheet.js`: `stats` subtabs `health · special · skills · talents`, remove first-level `health` and `notes`, add `info` with `quests · notes`, order `stats · inv · dice · info · map`
- [x] 6.2 Audit `sheet.js` / `main.js` for branches on `activeTop === 'health' | 'notes'` (banners, resource band, immersive) and adapt to the new positions
- [x] 6.3 Add a `gotoTab(top, sub)` helper to `tests/fixtures.ts`; update existing Playwright specs that click first-level `SALUTE` / `NOTES` or assert six tabs or the old order (`sheet-layout`, `notes-tab`, `health-margin`, `condition-popup`, `mobile-swipe-fullscreen`, etc.)
- [x] 6.4 Playwright: five first-level tabs, sheet opens on `STATS › Salute`, `INFO` subtabs, new flattened order and swipe ends

## 7. Pip-Boy — quest log

- [x] 7.1 `api/quests.js`: `getCharacterQuests(campaignId, characterId)`
- [x] 7.2 `tabs/quests.js` list view: skeleton, status groups with collapsed `COMPLETATE (n)`, row markers (★, STORIA/PERSONALE, CONDIVISA), sorting by `updatedAt`, empty and error states
- [x] 7.3 Detail view: `◀` back preserving group expansion, header with status chip and `★ MILESTONE`, `Condivisa con:` line, current description and `RICOMPENSA`, REGISTRO timeline newest first without ordinals, expandable past entries
- [x] 7.4 Seen-store helper (`pb.quests.seen.<cid>.<charId>`): first-load seeding, unseen detection by stage id, mark-seen on detail open, try/catch around storage
- [x] 7.5 Styles in the existing Pip-Boy CSS language (timeline rail, chips, badge)
- [x] 7.6 Ensure new modules are covered by the service worker precache / cache-busting
- [x] 7.7 Playwright `tests/quests-tab.spec.ts` with mocked API: grouping and collapse, markers, shared names exclude viewer, detail and log expansion, absent reward hidden, `AGGIORNATA` raise / clear / first-load seed / storage failure, empty state

## 8. Wrap-up

- [x] 8.1 Run API unit + e2e, CMS Vitest, Pip-Boy Playwright suites green
- [x] 8.2 `openspec validate add-quests --strict`
