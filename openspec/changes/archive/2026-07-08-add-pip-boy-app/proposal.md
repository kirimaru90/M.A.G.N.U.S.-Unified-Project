## Why

The API already models a full Fallout character sheet (`api-characters`, `api-character-stats`, `api-character-inventory`, `api-character-resources` — S.P.E.C.I.A.L., skills, perks, action points, status/conditions, inventory, resources), but no client anywhere in the monorepo consumes it: `apps/cms` only authors campaigns/terminals, and `apps/terminal` only plays node-graph terminals. Players currently have no way to view or manage their characters at all. A standalone design prototype (`reference/cloud design/Field Deck.dc.html`) already demonstrates the intended CRT Pip-Boy visual language and game-rule behavior (S.P.E.C.I.A.L., PA stepper, logoramento/conditions, gear, dice roller) closely enough to the existing API shape that it can serve as the UX/visual spec for a real client, without importing its code (it runs on a one-off `support.js`/DCLogic runtime that isn't part of this repo's stack).

## What Changes

- Add a new static, buildless PWA app `apps/pip-boy`, a sibling to `apps/api`/`apps/cms`/`apps/terminal`, following the terminal app's zero-build/plain-ES-modules/relative-path conventions.
- Add a login → campaign-select → character-select flow (character-select is new; `apps/terminal` has no character concept today), defaulting to the last campaign + character used.
- Add character sheet screens covering S.P.E.C.I.A.L./skills/perks (read-only for players — these sections are admin-only at the API), an action-points stepper (`paCurrent` is player-writable), a status/conditions editor, an inventory/gear editor, and a client-side (non-persisted) dice roller that adjusts `paCurrent` via the existing action-points endpoint per the game rules.
- Add PWA installability (manifest + versioned service worker) for `apps/pip-boy`, adapting the already-working `emulator-pwa-installability` pattern (three-class request caching, cross-origin API support via a query-param-supplied origin) to pip-boy's own name/colors/icons.
- Add two new global (not per-campaign) catalogs — skills and conditions — as new API capabilities, admin-authored via new CMS screens, modeled on the existing batched-op convention (`{ ops: [{ action, name, entry }] }`) already used for campaign global-variable schema.
- Extend the user document with a server-synced `lastCharacterId`, alongside the existing `lastCampaignId`, set on character load/select the same way `lastCampaignId` is set on terminal load.
- Add an `nginx:alpine` service for `apps/pip-boy` to the root `docker-compose.yml`, mirroring the existing `frontend` (terminal) service — its own port, volume-mounted static files, no Dockerfile/build stage.

No breaking changes — this is purely additive. Explicit non-goals: no change to the existing character PATCH endpoints' owner/admin write-permission model, no GitHub Pages hosting, no server-recorded dice-roll history.

## Capabilities

### New Capabilities
- `pipboy-app-shell`: The `apps/pip-boy` static PWA shell — session/auth reuse, campaign-select, new character-select screen, and defaulting to the server-synced last-used campaign + character.
- `pipboy-character-sheet`: The character sheet screens themselves — read-only S.P.E.C.I.A.L./skills/perks display, action-points stepper, status/conditions editor, inventory/gear editor, and the client-side dice roller.
- `pipboy-pwa-installability`: Manifest + service worker for `apps/pip-boy`, installable on desktop and Android, adapted from the existing emulator PWA pattern.
- `api-skills-catalog`: New global (cross-campaign) skills catalog with batched add/update/rename/delete operations, admin-only writes, readable by any authenticated caller.
- `api-conditions-catalog`: New global (cross-campaign) conditions catalog with the same batched-op shape, admin-only writes, readable by any authenticated caller.
- `cms-game-data-catalogs`: New CMS admin screens/services for authoring the skills and conditions catalogs.

### Modified Capabilities
- `api-users`: Adds a server-synced `lastCharacterId` field, set alongside `lastCampaignId` whenever a character is loaded/selected, so "last used" state follows the user across devices/installs.
- `api-auth`: Extends the existing `GET /auth/me` session-inspection response to also return `lastCharacterId`, with the same lazy self-heal already applied to `lastCampaignId` (clear it if the referenced character no longer exists or is soft-deleted) so `apps/pip-boy` can bootstrap its last-used default on launch.

## Impact

- New directory `apps/pip-boy` (static HTML/CSS/JS, no build step, no framework).
- `apps/api`: new collections/routes for the skills and conditions catalogs; `api-users` schema/route changes to persist and return `lastCharacterId`; `api-auth`'s `GET /auth/me` extended to surface it.
- `apps/cms`: new admin screens and API-client services for the two catalogs.
- Root `docker-compose.yml`: new `nginx:alpine` service block serving `apps/pip-boy`.
- No changes to `api-characters`/`api-character-stats`/`api-character-inventory`/`api-character-resources` themselves — pip-boy consumes their existing owner-scoped PATCH endpoints as-is.

## Testing

- **api-\***: unit specs (`src/**/*.spec.ts`) for the new catalog services/controllers covering batched-op semantics (add/update/rename/delete) and the admin-only write guard; e2e specs (`test/*.e2e-spec.ts`) against `mongodb-memory-server` covering the full HTTP contract for both catalogs and the `lastCharacterId` write-on-load behavior.
- **cms-\***: component/service Vitest specs for the new catalog admin screens and API-client services (the Vitest runner is already wired per `cms-testing`, so no dependency on an enablement change is needed).
- **pipboy-\***: automated Playwright tests (a new `apps/pip-boy/playwright.config.ts`, mirroring `apps/terminal`'s) loading `index.html` and asserting on the live DOM for: the login → campaign-select → character-select flow and last-used defaulting, read-only rendering of admin-only sections, owner-writable PATCH round-trips (inventory, status, action-points, resources), the dice roller's PA adjustment, and presence of the PWA manifest/service worker.
