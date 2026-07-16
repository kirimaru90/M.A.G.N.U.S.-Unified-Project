# Tasks

Order matters: the API lands first so the CMS has something to author against, and the CMS lands before the Pip-Boy so there is a map to look at. Each app's group is independently shippable.

**Nothing here is blocked.** `add-pipboy-settings-and-haptics` was archived while this change was being written, so `src/engine/settings-popup.js` and the `pipboy-settings` capability both already exist: tasks 8.6 and 9.5 can start immediately.

## 1. API: campaign map module

- [x] 1.1 Create `apps/api/api/src/campaign-map/schemas/campaign-map.schema.ts`: `CampaignMap` with `campaignId` (indexed, unique), `config` (`startLat`, `startLng`, `startZoom`, `minZoom`, `maxZoom`, `bounds{south,west,north,east}`), and `places: MapPlace[]`. `MapPlace` carries `slug`, `name`, `type` (`@Prop({ type: String, enum: PLACE_TYPES })`), `lat`, `lng`, `hasLocalMap`, `radius?`, `isPublic`, `parent?`, `desc?`, `icon?`. Export `PLACE_TYPES` as a `const` tuple, following `EQUIPMENT_KINDS` in `equipment-catalog-entry.schema.ts:6`.
- [x] 1.2 Create `apps/api/api/src/campaign-map/dto/campaign-map.dto.ts`: `MapConfigDto`, `MapPlaceDto`, `PutCampaignMapDto`. Validate the enum, the coordinate ranges, `minZoom <= maxZoom`, and `radius` present only when `hasLocalMap` is true.
- [x] 1.3 Add cross-place validation to the DTO layer (a custom validator, since it spans the array): unique `slug`; every `parent` names a place in the same payload; no `parent` names a place with `hasLocalMap: false`; no cycle in the `parent` chain. Each rejects with HTTP 400.
- [x] 1.4 Create `apps/api/api/src/campaign-map/campaign-map.service.ts`: `get(campaignId, actor)` returning a default empty map when no document exists, and applying the role projection — admin sees all; anyone else gets only places where the place and **every ancestor** is `isPublic`. Follow the shape of `terminals.service.ts:381-415`. Also export the pure `effectiveRadius(places)` helper implementing the recursive rule from `design.md`, cycle-guarded, with `R = 0` for `hasLocalMap: false`.
- [x] 1.5 Add `replace(campaignId, dto)` to the service, upserting the single document per campaign.
- [x] 1.6 Create `apps/api/api/src/campaign-map/campaign-map.controller.ts` with an empty `@Controller()`, following `terminals.controller.ts:33`: `@Get('campaigns/:id/map')` guarded by `JwtOptionalGuard, CampaignAccessGuard` passing `req.user` to the service; `@Put('campaigns/:id/map')` guarded by `JwtOptionalGuard, AdminGuard`.
- [x] 1.7 Create `campaign-map.module.ts` and register it in `apps/api/api/src/app.module.ts` alongside the other feature modules.

## 2. API: tests

- [x] 2.1 Add `apps/api/api/src/campaign-map/campaign-map.service.spec.ts`: admin read returns every place; player read omits non-public places; **player read omits a public child of a non-public parent**; the cascade holds at depth 3; a campaign with no document reads as an empty map.
- [x] 2.2 Add `effective-radius.spec.ts`: radius extends over a child's circle (`dist + R(child)`, not `dist`); a `hasLocalMap: false` child contributes `R = 0`; a cyclic parent chain terminates; a childless place returns its authored radius.
- [x] 2.3 Add `apps/api/api/test/campaign-map.e2e-spec.ts` against the in-memory Mongo: `GET`/`PUT` round-trip; guard matrix (anonymous / player / admin × visible / invisible campaign), asserting 404 rather than 403 for an invisible campaign; **the cascade asserted over HTTP**, since that is the security boundary; `PUT` rejected for a player; each cross-place validation rejects with 400.
- [x] 2.4 Run `npm test` and `npm run test:e2e` from `apps/api/api`; confirm green and that changed files meet >= 80% line coverage via `npm run test:cov`.

## 3. CMS: dependency, core, routing

