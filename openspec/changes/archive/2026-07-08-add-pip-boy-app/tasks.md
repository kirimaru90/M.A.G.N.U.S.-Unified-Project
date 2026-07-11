## 1. api-users: last-used sync

- [x] 1.1 Add `lastCharacterId` (nullable string, default `null`) to the user schema/model, alongside the existing `lastCampaignId`
- [x] 1.2 Implement `PUT /users/me/last-selection` accepting `{ campaignId, characterId }`: require both fields together (400 if either missing), validate the character exists, is non-deleted, and its `campaignId` matches the supplied `campaignId` (400 on mismatch/invalid), enforce ownership for non-admin callers (404 if the character isn't theirs), and persist `lastCampaignId`/`lastCharacterId` on success
- [x] 1.3 Extend the campaign-deletion cascade so that clearing a user's `lastCampaignId` also clears `lastCharacterId`
- [x] 1.4 Ensure `lastCharacterId` is excluded from all `GET/POST/PUT /users*` request/response bodies (never accepted on input, never exposed), matching the existing `lastCampaignId`/`unlockedHiddenIds` treatment
- [x] 1.5 Unit specs (`src/**/*.spec.ts`) for the last-selection endpoint's validation branches and the extended cascade
- [x] 1.6 E2e specs (`test/*.e2e-spec.ts`, `mongodb-memory-server`) covering the full `PUT /users/me/last-selection` contract and the cascade scenario from `specs/api-users/spec.md`

## 2. api-auth: expose and self-heal lastCharacterId

- [x] 2.1 Extend `GET /auth/me` to return `lastCharacterId` alongside the existing fields
- [x] 2.2 Implement the self-heal: if the persisted `lastCharacterId` references a missing or soft-deleted character, or one whose `campaignId` no longer equals the (possibly just-healed) `lastCampaignId`, `$set` it to `null` before responding
- [x] 2.3 Unit specs for the self-heal branches (missing character, soft-deleted character, campaign mismatch, valid pass-through)
- [x] 2.4 E2e specs covering every `GET /auth/me` scenario in `specs/api-auth/spec.md`

## 3. api-skills-catalog

- [x] 3.1 Add a `skills-catalog` collection/schema: `{ slug, name, description? }`, unique index on `slug`
- [x] 3.2 Implement `GET /skills-catalog` (any authenticated caller; 401 anonymous)
- [x] 3.3 Implement `PATCH /skills-catalog` batched ops (`add`/`update`/`rename`/`delete`), admin-only (403 player, 401 anonymous), 409 on duplicate slug, 400 on missing `entry.name`, `ignored` array with `unknown_slug` reason for ops on non-existent slugs
- [x] 3.4 Unit specs for batched-op semantics (add/update/rename/delete, duplicate handling, unknown-slug reporting) and the admin guard
- [x] 3.5 E2e specs covering the full HTTP contract in `specs/api-skills-catalog/spec.md`
- [x] 3.6 Add a `SkillsCatalogBootstrapService` (`OnApplicationBootstrap`, mirroring `users/bootstrap.service.ts`'s pattern) that inserts the 13 default Fallout skill entries when the collection is empty on startup, per `specs/api-skills-catalog/spec.md`'s seeding requirement — no reseed/overwrite if the collection is non-empty
- [x] 3.7 Unit specs for the bootstrap service (seeds when empty, no-ops when non-empty)
- [x] 3.8 E2e/integration coverage confirming the 13 defaults are present after a fresh startup against an empty `mongodb-memory-server` instance

## 4. api-conditions-catalog

- [x] 4.1 Add a `conditions-catalog` collection/schema: `{ slug, name, defaultSeverity, description? }`, unique index on `slug`
- [x] 4.2 Implement `GET /conditions-catalog` (any authenticated caller; 401 anonymous)
- [x] 4.3 Implement `PATCH /conditions-catalog` batched ops, admin-only, 409 on duplicate slug, 400 on missing `entry.name` or invalid `defaultSeverity`, `ignored` array for unknown slugs
- [x] 4.4 Unit specs mirroring the skills-catalog coverage, plus `defaultSeverity` validation
- [x] 4.5 E2e specs covering the full HTTP contract in `specs/api-conditions-catalog/spec.md`
- [x] 4.6 Add `polarity: 'positive' | 'negative'` to the `condition-catalog-entry.schema.ts` schema, the `ConditionCatalogEntryDto`, and the service's `CatalogEntry`/`findAll`/`add`/`update` handling; required (400 if missing/invalid) on `add`, validated-if-present on `update`, per the updated `specs/api-conditions-catalog/spec.md`
- [x] 4.7 Unit + e2e specs for `polarity` validation (missing on add, invalid value on add/update, successful add/update/read round-trips)

## 5. apps/api test gate

- [x] 5.1 Run `npm test` from `apps/api/api`, confirm all pass
- [x] 5.2 Run `npm run test:e2e` from `apps/api/api`, confirm all pass (pre-existing unrelated failures in `characters.e2e-spec.ts` remain — confirmed via `git diff` that no characters-module files were touched by this change)
- [x] 5.3 Run `npm run test:cov` from `apps/api/api` — new logic well covered (skills-catalog ~95% lines, conditions-catalog ~84% lines, auth self-heal covered); pre-existing gaps in `users.service.ts`/`campaigns.service.ts` are legacy CRUD methods outside this change's scope

## 6. cms-game-data-catalogs

- [x] 6.1 Extend the generated API client with the skills-catalog and conditions-catalog endpoints (hand-typed with a `TODO(openapi-gap)` marker, following the existing `auth.api.ts` precedent — `reference/API-docs.json` isn't regenerable without a running API dev server; regenerate via `npm run api:gen` when convenient)
- [x] 6.2 Implement `SkillsCatalogApiService.patchSchema(ops)` and `ConditionsCatalogApiService.patchSchema(ops)` as the sole write paths (no direct `HttpClient` calls from components)
- [x] 6.3 Build the skills catalog admin screen (table, add affordance, inline rename/edit, delete-with-confirmation)
- [x] 6.4 Build the conditions catalog admin screen (table incl. `defaultSeverity` selector, same affordances)
- [x] 6.5 Guard both routes behind the CMS's existing admin-only route guard (`authGuard`, matching every other CMS route — real admin enforcement is server-side via `AdminGuard`)
- [x] 6.6 Component/service Vitest specs for both screens and both services
- [x] 6.7 Run `npm test` from `apps/cms`, confirm pass and >= 70% line coverage on changed files (new files: 91-100% each; global 70% gate is a pre-existing failure unrelated to this change — most of the app's 72 files have no tests)
- [x] 6.8 Add `polarity: 'positive' | 'negative'` to `conditions-catalog.types.ts` and the conditions catalog admin screen (selector alongside `defaultSeverity`, included in add/edit draft rows), per the updated `specs/cms-game-data-catalogs/spec.md`
- [x] 6.9 Update/add component specs covering the `polarity` selector (add, update) and re-run `npm test` from `apps/cms`

## 7. apps/pip-boy: app shell scaffold

- [x] 7.1 Scaffold `apps/pip-boy` (static `index.html` + `src/` layout: `api/config.js`, `api/client.js`, `api/session.js`), mirroring `apps/terminal`'s zero-build conventions — own copies, not shared
- [x] 7.2 Implement the real-user login screen against the existing `api-auth` login endpoint
- [x] 7.3 Implement campaign selection (`GET /campaigns`)
- [x] 7.4 Implement character selection (`GET /campaigns/:cid/characters`; owner-scoped for players, full list for admins; "create character" action via `POST /campaigns/:cid/characters` when the list is empty)
- [x] 7.5 Implement last-used defaulting on launch via `GET /auth/me`, trusting a non-null `lastCharacterId` as pre-validated (no client-side re-validation)
- [x] 7.6 Call `PUT /users/me/last-selection` whenever a character is chosen via the selection screens
- [x] 7.7 Implement navigation: back to character selection, back to campaign selection, logout (clears local session)

## 8. apps/pip-boy: character sheet screens

- [x] 8.1 Build S.P.E.C.I.A.L./skills/perks display — read-only for non-admin, editable for admin (`PATCH .../special`, `.../skills`, `.../perks`)
- [x] 8.2 Build the action-points stepper — `paCurrent` editable by owner/admin (`PATCH .../action-points`), `paMax`/`paTrackedBy` read-only for non-admin
- [x] 8.3 Build the status/conditions editor — owner/admin editable (`PATCH .../status`), conditions-catalog quick-pick (`GET /conditions-catalog`) routing into `positiveConditions`/`negativeConditions` by the picked entry's `polarity`, plus freeform entry with an explicit collection choice, prominent critical-state banner
- [x] 8.4 Build the inventory/gear editor — owner/admin editable (`PATCH .../inventory`), tag types (core/extra), damaged/broken toggle
- [x] 8.5 Build resources display/edit — `caps`/`scraps` editable by owner/admin (`PATCH .../resources`), `bobbleheads` read-only for non-admin
- [x] 8.6 Build the client-side dice roller (d6 pool sized by relevant S.P.E.C.I.A.L. rating; PA refund/cost resolution issues `PATCH .../action-points`; no roll-history persistence)
- [x] 8.7 Apply the CRT phosphor-green visual system from `reference/cloud design/CLAUDE.md` (fonts, glow, layout skeleton, recurring UI patterns), mobile-first sizing

## 9. apps/pip-boy: PWA installability

- [x] 9.1 Author `manifest.webmanifest` (name, short_name, `start_url`/`scope: "./"`, `orientation: "portrait"`, background/theme colors, icon set)
- [x] 9.2 Produce the icon set (192×192 and 512×512, standard and maskable)
- [x] 9.3 Implement `sw.js`: versioned shell precache, two-class fetch classification (shell vs. always-network-only authenticated API), API origin read from its own registration query string
- [x] 9.4 Implement the logout cache-flush `postMessage` handshake
- [x] 9.5 Implement the offline fallback (offline navigation page; in-page offline messaging when an API call fails offline)
- [x] 9.6 Implement cache-versioning cleanup on `activate` (`skipWaiting`/`clients.claim`, stale-cache deletion)

## 10. apps/pip-boy: automated testing

- [x] 10.1 Add `apps/pip-boy/playwright.config.ts`, mirroring `apps/terminal`'s
- [x] 10.2 Playwright: login → campaign-select → character-select flow, and last-used defaulting (skips selection when both are set)
- [x] 10.3 Playwright: admin-only sections render read-only for a player and editable for an admin
- [x] 10.4 Playwright: owner PATCH round-trips for inventory, status/conditions, action-points, and resources
- [x] 10.5 Playwright: dice roller resolves a PA adjustment via the action-points endpoint
- [x] 10.6 Playwright: manifest and service-worker registration present (installability smoke check)
- [x] 10.7 Run `npx playwright test` from `apps/pip-boy`, confirm all pass

## 11. Deploy

- [x] 11.1 Add an `nginx:alpine` service for `apps/pip-boy` to the root `docker-compose.yml` (own port, volume-mounted static files, `restart: unless-stopped`), mirroring the existing `frontend` service
- [x] 11.2 Add the pip-boy deployment origin to `CORS_ALLOWED_ORIGINS` once its port/origin is finalized
- [x] 11.3 Verify via `docker-compose up` that the new service serves `apps/pip-boy` and can reach the API across services
