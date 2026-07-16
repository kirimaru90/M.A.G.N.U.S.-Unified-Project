## Why

A campaign has a geography, and right now nothing in the product knows it. The GM describes where things are in prose; players hold it in their heads. Terminals are authored, catalogued, and state-driven — locations are not modelled at all. Greps for `leaflet`, `map`, or `mappa` across `apps/pip-boy/src`, `apps/api/api/src`, and `openspec/specs` return nothing: this is greenfield.

This adds a per-campaign map: authored in the CMS, read in the Pip-Boy as a tab of its own, sitting between `DADI` and `NOTES`. Places nest to arbitrary depth (a region contains a vault, which contains its rooms), and which tier you see is driven by how far you have zoomed in — a "local map" in the Fallout sense, without a separate mode. Non-public places are filtered **server-side**, so the map is also the GM's authoring surface for secrets rather than a leak waiting to happen.

## What Changes

- **New `api-campaign-map` capability.** One `CampaignMap` document per campaign holding `config` (start position, zoom range, pan bounds) and `places[]`. `GET /campaigns/:id/map` returns the whole map, projected by role; `PUT /campaigns/:id/map` replaces it, admin-only. Non-public places — and their whole subtree — are stripped for non-admins in the service, mirroring how `terminals.service.ts` already filters hidden terminals.
- **New `cms-campaign-map` capability.** A campaign-scoped admin screen that mounts Leaflet: click-to-place, drag-to-move, drag-to-resize the radius, drag-the-handles to reshape the pan bounds. A collapsible Configurazione card and a selection card sit to the right of the map. A tree table lists places with collapsible branches. Import/export of the places tree as JSON, importing additively.
- **New `pipboy-map-tab` capability.** A `MAPPA` tab rendering a CARTO dark tile layer under a fixed Fallout CSS filter, place markers by icon key, a breadcrumb zone indicator, and an 800ms bloom/collapse animation as zones open and close. Leaflet is **vendored** into `src/vendor/`. No attribution watermark: the attribution shows for five seconds on entering the tab and then collapses, with the full text living in the settings popup's Credits view.
- **Modified `pipboy-sheet-navigation`.** The first level goes from five tabs to six; `MAPPA` enters the flattened traversal order between `DADI` and `NOTES`; the swipe requirement gains an exemption so the map pans instead of navigating.
- **Modified `pipboy-pwa-installability`.** The shell precache gains `src/tabs/map.js` and the vendored Leaflet assets; request handling goes from two classes to three, adding a cache-on-visit class for map tiles.
- **Modified `pipboy-settings`.** A `CREDITI` action is added below the popup's four preference rows, opening a credits view that carries the basemap attribution.

## Capabilities

### New Capabilities
- `api-campaign-map`: campaign-scoped map document, role-projected reads, admin-only writes, `isPublic` subtree cascade.
- `cms-campaign-map`: the authoring screen — map-first direct manipulation, place tree, import/export.
- `pipboy-map-tab`: the player-facing tab — tiles, filter, LOD by viewport containment, breadcrumb, animation.

### Modified Capabilities
- `pipboy-sheet-navigation`: six first-level tabs instead of five; `MAPPA` in the flattened order between `DADI` and `NOTES`; swipe navigation exempted over the map surface.
- `pipboy-pwa-installability`: shell precache extended; a third request class for tiles.
- `pipboy-settings`: a `CREDITI` action below the four preference rows, opening a credits view that names the basemap providers and the vendored map library.

## Dependencies

**Satisfied.** `add-pipboy-settings-and-haptics` was archived as `2026-07-16-add-pipboy-settings-and-haptics` while this proposal was being written, so `pipboy-settings` is now a live capability in `openspec/specs/` and `src/engine/settings-popup.js` exists. This change's `pipboy-settings` delta therefore applies against a real baseline, and nothing here is blocked.

Two things it left behind that this change must respect:

- **`pipboy-pwa-installability` is now shared ground.** That change modified the manifest's `orientation` requirement; this one modifies the shell precache, the request classification, and the logout flush. Different requirements, so the deltas do not collide — but this change's `Two-class request handling` delta is written against the **post-archive** baseline and must be re-checked if that spec moves again.
- **The settings popup exists and has a shape.** Its `pipboy-settings` spec requires "exactly four rows", each a pick-one preference control. `CREDITI` is therefore added as an **action below the rows**, not a fifth row — so that requirement stays true and needs no modification.

## Impact

