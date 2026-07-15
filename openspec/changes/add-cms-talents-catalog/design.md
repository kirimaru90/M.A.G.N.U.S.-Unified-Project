## Context

`api-talents-catalog` is already implemented, wired into `app.module.ts`, and covered by unit + e2e specs. Its entry shape — `{ slug, name, description? }` — and its batched `PATCH { ops }` contract (`add | update | rename | delete`, `unknown_slug` reported in an `ignored` array, HTTP 409 on duplicate/rename conflict, HTTP 400 on missing `name`) are **byte-for-byte identical** to `api-skills-catalog`. The Pip-Boy already reads `GET /talents-catalog?orderBy=name`. The only gap is the CMS authoring surface.

Because the shape is identical to skills, this is a mechanical mirror of the existing skills-catalog CMS feature — not a new design. The value of this document is to pin the mirror precisely so the implementation is a copy-rename, not a re-derivation.

## Goals / Non-Goals

**Goals**
- CMS admin can add / edit / rename / delete talents through a single batched `PATCH /talents-catalog`.
- The screen is admin-guarded and reachable from the sidebar Catalogo section.
- The feature matches the skills-catalog screen's UX, structure, and test coverage.

**Non-Goals**
- No API changes (endpoints already exist).
- No default seed — the catalog starts and stays empty until authored.
- No extra fields beyond `{ slug, name, description? }` (no ranks, prerequisites, effects). If richer talent modelling is wanted later, that is a separate change on both `api-talents-catalog` and this capability.
- No filter bar or multiselects (skills-style simple sortable table only; talents has no extra facets to filter on).

## Decisions

### Mirror the skills-catalog feature verbatim
The talent entry shape equals the skill entry shape, so we copy the four skills artifacts and rename `Skill(s)` → `Talent(s)` / `abilità` → `talenti` throughout:

| Concern | Skills (reference) | Talents (new) |
|---|---|---|
| Types | `core/skills-catalog/skills-catalog.types.ts` | `core/talents-catalog/talents-catalog.types.ts` |
| API service | `core/skills-catalog/skills-catalog-api.service.ts` | `core/talents-catalog/talents-catalog-api.service.ts` |
| Page | `features/skills-catalog/skills-catalog-page.ts` | `features/talents-catalog/talents-catalog-page.ts` |
| Base URL | `${apiBaseUrl}/skills-catalog` | `${apiBaseUrl}/talents-catalog` |
| Route | `skills-catalog` (adminGuard) | `talents-catalog` (adminGuard) |
| Sidebar | `isSkillsCatalogActive()` / "Abilità" | `isTalentsCatalogActive()` / "Talenti" |

Type names become `TalentCatalogEntryDto`, `TalentCatalogEntryShape`, `TalentsCatalogOp`, `TalentsCatalogIgnoredOp`, `TalentsCatalogPatchResponse`. The page's user-facing Italian strings become "Catalogo talenti", "Talento aggiunto/aggiornato/eliminato", "Nessun talento nel catalogo", `Eliminare il talento "…"?`.

The hand-typed-DTO `TODO(openapi-gap)` comment carries over: `/talents-catalog` likewise has no generated OpenAPI schema yet, so the types are hand-authored to match the spec and flagged for later regeneration.

### Route placement and guarding
Insert the `talents-catalog` route alongside the other catalog routes in `app.routes.ts`, `canMatch: [adminGuard]`, lazy-loading `TalentsCatalogPage`. Placement within the catalog block is cosmetic; put it after `skills-catalog` (its twin) or at the end of the block — either is fine.

### Sidebar entry
Add a **Talenti** link inside the existing `@if (isAdmin())` Catalogo `<nav>`, with an `isTalentsCatalogActive()` computed mirroring `isSkillsCatalogActive()`. Reuse an existing inline SVG icon (e.g. the star/award glyph) — no new asset needed.

## Risks / Trade-offs

- **Copy drift** — hand-copying risks a stale string (e.g. leftover "abilità"). Mitigated by the page/service unit specs asserting the exact URL and op payloads, and by a quick visual pass.
- **Duplication vs. abstraction** — this is the sixth near-identical catalog screen. Extracting a shared generic catalog component is tempting but out of scope: the sibling screens (species, equipment) have diverged with extra fields/filters, so a premature abstraction would fight those. Mirroring keeps this change small and low-risk; a later refactor can consolidate skills+talents+tags if desired.

## Migration Plan

None. Additive CMS-only change. Deploying the CMS makes the screen available immediately; the catalog is empty until an admin authors entries. No data migration, no API/version coupling.

## Open Questions

- Icon choice for the sidebar Talenti link — any distinct glyph is acceptable; not blocking.
