# deploy-reverse-proxy Specification

## Purpose

The Magnus compose stack SHALL be deployed behind a shared host-level Caddy edge proxy so that no application container publishes ports to the host, every frontend is served same-origin with its API under `/api`, MongoDB stays isolated to loopback, and local and remote environments run the identical topology differing only by a single `BASE_HOST` variable.

## Requirements

### Requirement: No container publishes ports to the host

The Magnus compose stack SHALL NOT publish any application container port to the host via `ports:`. All inbound traffic SHALL arrive through the shared host-level edge proxy over the external `edge` network. The only exception SHALL be the MongoDB container, which MAY bind exclusively to loopback (`127.0.0.1`) for host-local debugging access (see the MongoDB isolation requirement).

#### Scenario: No application ports are published

- **WHEN** the stack is running via `docker compose up`
- **THEN** `docker compose ps` shows no host-published port for `magnus-api`, `magnus-cms`, `magnus-terminal`, or `magnus-pipboy`
- **AND** none of those services is reachable at `http://localhost:<port>` on the host

#### Scenario: Only loopback MongoDB is bound

- **WHEN** the stack is running
- **THEN** the only host port binding is MongoDB on `127.0.0.1:27017`
- **AND** that binding is not reachable from any non-loopback interface

### Requirement: Containers join the shared external edge network

The frontend containers (`magnus-cms`, `magnus-terminal`, `magnus-pipboy`) and the API container (`magnus-api`) SHALL attach to a Docker network named `edge` declared as `external: true`, which is created and owned outside this repository by the host edge proxy. Containers SHALL use project-prefixed names (`magnus-*`) so they do not collide with other projects sharing the same network. MongoDB SHALL NOT be attached to the `edge` network.

#### Scenario: Proxy reaches services by name over the edge network

- **GIVEN** a Caddy edge proxy attached to the external `edge` network
- **WHEN** the proxy forwards a request to `magnus-api:3000` or `magnus-cms:80`
- **THEN** the request resolves to the corresponding container over the `edge` network

#### Scenario: MongoDB is absent from the edge network

- **WHEN** the stack is running
- **THEN** `magnus-mongo` is connected only to the private `internal` network
- **AND** `magnus-mongo` is not reachable from any container that is only on the `edge` network

### Requirement: Same-origin `/api` proxying without CORS

Each frontend hostname SHALL be served by a repo-owned Caddy site snippet that serves the static app at `/` and reverse-proxies `/api/*` on the **same hostname** to `magnus-api:3000`. Because the browser reaches the API on the same origin as the app, the deployment SHALL NOT depend on cross-origin CORS allow-listing; `CORS_ALLOWED_ORIGINS` SHALL default to empty and the API SHALL boot and serve same-origin requests with it empty.

#### Scenario: App and API share one origin

- **WHEN** a browser loads `https://cms.<BASE_HOST>/` and the app calls `GET /api/campaigns`
- **THEN** the request is issued to `https://cms.<BASE_HOST>/api/campaigns` (same origin as the page)
- **AND** Caddy forwards it to `magnus-api:3000`
- **AND** the response succeeds without any `Access-Control-Allow-Origin` negotiation

#### Scenario: API boots with an empty CORS allow-list

- **WHEN** the API starts with `CORS_ALLOWED_ORIGINS` unset or empty
- **THEN** the API boots successfully
- **AND** same-origin requests proxied through Caddy succeed

### Requirement: Frontends target a relative API base

Every frontend SHALL address the API using the relative path `/api` rather than an absolute origin. The emulator (`apps/terminal`) and pip-boy (`apps/pip-boy`) source API-base constants SHALL be `/api`; the CMS (`apps/cms`) SHALL be built with `API_BASE_URL=/api`. No frontend SHALL hard-code `http://localhost:3000` or any host-specific API origin.

#### Scenario: Emulator issues relative API requests

- **WHEN** the emulator served through the proxy performs an API-backed action
- **THEN** the resulting network request targets a path beginning with `/api/`
- **AND** no request targets an absolute `http://localhost:3000` origin

#### Scenario: CMS build bakes the relative base

- **WHEN** the CMS image is built with `API_BASE_URL=/api`
- **THEN** the built `environment.ts` `apiBaseUrl` equals `/api`

### Requirement: MongoDB isolation with SSH-tunnel debug access

MongoDB SHALL be reachable only from within the host and never exposed to the public internet. It SHALL bind to `127.0.0.1:27017` on the host so that operators with SSH access can reach it through a tunnel, and the deploy documentation SHALL describe the tunnel workflow. The OCI firewall SHALL NOT open port 27017.

#### Scenario: External clients cannot reach MongoDB

- **WHEN** a client connects to `27017` on the host's public IP `158.180.46.246`
- **THEN** the connection is refused or times out (no route from the internet)

#### Scenario: Operator debugs via SSH tunnel

- **GIVEN** an operator with SSH access to the host
- **WHEN** they run `ssh -L 27017:127.0.0.1:27017 opc@158.180.46.246` and connect a client to `localhost:27017`
- **THEN** the client reaches the MongoDB instance through the tunnel

### Requirement: Local and remote parity via BASE_HOST

The deployment SHALL run the identical Caddy snippet and compose topology locally and on the remote host, differing only by a single `BASE_HOST` variable that supplies the nip.io hostname suffix. Local development SHALL use `BASE_HOST=127.0.0.1.nip.io` (resolving to loopback on any OS); the remote host SHALL use `BASE_HOST=158.180.46.246.nip.io`. TLS SHALL be automatic in both environments — Caddy's internal CA (or plain HTTP) locally and Let's Encrypt on the public nip.io hostnames remotely.

#### Scenario: Local stack serves the same config

- **WHEN** the stack is brought up locally with `BASE_HOST=127.0.0.1.nip.io` behind a local edge proxy
- **THEN** `cms.127.0.0.1.nip.io`, `terminal.127.0.0.1.nip.io`, and `pipboy.127.0.0.1.nip.io` each serve their app
- **AND** `/api/*` on each hostname reaches `magnus-api`

#### Scenario: Remote stack differs only by BASE_HOST

- **WHEN** the stack is deployed with `BASE_HOST=158.180.46.246.nip.io`
- **THEN** the same snippet serves `cms.158.180.46.246.nip.io` (and the terminal/pipboy hostnames) with Let's Encrypt TLS
- **AND** no snippet or compose change other than `BASE_HOST` is required between environments
</content>
</invoke>
