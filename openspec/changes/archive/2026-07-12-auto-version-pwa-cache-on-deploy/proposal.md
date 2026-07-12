## Why

The installed pip-boy PWA on mobile is frozen on a pre-deploy snapshot and its API calls fail, because the service worker can never update itself. `apps/pip-boy/sw.js` pre-caches the **entire shell — including `src/api/config.js` — cache-first** under a cache name (`pipboy-v1`) that has never been bumped since the file was created. The browser only re-installs a service worker when `sw.js`'s **bytes change**; since neither the version constant nor the file body changes on deploy, `install`/`addAll` never re-run, `activate` never purges the stale cache, and the installed app keeps serving old JavaScript and an old `config.js` that points at the pre-edge-proxy API origin. Result: frozen UI + broken API.

The update mechanism *exists* but depends on a human remembering to hand-edit the version — and that memory failed. (The terminal app proves the hazard: it sits at `robco-v9`, nine manual bumps.) The fix is to make the deploy stamp the cache version automatically, so every code change produces a byte-different `sw.js` and the installed app self-heals on its next online launch — no manual "clear site data" for users.

## What Changes

- **Build-time cache-version stamping (Design A — mirrors the existing `apps/cms/Dockerfile` `sed` pattern).** `apps/pip-boy/sw.js` declares `const CACHE_VERSION = 'pipboy-__BUILD_ID__'`. A new `apps/pip-boy/Dockerfile` takes an `ARG BUILD_ID` and `sed`-substitutes the placeholder at image-build time. The tracked source keeps the stable placeholder, so the git tree is never dirtied by the deploy.
- **Pip-boy served from a built image, not a raw volume mount.** `docker-compose.yml` gives the `pip-boy` service a `build.context` + `args: { BUILD_ID }` (replacing the `nginx:alpine` + `./apps/pip-boy:/usr/share/nginx/html` volume mount), exactly like `cms`.
- **`BUILD_ID` derived from the deployed commit.** `start.sh` exports `BUILD_ID=$(git rev-parse --short HEAD)` before `docker compose up -d --build`, so the version changes if and only if the code changed, and each version is traceable to a commit.
- **`sw.js` served with revalidation headers.** The pip-boy image ships an `nginx.conf` that serves `sw.js` with `Cache-Control: no-cache`, closing the window where the browser's HTTP cache masks a changed service worker.
- **Local-dev ergonomics preserved.** A compose override (or documented `--build` step) keeps live editing for local work now that pip-boy is image-built.

## Capabilities

### New Capabilities
- `deploy-cache-busting`: the deploy stamps a static PWA's service-worker cache version from the deployed commit at image-build time, and the app image serves `sw.js` with revalidation headers so installed clients detect and adopt new versions. Pip-boy is the first adopter; the mechanism is reusable (terminal can adopt it in a follow-on change to retire its manual `robco-vN` bumps).

### Modified Capabilities
- `pipboy-pwa-installability`: the "Cache versioning and activation cleanup" requirement no longer permits a hand-maintained static version constant; the version SHALL be a deploy-stamped build id, and `sw.js` SHALL be served so browsers can detect updates.

## Impact

- **Scope:** `apps/pip-boy` (its `sw.js`, a new `Dockerfile`, a new `nginx.conf`), `docker-compose.yml`, and `start.sh`. No API, CMS, or terminal changes in this change.
- **Self-heals the field:** because browsers fetch `sw.js` itself over HTTP on every online launch (a SW script is never served from its own cache), a changed `CACHE_VERSION` is detected even on currently-frozen phones — `activate` then purges `pipboy-v1` and re-caches the fresh shell. No manual user action required.
- **Tradeoff — local live-edit:** switching pip-boy from a volume mount to an image build means local source edits no longer appear without a rebuild. Mitigated by a local compose override that re-mounts the source (accepting the local `__BUILD_ID__` placeholder in dev) or a documented `docker compose up -d --build pip-boy`.
- **Terminal deferred (deliberate):** the terminal app has the identical manual-bump hazard (`robco-v9`) but is out of scope here to keep the change focused on the reported pip-boy failure; it becomes a small follow-on adopter of `deploy-cache-busting`.

## Testing

Behaviors under test:

- **Stamping (build/integration):** building the pip-boy image with `--build-arg BUILD_ID=<sha>` produces an image whose served `sw.js` contains `CACHE_VERSION = 'pipboy-<sha>'` and **no** literal `__BUILD_ID__`. Two builds with different `BUILD_ID` values yield different cache names.
- **`sw.js` headers (integration):** an HTTP request for `/sw.js` against the running container returns a `Cache-Control` header containing `no-cache`.
- **`BUILD_ID` wiring (integration):** with `BUILD_ID` unset, the build falls back to a safe default (e.g. `dev`) rather than emitting the raw placeholder.
- **Self-heal contract (Playwright e2e, existing `apps/pip-boy/tests/*.spec.ts` harness):** after load, the active service worker's cache set contains a `pipboy-<...>` cache and no differently-named stale cache survives `activate`; a page served a `sw.js` whose `CACHE_VERSION` differs from a previously-cached one ends up with only the new version's cache (asserting the purge-on-activate path the fix relies on).

A pure packaging concern (the `sed` substitution) is asserted by inspecting the built artifact rather than a unit test, consistent with how `apps/cms` verifies its `API_BASE_URL` injection.
