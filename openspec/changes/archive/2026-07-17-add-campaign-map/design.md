## Context

Greenfield: no map, no geography, no Leaflet anywhere in the monorepo. The design below was settled against two throwaway HTML prototypes (a Pip-Boy map tab and a CMS authoring page) built from the real design tokens and driven by the real geometry. Several decisions here look arbitrary and are not — they were forced by simulation. Those are flagged, because an implementer or reviewer who does not know *why* will reasonably "fix" them back.

Three facts about the codebase shape everything:

1. **`apps/pip-boy` has no bundler, no framework, no dependencies.** It ships static files to nginx; its only devDep is Playwright. `src/sheet/markdown.js:1-7` explicitly notes it was hand-rolled "without bundling a markdown library." Leaflet is the first runtime dependency this app has ever had.
2. **There is no GM role** — `user.schema.ts:6` has `'admin' | 'player'` and nothing else. `admin` *is* the GM.
3. **Hidden-content filtering is already solved server-side.** `terminals.service.ts:381-415` filters hidden terminals out of the list for non-admins, and `buildDetailEnvelope` (`:244-274`) omits fictional-user passwords for them. The house rule is: admin sees everything, everyone else gets a projected envelope, absent things 404 rather than 403.

## Goals / Non-Goals

**Goals**
- One authored map per campaign, with places nesting to arbitrary depth.
- Which tier of places is visible follows from how far you have zoomed, per-area — not from a global zoom table.
- `isPublic` is a real security boundary, enforced in the service.
- Authoring is direct manipulation: point at the map, don't type coordinates.

**Non-Goals**
- **No per-player discovery.** `isPublic` is authored, not earned. The machinery for discovery already exists (`user.unlockedHiddenIds`, per-user per-campaign, driven by terminals) and the field design below does not block a later change that reveals a place from a terminal — but that is a separate change.
- **No image uploads.** The repo has zero upload infrastructure (no multer, no `FileInterceptor`, no static serving, no file inputs — verified by exhaustive grep). Icons are keys into a built-in set.
- **No fictional/hand-drawn map.** This is real-world geography under a filter.
- **No offline tile pre-seeding.** Caching tiles a user actually visits is fine; bulk-downloading a region violates basemap terms.

## Decisions

### Real tiles, CARTO dark, no labels for players

The campaign is set in real geography, so `L.tileLayer` over CARTO's `dark_nolabels`, filtered:

```css
.leaflet-tile-pane {
  filter: grayscale(1) invert(0) sepia(1) hue-rotate(90deg) saturate(8) brightness(2) contrast(1);
}
```

These numbers are **authored, not derived** — chosen by eye against the live prototype. They are a design token, not a tuning knob.

`dark_nolabels` over standard OSM because street names, bus routes, and brand POIs survive the filter and turn it into green clutter that reads as a filtered street map rather than a Pip-Boy. With no labels, the authored place icons are the only text on screen.

**Labels are an authoring aid, not campaign config.** The author needs street names to know where they are dropping things; the player must not have them. So the CMS map header carries an `etichette` toggle (swapping `dark_all` for `dark_nolabels`) which is view-local and **never persisted**. Same for the `anteprima filtro Pip-Boy` toggle. Neither reaches the player.

### Attribution is a licence condition, and the five seconds are not arbitrary

The tiles are not ours. OpenStreetMap and CARTO attribution is a **condition of using them**, so it is specified, tested, and explained here rather than left as chrome someone can tidy away. Anyone tempted to delete the line should read this section first.

A permanent watermark is wrong for the product — it reads as somebody else's UI bolted onto a Pip-Boy. The OSM Foundation's Attribution Guidelines allow it to be collapsed, but only via three named mechanisms:

> "immediately with a dismiss interaction, for example clicking an 'x' in the corner of a dialog"; "automatically on map interaction such as panning, clicking, or zooming"; "automatically after five seconds"

and require that, once collapsed:

> "the user must still be able to find the licence information if they look for it, for example from an '(i)' button in the corner of the map or an 'About' option in a menu."

