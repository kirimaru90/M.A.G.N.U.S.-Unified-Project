# Leaflet (vendored)

**Pinned version: 1.9.4** — BSD-2-Clause, see `LICENSE`.

This is the first and only runtime dependency `apps/pip-boy` has. The app ships
static files to nginx with no bundler and no dependency tree, so the library is
committed here rather than installed. An offline-first PWA also cannot have its
map library behind a CDN: the map tab must render from cache with no network.

## Upgrades are manual

There is no package manager watching this directory. To upgrade, copy the files
below out of a matching `leaflet` release and re-run `apps/pip-boy`'s Playwright
suite — `map-tab.spec.ts` and `map-attribution.spec.ts` in particular.

| File | Source (from the npm package) |
|---|---|
| `leaflet.esm.js` | `dist/leaflet-src.esm.js` |
| `leaflet.css` | `dist/leaflet.css` |
| `images/` | `dist/images/` |
| `LICENSE` | `LICENSE` |

`apps/cms` installs Leaflet from npm instead, and the two are expected to stay on
the same version. If you bump one, bump the other.

## Notes

- **The BSD-2 copyright notice lives in `leaflet.esm.js`, verbatim, at the top of
  the file.** That is what the licence requires — a notice in the source, not on
  screen. The map tab constructs Leaflet with `attributionControl: false`, which
  also drops Leaflet's own "Leaflet" prefix. Do not "restore" the notice by
  deleting the `@preserve` header; the licence is satisfied by it being here.
  Leaflet is named in the settings popup's `CREDITI` view as a courtesy.
- `images/` is vendored so the stylesheet's `url(images/…)` references resolve,
  but nothing currently requests them: the map tab uses `L.divIcon` only and
  mounts no layers control. They are deliberately **not** in the service worker's
  `REQUIRED_SHELL_URLS` — precaching assets nothing fetches would be dead weight.
  If you ever add a default marker or a layers control, add them there.