- [x] 3.1 `npm i leaflet` and `npm i -D @types/leaflet` in `apps/cms`. Import `leaflet/dist/leaflet.css` in the map feature's styles.
- [x] 3.2 Create `apps/cms/src/app/core/campaign-map/campaign-map.types.ts` — `MapConfig`, `MapPlace`, `PlaceType`, `CampaignMapDto`, plus `PLACE_TYPE_OPTIONS` (`{ value, label, defaultIcon }`) following `KIND_OPTIONS` in `equipment-catalog-page.ts:48-56`. Carry a `TODO(openapi-gap)` comment as `talents-catalog.types.ts` does.
- [x] 3.3 Create `apps/cms/src/app/core/campaign-map/campaign-map-api.service.ts`: `get(campaignId)` → `GET /campaigns/:id/map`, `replace(campaignId, map)` → `PUT /campaigns/:id/map`. Components never touch `HttpClient`.
- [x] 3.4 Add an admin-guarded `campaign-map` route to `apps/cms/src/app/app.routes.ts` (`canMatch: [adminGuard]`), sourcing the campaign from the current-campaign service, following the terminals route.
- [x] 3.5 Add a **Mappa** link to the sidebar's `CAMPAGNA` section in `apps/cms/src/app/layout/sidebar.ts` with an `isCampaignMapActive()` computed, mirroring the Terminali entry. Reuse an existing inline SVG glyph.

## 4. CMS: geometry and import — pure functions first

- [x] 4.1 Create `apps/cms/src/app/features/campaign-map/place-tree.ts`: `kids`, `ancestors` (cycle-guarded), `descendants`, `depth`, `cascaded` (public place under a hidden ancestor), `canParent` (`hasLocalMap`), `floorR`, `effectiveRadius` (memoised, cycle-seeded). These mirror the API's rule and must agree with it.
- [x] 4.2 Create `apps/cms/src/app/features/campaign-map/place-import.ts`: `dedupKey` (name trimmed/lowercased/whitespace-collapsed + coordinates at 4dp), `slugify`, and `mergePlaces(existing, incoming)`. **Plan by index, not by incoming slug** — see design.md; a slug-keyed remap silently drops places. Keep a separate first-occurrence-wins slug lookup for parent resolution. Detach parents that resolve to nothing or to a pin; break cycles; skip entries lacking a name or finite coordinates; return `{ added, dup, skipped, reparented }`.
- [x] 4.3 Add `place-tree.spec.ts` and `place-import.spec.ts` **before wiring the UI** — these are where the risk lives and they need no DOM. `place-import.spec.ts` covers, at minimum: re-import of an export adds nothing; a duplicate never overwrites; new children attach to an existing duplicate zone; two incoming places sharing one slug both survive under distinct slugs; entries with no slug do not collide; a malformed cycle is broken; invalid entries are discarded and counted.

## 5. CMS: the authoring screen

- [x] 5.1 Create `apps/cms/src/app/features/campaign-map/campaign-map-page.ts`: the `.bo-page-head` (title, counts, Annulla/Salva), the two-column grid with the map left and the cards right (`align-items: stretch`), and the places card below. Map min-height tracks the tallest the side column has been — measured, not a constant (design.md).
- [x] 5.2 Mount Leaflet on CARTO dark. Add the header's view-local `etichette` and `anteprima filtro Pip-Boy` toggles; neither is persisted. The filter preview uses the exact token from `pipboy-map-tab`.
- [x] 5.3 Configurazione card: start position/zoom fields plus "use current view"; min/max zoom; bounds fields plus "capture current view" **and** draggable corner handles with interior-drag-to-move. Collapsible to a one-line summary; the map does not shrink when it collapses.
- [x] 5.4 Place markers: draggable, distinct treatments for public / hidden / inherited-hidden. **No negative margin on the marker CSS** — `L.divIcon` already anchors at `iconSize/2` and doubling it offsets every marker (design.md). Click-to-place flow with a crosshair mode; bounds-editing and placing are mutually exclusive modes.
- [x] 5.5 Selection card: name, type, parent (excluding self + descendants), coordinates + "sposta", `hasLocalMap` toggle (disabled while it has children) + radius + derived `≈zN`, `isPublic`, description, delete. Edits apply on input; text edits patch the table row rather than re-rendering the card, or the field loses focus per keystroke.
- [x] 5.6 Radius editing on the map: effective-radius circle with a drag handle, plus a distinct floor circle when children impose one; dragging inside the floor clamps.
- [x] 5.7 Places table: depth-first tree with collapse controls and a hidden-count badge on closed branches; visibility pill with the three states; radius column showing `authored → effective` when extended. Collapse hides rows only — markers stay. Filtering flattens the list and hides markers.
- [x] 5.8 Import/export buttons in the `.bo-filter-bar`, wired to `place-import.ts`, reporting the result. Export covers places only.
- [x] 5.9 Delete cascades to descendants behind a confirm naming the count.