So the design takes **the third mechanism verbatim** — a phosphor line on entering the tab that auto-collapses after five seconds — plus **the second named findability example**, a `CREDITI` action in the settings popup. Both halves are quoted text, not interpretation. That is the entire reason for the number: **five seconds is the guideline's own figure**, not a taste call, and shortening it to "look nicer" breaks the one thing making this compliant.

Showing nothing at all was considered and rejected. The menu clause covers *finding* collapsed attribution; it does not by itself cover the initial presentation, and "collapsed" presupposes something that was shown. The five-second line costs one CRT-boot-looking line at tab entry and removes the ambiguity entirely.

Leaflet's own attribution prefix goes with the control (`attributionControl: false`), and that is fine on different grounds: Leaflet is BSD-2, which requires its copyright notice **in the source**, which the vendored file retains verbatim. Nothing obliges us to put "Leaflet" on screen. It is named in Credits anyway — the app suppresses its prefix, so Credits becomes the only place it is acknowledged, and that is cheap courtesy rather than obligation.

The Credits view lives in the settings popup, which is reachable only from the sheet. That bound is fine and worth stating: the map that incurs the attribution **is** a tab of that sheet, so anyone who can see the map can reach the credits. The obligation and its discharge have the same reachability.

### The geometry: one radius, two questions

Every place carries an **explicit radius** (default `250 m`) which is **extended automatically to contain its children** — recursively, and over each child's *circle*, not its point:

```
R(p) = max( p.radius,  max over children c of ( dist(p,c) + R(c) ) )
```

The recursion is the part that is easy to get wrong. Containing a child *zone*'s centre is not enough; you must reach past its own radius, or the child pokes out of its parent.

Two independent predicates read that radius:

```
APERTA(p)  =  vr <= R(p)                      ← only zoom.  p's children render.
DENTRO(p)  =  dist(centre, p) <= R(p)         ← only position. Names the breadcrumb.
```

where `vr` is **half the viewport's short side, in metres** — how much world is on screen. It depends on zoom *and* screen size, so a tablet enters zones slightly later than a phone. That is intended: "does this area fill my view" is a question about the view.

From these:

```
visible(p)   = allowed(p) && ancestors(p).every(APERTA) && !APERTA(p)
breadcrumb   = deepest p with  APERTA(p) && DENTRO(p),  plus its ancestors
```

Opening a place hides its own marker — its name has moved to the breadcrumb and its children have taken its place, so leaving the icon there is duplication.

### There is deliberately no authored zoom threshold — and nothing to validate

An earlier iteration gave each zone a `childrenFromZoom`. It is gone. The radius **is** the threshold: `vr <= R(p)` derives the opening zoom from the size of the thing. Simulated against hand-authored values, the geometry reproduced them exactly on 3 of 7 zones and within one zoom level on the rest — the hand numbers were re-deriving what the radius already said.

The consequence worth writing down: **the auto-extension rule makes the invariant free.** Because `dist(p,c) + R(c) <= R(p)`, every child's circle lies inside its parent's, therefore `R(child) <= R(parent)`, therefore:

- `APERTA(child) ⇒ APERTA(parent)`
- `DENTRO(child) ⇒ DENTRO(parent)`

Both chains are monotone **by construction**. A child cannot open before its parent; the breadcrumb cannot be incoherent. There is no zoom-band validation in this design because there is nothing left to violate. Anyone tempted to add a "childrenFromZoom" field should re-read this paragraph first.

### `hasLocalMap`: a place with no interior has no circle

A boolean per place. When false: no radius, no circle, cannot have children, never opens, never appears in the breadcrumb — and, importantly, **contributes `R = 0` to its parent's extension**, so the parent only has to reach its point. Forcing a decorative radius onto a pin inflates everything containing it: dropping the pins' radii took one sample zone from 4455 m to 4055 m of pure bookkeeping. The CMS disables the toggle while a place has children — you cannot strand a subtree by unchecking a box.

### Overlap: smallest radius wins

