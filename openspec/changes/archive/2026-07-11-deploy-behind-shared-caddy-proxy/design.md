## Context

Magnus runs as one compose stack of five services: `api` (NestJS), `mongo`, `cms` (Angular SPA), `frontend`/terminal emulator (static nginx), and `pip-boy` (static nginx). Today every service publishes a host port (`3000`, `27017`, `4280`, `8080`, `8081`), and all three frontends hard-code the API at `http://localhost:3000`. That works only when the browser and the stack share a machine; served from the Oracle Cloud host (`158.180.46.246`), `localhost` resolves to the visitor's own machine and every API call fails, while the published Mongo port would sit exposed on the public internet.

The host is intended to serve **multiple** projects behind one reverse proxy, so the proxy is deliberately kept out of this repo. A host-level Caddy instance owns `:80`/`:443`, terminates TLS, and routes to each project's containers over a shared external Docker network. This change wires Magnus into that model without pulling the proxy into the repo.

Constraints:
- No purchased domain — hostnames come from `nip.io` wildcard DNS (`<sub>.<ip>.nip.io` → `<ip>`).
- Same-origin `/api` is a hard requirement (no CORS).
- The stack must build and run locally with a topology identical to production.
- MongoDB must remain debuggable from a developer machine without being internet-exposed.

## Goals / Non-Goals

**Goals:**
- Serve cms/terminal/pip-boy publicly through the shared edge proxy with automatic TLS.
- Same-origin `/api/*` per hostname → `magnus-api:3000`, removing CORS.
- Remove all host port publishing except a loopback-only Mongo bind.
- One `BASE_HOST` variable is the sole difference between local and remote.
- MongoDB reachable only via SSH tunnel.

**Non-Goals:**
- The shared edge Caddy stack itself, the OCI Security List / OS firewall rules, and reserving the public IP — these are host infrastructure documented in a separate runbook, not governed by this repo's specs.
- Migrating apps to server-side rendering or introducing an API gateway/auth layer.
- Changing application/business logic in any app.

## Decisions

### D1: Shared external `edge` network, no host ports
Frontends + api attach to an `external: true` network `edge` owned by the host proxy; Mongo stays on a private `internal` network. Caddy reaches services by container name (`magnus-api:3000`).
- **Why:** Decouples the proxy from the project — the edge stack is created once and knows nothing about Magnus. Removing `ports:` closes the host attack surface (notably the exposed Mongo port) and lets many projects coexist without port collisions.
- **Alternatives:** (a) Keep host ports + firewall rules per service — re-exposes Mongo, doesn't scale to many projects. (b) Proxy inside this repo — couples every future project to Magnus's compose and fights over `:80`/`:443`.

### D2: Caddy import-snippets over labels or nginx
The edge Caddyfile does `import /etc/caddy/sites/*.caddy`; this repo ships `deploy/magnus.caddy` mounted into that shared dir.
- **Why:** Keeps per-project routing explicit and readable (one file shows all Magnus routes) while the edge stays generic and each project owns its own routing. Caddy gives automatic Let's Encrypt on nip.io hostnames and resolves upstreams at request time (no stale-DNS 502s on container restart).
- **Alternatives:** (a) `caddy-docker-proxy` labels — fully auto-discovered but routing is scattered across compose labels and less legible; chosen against for readability. (b) Plain nginx — no auto-TLS (certbot + renewal), and static `proxy_pass` to container names caches the IP at load and 502s after a container is recreated unless a `resolver 127.0.0.11` + variable workaround is added; more moving parts for less.

### D3: Same-origin `/api` via per-hostname reverse proxy
Each site block: `handle_path /api/* { reverse_proxy magnus-api:3000 }` then `handle { reverse_proxy magnus-<app> }`. Frontends call relative `/api`.
- **Why:** Collapses two problems at once — the baked-in `localhost:3000` origin and CORS both disappear because the app and API share an origin. Nothing is environment-specific in the app bundles.
- **Alternatives:** API on its own `api.<ip>.nip.io` host — simpler routing but re-introduces cross-origin CORS and an absolute API base the frontends must bake per environment.
- **Resolved:** `apps/api/api/src/main.ts` sets **no** global prefix — routes are served at root (`/campaigns`, `/auth`, …). Therefore `handle_path /api/*` (which **strips** `/api`) is correct: the browser calls `/api/campaigns`, Caddy strips to `/campaigns`, and the API matches. Using `handle` without stripping would send `/api/campaigns` to an API that has no such route → 404.

