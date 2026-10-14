## Context

Both map surfaces load CARTO raster tiles anonymously from `{s}.basemaps.cartocdn.com`:

- `apps/pip-boy/src/tabs/map.js:24` — `dark_nolabels`, static ES modules, no build step; deployed as an nginx image whose Dockerfile already `sed`-stamps `__BUILD_ID__` into `sw.js`.
- `apps/cms/src/app/features/campaign-map/campaign-map-page.ts:44-45` — `dark_nolabels` / `dark_all`, Angular; its Dockerfile already `sed`-stamps `apiBaseUrl: 'TODO'` in `environment.ts` from the `API_BASE_URL` build arg.

CARTO now answers keyless requests with a 200 watermark tile. A free key is appended as `?key=`; it is necessarily visible to every browser that loads the map, so its protection is CARTO's per-key domain lock, not secrecy. Keeping it out of git is still worth doing: it avoids publishing a quota-bearing credential in history and lets the server own rotation.

Adopting the key binds us to CARTO's attribution rule ("both linked, visible on the map itself … Not hidden, faded or behind a click"). The Pip-Boy's current design deliberately does the opposite (five-second collapse + `CREDITI`, justified by the OSM guidelines), and its tests and comments pin that behaviour. This change reverses that decision.

## Goals / Non-Goals

**Goals:**
- Restore the basemap in both apps with a key supplied by the operator at build time.
- Make attribution in both apps meet CARTO's terms.
- Purge watermarked tiles already sitting in installed Pip-Boy clients.

**Non-Goals:**
- Switching provider, vector tiles, or self-hosting tiles.
- A runtime (non-rebuild) way to change the key.
- Monitoring CARTO quota usage.

## Decisions

### D1. Key is a build arg stamped into source, like `API_BASE_URL` / `BUILD_ID`

`.env` → `docker-compose.yml` `args: CARTO_BASEMAP_KEY: ${CARTO_BASEMAP_KEY:-}` for `pip-boy` and `cms` → Dockerfile `ARG` + `sed`.

- Pip-Boy: a new module `src/tabs/basemap.js` holds `const CARTO_BASEMAP_KEY = '__CARTO_BASEMAP_KEY__';`; the Dockerfile `sed`s that placeholder. One file owns the key, the URL template, and the attribution markup, so `map.js` and `settings-popup.js` don't duplicate them, and the `sed` has a single, obvious target.
- CMS: `environment.ts` gains `cartoBasemapKey: 'CARTO_KEY_TODO'` (sed target, mirroring `apiBaseUrl: 'TODO'`); `environment.development.ts` gains `cartoBasemapKey: ''`.

*Alternatives:* committing the key in source (simplest, works in dev, but puts a credential in history and couples rotation to a commit); fetching it from the API at runtime (new endpoint and a dependency of the map on the API for no real secrecy gain); nginx `sub_filter` at serve time (no rebuild to rotate, but a new mechanism unlike anything else in the repo).

### D2. Unstamped/empty key → omit the parameter

A pure helper builds the URL: `key` is "usable" only if it is non-empty and not the placeholder; otherwise the URL has no query string. Sending `?key=__CARTO_BASEMAP_KEY__` would be a guaranteed-invalid key that might count against nothing yet still look like a config bug in CARTO's logs; omitting it gives the documented keyless behaviour (watermark) and makes "no key configured" obvious on screen.

The helper is exported so Playwright (Pip-Boy, via a `globalThis.__PB_CARTO_KEY__` test override in the style of `__PB_MAP_ATTRIBUTION_MS__`) and Vitest (CMS, pure function) can test both branches without a real key.

### D3. Pip-Boy attribution: custom line, permanent by default, collapse behind one constant

Keep `attributionControl: false` and keep the custom `.pb-map-attr` line, now containing two `<a>` elements. Leaflet's control would add the "Leaflet" prefix and default chrome that ignores the phosphor theme; the custom line already exists and is styled.

The lifetime is one exported constant in `basemap.js`:

```js
/**
 * How long the basemap attribution stays on the map, in ms.
 *   null  → permanent. Required by the CARTO Basemaps Terms ("visible on the
 *           map itself … not hidden, faded or behind a click"). Default.
 *   5000  → collapse after five seconds, the OSM Attribution Guidelines'
 *           mechanism, with CREDITI as the fallback. OSM-compliant, NOT
 *           CARTO-compliant: only use it if the basemap provider allows it.
 */
export const ATTRIBUTION_COLLAPSE_MS = null;
```