Auto-extension makes zones overlap: one outlier child 4 km from its parent's centre inflated that zone until it swallowed a *sibling* zone entirely. So the viewport can sit inside two tier-0 zones at once and the breadcrumb has to choose. **Smallest effective radius wins** — the tightest containing zone claims you. This is a heuristic, not a guarantee; it is right whenever the overlap comes from inflation and arbitrary when two zones genuinely overlap without nesting. Overlap is **not** warned about in the CMS: authors are trusted, and the tie-break is stable.

### `isPublic` is server-side and cascades over the subtree

Filtering happens in `campaign-map.service.ts`, not the Pip-Boy. If the API ships non-public places and the client hides them, every player with devtools reads the GM's secrets out of the network tab.

The cascade is not optional: a hidden parent hides its **whole subtree**, even public children. Rendering a public room inside a hidden bunker announces the bunker. The CMS shows this third state explicitly — a public place under a hidden ancestor reads `Ereditato`, not `Pubblico`, because either of the other two labels would be a lie — and the header counts "visibili al giocatore" using the cascade rather than the raw flag.

### Icons are keys, not uploads

`PLACE_TYPES` is a `const` tuple with a per-type default icon key; a place may override with its own key. **Resolved at render** (`place.icon ?? PLACE_TYPES[place.type].icon`), not copied at creation.

This diverges from the house pattern on purpose. `condition-popup.js:30-33` resolves `defaultSeverity` **at instantiation** and persists the copy, because a condition on a character is an independent instance. A map place is not an instance of its type — it *is* the authored thing — so a type's icon changing should update every place that never overrode it. The divergence is deliberate; do not "fix" it to match conditions.

### Leaflet twice, two honest answers

- **CMS:** `npm i leaflet`, with the stylesheet registered in `angular.json` rather than imported. A normal dependency tree, and — see the next section — the opposite of unremarkable.
- **Pip-Boy:** vendored into `src/vendor/leaflet/` and committed. No bundler, and an offline-first PWA cannot have its map library behind a CDN. This is the app's first runtime dependency and it breaks the no-dependencies posture — knowingly. Hand-rolling pan/zoom/pinch over real tile pyramids is not the same class of problem as hand-rolling markdown.

Same library, two constraints, two answers. That is not duplication.

### The CMS Leaflet stylesheet goes in `angular.json` — an `import` in TypeScript ships a dead map

`@angular/build:application` runs two esbuild passes, and only one of them can resolve a `url()`:

- **The stylesheet pipeline** — `angular.json`'s `styles`, and component `styles`/`styleUrls`. It registers `createCssResourcePlugin` (`stylesheets/bundle-options.js:36`), which routes every `url()` target through esbuild's `file` loader, emits it to `media/`, and rewrites the reference.
- **The code pipeline** — anything reached from a `.ts` file. Its loader map comes solely from `angular.json`'s `loader` option (`builders/application/options.js:93-110`), and is empty unless that key exists.

So `import 'leaflet/dist/leaflet.css'` inside `campaign-map-page.ts` routes the stylesheet through the *code* pipeline, where Leaflet's three `url()` references meet no loader and the build dies with `No loader is configured for ".png"`. This is not a container problem — `ng build` fails identically on a workstation. The Docker build was simply the first thing to run it.

**The obvious fix is a trap, and it was measured, not assumed.** Setting `"loader": { ".png": "file" }` makes the build pass and produces a broken map: esbuild emits the PNGs and a `main-*.css`/`chunk-*.css` pair carrying the whole of Leaflet's stylesheet, and then nothing in the output references either file. `index-html-generator.js:81` links only `initialFiles`; the map is lazy (`app.routes.ts:50`); Angular has no mechanism to load a lazy chunk's CSS. A green build with an unstyled map is strictly worse than a red one — the failing build is the only thing that caught this.

Hence the `styles` array, vendor entry **first** so our own CSS still wins on ties. Leaflet lands un-layered, which is correct rather than sloppy: `styles.css` layers our CSS so Tailwind utilities resolve predictably, and folding Leaflet into that system would let a stray utility beat the map's own internals. Leaflet owns the `.leaflet-*` namespace; nothing competes for it.

The costs are real and accepted:

