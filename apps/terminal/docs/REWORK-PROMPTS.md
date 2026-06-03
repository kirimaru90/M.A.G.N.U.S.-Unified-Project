# Terminal Rework — Propose Prompts

One prompt per phase, ready to feed to `/opsx:propose` (or `/openspec-propose`). Copy the block for the phase you're starting and paste it as the argument. Each prompt is self-contained and references [REWORK.md](REWORK.md), the architecture docs, and the API contract.

**Usage rule**: only run one phase's propose at a time. Finish, apply, archive — then move to the next.

---

## Phase 0 — Modularize

```
Create change phase-0-modularize.

Split the monolithic index.html (currently 738 lines, all engine logic inline)
into ES modules under a new src/ directory. This is a pure refactor — zero
observable behavior change. Every existing holotape in dati/ must continue to
play identically.

Target layout:
  index.html              (shell only: DOM scaffolding, CSS, <script type="module">)
  src/main.js             (bootstrap, screen router)
  src/api/                (placeholder — populated in later phases)
  src/state/              (placeholder — populated in later phases)
  src/engine/             (typewriter, sounds, keyboard nav, hidden-tape access,
                           login screen, choice rendering, back history)
  src/screens/            (boot, current holotape view)

Constraints:
- Use native browser ES modules via <script type="module">. No bundler, no
  build step. Static-deployable as today.
- Update sw.js to cache the new module files so PWA install still works.
- No new capability specs. No updates to existing capability specs — every
  spec in openspec/specs/ should still accurately describe observable behavior
  after the refactor.
- Italian UI, CRT aesthetic, all existing engine behaviors unchanged.

See openspec/REWORK.md Phase 0 for full scope and done-when criteria.
```

---

## Phase 1 — API client + campaign selection

```
Create change phase-1-api-client-campaigns.

Replace the dati/manifest.json + static-file loading flow with an API-backed
content pipeline. Anonymous-only in this phase — no real-user authentication
yet (that's Phase 4). Only public campaigns are visible.

Scope:
- New module src/api/client.js: fetch wrapper, base URL config, JSON
  serialization, error normalization, surfacing of 401/403 responses.
- New screen src/screens/campaign-select.js (CRT aesthetic) that lists
  campaigns from GET /campaigns. Behavior:
    - zero campaigns → "Nessuna campagna disponibile" state
    - one campaign  → auto-enter
    - many          → selection screen
- Inside a campaign: terminals listed via GET /campaigns/:id/terminals
  (replaces the old manifest.json shape).
- Terminal loading: GET /terminals/:id/load (replaces fetch of dati/<file>.json).
- Hidden terminal access (by ID lookup) becomes server-mediated via the load
  endpoint — 404 on miss; the client never holds hidden terminal metadata
  until it has a valid ID.

New capability specs: api-client, campaign-selection.
Updated capability spec: hidden-terminal-access (now server-mediated).

Constraints:
- Old holotape JSON shape (no state, no variants, no components) must keep
  playing — the load endpoint is expected to return whatever shape the API
  produces; the client tolerates the legacy minimal shape.
- CRT aesthetic on the new campaign selection screen.
- No state engine yet — terminal playback works exactly like today once the
  content is fetched.

See openspec/REWORK.md Phase 1 and reference/Swagger API.html for the
endpoint contracts.
```

---

## Phase 2 — State engine + variants + on_enter + choice.set

```
Create change phase-2-state-engine.

Make the terminal state-aware. Add the state subsystem and extend the node
engine to honor conditional variants, on_enter mutations, and choice.set
mutations.

Scope:
- New module src/state/store.js: in-memory snapshot of { local, global } for
  the active terminal session. Refresh-from-server semantics. No persistence
  across reloads.
- New module src/state/conditions.js: evaluator for the structured condition
  grammar — combinators and / or / not, leaf predicates eq, neq, gt, gte,
  lt, lte, in. Arbitrary nesting allowed.
- New module src/engine/node-resolver.js: pick the first matching variant
  (or the default), emit on_enter mutations, apply choice.set mutations on
  choice selection.
- State mutations sent via POST /terminals/:id/state/mutate and
  POST /campaigns/:id/state/mutate. Multi-mutation requests are atomic
  (one transaction per request).

Decisions to bake into the spec:
- Render order: evaluate variants against the current snapshot first, render,
  then send on_enter mutations. (Variant rendering is not blocked on the
  mutation roundtrip.)
- Mutation model follows the architecture doc verbatim: server-authoritative,
  if the server rejects a mutation the client refetches state and re-renders.
  (Optimistic + LWW is deferred to a future change.)
- Old holotapes with no state block play with an empty snapshot and make no
  state API calls.

New capability specs: state-store, conditional-variants, state-mutations.

See openspec/REWORK.md Phase 2 and ARCHITECTURE.md sections 8.5 (mutations)
and 8.6 (conditions).
```

