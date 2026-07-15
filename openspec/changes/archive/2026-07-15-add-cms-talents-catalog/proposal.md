## Why

The `api-talents-catalog` backend (global perk catalog of `{ slug, name, description? }`, `GET /talents-catalog` + admin-only batched `PATCH /talents-catalog`) is fully implemented and read by the Pip-Boy, but there is **no way to author it**: the seed is intentionally empty and the only write path is the admin `PATCH`, which no UI drives. The CMS already authors five sibling catalogs (skills, conditions, species, equipment, tags) but is missing talents — so the catalog is permanently empty in practice. This closes that gap.

## What Changes

- Add a CMS admin screen for the talents catalog, mirroring the existing **skills** catalog screen exactly (same `{ slug, name, description? }` shape, same add / inline edit / rename / delete affordances, same single batched `PATCH` write path).
- Add a `TalentsCatalogApiService` (`list()` → `GET /talents-catalog`, `patchSchema(ops)` → `PATCH /talents-catalog`) plus its hand-typed DTO/op types, following `SkillsCatalogApiService`.
- Add an admin-guarded `talents-catalog` route to `app.routes.ts`.
- Add a **Talenti** link to the sidebar's admin-only Catalogo section, with an `isTalentsCatalogActive()` helper.
- No default seed and **no API changes** — the catalog stays empty until authored.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `cms-game-data-catalogs`: add a "CMS authors the talents catalog" requirement (mirroring the skills requirement); extend the "Non-admin cannot reach the catalog screens" requirement and the "Catalogo nav section" scenarios to include talents; include talents in the name-default column-sortable table requirement.

## Impact

- **Code (apps/cms only):**
  - New `apps/cms/src/app/core/talents-catalog/` — `talents-catalog-api.service.ts`, `talents-catalog.types.ts`.
  - New `apps/cms/src/app/features/talents-catalog/` — `talents-catalog-page.ts`.
  - Modified `apps/cms/src/app/app.routes.ts` — new admin-guarded `talents-catalog` route.
  - Modified `apps/cms/src/app/layout/sidebar.ts` — new **Talenti** link + active-state helper.
- **API / backend:** none. `api-talents-catalog` already exposes the required endpoints.
- **Other apps:** none. Pip-Boy already reads `/talents-catalog`.

## Testing

- **cms (Vitest, already wired via `cms-testing`):**
  - `talents-catalog-page.spec.ts` — unit specs on the page component: table loads from a single `GET`, add issues `patchSchema([{ action: 'add', slug, entry }])`, rename issues a single `rename` op, delete issues `[{ action: 'delete', slug }]` after confirm, and 409 surfaces as an inline duplicate-slug error without discarding edits.
  - `talents-catalog-api.service.spec.ts` — the service calls the correct URLs/verbs (`GET` and `PATCH /talents-catalog`).
  - `app.routes.spec.ts` — extend the existing lazy-load / admin-guard assertions to cover `talents-catalog`.
