# Terminal Rework — Slice Checklist

Tracking document for the multi-phase rework of the Terminal client from a static-content single-file app into an API-backed client of the wider RobCo architecture (see [ARCHITECTURE.md](../ARCHITECTURE.md), [SERVER-DESIGN.md](../SERVER-DESIGN.md), and [reference/robco-terminal-architecture.md](../reference/robco-terminal-architecture.md)).

Each phase is independently shippable. Tick boxes as work lands. Each phase corresponds to one OpenSpec change in `openspec/changes/` — see [How to drive this with OpenSpec](#how-to-drive-this-with-openspec) at the end.

---

## Foundations (decided)

- [x] Stay **vanilla JS**, no framework. Split monolithic `index.html` into ES modules.
- [x] Build step **not required**; static-deployable; PWA preserved.
- [x] **CRT aesthetic preserved** across all new screens (campaign selection, real-user login).
- [x] **Italian** UI and content. No localization layer.
- [x] **Mutations behavior** follows the architecture doc verbatim for now (server-authoritative, refresh on rejection). Optimistic + LWW model to be revisited in a later change.
- [x] **API is live and evolving**; Terminal develops against the contract in `reference/Swagger API.html`.

---

## Capability map

How the phases relate to `openspec/specs/`. **NEW** = new capability spec; **UPDATE** = existing capability spec rewritten.

| Phase | New capabilities                          | Updated capabilities                       |
|-------|-------------------------------------------|--------------------------------------------|
| 0     | —                                         | — (pure refactor, no behavior change)      |
| 1     | `api-client`, `campaign-selection`        | `hidden-terminal-access` (server-mediated) |
| 2     | `state-store`, `conditional-variants`, `state-mutations` | `hidden-terminal-access` (endpoint rename + MetaDto reshape) |
| 3     | `input-components`                        | —                                          |
| 4     | `real-user-auth`                          | —                                          |
| 5     | —                                         | `login-access-control` (server-side)       |
| 6     | —                                         | `pwa-installability` (split cache policy)  |

Existing specs untouched by this rework: `fast-replay-typing`, `file-error-back-navigation`, `keyboard-navigation`, `scroll-and-shortcuts`, `terminal-exit`, `terminal-sound-effects`, `typing-animation-flow`. These describe engine behaviors that survive the rework.

---

## Phase 0 — Modularization

**Goal**: split `index.html` into ES modules. **Zero behavior change.** Pure refactor.

- [x] New layout: `index.html` (shell only), `src/main.js`, `src/api/`, `src/state/`, `src/engine/`, `src/screens/`.
- [x] Each existing engine subsystem (typewriter, sounds, keyboard nav, hidden-tape access, login screen, choice rendering, back history) extracted into its own module with explicit exports.
- [x] `<script type="module" src="src/main.js">` in `index.html`. No bundler.
- [x] Service worker (`sw.js`) updated to cache the new module files.
- [ ] All existing holotapes in `dati/` continue to play identically.
- [ ] All existing OpenSpec specs still describe observable behavior correctly.

**Done when**: every current spec's manual scenarios pass against the modularized client with no diff in user-visible behavior.

**Risk**: regressions in subtle engine timing (typewriter cadence, sound triggers, focus). Mitigation: keep the existing `dati/*.json` set as a regression harness.

---

## Phase 1 — API client + campaign selection

**Goal**: replace the `dati/manifest.json` flow with a real API-backed campaign + terminal listing. Anonymous-friendly (no auth yet).

- [ ] `src/api/client.js`: fetch wrapper, base URL config, JSON serialization, error normalization, 401/403 surfacing.
- [ ] `src/screens/campaign-select.js`: new screen, CRT aesthetic. Renders `GET /campaigns` (anonymous = public only).
- [ ] Single-campaign auto-enter; multi-campaign chooser; empty-state message.
- [ ] Within a campaign: `GET /campaigns/:id/terminals` lists terminals. Replaces `manifest.json`.
- [ ] Terminal load: `GET /terminals/:id/load` instead of static file fetch. Content shape unchanged for old holotapes (no `state`, no `variants`, no `components`).
- [ ] Hidden terminal access: ID lookup validated server-side via `GET /terminals/:id/load` (404 on miss; client never holds hidden metadata).
- [ ] New OpenSpec specs: `api-client`, `campaign-selection`.
- [ ] Updated OpenSpec spec: `hidden-terminal-access`.

**Done when**: a fresh client with no `dati/` directory can list and play all currently-existing holotapes by hitting the API.

**Risk**: API contract drift during ongoing server development. Mitigation: pin to a Swagger version and surface clear errors when the server returns an unexpected shape.

---

## Phase 2 — State engine + variants + on_enter + choice.set

**Goal**: the terminal becomes state-aware. Conditional content, mutations on node entry, mutations on choice selection.

- [x] `src/state/store.js`: in-memory snapshot of `{ local, global }` for the active terminal session.
- [x] `src/state/conditions.js`: evaluator for the structured condition grammar (`and`, `or`, `not`, leaf predicates `eq`/`neq`/`gt`/`gte`/`lt`/`lte`/`in`).
- [x] `src/engine/node-resolver.js`: picks the first matching variant (or `default`), emits `on_enter` mutations, applies `choice.set` mutations on selection.
- [x] Mutation request: `POST /terminals/:id/state/mutate` and `POST /campaigns/:id/state/mutate` per scope.
- [x] Multi-mutation requests are atomic per the architecture doc.
- [x] Server rejection of a mutation triggers a state refetch and re-render of the current node (per doc).
- [x] Old holotapes (no `state` block) play with an empty snapshot; no API state calls for them.
- [x] New OpenSpec specs: `state-store`, `conditional-variants`, `state-mutations`.

**Done when**: a test holotape exercising local + global state, variants, `on_enter`, and `choice.set` plays correctly and the mutations are observable in the API.

**Risk**: the variant-vs-`on_enter` render-order question. Per agreement: evaluate variants from current snapshot first, render, then send mutations. Document this in the spec so it's not relitigated later.

---

## Phase 3 — Input components

**Goal**: typed-input nodes that write to state and branch based on the value.

- [x] `src/engine/components/input.js`: input component renderer; submits value → state mutation → branch evaluation.
- [x] Branches evaluated in declaration order; `default: true` is the fallback.
- [x] CRT-styled input field consistent with existing fictional-login input.
- [x] New OpenSpec spec: `input-components`.

**Done when**: a holotape with a code-entry node (e.g. the `58874645` puzzle from `super_duper_admin.json`) works using an input component rather than fictional-login.

---

## Phase 4 — Real-user auth (player login from campaign selection)

**Goal**: optional real-user login surfaced from the campaign selection screen. Reveals assigned campaigns alongside public ones.

- [ ] `src/api/session.js`: real-user session token, persisted appropriately (in-memory or cookie per server's chosen mechanism).
- [ ] `src/screens/login-real.js`: CRT-styled login screen, accessed via `[ Accedi ]` on campaign selection.
- [ ] On success: `GET /auth/me` + refresh campaign list (public + assigned).
- [ ] On failure: clear error inline; remain on selection screen.
- [ ] `[ Esci ]` action: logout, return to anonymous selection state.
- [ ] New OpenSpec spec: `real-user-auth`.

**Done when**: an authenticated player sees their assigned campaigns; logout cleanly returns to public-only view.

---

## Phase 5 — Server-side fictional login

**Goal**: replace the current in-JS password compare with `POST /terminals/:id/fictional-login`. Fictional credentials never leave the server.

- [ ] Existing login screen (`#login-screen`) submits to the API instead of comparing in JS.
- [ ] On success: server returns access to gated content (or a session-scoped token authorizing it).
- [ ] In-session memory of fictional-user authentications (not persisted across reloads).
- [ ] Removal of fictional credentials from any client-bound payload.
- [ ] Updated OpenSpec spec: `login-access-control`.

**Done when**: no holotape JSON delivered to the client contains a `login.users[].password` field, and gated content unlocks only after a successful server validation.

**Risk**: feature regression in the login UX (timing, error messages, retry behavior). Mitigation: scenario-by-scenario comparison against the existing spec.

---

## Phase 6 — Service worker cache policy split

**Goal**: cache policy distinguishes public (cacheable) from authenticated-only (never cached) content. Shell remains installable offline.

- [ ] App shell (HTML, JS modules, CSS, sounds, icons) cached for offline boot.
- [ ] Public campaign content cacheable with a short TTL or stale-while-revalidate.
- [ ] Authenticated-only responses (assigned campaigns, gated terminal payloads, state) never cached.
- [ ] Fictional-login responses never cached.
- [ ] Logout flushes any sensitive caches.
- [ ] Updated OpenSpec spec: `pwa-installability`.

**Done when**: an installed PWA can boot offline to the shell; a logged-out user cannot retrieve previously-fetched assigned-campaign content from cache.

---

## Cross-cutting cleanup (after phases land)

- [x] Delete `dati/` directory (legacy static holotapes).
- [x] Delete the old `index.html` inline engine code (already empty after Phase 0, but verify).
- [x] Update `guida terminale.md` to reflect API-backed flow if it references static-file behavior.
- [x] Archive any specs that no longer reflect implemented behavior.

---

## Decisions log

| Date       | Decision                                                              | Rationale                                                       |
|------------|-----------------------------------------------------------------------|-----------------------------------------------------------------|
| 2026-05-16 | No framework. ES modules only.                                        | App has no reactive component tree; framework overhead unjustified. |
| 2026-05-16 | Mutation model: server-authoritative, refresh on rejection.           | Match architecture doc verbatim for now; revisit later.         |
| 2026-05-16 | Phase 0 is a pure refactor — no behavior change shipped with it.      | Keeps the migration reviewable; later phases land on clean ground. |
| 2026-05-16 | Greenfield-style port (Option β from explore): no parallel terminal.  | Phase 0 modularization is in-place, not a parallel rewrite.     |

---

## How to drive this with OpenSpec

This file is a **roadmap**, not a spec. Each phase becomes its own OpenSpec change when it's ready to be detailed and worked on. Suggested cadence:

1. **Pick the next phase from this checklist.**
2. **Run `/opsx:propose`** (or `/openspec-propose`) describing that phase's scope. The proposal lives at `openspec/changes/<phase-name>/`. Use the phase section above as the seed.
3. **Implement** via `/opsx:apply` against that change's `tasks.md`.
4. **Archive** via `/opsx:archive` when done. Tick the phase's checkbox here.
5. **Move to the next phase.**

Naming convention for the changes: `phase-N-<short-name>`, e.g. `phase-0-modularize`, `phase-1-api-client-campaigns`, `phase-2-state-engine`. The number prefix makes the archive folder readable later.

Don't open more than one phase as an active change at a time. The whole point of slicing is one-at-a-time delivery.
