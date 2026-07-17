## Why

`add-campaign-map` gives the Pip-Boy a map you can read: tiles, markers, a breadcrumb, and level-of-detail that opens a zone as you zoom into it. What it does not give you is a way to *ask a question of it*. A marker is a silent icon — tapping it does nothing, so a player who spots "Vault 111" on the map cannot find out what it is without asking the GM out loud. And a place you cannot currently see — a room three tiers down, closed inside its zone — is unreachable except by guessing the zoom and pan that would surface it.

Three interactions close that gap, and they turn out to be one primitive wearing three hats:

- **Read a place.** Tap a marker → it centres and a popup shows its description.
- **Enter a place.** If that place has an interior, the popup offers *Vedi mappa* → the view zooms until the interior fills the screen (the place is "open").
- **Jump to a place.** A search field over the map finds any place by name and does exactly what tapping its marker would — even when that marker is not currently on screen, in which case the view first reveals it.

All three were prototyped end-to-end against the real geometry (`map-geometry.js`) in the Pip-Boy's own phosphor styling; the prototype is what settled the "fit the interior" framing and the breadcrumb's last-three-levels shape. This change keeps that visual language exactly — it adds behaviour and one lens button, no new look.

## What Changes

- **Modified `pipboy-map-tab` — the breadcrumb.** The root label becomes **`Terre contaminate`** (it was `MAPPA`), shown only when the centre is inside no open place and never alongside deeper levels. The chain is capped to the **last three open levels**; when it is deeper, a leading **`…`** marks the elision. The underlying rule is unchanged: a level appears only when it is `APERTA` and `DENTRO`, deepest emphasised, tie broken by smallest effective radius.
- **Added `pipboy-map-tab` — marker popups.** Selecting a visible marker centres it and opens a Leaflet popup naming the place and its `desc`, in the existing phosphor popup styling. The popup lives only while its marker is rendered: when the place opens or is panned out of the visible set, the popup closes with it.
- **Added `pipboy-map-tab` — *Vedi mappa*.** The popup carries a *Vedi mappa* action **iff** the place has a local map (`hasLocalMap` and at least one child). Activating it centres the place and zooms to the **least** zoom at which the place is `APERTA` — the framing at which its whole interior just fits the viewport. There is no authored zoom; it is derived from the place's effective radius.
- **Added `pipboy-map-tab` — place focus, the shared primitive.** A single "focus this place" operation centres a place and opens its popup, and — when the place's marker is not currently rendered — first moves the view into the window where it *is* rendered (every ancestor `APERTA`, the place itself not `APERTA`). Both the marker tap and the search selection are expressed through it.
- **Added `pipboy-map-tab` — search.** A lens control in a corner of the map toggles a search field with autocomplete over place **names**, matched case- and accent-insensitively across the whole set the client received. Selecting a result focuses that place. Because the API already strips non-public places server-side, the search index cannot surface a secret the player was never sent.

## Capabilities

### Modified Capabilities
- `pipboy-map-tab`: the breadcrumb gains the `Terre contaminate` root label, a last-three-levels cap, and a leading `…` on elision; the tab gains marker popups, a *Vedi mappa* open action, a place-focus primitive, and name search.

## Dependencies

**On `add-campaign-map`.** This change is a delta on `pipboy-map-tab`, which that change introduces. `add-campaign-map` is in progress (67/76 tasks) but the map tab, its markers, the breadcrumb, and the pure geometry helpers (`isOpen`, `isInside`, `effectiveRadius`, `viewportRadius`) already exist in `apps/pip-boy/src/tabs/map.js` and `map-geometry.js` — which is what this builds on. It should land after `add-campaign-map` archives, or be rebased onto its final `pipboy-map-tab` spec if that spec moves.

No new runtime dependency: Leaflet is already vendored, and Leaflet's own `L.popup` / `bindPopup` and `getBoundsZoom` supply the popup and the fit-to-circle zoom. No API or CMS change — the place model already carries `desc`, `hasLocalMap`, and `radius`.

## Impact

- **Pip-Boy (`apps/pip-boy`):**
  - `src/tabs/map.js` — a `click` handler and bound popup per marker; a `focusPlace(place, { open })` primitive routing both marker taps and search selections through `setView` (reusing the existing `zoomanim` bloom path); the breadcrumb `renderZone` gains the `Terre contaminate` root, the three-level slice, and the `…` lead; a new corner lens/search control mounted alongside the attribution line.
  - `src/tabs/map-geometry.js` — two pure helpers: the contain-zoom for *Vedi mappa* (least zoom with `vr ≤ R(p)`) and the reveal-zoom for focusing a hidden place (the window where its marker renders). Pure and unit-testable without a DOM, matching the existing predicates.
  - `src/styles/pipboy.css` — a lens button, an expanding search field, and its autocomplete list, all on existing tokens; the `.leaflet-popup-*` rules already present are reused and extended with the *Vedi mappa* button and the popup's type line.
- **No cross-app impact.** No API, CMS, service worker, or navigation change. The tab set, precache, and settings popup are untouched.
- **Third-party:** none new. Same CARTO tiles, same vendored Leaflet.
- **No data migration.**

## Testing

- **pip-boy (Playwright, `apps/pip-boy/tests/`):**
  - `map-place-focus.spec.ts` — tapping a marker centres its place and opens a popup naming it and its `desc`; a place with a local map shows *Vedi mappa* and a leaf does not; activating *Vedi mappa* raises the zoom until the place is open and its children render, and the popup closes as its marker leaves the set; panning the centre off a place with an open popup closes the popup.
  - `map-search.spec.ts` — the lens toggles the search field; typing a partial, accent-folded name lists matching places; selecting one that is currently hidden moves the view until its marker renders and opens its popup (same end state as a marker tap); a non-admin session's search never lists a place the network response omitted (the index is the received set); `Escape` closes the field.
  - Extend `map-tab.spec.ts` — the breadcrumb root reads `Terre contaminate` when inside no open place; a chain deeper than three shows exactly the last three with a leading `…`; the root label never appears beside a named level.
  - Driven through the published `globalThis.__PB_MAP__` seam already used by the LOD specs, so zoom lands on exact levels rather than via synthetic wheel events.
- **pip-boy (unit, pure geometry):** the contain-zoom and reveal-zoom helpers get direct assertions in the existing `map-geometry` unit specs — a large zone contains at a lower zoom than a small room; a leaf reveals within its parent's open window; both agree with `isOpen`/`isInside` at the boundary they compute.
- **Not covered by automated tests:** the search field's expand animation and the popup's placement offset — judged by eye against the prototype, whose settled values are recorded in design.md.
