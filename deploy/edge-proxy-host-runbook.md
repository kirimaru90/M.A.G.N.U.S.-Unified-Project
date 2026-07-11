# Edge Proxy — Host Runbook (Oracle Cloud)

> **Scope.** This is *host infrastructure*, shared across every project on the box —
> deliberately **not** part of the Magnus repo or its OpenSpec change. Set it up once
> per host. The Magnus repo only ships its own `deploy/magnus.caddy` snippet, which the
> edge proxy imports. Other projects do the same.
>
> Host: Oracle Cloud (OCI) · Public IP: `158.180.46.246` · Proxy: Caddy · No purchased domain (uses `nip.io`).

---

## 0. Mental model

```
        internet
           │  :80 / :443  (the ONLY public ports)
           ▼
   ┌───────────────┐   imports /etc/caddy/sites/*.caddy
   │  Caddy (edge) │◄──── magnus.caddy, projectB.caddy, ...
   └──┬────────────┘
      │  docker network "edge"  (external, shared)
      ▼
  magnus-cms  magnus-terminal  magnus-api   projectB-web ...
```

The edge proxy owns 80/443 and TLS. Every project attaches its containers to the shared
`edge` network and drops a `*.caddy` snippet into the proxy's `sites/` directory. No project
publishes host ports.

---

## 1. Reserve the public IP (do this first)

OCI instances get an **ephemeral** public IP by default, which can change on stop/start.
Because the IP is baked into every `nip.io` hostname *and* into issued TLS certificates,
a changed IP silently breaks all URLs and certs.

Console → **Instance → Attached VNICs → Primary VNIC → IPv4 Addresses → Edit the public IP →
change from *Ephemeral* to *Reserved*.** (Free while attached.) Confirm it stays `158.180.46.246`.

---

## 2. Open the firewall — BOTH layers

OCI has two independent firewalls. Traffic must pass **both**. Opening only the cloud one
(the common mistake) leaves the OS firewall silently dropping packets.

### 2a. Cloud firewall — VCN Security List / NSG

Console → **VCN → Security Lists (or the instance's NSG) → Add Ingress Rules:**

| Stateless | Source CIDR | IP Protocol | Dest. Port |
|-----------|-------------|-------------|------------|
| No        | `0.0.0.0/0` | TCP         | `80`       |
| No        | `0.0.0.0/0` | TCP         | `443`      |

**Do NOT** add a rule for `27017`. MongoDB stays off the internet.

### 2b. OS firewall — on the instance (the gotcha)

OCI Linux images ship with a locked-down firewall that blocks everything except SSH.
Run whichever matches your image.

**Ubuntu (iptables / netfilter-persistent):** there is a `REJECT all` rule near the end —
insert the new rules *above* it.

```bash
sudo iptables -L INPUT --line-numbers        # find the line number of the REJECT-all rule
# insert BEFORE that line (example assumes REJECT is at line 6):
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80  -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save               # persist across reboots
```

**Oracle Linux (firewalld):**

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

Verify from *outside* the host once the proxy is up (step 5):
`curl -I http://158.180.46.246` should connect (not hang).

---

## 3. Create the shared network

```bash
docker network create edge
```

Idempotent-ish: if it already exists you'll get an error you can ignore. Every project's
compose references this as `external: true`.

---

## 4. The edge stack

Keep this in its own directory on the host, e.g. `/opt/edge/`. It is project-agnostic.

**`/opt/edge/docker-compose.yml`**

```yaml
services:
  caddy:
    image: caddy:2-alpine
    container_name: edge-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./sites:/etc/caddy/sites:ro     # project snippets land here
      - caddy_data:/data                # issued certs — MUST persist
      - caddy_config:/config
    networks:
      - edge

networks:
  edge:
    external: true

volumes:
  caddy_data:
  caddy_config:
```

**`/opt/edge/Caddyfile`**

```caddy
{
    # Let's Encrypt account email (any address you control)
    email ai@3logic.it
}

# Every project drops a *.caddy snippet in here:
import /etc/caddy/sites/*.caddy
```

**`/opt/edge/sites/`** — the shared import directory. Magnus's snippet goes here (step 6).

Bring it up:

```bash
cd /opt/edge
docker compose up -d
docker compose logs -f caddy      # watch for cert issuance / errors
```

> `caddy_data` persistence is non-negotiable — it holds the TLS certs and the ACME account.
> Losing it means re-issuing certs on every restart and risking Let's Encrypt rate limits.

---

## 5. Wire in the Magnus project

On the host, from the Magnus repo:

1. Set `BASE_HOST=158.180.46.246.nip.io` in the repo's `.env`.
2. Bring up the Magnus stack (it attaches to the `edge` network, publishes no ports):
   ```bash
   docker compose up -d
   ```
3. Make Magnus's snippet visible to the edge proxy — symlink or copy it into the shared dir:
   ```bash
   ln -s /path/to/magnus/deploy/magnus.caddy /opt/edge/sites/magnus.caddy
   ```
   (`magnus.caddy` also references `{$BASE_HOST}`; set that same env for the edge container,
   or hard-code the hostnames in the copied snippet — decide per your preference.)
4. Reload the proxy to pick up the new snippet:
   ```bash
   cd /opt/edge && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
   ```

Caddy now requests Let's Encrypt certificates for `cms.158.180.46.246.nip.io`,
`terminal.158.180.46.246.nip.io`, and `pipboy.158.180.46.246.nip.io` on first request.

---

## 6. Verify

```bash
# from your laptop:
curl -I https://cms.158.180.46.246.nip.io/            # 200, valid TLS
curl -s https://cms.158.180.46.246.nip.io/api/…       # same-origin API path works
```

Open each hostname in a browser; confirm the app loads and API-backed actions succeed with
no CORS error in the console.

---

## 7. MongoDB debugging — SSH tunnel (never open 27017)

Mongo binds `127.0.0.1:27017` on the host, so it is reachable from the host itself but not
the internet. From your laptop:

```bash
ssh -L 27017:127.0.0.1:27017 opc@158.180.46.246
# leave that session open, then point Compass / mongosh at:
mongodb://localhost:27017
```

The traffic rides the encrypted SSH connection you already use to administer the box. No
firewall change, no public exposure, works with GUI tools.

---

## 8. Adding another project later

1. Give its containers `projectX-*` names and attach them to the `edge` network (no host ports).
2. Drop `projectX.caddy` into `/opt/edge/sites/`.
3. `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`.

The edge stack itself never changes.

---

## Rollback / teardown

- **Detach one project:** remove its snippet from `/opt/edge/sites/` and reload the proxy.
- **Bypass the proxy temporarily:** re-add host `ports:` to that project's compose for direct
  (or SSH-tunneled) access.
- **Remove the edge stack:** `cd /opt/edge && docker compose down`; `docker network rm edge`
  (only after all projects are detached).
