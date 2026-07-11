## Why

The three player/author-facing apps (cms, terminal/emulator, pip-boy) are currently only reachable on `localhost` via per-service host port mappings, and each frontend hard-codes its API at `http://localhost:3000` — which points at the *visitor's* machine, so nothing works once the stack is served from a remote host. We want the apps reachable from the public internet on the Oracle Cloud host (`158.180.46.246`) through a single shared reverse proxy, with same-origin `/api` (no CORS), while keeping MongoDB off the internet and preserving a local build/test workflow identical to production.

## What Changes

- **BREAKING** — Remove all host `ports:` mappings from `docker-compose.yml` (`3000:3000`, `4280:80`, `8080:80`, `8081:80`). Services are no longer published to the host; they are reached only through the shared edge proxy. Direct `http://localhost:<port>` access is gone.
- Attach `cms`, `terminal`, `api` (and `pip-boy`) containers to a shared **external** Docker network `edge` (owned by a host-level Caddy proxy that lives outside this repo). Give containers project-prefixed names (`magnus-cms`, `magnus-terminal`, `magnus-api`, `magnus-pipboy`, `magnus-mongo`) to avoid collisions on the shared network.
- Keep `mongo` on a private `internal` network only, bound to `127.0.0.1:27017` on the host so it is reachable for SSH-tunnel debugging but never exposed to the internet.
- Ship a repo-owned Caddy snippet (`deploy/magnus.caddy`) that the host proxy imports. Each frontend hostname serves its static app at `/` and proxies `/api/*` to `magnus-api:3000` on the **same origin**, eliminating CORS. Hostnames are driven by a `BASE_HOST` variable (`127.0.0.1.nip.io` locally, `158.180.46.246.nip.io` remotely) so the identical config runs in both environments.
- Switch each frontend's API base from `http://localhost:3000` to a relative `/api`:
  - `apps/pip-boy/src/api/config.js`, `apps/terminal/src/api/config.js` (source constants)
  - `apps/cms` via the `API_BASE_URL` build arg (`/api`)
- Relax `CORS_ALLOWED_ORIGINS` in `apps/api/.env` since browser→API is now same-origin.
- Document the SSH-tunnel MongoDB debug workflow and reference the separate OCI host runbook (reserved IP, dual firewall, `docker network create edge`).

Out of scope (host infrastructure, captured in a separate runbook, **not** this repo's specs): the shared edge Caddy stack itself, OCI Security List / OS firewall rules, and reserving the public IP.

## Capabilities

### New Capabilities
- `deploy-reverse-proxy`: How Magnus containers are exposed to the network — shared external `edge` network membership, no host port publishing, the repo-owned Caddy site snippet, same-origin `/api` proxying (which makes cross-origin CORS allow-listing unnecessary), MongoDB network isolation with SSH-tunnel debug access, and local/remote parity via `BASE_HOST`/nip.io.

### Modified Capabilities
<!-- None. CORS is not currently governed by any existing spec (api-configuration covers runtime config blobs, not HTTP CORS), so the same-origin behavior is captured as a requirement under the new deploy-reverse-proxy capability rather than as a delta. -->
- _None._

## Impact

- **Compose**: `docker-compose.yml` restructured (networks, container names, removed ports, mongo loopback bind). New `deploy/` directory for the Caddy snippet and a `BASE_HOST`-driven `.env` entry.
- **Frontends**: API base constants in `apps/terminal` and `apps/pip-boy`; `API_BASE_URL` build arg for `apps/cms` (`apps/cms/Dockerfile`, `src/environments/environment.ts`).
- **API**: `apps/api/.env` `CORS_ALLOWED_ORIGINS` and its consumption in `apps/api/api/src/config/configuration.ts` / `main.ts`.
- **External dependency**: requires a host-level Caddy edge proxy attached to an external `edge` network (created out-of-band). Local dev requires running that edge stack (or an equivalent) locally.
- **Operational**: MongoDB debugging shifts from a published port to an SSH tunnel.

## Testing

- **Local integration (docker-compose smoke)** — Bring the stack up with `BASE_HOST=127.0.0.1.nip.io` behind a local Caddy on the `edge` network; assert each frontend hostname returns its app HTML and that `/api/...` on that same hostname reaches the API (proxy + same-origin path). Layer: integration (manual/scripted compose smoke; automatable in CI with a compose harness).
- **emulator same-origin client** — Playwright test loads the emulator `index.html` served through the proxy and asserts an API-backed flow issues requests to a relative `/api` path (no absolute `localhost:3000`) and succeeds. Layer: e2e (uses the existing `emulator-testing` Playwright harness).
- **api boots without CORS allow-list** — API e2e/unit spec asserting that with `CORS_ALLOWED_ORIGINS` empty the app boots and same-origin requests are unaffected (no cross-origin allow-list required). Layer: unit/e2e against `mongodb-memory-server`.
- **Not automatically tested (stated explicitly)**: OCI firewall rules, Let's Encrypt issuance on public nip.io, and reserved-IP persistence are host-infra concerns verified manually during deploy per the runbook; they cannot run in this repo's test environment.