- **~11 kB of CSS on initial load** for a route most users never open (measured: initial budget 545.77 kB → 556.84 kB). There is no lazy alternative — that is precisely what the `loader` route disproves. The bundle was already 45 kB over its 500 kB *warning* before any of this; that overrun predates the map and is not this change's to fix.
- **Three unused PNGs.** `layers.png`/`layers-2x.png` serve `L.control.layers` and `marker-icon.png` serves `L.Icon.Default` path detection. This map uses neither — `L.divIcon` only (`campaign-map-page.ts:1136`), no layers control. They ship anyway: forking a vendor stylesheet to strip three references is worse than three dead images.

### Emulated encapsulation cannot reach Leaflet's runtime DOM

The same trap as the `divIcon` margin, one layer up. Component styles are scoped by attribute — `.cm-filtered .leaflet-tile-pane` compiles to `.cm-filtered[_ngcontent-%COMP%] .leaflet-tile-pane[_ngcontent-%COMP%]` — but Leaflet builds the tile pane at runtime, and it never carries the attribute. The selector compiles clean, passes every test, and silently never matches.

**Any selector reaching into Leaflet-built DOM needs `:host ::ng-deep`**, as the `.cm-marker` rules already do. This is invisible until someone looks at a real screen, which is why it survived the CMS test suite intact.

### Pip-Boy integration: three collisions with existing chrome

1. **`.pb-screen * { text-shadow: inherit }`** (`pipboy.css:209`) force-inherits the phosphor glow onto every descendant. Free aesthetic on labels; smears the tiles. The tile pane needs an explicit `text-shadow: none`.
2. **`touch-action: pan-y`** on `.pb-screen-content` exists precisely so horizontal drags reach the swipe handler (`sheet.js:406-423`). Leaflet wants those same drags. **Decision: the map wins** — the map container is exempted from the swipe handler, and on this tab horizontal drags pan. This makes `MAPPA` behave unlike every other tab, which is why it is a spec change and not an implementation detail. It does not trap the user: the tab bar is always visible and tappable. (The footer has **no** prev/next arrows — `renderFooter()` at `sheet.js:306-310` renders only the leaf label, a caps counter, and a clock.)
3. **The CRT overlays are siblings of `#app`, not children** — deliberately, because every `mount()` wipes `#app`'s innerHTML. They therefore render *over* the map for free, which is what we want.

### Service worker: a third request class

`sw.js:82-92` `classify()` today treats every non-shell request as authenticated API traffic with `cache: 'no-store'` — which would mis-handle every tile. Tiles get their own class with a **cache-on-visit** strategy. This is a genuine win rather than a chore: `minZoom`/`maxZoom` plus `maxBounds` make the reachable tile set finite and small, so the map works offline after one visit. Pre-seeding the whole region would violate CARTO's terms; caching what a user actually browsed does not.

### Animation: bloom and collapse share one curve — *not* mirrored

Entering a zone, the children's icons spring **out of the zone's icon** to their own positions; exiting, they collapse back into it. `800 ms`, `cubic-bezier(.16, 1, .3, 1)`, **both directions**.

Both of the following were discovered by measurement and are the kind of thing that gets "corrected" by a well-meaning reader:

**The exit curve must not be the reverse of the entry curve.** The exact time-reverse of `cubic-bezier(.16,1,.3,1)` is `cubic-bezier(.7,0,.84,0)`, and using it made exit *feel* far slower at identical duration:

| | enter `(.16,1,.3,1)` | reversed `(.7,0,.84,0)` |
|---|---|---|
| first visible movement | 7 ms | **460 ms** |
| half the distance | 82 ms | 719 ms |
| 90% of the distance | 264 ms | 787 ms |

An ease-out's long tail is invisible; mirroring relocates it to the *front*, where it becomes 460 ms of dead air. Reversal is mathematically correct and perceptually wrong. Both directions therefore use the **same** curve, and both fade over `400 ms` so the slow tail stays invisible either way.

**Animate from the nearest *visible* ancestor, not the literal parent.** One zoom step can cross several tiers at once: standing on a vault, z13 → z16 opens both the region and the vault, so the vault's icon was never on screen and its rooms would bloom out of an empty patch of map. The source is the deepest ancestor that was actually rendered before the transition; the collapse target is the deepest that will be rendered after.