- **API (`apps/api/api`):** new `src/campaign-map/` module — schema, DTOs, service, controller, module — registered in `app.module.ts`. No changes to existing modules.
- **CMS (`apps/cms`):** new `core/campaign-map/` (types + API service) and `features/campaign-map/` (page + selection card + place tree). New campaign-scoped route in `app.routes.ts`. New **Mappa** sidebar entry. **New runtime dependency: `leaflet`** (plus `@types/leaflet`) via npm — normal here, the CMS has a bundler.
- **Pip-Boy (`apps/pip-boy`):** new `src/tabs/map.js`, new `src/api/campaign-map.js`, new `src/vendor/leaflet/` (committed), new map styles in `src/styles/pipboy.css`, one entry in `TAB_TREE` (`src/screens/sheet.js`), a swipe exemption in the same file, and additions to `sw.js` (`REQUIRED_SHELL_URLS` + `classify()`). **First runtime dependency this app has ever had** — see design.md.
- **Third-party:** CARTO basemap tiles (`{s}.basemaps.cartocdn.com`, `dark_nolabels`). New outbound host for the Pip-Boy. Attribution to OpenStreetMap and CARTO is a **licence condition on the tiles**, not a courtesy: it is discharged by a five-second auto-collapsing line on entering the map tab plus a permanent Credits view, both of which are mechanisms named verbatim in the OSM Foundation's Attribution Guidelines. See design.md before changing either.
- **Cross-change:** adds a `CREDITI` action to `src/engine/settings-popup.js`, which `add-pipboy-settings-and-haptics` creates.
- **Existing tests:** `apps/pip-boy/tests/two-level-nav.spec.ts:44-63` asserts the literal tab set `['SALUTE','DADI','NOTES']` and must be extended, or it goes red.
- **No data migration.** A campaign without a map document reads as an empty map.

## Testing

- **api (Jest unit, `src/campaign-map/*.spec.ts`):**
  - `campaign-map.service.spec.ts` — an admin read returns every place; a player read omits `isPublic: false` places **and their descendants**, including a public child under a hidden parent; a player read of a campaign they cannot see 404s; `PUT` rejects a non-admin.
  - Effective-radius unit specs: radius extends recursively over a child's *circle* (`dist + R(child)`), a place with `hasLocalMap: false` contributes `R = 0`, and a cyclic `parent` chain terminates instead of hanging.
- **api (e2e, `test/campaign-map.e2e-spec.ts`, in-memory Mongo):** `GET`/`PUT` round-trip; guard matrix (anonymous / player / admin × visible / invisible campaign); the cascade is verified over HTTP, not just in the service, since that is the security boundary.
- **cms (Vitest, `cms-testing` is archived so the runner is wired):**
  - `campaign-map-api.service.spec.ts` — correct URLs/verbs for `GET`/`PUT /campaigns/:id/map`.
  - `campaign-map-page.spec.ts` — clicking the map appends a place at the clicked coordinates; selecting a place renders the card and edits apply immediately; the `mappa locale` toggle is disabled while a place has children; the parent dropdown excludes the place itself and its descendants.
  - `place-import.spec.ts` — **pure-function specs on the merge**, which is where the risk is: duplicate detection by name+coordinates, incoming slug collisions, entries with no slug, children re-attaching to an existing zone, malformed cycles broken, and a re-import of the same file adding nothing.
  - `app.routes.spec.ts` — extend for the campaign-map route and its guard.
- **pip-boy (Playwright, `apps/pip-boy/tests/`):**
  - Extend `two-level-nav.spec.ts` for the six-tab set and `MAPPA`'s absent subtab row.
  - `map-tab.spec.ts` — the tab renders a Leaflet container; zooming in over a zone reveals its children and the breadcrumb names it; panning off-centre keeps the children rendered and changes only the breadcrumb; a non-admin session never receives non-public places in the network response.
  - `map-attribution.spec.ts` — **the licence obligation is a tested behaviour, not a comment.** Entering the tab shows a line naming OpenStreetMap and CARTO; it is gone after the collapse delay; no Leaflet attribution control is rendered at any point; a pan beneath the visible line reaches the map. Fake timers or an injected delay override keep this off a five-second real wait.
  - `settings-credits.spec.ts` (**depends on `add-pipboy-settings-and-haptics`**) — the popup shows `CREDITI` below the four preference rows; activating it names OpenStreetMap, CARTO, and the vendored map library; activating it persists nothing and changes no preference.
  - The LOD predicates (`isOpen` / `isInside` / effective radius) are pure and SHALL be unit-testable without a DOM; they carry the same assertions as the API-side radius specs so both apps agree on the geometry.
- **Not covered by automated tests:** the CSS filter's appearance, and the animation's perceived timing. Both are judged by eye; the prototypes exist for that and the values they settled are recorded in design.md.
