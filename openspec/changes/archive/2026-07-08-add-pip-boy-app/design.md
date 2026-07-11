## Context

The API already models a complete Fallout character (S.P.E.C.I.A.L., skills, perks, action points, status/conditions, inventory, resources) across `api-characters`/`api-character-stats`/`api-character-inventory`/`api-character-resources`, but nothing in the monorepo reads or writes it — `apps/cms` authors campaigns/terminals only, `apps/terminal` plays node-graph terminals only. A standalone prototype (`reference/cloud design/Field Deck.dc.html`) already demonstrates the intended CRT Pip-Boy visual/interaction language closely enough to the existing API shape to serve as its UX spec, but it runs on a one-off runtime (`support.js`/`DCLogic`) that has no place in this repo's stack and must not be imported as code.

This spans three apps at once (`apps/api`, `apps/cms`, new `apps/pip-boy`) plus deploy config, and introduces a cross-cutting concern (a "last used" pointer shared, but independently written, by two different frontends) — hence a design doc.

## Goals / Non-Goals

**Goals:**
- Give players a real, installable client for the existing character domain.
- Keep the existing character PATCH endpoints and their owner/admin write-permission model completely unchanged.
- Fit the new app into the monorepo's established conventions (zero-build static apps, app-owned code, docker-compose deploy) rather than introducing new tooling.
- Make "last used campaign + character" durable across devices via the server, without entangling it with `apps/terminal`'s existing, independent `lastCampaignId` side effect.

**Non-Goals:**
- No GitHub Pages hosting (decided during exploration — deploy attaches to the existing `docker-compose.yml` instead).
- No server-recorded dice-roll history — the roller is client-side/ephemeral; only its effect on `paCurrent` is persisted, via the existing action-points endpoint.
- No change to `api-characters`/`api-character-stats`/`api-character-inventory`/`api-character-resources` themselves, or to their owner/admin write-permission model.
- No shared code package between `apps/terminal` and `apps/pip-boy` (see Decision 1).
- No per-campaign variance for the new skills/conditions catalogs in v1 — they are global.

## Decisions

**1. `apps/pip-boy` owns its own copy of small client/session modules — no shared package with `apps/terminal`.**
The monorepo already keeps each app's client code independent: `apps/cms` uses a generated typed client (`cms-api-client-codegen`), `apps/terminal` hand-rolls its own `src/api/client.js`/`session.js`. Introducing a shared `packages/*` module would be the first of its kind here and would pull a build-step dependency into apps that are deliberately build-free. `apps/pip-boy` follows the terminal's precedent: its own small hand-rolled `client.js`/`session.js`/`config.js`, calling the same `api-auth` endpoints, but as an independent copy.
*Alternative considered*: extract a shared `packages/client-common`. Rejected — no existing precedent, and it would couple two independently-deployed static apps through a build artifact.

**2. Last-used sync via a new self-service endpoint, not a side effect on character reads.**
`apps/terminal` sets `lastCampaignId` as an implicit side effect of `GET /terminals/:id/load`. Doing the analogous thing for characters (`GET /campaigns/:cid/characters/:id` sets `lastCampaignId`+`lastCharacterId`) would touch the `api-characters` capability, which the proposal explicitly keeps untouched. Instead, `api-users` gains one new self-service endpoint, `PUT /users/me/last-selection { campaignId, characterId }`, mirroring the already-established self-service pattern in `api-configuration` (`PUT /users/me/configuration/terminal`) rather than inventing a third mechanism. `apps/pip-boy` calls it explicitly right after a successful character selection.
*Alternative considered*: implicit side effect on the character detail/load read, matching the terminal's pattern exactly. Rejected to avoid touching `api-characters`.

**3. Server-side self-heal of `lastCharacterId`, mirroring the existing `lastCampaignId` pattern — not client-side re-validation.**
Because `lastCampaignId` is a single shared field written independently by two frontends (the terminal's implicit side effect, pip-boy's explicit call), the two can drift: a user who opens a terminal in campaign B after last using pip-boy in campaign A will have `lastCampaignId == B` while `lastCharacterId` still points at a character in A. `GET /auth/me` already lazily self-heals a stale `lastCampaignId` (clears it if the campaign no longer exists) before responding; the same endpoint extends that self-heal to `lastCharacterId` — clearing it if the referenced character no longer exists, is soft-deleted, or its `campaignId` no longer matches the (possibly just-healed) `lastCampaignId`. `apps/pip-boy` then simply trusts whatever `GET /auth/me` returns: a non-null `lastCharacterId` is always safe to auto-load; `null` means fall back to the picker. This keeps the consistency rule in one place (the API) instead of duplicating it in every client that reads the field.
*Alternative considered*: leave `lastCampaignId`/`lastCharacterId` self-heal exactly as-is and have `apps/pip-boy` re-validate client-side before trusting the hint. Rejected — it would duplicate logic the API already owns for `lastCampaignId`, and a second client (or the terminal, later) would have to reimplement the same check.

