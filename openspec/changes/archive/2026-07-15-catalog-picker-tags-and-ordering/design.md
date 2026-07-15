## Context

This change spans two apps. In `apps/api/api` (NestJS 11 + Mongoose/MongoDB, Fastify adapter) four catalog endpoints — equipment, conditions, skills, tag — share one shape: `@Get() list() → service.findAll() → entryModel.find(filter).lean()`, with **no ordering** and (except equipment's `?starter`) **no query params**. `talents-catalog` has no backend at all; the client (`apps/pip-boy/src/api/catalogs.js`) calls `GET /talents-catalog`, swallows the failure, and returns `[]`.

In `apps/pip-boy` the vanilla-JS full-screen picker (`tabs/catalog-picker.js`) is the single component every catalog autocomplete flows through. It already supports two optional caller hooks — `renderMeta(entry)` (trailing, right-aligned, same line) and `rowAccent(entry)` — used today only by the conditions picker. The equipment (weapon/armor) path passes neither, so those rows are name-only. Nothing sorts: `renderList()` filters and renders in supplied order.

Established patterns to build on: `@Query('starter')` (reading a lenient query param), `character-notes.service.ts` `.sort({ createdAt: 1 })` (server-side Mongoose ordering), `common/utils/sort-tags.ts` and `defined-only.ts` (shared pure helpers), and the `skills-catalog` module as a complete template (schema `slug/name/description`, GET, admin PATCH, bootstrap seed).

## Goals / Non-Goals

**Goals:**
- Show weapon/armor tags at the moment of choice, on a second line, differentiated by background (core vs extra) without a text label.
- Make every catalog autocomplete list alphabetical, driven by an API-side `orderBy` param, with a client-side safety net for lists the API never sorts.
- Make `talents-catalog` a real, orderable backend so it stops being a faked/empty endpoint.
- Keep every endpoint change backward compatible.

**Non-Goals:**
- No generalized sort framework (multi-field, direction tokens, pagination) — name-ascending only.
- No change to the inventory **row-card** tag chips (they keep their `CORE`/`EXTRA` labels); only the **picker's** second line is new.
- No CMS changes; no authoring of actual talent content (the module ships; content is seeded/authored separately).
- No new persistence, indexes, or migration of existing catalog documents.

## Decisions

### 1. A new below-name hook, not a repurposed `renderMeta`
Add an optional `renderSub(entry)` hook to the picker that renders block content on a new line **under** the name. `renderMeta` is trailing and right-aligned (`.pb-picker-row--rich` is a centered flex row) and is load-bearing for the conditions `×1`/`×2` badge. Reusing it would either force tags onto the same line or require changing the shared rich-row layout and risk the conditions badge. A dedicated slot expresses "new line" directly and leaves `renderMeta`/`rowAccent` untouched. *Alternative rejected:* overload `renderMeta` + make the rich row wrap — couples two unrelated callers.

### 2. Sort at the API via `orderBy`, keep a client-side safety net
Server-side ordering is the source of truth (requested via `orderBy=name`), but the picker **also** sorts its entries with `localeCompare` in `renderList()`. Rationale: some picker lists never touch the API sort — the conditions fallback presets are hardcoded client-side, the talents list may be empty/absent, and a free-typed row is client-only. One defensive sort guarantees the UX invariant ("all lists alphabetical") regardless of source. The double sort is idempotent and cheap on catalog-sized lists. *Alternative rejected:* client-only sort (ignores the explicit "possible by api request" requirement); API-only sort (leaves fallback/absent lists unordered).

### 3. `orderBy` is lenient and name-only, via a shared helper
A `common/utils` helper — `parseOrderBy(orderBy, allowed)` — returns a Mongo sort spec for a whitelisted field or `null` (natural order) for anything unknown or absent; no 400. This mirrors how `?starter` tolerates non-`'true'`. Only `name` is whitelisted today. Centralizing it keeps the four services (plus talents) DRY and gives one unit-tested place for the whitelist/fallback logic. *Alternative rejected:* per-endpoint inline `.sort()` (repetition, five copies of the collation constant); strict 400 on unknown field (more surface, no caller needs it).

### 4. Italian collation for correct alphabetical order
Sorting chains `.sort(spec).collation(IT_COLLATION)` where `IT_COLLATION = { locale: 'it', strength: 1 }` (a shared constant). A plain Mongo `.sort({ name: 1 })` orders by raw byte value — uppercase before lowercase, accented letters after `z` — so "Zaino" would precede "àncora". Collation at strength 1 folds case and accents, matching what the client's `localeCompare` yields, so server and client orderings agree. *Alternative rejected:* fetch-then-`localeCompare` in the service (pulls the whole collection into JS to sort; the DB already does this correctly).

### 5. `talents-catalog` is a structural clone of `skills-catalog`
The talents client consumes `{ name, description }` — identical to skills. So the new module copies skills-catalog's schema (`slug/name/description`), controller (auth-gated GET with `orderBy`, admin PATCH), service (`findAll` + batched ops), bootstrap service, and patch DTO, renamed. Registered in `app.module.ts`. This maximizes reuse and keeps the five catalogs uniform. The client's existing defensive fetch already tolerates the endpoint, so no client change is required beyond appending `orderBy=name`.

### 6. Style A tag chips, reusing existing chip classes
The second line renders each tag as a chip using the existing `pb-chip--core` (tinted fill + solid border) / `pb-chip--extra` (transparent + dashed border) language, **without** the `CORE`/`EXTRA` text label. This matches the app's visual vocabulary (and the "no label" precedent already set by the conditions picker showing polarity by colour only). Tags render core-first then extra, alphabetical within each group — the order the API already persists via `sort-tags`.

## Risks / Trade-offs

- **Conditions picker order changes** (was API/natural order, now alphabetical) → Intended per "all lists alphabetical"; call it out in the spec delta and Playwright assertion so it's a documented behavior change, not a regression.
- **Collation ignores plain `name` indexes** → On catalog-sized collections (tens–low hundreds of entries) a collated in-memory sort is negligible; no index is added. Revisit only if a catalog grows large.
- **Redundant server+client sort** → Harmless and idempotent; the cost is one `localeCompare` pass over an already-short list. Accepted as the price of the safety net.
- **New hook widens the picker API** → Kept optional and presentation-only (never alters the returned entry), consistent with how `renderMeta`/`rowAccent` are already specified; name-only rows are unchanged when the hook is omitted.
- **Talents module without content reads as empty** → The endpoint is real but may seed no entries initially; the client already renders an empty "Scegli esistente" tab without error, so this is a soft launch, not a break.

## Open Questions

- **Talents bootstrap seed contents**: does the bootstrap seed a starter set of talents, or create the collection empty pending CMS authoring? Default assumption: seed empty (parity with the client's current empty-catalog experience); populating is follow-up content work. Confirm during apply if a seed list exists.