---

## Phase 3 — Input components

```
Create change phase-3-input-components.

Add support for input-component nodes: a typed text input rendered inside a
node, whose submitted value is written into a declared state variable, then
routed to a target node via branch evaluation.

Scope:
- New module src/engine/components/input.js implementing the input component.
- Component declaration: type "input", placeholder text, target state variable
  (scope-qualified, e.g. local.entered_code), ordered branches list.
- On submit: write the value into the declared state variable via a state
  mutation, then evaluate branches in declaration order against the updated
  state. The first matching branch determines the target node; a branch with
  default: true acts as the fallback.
- CRT-styled input field, visually consistent with the existing
  fictional-login input.

New capability spec: input-components.

See openspec/REWORK.md Phase 3 and ARCHITECTURE.md section 8.4.
```

---

## Phase 4 — Real-user auth (player login)

```
Create change phase-4-real-user-auth.

Add optional real-user (player) login surfaced from the campaign selection
screen. Anonymous flow continues to work; login is additive.

Scope:
- New module src/api/session.js managing the real-user session token per the
  server's chosen mechanism (cookie or bearer header — match what the API
  returns).
- New screen src/screens/login-real.js in CRT aesthetic, reached via an
  [ Accedi ] action on the campaign selection screen.
- On successful login: GET /auth/me + refresh campaign list — the player
  now sees public campaigns plus their assigned active campaigns.
- On failed login: clear inline error; user remains on the campaign selection
  screen; public campaigns remain visible.
- New [ Esci ] action to log out, returning to the anonymous campaign
  selection view.

Endpoints: POST /auth/login, POST /auth/logout, GET /auth/me.

New capability spec: real-user-auth.

Constraints:
- Login is optional — anonymous users keep seeing public campaigns.
- Session state is in-memory or relies on the server-set cookie; no
  client-side persistence beyond what the API mandates.
- CRT aesthetic; the login screen feels like a terminal sub-screen, not a
  modal overlay.

See openspec/REWORK.md Phase 4.
```

---

## Phase 5 — Server-side fictional login

```
Create change phase-5-server-side-fictional-login.

Move fictional-user login validation from in-browser JS comparison to a
server call. Fictional credentials must never appear in any client-bound
payload.

Scope:
- The existing fictional-login screen (#login-screen) UI is preserved but
  its submission handler now calls POST /terminals/:id/fictional-login
  instead of comparing locally.
- On success: the server returns access to the gated content (or a
  session-scoped authorization that unlocks subsequent reads of gated nodes
  for that fictional user within the same session).
- On failure: clear error; user remains on the login screen.
- In-session memory of fictional-user authentications: kept in memory only,
  not persisted across reloads.
- All terminal content delivered to the client must have fictional user
  password fields stripped. Confirm via the load endpoint contract.

Updated capability spec: login-access-control (rewritten — was client-side
comparison; now server-mediated).

Risks:
- UX regressions in timing, error messaging, retry behavior. Scenario-by-
  scenario comparison against the existing spec is part of done-when.

See openspec/REWORK.md Phase 5.
```

---

## Phase 6 — Service worker cache policy split

```
Create change phase-6-sw-cache-policy.

Update sw.js so that cache policy distinguishes public content (cacheable)
from authenticated-only content (never cached). The app shell remains
installable and offline-bootable.

Scope:
- App shell (index.html, JS modules under src/, CSS, sounds, icons,
  manifest.webmanifest) cached for offline boot.
- Public campaign content (campaign metadata, terminal content for public
  campaigns) cacheable with a short TTL or stale-while-revalidate.
- Authenticated-only responses are never cached: assigned campaigns,
  gated/private terminal payloads, all state reads and mutations, all
  fictional-login responses, /auth/me responses tied to a session.
- Logout flushes any caches that could leak authenticated-only content.

Updated capability spec: pwa-installability (cache policy now distinguishes
anonymous vs authenticated).

Done-when:
- An installed PWA boots offline to the shell and reaches the campaign
  selection screen.
- A logged-out user cannot retrieve previously-fetched assigned-campaign
  content from cache.

See openspec/REWORK.md Phase 6.
```

---

## After Phase 6 — Cleanup

When all six phases are archived, the cross-cutting cleanup from
[REWORK.md](REWORK.md) gets its own small change:

```
Create change phase-7-cleanup.

Final cleanup after the rework:
- Delete the dati/ directory (legacy static holotapes — superseded by API).
- Remove any residual inline engine code from index.html (should be empty
  after Phase 0; verify).
- Update guida terminale.md to describe the API-backed flow if it still
  references static-file behavior.
- Archive any capability specs in openspec/specs/ that no longer reflect
  implemented behavior.

No capability spec changes (this is cleanup, not new behavior).

See openspec/REWORK.md cross-cutting cleanup section.
```