## 6. CMS: tests

- [x] 6.1 Add `campaign-map-api.service.spec.ts` asserting the URLs and verbs for `get` and `replace`.
- [x] 6.2 Add `campaign-map-page.spec.ts`: clicking the map appends a place at the clicked coordinates; selecting renders the card; the `hasLocalMap` toggle is disabled while children exist; the parent selector excludes self and descendants; collapsing a branch hides rows but not markers; the visible-to-player count uses the cascade.
- [x] 6.3 Extend `apps/cms/src/app/app.routes.spec.ts` for the campaign-map route and its admin guard.
- [x] 6.4 Run `npm test` from `apps/cms`; confirm green and >= 70% line coverage.

## 7. Pip-Boy: vendoring and the map tab

- [x] 7.1 Vendor Leaflet into `apps/pip-boy/src/vendor/leaflet/` (ESM build + stylesheet), committed. Add a short README noting the pinned version and that upgrades are manual.
- [x] 7.2 Create `apps/pip-boy/src/api/campaign-map.js`: `getCampaignMap(campaignId)` → `apiGet('/campaigns/{id}/map')`, degrading to an empty map on error, following `src/api/catalogs.js`.
- [x] 7.3 Create `apps/pip-boy/src/tabs/map-geometry.js` — the pure predicates: `effectiveRadius` (recursive, cycle-guarded, `R = 0` for pins), `viewportRadius(sizePx, zoom, lat)`, `isOpen`, `isInside`, `visible`, `chain` (smallest-radius tie-break). No DOM, no Leaflet: unit-testable, and it must agree with the API's radius rule.
- [x] 7.4 Create `apps/pip-boy/src/tabs/map.js`: synchronous render + skeleton + own fetch (the `notes.js` pattern). Mount Leaflet from the vendored path, constrained by the config's zoom range and bounds.
- [x] 7.5 Add the icon set (inline SVG literals keyed by name) and marker rendering, resolving `place.icon ?? type default` **at render**. No negative margin on the marker CSS.
- [x] 7.6 Add the zone-indicator breadcrumb: the entered chain, deepest emphasised, truncated from the **left**, root label when nothing is entered.
- [x] 7.7 Add the bloom/collapse animation: diffed marker set (never rebuilt); state computed at `zoomanim` against the destination zoom; offsets projected at that zoom; source/target is the nearest **visible** ancestor; 800 ms; **one shared curve `cubic-bezier(.16,1,.3,1)` in both directions — not mirrored** (design.md explains why, at length). Isolate the `_latLngToNewLayerPoint` call for markers added mid-`zoomanim` and look for a supported alternative.
- [x] 7.8 Add map styles to `apps/pip-boy/src/styles/pipboy.css`: the tile-pane filter token, the `text-shadow: none` reset over the tile pane, marker/popup/control chrome using only existing design tokens, and the zone indicator.
- [x] 7.9 Attribution: construct the map with `attributionControl: false` (which also drops Leaflet's own prefix — its BSD-2 notice stays in the vendored source, where it belongs), and render a phosphor attribution line naming OpenStreetMap and CARTO on entering the tab, auto-collapsing after **five seconds**. `pointer-events: none` so it never intercepts a pan; it does not reappear on pan/zoom within the same visit. **The five seconds are the OSM guideline's own figure and are what makes removing the watermark permissible — read design.md before touching the number.** Expose the delay as an injectable constant so the test does not wait five real seconds.

## 8. Pip-Boy: sheet and shell integration

- [x] 8.1 Add `{ key: 'map', label: 'MAPPA', render: renderMapTab }` to `TAB_TREE` in `apps/pip-boy/src/screens/sheet.js:20-35`, between `dice` and `notes`. `FLAT` derives from the tree, so prev/next and swipe order follow automatically.
- [x] 8.2 Exempt the map container from the swipe handler at `sheet.js:406-423` so horizontal drags pan the map. Keep the exemption expressed as a surface opt-out, not a tab-name special case.
- [x] 8.3 Add `./src/tabs/map.js`, `./src/tabs/map-geometry.js`, `./src/api/campaign-map.js`, and the vendored Leaflet paths to `REQUIRED_SHELL_URLS` in `apps/pip-boy/sw.js:19-51`.
- [x] 8.4 Add the tile class to `classify()` in `apps/pip-boy/sw.js:82-92`: cache-first into a separate tile cache, cache-on-visit, never no-store. No pre-seeding.
- [x] 8.5 Exempt the tile cache from the logout flush.
- [x] 8.6 Add a `CREDITI` action to `apps/pip-boy/src/engine/settings-popup.js` (110 lines, already shipped). Render it **after** the `${ROWS.map(...)}` block inside `.pb-popup-body`, not as a `ROWS` entry — `ROWS` drives pick-one `pb-toggle-row` controls and the `pipboy-settings` spec requires "exactly four rows"; a fifth entry would break both. It opens a credits view naming OpenStreetMap, CARTO, and the vendored map library, reusing the `.pb-popup-overlay` / `.pb-popup` / `.pb-popup-close` treatment the file already uses. It touches no preference and calls nothing in `prefs.js`.

## 9. Pip-Boy: tests

- [x] 9.1 Extend `apps/pip-boy/tests/two-level-nav.spec.ts:44-63` for the six-tab set and `MAPPA`'s absent subtab row — **this test is currently red without this change**.
- [x] 9.2 Add `apps/pip-boy/tests/map-geometry.spec.ts` (unit, no DOM): the radius rule matches the API's specs case-for-case; `isOpen` ignores the centre; `isInside` ignores zoom; `visible` hides an open place's own marker; the breadcrumb never names an unopened tier; overlapping zones resolve to the smaller radius.
- [x] 9.3 Add `apps/pip-boy/tests/map-tab.spec.ts` (Playwright): the tab renders a Leaflet container; zooming into a zone reveals its children and the breadcrumb names it; panning off-centre keeps children rendered and only changes the breadcrumb; a horizontal drag over the map does not change tab; **a player session's `/map` response contains no non-public place**.
- [x] 9.4 Add `apps/pip-boy/tests/map-attribution.spec.ts`: entering the tab shows a line naming OpenStreetMap and CARTO; it is gone once the collapse delay elapses (drive it via the injected constant, not a real wait); **no `.leaflet-control-attribution` is ever rendered**; a pan beneath the visible line reaches the map. This spec is the licence obligation's only guard — it is not noise.
- [x] 9.5 Add `apps/pip-boy/tests/settings-credits.spec.ts`: `CREDITI` renders below the four preference rows; activating it names OpenStreetMap, CARTO, and the vendored map library; activating it changes no preference and persists nothing.
- [x] 9.6 Run `npx playwright test` from `apps/pip-boy`; confirm green.

## 10. Verify

- [ ] 10.1 Drive the real flow end-to-end (see the `verify` skill): as admin, author a nested map in the CMS — place a zone, place a child inside it, set a radius by dragging, hide the zone — save, then open the Pip-Boy as that campaign's player and confirm the zone and its subtree are absent from the network response, not merely unrendered.
- [ ] 10.2 As a player, confirm zooming opens the zone with the bloom animation, the breadcrumb tracks the centre, and a horizontal drag pans rather than changing tab. Check on a touch device if one is available — the swipe collision is the one thing a desktop cannot show.
- [ ] 10.3 Confirm the filter renders as intended against `dark_nolabels` on a real screen. This is the one acceptance criterion no test covers.
- [ ] 10.4 Load the map online, go offline, and reload: tiles come from the tile cache and the tab still renders.
- [ ] 10.5 Confirm the attribution line reads as CRT chrome rather than a legal notice bolted on, and that it is gone by the time you have finished reading it. Then confirm the credits are reachable from the settings popup on the same sheet — the obligation and its discharge must live at the same reachability.