Two supporting constraints:
- **The marker set must be diffed, not rebuilt.** An icon can only fly out of a zone if it survives the redraw. (Welcome side effect: popups stop closing on every pan.)
- **State is computed at Leaflet's `zoomanim`**, which carries the destination zoom, so bloom/collapse run *alongside* the zoom rather than after it. Offsets must be projected at the **target** zoom (`map.project(latlng, targetZoom)`) — the live projection gets multiplied by the pane's scale animation and icons fly in from the wrong distance. A marker added during `zoomanim` never receives that event (Leaflet snapshots its listener list before dispatch), so it must be positioned manually the way `L.Marker._animateZoom` does. **This is the one place touching a Leaflet internal (`_latLngToNewLayerPoint`) and the implementation should look for a supported alternative.**

Panning triggers no animation at all — only zoom changes `APERTA`.

### `L.divIcon` anchors itself — do not add a negative margin

`L.divIcon({ iconSize: [n, n] })` defaults `iconAnchor` to `iconSize/2` and applies it as a negative margin on the icon element. Adding another negative margin in CSS **doubles it**: every marker sits half its size up-and-left of its actual coordinate. This bit both prototypes and stayed invisible until pixel-exact animation targets were needed. Marker CSS sets no margin.

### CMS layout: map-first, cards right

The Configurazione and selection cards sit **permanently right** of the map. The map holds a **stable, viewport-relative height** of its own (a `clamp()` against the viewport), independent of the card column: expanding the selection card or collapsing Configurazione never resizes it.

An earlier version measured the tallest the card column had ever been and fed that into the map's `min-height` through a `ResizeObserver`, so the map would "track" the column. That coupling is a trap. The grid's `align-items: stretch` makes the *observed* column mirror the map's own height, and the map card's border adds a pixel or two on top — so each observation reads back a value larger than the one it just wrote, the min-height climbs with no fixed point, and the map grows without bound. A fixed viewport height removes the loop and the machinery both; the map calls `invalidateSize()` only on a genuine container/window resize.

### The screen is reactive to the current campaign, not a one-shot read

The current campaign resolves **asynchronously** — `CurrentCampaignService` fetches it from the stored id after construction. A screen that reads `campaignId()` once, in `ngOnInit`/`ngAfterViewInit`, loses the race on a hard refresh landed directly on the map route: the id is still null, the data fetch bails, and — because the map container lives inside the `@else` of `!campaignId()` — Leaflet is never constructed. Navigating in from elsewhere hides the bug, because the campaign has resolved by then.

So the load is driven by effects, the way `cms-terminals-crud` already stays reactive to this same signal:
- an effect on `campaignId()` (re)loads the map whenever it becomes available or changes;
- an effect on the map container's `viewChild` builds Leaflet when the element appears and tears it down when it leaves, so clearing then re-selecting a campaign rebinds to the fresh element rather than a detached node.

### In-page campaign selector, guarded against discarding edits

The header carries the same in-page campaign selector as the terminals list — the shared `CampaignWorkspaceSwitcherComponent`, reused rather than reimplemented. But the map is an **authoring surface** with unsaved local state — unlike the read-only terminals list — so switching campaigns while edits are pending would silently throw work away. The screen tracks whether the working copy diverges from what was last loaded (a snapshot compare, not a flag threaded through every mutation) and confirms before a switch that would discard: accepting loads the new campaign, declining keeps the current one and its edits. A hard refresh is outside this guard — the browser owns that — the guard is specifically the in-app switch.

The switcher commits immediately today, so the guard is added to the shared component as an **opt-in** input: `guard?: (next) => boolean | Promise<boolean>`. When absent — the terminals list — it commits as before; when the map page supplies one, `onSelect` awaits it and only calls `setCurrent` if it resolves truthy. One gotcha this introduces: the switcher binds `[ngModel]` **one-way** to `currentCampaign()`, so a *declined* switch leaves `p-select` still showing the rejected pick — the CVA kept the user's selection and the signal never changed, so nothing writes the old value back. The component therefore drives the select from a local model it re-asserts to the current campaign on decline, snapping the control back to reality.

