## 1. Placeholder in the service worker (pipboy-pwa-installability)

- [x] 1.1 In `apps/pip-boy/sw.js`, change `const CACHE_VERSION = 'pipboy-v1'` to `const CACHE_VERSION = 'pipboy-__BUILD_ID__'`. Do not change the `activate` cleanup logic — it already deletes every cache `!== CACHE_VERSION`, which is exactly what stamps a new version onto a purge of the old one.

## 2. Image build for pip-boy (deploy-cache-busting)

- [x] 2.1 Add `apps/pip-boy/Dockerfile`: `FROM nginx:alpine`, `COPY` the app into `/usr/share/nginx/html`, declare `ARG BUILD_ID=dev`, and `sed -i "s/__BUILD_ID__/${BUILD_ID}/" /usr/share/nginx/html/sw.js` (mirroring `apps/cms/Dockerfile` line 11). Ensure `node_modules`, `tests`, and `test-results` are excluded (add/extend `apps/pip-boy/.dockerignore`).
- [x] 2.2 Add `apps/pip-boy/nginx.conf` serving the static root, with a `location = /sw.js` block that sets `Cache-Control: no-cache`; `COPY` it to `/etc/nginx/conf.d/default.conf` in the Dockerfile (mirroring `apps/cms/Dockerfile` line 17).

## 3. Wire BUILD_ID through compose and deploy (deploy-cache-busting)

- [x] 3.1 In `docker-compose.yml`, replace the `pip-boy` service's `image: nginx:alpine` + `volumes: ./apps/pip-boy:/usr/share/nginx/html` with `build: { context: ./apps/pip-boy, args: { BUILD_ID: ${BUILD_ID:-dev} } }`; keep `container_name: magnus-pipboy` and the `edge`/`internal` networks unchanged.
- [x] 3.2 In `start.sh`, export `BUILD_ID="$(git rev-parse --short HEAD)"` after the checkout/pull and before `docker compose up -d --build`, so the built image is stamped with the deployed commit.
- [x] 3.3 Add `docker-compose.override.yml` (git-ignored or documented) that re-mounts `./apps/pip-boy:/usr/share/nginx/html` for local live editing, and document `docker compose up -d --build pip-boy` as the local refresh command in `URLS.md` / `deploy/README.md`.

## 4. Verification

- [x] 4.1 Build assertion: `docker build --build-arg BUILD_ID=testsha apps/pip-boy` then confirm the served `sw.js` contains `CACHE_VERSION = 'pipboy-testsha'` and no literal `__BUILD_ID__`; build again with a different `BUILD_ID` and confirm the cache name differs.
- [x] 4.2 Header assertion: `curl -I` (or equivalent) for `/sw.js` against the running container returns a `Cache-Control` value containing `no-cache`.
- [x] 4.3 Fallback assertion: building with no `BUILD_ID` arg yields `pipboy-dev`, never `pipboy-__BUILD_ID__`.
- [x] 4.4 Playwright e2e (`apps/pip-boy/tests/`): after load, the registered service worker's Cache Storage contains a single `pipboy-<...>` shell cache and no stale differently-named cache survives activation; extend/adapt the existing installability spec accordingly.
- [x] 4.5 Run the full pip-boy suite (`npx playwright test` from `apps/pip-boy`) and confirm green.
