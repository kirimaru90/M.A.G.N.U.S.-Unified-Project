## 1. Compose refactor (networks, names, ports, Mongo isolation)

- [x] 1.1 Add a top-level `networks:` block to `docker-compose.yml`: `edge` (`external: true`) and `internal` (default bridge).
- [x] 1.2 Rename services/containers to project-prefixed names: `api`→`magnus-api`, `cms`→`magnus-cms`, `frontend`→`magnus-terminal`, `pip-boy`→`magnus-pipboy`, `mongo`→`magnus-mongo` (use `container_name` and/or a network alias so Caddy resolves them on `edge`).
- [x] 1.3 Attach `magnus-cms`, `magnus-terminal`, `magnus-pipboy`, `magnus-api` to `edge` **and** `internal`; attach `magnus-mongo` to `internal` **only**.
- [x] 1.4 Remove all host `ports:` mappings (`3000:3000`, `4280:80`, `8080:80`, `8081:80`).
- [x] 1.5 Change Mongo's port mapping to loopback-only `127.0.0.1:27017:27017`.
- [x] 1.6 Update the api service's `MONGO_URL` / any inter-service references to use the new `magnus-mongo` host name.
- [x] 1.7 Add `BASE_HOST` to `.env` (and `.env.example` if present): default `BASE_HOST=127.0.0.1.nip.io` for local.

## 2. Caddy site snippet

- [x] 2.1 Create `deploy/magnus.caddy` with three site blocks driven by `{$BASE_HOST}`: `cms.{$BASE_HOST}`, `terminal.{$BASE_HOST}`, `pipboy.{$BASE_HOST}`.
- [x] 2.2 In each block, add `handle_path /api/* { reverse_proxy magnus-api:3000 }` (prefix-stripping — API has no global prefix) followed by `handle { reverse_proxy magnus-<app>:80 }`.
- [x] 2.3 Add a short `deploy/README.md` documenting: mounting `magnus.caddy` into the edge proxy's `/etc/caddy/sites/` dir, the `import` line the edge Caddyfile needs, and the `BASE_HOST` values for local vs remote.

## 3. Frontends → relative `/api`

- [x] 3.1 `apps/terminal/src/api/config.js`: change `API_BASE_URL` from `http://localhost:3000` to `/api`.
- [x] 3.2 `apps/pip-boy/src/api/config.js`: change `API_BASE_URL` from `http://localhost:3000` to `/api`.
- [x] 3.3 CMS: set the build to `API_BASE_URL=/api` (compose build arg + confirm `apps/cms/Dockerfile` sed replaces `apiBaseUrl` in `environment.ts` accordingly).
- [x] 3.4 Grep the three frontends for any remaining absolute `localhost:3000` / hard-coded API origins and remove them.

## 4. API CORS relaxation

- [x] 4.1 Set `CORS_ALLOWED_ORIGINS` empty by default in `apps/api/.env` (and `.env.example`), documenting that same-origin `/api` needs no allow-list.
- [x] 4.2 (Optional, defense-in-depth) In `apps/api/api/src/main.ts`, prefer same-origin behavior over `origin: '*'` when the list is empty; keep it configurable so a future cross-origin client can re-enable.

## 5. Local verification

- [x] 5.1 Ensure the `edge` network exists locally (`docker network create edge`) and a local Caddy edge proxy imports `deploy/magnus.caddy`.
- [x] 5.2 `docker compose up` with `BASE_HOST=127.0.0.1.nip.io`; confirm `cms.127.0.0.1.nip.io`, `terminal.127.0.0.1.nip.io`, `pipboy.127.0.0.1.nip.io` each serve their app. — verified: all HTTP 200 with app HTML.
- [x] 5.3 Confirm an API-backed action on each frontend issues requests to relative `/api/...` and succeeds through the proxy (no `localhost:3000`, no CORS error in console). — verified: `/api/campaigns` on each hostname → HTTP 200 live JSON through the proxy.
- [x] 5.4 Confirm `docker compose ps` shows no published app ports and only `127.0.0.1:27017` for Mongo; confirm Mongo is unreachable from a non-loopback interface. — verified: no app ports; mongo `127.0.0.1:27017` only; non-loopback interface refused, loopback OK.

## 6. Automated tests

- [x] 6.1 Emulator (`apps/terminal`) Playwright test: load the app and assert an API-backed flow requests a relative `/api/*` path and succeeds (extends the `emulator-testing` harness).
- [x] 6.2 API test: assert the app boots with `CORS_ALLOWED_ORIGINS` empty and same-origin requests succeed (unit/e2e against `mongodb-memory-server`).
- [x] 6.3 (If practical) scripted compose smoke asserting each hostname returns app HTML and `/api` reaches the API. — `deploy/smoke.sh`; passed locally against the live stack.

## 7. Deploy (host — cross-reference the OCI runbook)

> §7 runs on the Oracle Cloud host and cannot be executed from the dev machine. Follow
> [`deploy/edge-proxy-host-runbook.md`](../../../deploy/edge-proxy-host-runbook.md) and use
> `BASE_HOST=158.180.46.246.nip.io ./deploy/smoke.sh` for 7.3.

- [ ] 7.1 Confirm host prerequisites per the separate runbook: reserved public IP; 80/443 open in **both** the OCI Security List/NSG and the OS firewall; 27017 closed; `edge` network created; shared Caddy edge stack running and importing `sites/*.caddy`.
- [ ] 7.2 Mount `deploy/magnus.caddy` into the edge proxy's `sites/` dir and reload the edge proxy.
- [ ] 7.3 Deploy the stack with `BASE_HOST=158.180.46.246.nip.io`; verify Let's Encrypt issuance and that each public hostname serves its app with working `/api`.
- [ ] 7.4 Verify MongoDB is not reachable on the public IP; verify `ssh -L 27017:127.0.0.1:27017 opc@158.180.46.246` + client on `localhost:27017` reaches it.

## 8. Docs

- [x] 8.1 Document the SSH-tunnel MongoDB debug workflow (local `localhost:27017`, remote via tunnel) in `deploy/README.md`.
- [x] 8.2 Note the BREAKING change (no more `http://localhost:<port>` direct access; use nip.io hostnames through the edge proxy) in the deploy docs / project README.
