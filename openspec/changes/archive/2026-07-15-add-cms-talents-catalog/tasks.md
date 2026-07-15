# Tasks

## 1. Core: API client + types

- [x] 1.1 Create `apps/cms/src/app/core/talents-catalog/talents-catalog.types.ts` mirroring `skills-catalog.types.ts`: `TalentCatalogEntryDto` (`{ slug; name; description? }`), `TalentCatalogEntryShape` (`{ name; description? }`), `TalentsCatalogOp`, `TalentsCatalogIgnoredOp` (`reason: 'unknown_slug'`), `TalentsCatalogPatchResponse` (`{ ignored }`). Carry over the `TODO(openapi-gap)` comment.
- [x] 1.2 Create `apps/cms/src/app/core/talents-catalog/talents-catalog-api.service.ts` mirroring `SkillsCatalogApiService`: base `${environment.apiBaseUrl}/talents-catalog`, `list()` → `GET`, `patchSchema(ops)` → `PATCH { ops }`.

## 2. Feature: talents catalog page

- [x] 2.1 Create `apps/cms/src/app/features/talents-catalog/talents-catalog-page.ts` by copying `skills-catalog-page.ts`: rename component/selector to `TalentsCatalogPage` / `app-talents-catalog-page`, swap in `TalentsCatalogApiService` and talent types, and translate the Italian strings ("Catalogo talenti", "Talento aggiunto/aggiornato/eliminato", "Nessun talento nel catalogo", `Eliminare il talento "…"?`). Keep the sortable table defaulting to name-ascending, add/edit/rename/delete flow, and inline 409 error handling.

## 3. Routing + navigation

- [x] 3.1 Add an admin-guarded `talents-catalog` route to `apps/cms/src/app/app.routes.ts` (`canMatch: [adminGuard]`) lazy-loading `TalentsCatalogPage`, alongside the other catalog routes.
- [x] 3.2 Add a **Talenti** link to the Catalogo section in `apps/cms/src/app/layout/sidebar.ts` (inside the `@if (isAdmin())` nav), with an `isTalentsCatalogActive()` computed mirroring `isSkillsCatalogActive()`, reusing an existing inline SVG icon.

## 4. Tests

- [x] 4.1 Add `apps/cms/src/app/core/talents-catalog/talents-catalog-api.service.spec.ts` asserting `list()` issues `GET /talents-catalog` and `patchSchema(ops)` issues `PATCH /talents-catalog` with `{ ops }`.
- [x] 4.2 Add `apps/cms/src/app/features/talents-catalog/talents-catalog-page.spec.ts` covering: table loads from a single `GET`; add issues `[{ action: 'add', slug, entry }]` then re-reads; slug change issues a single `rename` op; name/description-only change issues an `update` op; delete-after-confirm issues `[{ action: 'delete', slug }]`; HTTP 409 surfaces as an inline duplicate-slug error without discarding edits.
- [x] 4.3 Extend `apps/cms/src/app/app.routes.spec.ts` to assert the `talents-catalog` route lazily loads and is admin-guarded, matching the existing catalog-route assertions.

## 5. Verify

- [x] 5.1 Run the CMS unit suite (Vitest) — all new and existing specs pass.
- [x] 5.2 Manually (or via the run/verify skill) confirm: as admin, the Talenti sidebar link appears, the screen loads, and add/edit/rename/delete round-trip against `/talents-catalog`; as a non-admin, the Catalogo section and the `talents-catalog` route are inaccessible.