### D4: nip.io in both environments, differ only by `BASE_HOST`
Local `BASE_HOST=127.0.0.1.nip.io`, remote `BASE_HOST=158.180.46.246.nip.io`. Snippet hostnames are `cms.{$BASE_HOST}`, `terminal.{$BASE_HOST}`, `pipboy.{$BASE_HOST}`.
- **Why:** `127.0.0.1.nip.io` resolves to loopback on any OS (more reliable than `*.localhost`, which is inconsistent on Windows), so the exact snippet tested locally is the one shipped. Caddy uses its internal CA (or HTTP) locally and Let's Encrypt remotely automatically — no per-env TLS config.
- **Alternatives:** `*.localhost` locally — Windows resolution is unreliable; bare IP remotely — cannot obtain Let's Encrypt certs.

### D5: MongoDB — loopback bind + SSH tunnel
Mongo binds `127.0.0.1:27017:27017`; debugging is `ssh -L 27017:127.0.0.1:27017 opc@158.180.46.246` then connect a client to `localhost:27017`.
- **Why:** Gives full Compass/mongosh access from a developer machine, encrypted, using SSH the operator already has — with zero public exposure and no firewall change.
- **Alternatives:** Open 27017 in the OCI firewall — internet-exposed MongoDB, found by scanners within minutes; rejected.

## Risks / Trade-offs

- **External `edge` network must exist first** → Compose fails if `edge` is absent. Mitigation: runbook step `docker network create edge`; document that the edge stack (or a local equivalent) must be up before `docker compose up`.
- **`handle_path` prefix stripping mismatches the API's route base** → 404s on `/api/*`. Mitigation: verify the NestJS global prefix during implementation and choose `handle_path` vs `handle` accordingly; covered by the local smoke test before deploy.
- **Ephemeral OCI IP changes** → nip.io hostnames and issued certs break. Mitigation: reserve the public IP (runbook); `BASE_HOST` is the single point to update if it ever changes.
- **Let's Encrypt rate limits / issuance failures** on first remote boot → no TLS. Mitigation: verify 80/443 reachable in both OCI firewalls before first `up`; Caddy retries and can fall back to internal CA for smoke testing.
- **Removing host ports breaks any existing local workflow** that hit `localhost:4280` etc. Mitigation: documented BREAKING change; local access is now via the nip.io hostnames through the local edge proxy.
- **CORS relaxation** assumes all API traffic is same-origin. Mitigation: keep `CORS_ALLOWED_ORIGINS` configurable (empty default) so a future cross-origin client can re-enable it without code change.

## Migration Plan

1. **Host (runbook, out of repo):** reserve the public IP; open 80/443 in the OCI Security List/NSG **and** the instance OS firewall; leave 27017 closed; `docker network create edge`; bring up the shared Caddy edge stack importing `/etc/caddy/sites/*.caddy`.
2. **Repo:** land compose refactor (networks, `magnus-*` names, no ports, Mongo loopback), `deploy/magnus.caddy`, `BASE_HOST` in `.env`, relative `/api` in the three frontends, empty CORS default.
3. **Local verify:** `BASE_HOST=127.0.0.1.nip.io` behind a local edge proxy; smoke each hostname + `/api`.
4. **Deploy:** on the host, mount `deploy/magnus.caddy` into the edge `sites/` dir, set `BASE_HOST=158.180.46.246.nip.io`, `docker compose up -d`; confirm TLS issuance and each hostname.
5. **Rollback:** the edge stack and Magnus stack are independent — revert this repo's compose/frontend changes and, if needed, temporarily re-add host `ports:` for direct access; removing `deploy/magnus.caddy` from the edge `sites/` dir + reload cleanly detaches Magnus from the proxy.

## Open Questions

- **(Resolved)** API route base: no global prefix — `handle_path /api/*` (strip) is correct. See D3.
- One subtlety: `main.ts` sets `origin: origins.length > 0 ? origins : '*'` with `credentials: true`. Wildcard-plus-credentials is invalid for real cross-origin credentialed requests, but is inert here because all traffic is same-origin. No change strictly required, but consider defaulting empty origins to same-origin-only rather than `*` for defense in depth.
- **(Resolved)** pip-boy is publicly exposed at launch → `pipboy.{$BASE_HOST}` gets its own site block.
- **(Resolved)** Emulator public subdomain is `terminal.{$BASE_HOST}` (matches app folder and container `magnus-terminal`).