`showAttribution` reads it through the existing `__PB_MAP_ATTRIBUTION_MS__` test override (kept, now also accepting `null`) and only schedules the `setTimeout` removal for a positive number. Reverting is changing `null` to `5000`; no other code, CSS, or test fixture changes.

*Alternatives:* a player-facing setting (rejected — whether the credit may be hidden is a licence decision for whoever deploys, not each player, and a per-user toggle would let the app run non-compliant without the operator knowing); a Docker build arg like the key (rejected for now as more plumbing than a value that changes, if ever, with a provider switch — it can be added later by stamping this same constant).

Other changes:
- Container keeps `pointer-events: none`; the anchors get `pointer-events: auto`, so only the link text captures input and pans elsewhere on the line still reach the map.
- Wording `© OpenStreetMap contributors, © CARTO`, links `target="_blank" rel="noopener noreferrer"`. Opening a new browsing context from an installed PWA hands off to the system browser rather than navigating the app away.
- Contrast: raise text alpha from `0.55` towards the existing readable phosphor text levels so it is "legible", not "faded" (CARTO's word).
- It must sit inside the map canvas so it is present in immersive mode (the canvas is what enlarges).

### D4. CMS: keep Leaflet's control, change only the string

The CMS already uses Leaflet's permanent control; set `attribution` to the linked HTML. Extract `cartoTileUrl(style: 'dark_nolabels' | 'dark_all', key: string)` so `TILE_NOLABELS`/`TILE_LABELS` and the labels-toggle `setUrl` all go through it.

### D5. Bump tile cache to `pipboy-tiles-v3`

The existing activate sweep already deletes any non-current tile cache. Because keyed URLs differ from keyless ones, stale entries would never be *served* again even without a bump — but they would occupy up to 4000 entries until evicted. The bump reclaims that immediately and costs one re-download per visited tile. `TILE_HOST_SUFFIX` matching is by hostname, so keyed URLs need no SW classification change.

### D6. `CREDITI` stays as the always-reachable fallback, gains links

It is what makes collapse mode acceptable under the OSM guidelines, so it must stay working regardless of the default. Its comment block is updated to say so, and to point at `ATTRIBUTION_COLLAPSE_MS` and the CARTO caveat, so nobody switches to collapse mode believing Credits alone satisfies CARTO.

## Risks / Trade-offs

- [Key visible in shipped JS] → Lock the key to production domains in CARTO's key settings; that is the only real protection and the intended one.
- [Local live-edit override serves unstamped source → watermarked tiles] → Documented; developers rebuild (`docker compose up -d --build pip-boy`) with the key in `.env`, or temporarily stamp the key locally (never committed). Acceptable because tiles are cosmetic for most local work.
- [Forgetting `CARTO_BASEMAP_KEY` on the server] → Map silently shows watermark again. Mitigation: add the variable to `deploy`/`start.sh` docs and the `.env` the server uses; the watermark itself is a loud, self-explaining symptom.
- [Quota: 5M/month non-commercial, 1M commercial, account-wide] → Pip-Boy is cache-first; CMS is admin-only. Low risk at current scale.
- [Permanent line over the map] → Small corner text with `pointer-events: none` except on links; the visual cost is the trade for keeping the key.
- [Someone flips `ATTRIBUTION_COLLAPSE_MS` to `5000` while still on CARTO] → The constant's comment states it is not CARTO-compliant; it is a deliberate, reviewable one-line diff rather than a hidden setting.
- [Spec/test churn] → `map-attribution.spec.ts` assertions invert; done in the same change so no red test is left behind.

## Migration Plan

1. Request a key at carto.com/basemaps/apikey; lock it to the production domain(s) (+ `localhost` if desired).
2. Add `CARTO_BASEMAP_KEY=…` to the server `.env` (and locally if wanted).
3. Deploy: rebuild `pip-boy` and `cms` images. New SW activates → `pipboy-tiles-v2` purged.
4. Rollback: redeploy the previous images; the map returns to watermarked tiles (same as today). No data migration.

## Open Questions

- Should `localhost` be on the key's allowed list so the dev override works once the key is stamped locally? (Operator choice in CARTO settings; no code impact.)
- Is any deployment "commercial use" under CARTO's terms (1M/month cap instead of 5M)? Affects plan choice only.