**The selection card is the editor; there is no inline row editing.** This diverges from the catalog pages (`talents-catalog-page.ts:60`, `:109`), and the reason is scale: a place has name, type, parent, coordinates, `hasLocalMap`, radius, `isPublic`, and description — long past what a table row holds — and it is selected *from the map*, so its editor belongs beside the map. Edits apply on input with no confirm step, matching the radius handle, which already worked that way. (Text edits patch the table row in place rather than re-rendering the card, or the name field loses focus on every keystroke.)

Collapsing a tree branch hides its **rows but not its markers**. Collapsing is a reading convenience for a long table; the filter bar is what hides things from the world. Two controls that both make rows vanish must not mean the same thing.

### Import is additive and must plan before it writes

Duplicate = same name (trimmed, lowercased, whitespace-collapsed) + same coordinates at 4 decimal places. Duplicates are skipped, never overwritten.

The tree is the hard part, and the naive implementation **loses data**. Incoming places reference parents by slug, but incoming slugs are not a reliable key: they can collide with existing slugs, collide with *each other* (concatenate two exports and see), or be absent. Keying the remap by incoming slug lets later entries overwrite earlier decisions and silently drops places.

So: decide every entry's fate **by index** first, keeping a separate slug→slug lookup for parent resolution where **first occurrence wins**; then insert, rewriting parents from that plan. The payoff is the case you actually hit: import a file containing a zone you already have plus new children, and **the children attach to your existing zone instead of duplicating it**.

Three guards, each earned by a failing test: a parent that resolves to nothing — or to a pin, which cannot contain anything — is detached rather than left dangling; cycles from a malformed file are broken; entries missing a name or valid coordinates are dropped and counted, not imported as `NaN` pins.

Export covers **locations only**. Start position, zoom range, and bounds are properties of the campaign's framing, not of its places.

## Risks / Trade-offs

- **First Pip-Boy dependency.** ~140 KB of vendored Leaflet in git, upgraded by hand. Accepted; the alternative is hand-rolling a tile renderer.
- **Third-party tile host.** The Pip-Boy gains an outbound dependency on CARTO. Offline works after first visit via the tile cache; a cold-start offline map shows empty tiles under a working marker layer. The tile URL is a constant in one place, so swapping providers is a one-line change — **but the attribution text is coupled to it**: change the provider and both the five-second line and the Credits view must change with it, or the new provider's terms are unmet.
- **Attribution can rot silently.** Nothing about a filtered green map makes a missing credit visible, so the obligation is pinned by `map-attribution.spec.ts` rather than by a comment. If that spec is ever deleted as noise, the licence condition goes with it.
- **Overlap resolution is a heuristic.** See above. Accepted knowingly; `log`-free and silent by choice.
- **Screen-size-dependent LOD.** A tablet opens zones a beat later than a phone. Intended, but it means "which zoom does this open at" has no single answer, and the CMS can only show `≈z16` against a reference viewport.
- **Marker count.** Visibility is zoom-only, so at deep zoom every place in the campaign is instantiated even far off-screen; Leaflet does not cull by default. Fine at the tens-to-low-hundreds scale a campaign map has. If a map ever reaches thousands of places this needs viewport culling — noted, not built.

## Migration Plan

None. Purely additive. A campaign with no map document reads as an empty map (`config` defaults, `places: []`), so deploying in any order is safe: the Pip-Boy tab renders an empty map until an admin authors one. No data migration, no version coupling between apps.

## Open Questions

- **Should the CSS filter live in config rather than CSS?** It is currently a design token, meaning a per-campaign palette (amber instead of green?) needs a code change. No demand yet.
- **`config.yaml`'s prefix list omits `pipboy-*`.** The context block documents `api-*`, `cms-*`, and `emulator-*`, but `pipboy-*` capabilities have existed since before this change, and its testing rules name Playwright only for `emulator-*` even though `apps/pip-boy` has its own Playwright suite. Out of scope here; worth a separate housekeeping change.