**4. Admin-only sections render read-only, not hidden.**
S.P.E.C.I.A.L., skills, perks, PA cap, and bobbleheads stay visible to a player (they need to see their own stats) but non-interactive, using a visually distinct "locked" treatment consistent with the CRT aesthetic. This mirrors the reference prototype's existing pattern of scoping its `✎` editor toggle per-section rather than applying one global edit switch, so no new interaction pattern is introduced — just a narrower default scope per section.

**5. Skills and conditions catalogs are global and admin-authored via the CMS, modeled on the existing batched-op convention.**
Rather than inventing a new catalog CRUD shape, both new endpoints reuse the `{ ops: [{ action, name, entry }] }` batched-operation contract already proven by `cms-global-schema-management`'s campaign global-variable schema. This keeps the CMS authoring UI and the API-client code consistent with a pattern the team has already built, tested, and used once.
*Alternative considered*: per-campaign catalogs. Rejected for v1 — nothing in the reference design or current requirements calls for per-campaign rule variance, and a global catalog is both simpler to author and simpler for `apps/pip-boy` to cache. Adding a per-campaign override later is additive, not breaking.

**6. Dice roller stays purely client-side.**
The roll itself (`d6` pool, success/cost/failure tiers) is UI-only; the only durable effect is a `paCurrent` change, already covered by the existing `PATCH .../action-points` endpoint. No new endpoint, no roll-history storage.

**7. PWA installability and deploy are cloned, not redesigned — but the cache classification collapses from three classes to two.**
`apps/pip-boy`'s manifest + versioned service worker reuse the shape already shipped and spec'd for `apps/terminal` (`emulator-pwa-installability`): cross-origin API support via a `sw.js?api=<origin>` registration query param, never-cache authenticated responses, same offline-fallback/cache-versioning/logout-flush structure. Unlike the terminal, pip-boy has no anonymous/public content at all — every API call (catalogs included) requires a login. So the emulator's "public API content, stale-while-revalidate" class has nothing to classify into it here; pip-boy's service worker only needs two classes, app shell (precached) and authenticated API (always network-only, never cached), which is a straightforward simplification of the existing pattern rather than a new one. Deploy reuses the existing `docker-compose.yml` `frontend` service shape (`nginx:alpine`, volume-mounted static files, its own port) rather than any new hosting mechanism.

## Risks / Trade-offs

- **[Two independent writers to `lastCampaignId`]** (the terminal's implicit side effect vs. pip-boy's explicit self-service call) can leave `lastCharacterId` stale relative to the campaign currently in `lastCampaignId` → Mitigated by Decision 3 (server-side self-heal on `GET /auth/me`, mirroring the existing `lastCampaignId` self-heal) and by the campaign-deletion cascade clearing both fields together when their shared campaign is deleted.
- **[Duplicated client/session code across two static apps]** risks the two drifting apart (a fix landing in one but not the other) → Accepted, consistent with the repo's existing per-app-independence convention; each app's own Playwright suite is the safety net, not shared code.
- **[Global, not per-campaign, catalogs]** may not fit a future campaign running different house rules → Acceptable for v1; adding a per-campaign override later is additive.
- **[Read-only-but-visible admin sections]** could read as a bug ("why won't this save?") if not visually distinct enough → A UI/visual-design concern to resolve during implementation, not an API or architecture risk.

## Migration Plan

Purely additive — no destructive schema changes. Suggested build order:
1. `api-users`: add `lastCharacterId` field + `PUT /users/me/last-selection` endpoint + cascade update.
2. `api-skills-catalog` / `api-conditions-catalog`: new endpoints.
3. `cms-game-data-catalogs`: admin authoring screens (so there's catalog content to read before pip-boy needs it).
4. `apps/pip-boy` app shell (login/campaign-select/character-select) and character sheet screens.
5. `pipboy-pwa-installability` (manifest/service worker).
6. `docker-compose.yml` service addition.

Existing user documents default to `lastCharacterId == null` on read, exactly as `lastCampaignId` already does — no migration script required. Every piece above is independently revertible.

## Open Questions

- Exact port number for the new `docker-compose.yml` service (pick an unused one at implementation time, e.g. `8081`).
- Whether skills/conditions catalogs ever need a per-campaign disable/override — deferred; revisit if a real campaign asks for it.
