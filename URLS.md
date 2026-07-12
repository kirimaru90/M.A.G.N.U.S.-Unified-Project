# Magnus — Navigation URLs

Quick reference for reaching each app locally and in production.

All apps are served through a **shared Caddy edge proxy** (see [`deploy/README.md`](deploy/README.md)).
Hostnames are wildcard `nip.io` names, so `<anything>.<IP>.nip.io` resolves straight to that IP
with no DNS or `/etc/hosts` setup. The only per-environment difference is `BASE_HOST`.

Each frontend calls the API at the relative path **`/api`** on its own origin (same-origin, no CORS).

## Local — `BASE_HOST=127.0.0.1.nip.io`

| App      | URL                                  |
|----------|--------------------------------------|
| CMS      | https://cms.127.0.0.1.nip.io/        |
| Terminal | https://terminal.127.0.0.1.nip.io/   |
| Pip-Boy  | https://pipboy.127.0.0.1.nip.io/     |
| API      | `/api` on any hostname above (e.g. https://cms.127.0.0.1.nip.io/api) |
| MongoDB  | `mongodb://localhost:27017` (loopback only) |

> Local TLS uses Caddy's internal CA (`local_certs`), so browsers show
> `ERR_CERT_AUTHORITY_INVALID` until you trust its root CA. Either type `thisisunsafe`
> on the Chrome warning page, or import the root:
> `docker cp edge-caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-local-root.crt`
> then add it to your trusted roots.

## Remote — `BASE_HOST=158.180.46.246.nip.io`

Host: Oracle Cloud (OCI) · Public IP `158.180.46.246` · TLS via Let's Encrypt.

| App      | URL                                       |
|----------|-------------------------------------------|
| CMS      | https://cms.158.180.46.246.nip.io/        |
| Terminal | https://terminal.158.180.46.246.nip.io/   |
| Pip-Boy  | https://pipboy.158.180.46.246.nip.io/     |
| API      | `/api` on any hostname above              |
| MongoDB  | `127.0.0.1:27017` on the host — reach via SSH tunnel: `ssh -L 27017:127.0.0.1:27017 ubuntu@158.180.46.246`, then connect to `mongodb://localhost:27017` |

## Routing

Host → container mapping is defined in [`deploy/magnus.caddy`](deploy/magnus.caddy):

- `/`      → the app's static container (`magnus-cms` / `magnus-terminal` / `magnus-pipboy`)
- `/api/*` → `magnus-api:3000` (the `/api` prefix is stripped before forwarding)

## Related docs

- [`deploy/README.md`](deploy/README.md) — deploy topology & `BASE_HOST` switch
- [`deploy/edge-proxy-host-runbook.md`](deploy/edge-proxy-host-runbook.md) — one-time host proxy setup
- [`deploy/magnus.caddy`](deploy/magnus.caddy) — the routing snippet
