# Magnus deploy

Magnus is served to the network through a **shared, host-level Caddy edge proxy** that
lives outside this repo (one proxy for many projects). This repo only ships its own routing
snippet, [`magnus.caddy`](./magnus.caddy); the edge proxy imports it. Host-level setup of the
proxy itself is in [`edge-proxy-host-runbook.md`](./edge-proxy-host-runbook.md).

## Topology

```
        internet  :80 / :443
             │
     ┌───────▼───────┐   import /etc/caddy/sites/*.caddy
     │  Caddy (edge) │◄──── deploy/magnus.caddy
     └───────┬───────┘
             │  docker network "edge" (external, shared)
   ┌─────────┼──────────┬───────────────┐
magnus-cms  magnus-terminal  magnus-pipboy  magnus-api
                                              │  network "internal" (private)
                                          magnus-mongo  (127.0.0.1:27017 on host only)
```

No Magnus container publishes an application port. All inbound traffic arrives through the
edge proxy over the external `edge` network. MongoDB binds to loopback only.

## Wiring the snippet into the edge proxy

The edge Caddyfile must contain (once, set up per host):

```caddy
import /etc/caddy/sites/*.caddy
```

Make `magnus.caddy` visible in that directory — symlink (recommended) or copy:

```bash
ln -s /path/to/magnus/deploy/magnus.caddy /opt/edge/sites/magnus.caddy
cd /opt/edge && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

`magnus.caddy` references `{$BASE_HOST}`, so the **edge** container needs `BASE_HOST` set in
its environment too (or hard-code the hostnames in the copied snippet).

## `BASE_HOST` — the only per-environment difference

| Environment | `BASE_HOST`                | Resolves to | TLS                     |
|-------------|----------------------------|-------------|-------------------------|
| Local       | `127.0.0.1.nip.io`         | loopback    | Caddy internal CA / HTTP |
| Remote      | `158.180.46.246.nip.io`    | OCI host    | Let's Encrypt            |

Set it in this repo's root `.env`. The hostnames become `cms.<BASE_HOST>`,
`terminal.<BASE_HOST>`, and `pipboy.<BASE_HOST>`.

## Bringing up Magnus

```bash
docker network create edge      # once, if the edge network does not exist yet
docker compose up -d            # attaches to `edge`, publishes no app ports
```

Then verify each hostname serves its app and `/api/*` reaches the API with no CORS error.
The [`smoke.sh`](./smoke.sh) script automates that check:

```bash
BASE_HOST=127.0.0.1.nip.io ./deploy/smoke.sh       # local (internal-CA TLS)
BASE_HOST=158.180.46.246.nip.io ./deploy/smoke.sh  # remote (Let's Encrypt)
```

For a **local** edge proxy, run any Caddy container on the `edge` network that imports
`deploy/magnus.caddy` with `BASE_HOST` set. A minimal global block issuing self-signed
certs (`{ local_certs }`) lets the exact production snippet run unchanged over HTTPS; the
production edge uses automatic Let's Encrypt instead.

## MongoDB debugging — SSH tunnel (never open 27017)

MongoDB binds `127.0.0.1:27017` on the host, so it is reachable from the host itself but not
from the internet. The OCI firewall does **not** open 27017.

- **Local:** connect a client directly to `mongodb://localhost:27017`.
- **Remote:** open a tunnel, then point the client at your local loopback:

  ```bash
  ssh -L 27017:127.0.0.1:27017 opc@158.180.46.246
  # leave the session open, then connect Compass / mongosh to:
  mongodb://localhost:27017
  ```

  The traffic rides the encrypted SSH connection — no firewall change, no public exposure.

## ⚠️ BREAKING change

Direct `http://localhost:<port>` access is **gone**. Services no longer publish host ports
(previously `3000`, `4280`, `8080`, `8081`). Reach the apps through the nip.io hostnames via
the edge proxy instead:

| Old (removed)            | New                                     |
|--------------------------|-----------------------------------------|
| `http://localhost:4280`  | `https://cms.<BASE_HOST>/`              |
| `http://localhost:8080`  | `https://terminal.<BASE_HOST>/`         |
| `http://localhost:8081`  | `https://pipboy.<BASE_HOST>/`           |
| `http://localhost:3000`  | `/api` on any of the above hostnames    |
| `localhost:27017` (open) | `127.0.0.1:27017` (loopback / SSH tunnel) |

Frontends now call the API at the relative path `/api` (same origin), so no absolute API
origin is baked into any bundle.
