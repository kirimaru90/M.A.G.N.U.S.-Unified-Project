# Design — unify-openspec-monorepo

## Context

Three apps, one domain, three `openspec/` folders. Goal: one root `openspec/` as the
single source of truth, code repos untouched. No exact capability-name collisions exist
across apps, and no archived-change-name collisions exist across apps (both verified
2026-06-03), so the merge is mechanical and lossless.

## Decisions

### D1 — Flat namespace with app prefixes (not domain-regroup)
OpenSpec capabilities are flat top-level folders with no sub-namespacing. To keep
provenance in a flat namespace we prefix every capability by its owning app:
`api-`, `cms-`, `emulator-`. We deliberately do **not** merge the three angles of a shared
concept (e.g. api `terminals` + cms `terminals-crud` + emulator terminal-render specs)
into one domain capability in this change — that is a semantic rewrite that risks dropping
requirements. It is left to follow-up change proposals that can be reviewed and diffed.

### D2 — Player app prefix is `emulator-`, not `terminal-`
The player app lives in `apps/terminal`, but "terminal" is also the core domain noun (the
in-fiction terminals the API serves and the CMS edits). Prefixing with `terminal-` would
produce names like `terminal-terminal-sound-effects` and re-create the ambiguity we are
removing. Chosen prefix: `emulator-`.

### D3 — Archives keep original names, internals untouched
Archived change folders move verbatim into root `changes/archive/`; their internal
`specs/<cap>/spec.md` deltas keep referencing the old unprefixed capability names. They are
frozen history; OpenSpec does not re-validate archives against live specs. No prefix is
applied (no collisions), yielding a single chronologically-interleaved product history.

### D4b — Move mechanics: plain `mv`, full delete of per-app folders
The repo has no commits yet (entire tree untracked), so `git mv` is moot — plain `mv` is
used and the first commit captures the unified layout. The 53 spec renames and 47 archive
moves are scripted (deterministic targets); only `add-character-module` and the config merge
are done by hand. Per-app `openspec/` folders are **fully deleted**, never left as stubs: an
empty `openspec/` is a discovery trap for the CLI. Human/agent signposting goes in each app's
`README.md` instead.

### D4 — Global config, rules scoped by convention
OpenSpec `rules` are global to the folder. The terminal app's rich `rules` (vanilla JS, no
build step, Italian content, Fallout lore, browser-verifiable tasks) are folded into the
root config and reworded to apply "for `emulator-*` specs". This is the one real capability
lost versus three separate folders.

## Rename map — live specs (53)

### api → `api-*` (6)
| from | to |
|---|---|
| auth | api-auth |
| campaigns | api-campaigns |
| configuration | api-configuration |
| state-engine | api-state-engine |
| terminals | api-terminals |
| users | api-users |

### cms → `cms-*` (24)
| from | to |
|---|---|
| api-client-codegen | cms-api-client-codegen |
| app-bootstrap | cms-app-bootstrap |
| app-shell | cms-app-shell |
| auth-session | cms-auth-session |
| campaign-player-assignments | cms-campaign-player-assignments |
| campaign-workspace-switcher | cms-campaign-workspace-switcher |
| campaigns-crud | cms-campaigns-crud |
| campaigns-msw-handlers | cms-campaigns-msw-handlers |
| current-campaign-service | cms-current-campaign-service |
| dev-mock-layer | cms-dev-mock-layer |
| global-schema-management | cms-global-schema-management |
| state-msw-handlers | cms-state-msw-handlers |
| state-reset-operations | cms-state-reset-operations |
| state-viewer-editor | cms-state-viewer-editor |
| terminal-content-schema | cms-terminal-content-schema |
| terminal-editor-shell | cms-terminal-editor-shell |
| terminal-metadata-state-users-editor | cms-terminal-metadata-state-users-editor |
| terminal-nodes-editor | cms-terminal-nodes-editor |
| terminal-recursive-editors | cms-terminal-recursive-editors |
| terminals-crud | cms-terminals-crud |
| terminals-import-export | cms-terminals-import-export |
| terminals-msw-handlers | cms-terminals-msw-handlers |
| users-crud | cms-users-crud |
| users-msw-handlers | cms-users-msw-handlers |

### terminal → `emulator-*` (23)
| from | to |
|---|---|
| api-client | emulator-api-client |
| campaign-selection | emulator-campaign-selection |
| conditional-variants | emulator-conditional-variants |
| crt-font-config | emulator-crt-font-config |
| crt-phosphor-wave | emulator-crt-phosphor-wave |
| crt-visual-effects | emulator-crt-visual-effects |
| fast-replay-typing | emulator-fast-replay-typing |
| hidden-terminal-access | emulator-hidden-terminal-access |
| hidden-terminal-autocomplete | emulator-hidden-terminal-autocomplete |
| input-components | emulator-input-components |
| keyboard-navigation | emulator-keyboard-navigation |
| login-access-control | emulator-login-access-control |
| per-variant-components | emulator-per-variant-components |
| pwa-installability | emulator-pwa-installability |
| real-user-auth | emulator-real-user-auth |
| scroll-and-shortcuts | emulator-scroll-and-shortcuts |
| session-landing | emulator-session-landing |
| state-mutations | emulator-state-mutations |
| state-store | emulator-state-store |
| terminal-configuration | emulator-terminal-configuration |
| terminal-exit | emulator-terminal-exit |
| terminal-sound-effects | emulator-terminal-sound-effects |
| typing-animation-flow | emulator-typing-animation-flow |

## Active change relocation — `add-character-module`

Moves `apps/api/openspec/changes/add-character-module/` → `openspec/changes/`. Rename the
four delta spec folders and update the capability names referenced in `proposal.md`:

| from | to |
|---|---|
| specs/characters | specs/api-characters |
| specs/character-stats | specs/api-character-stats |
| specs/character-inventory | specs/api-character-inventory |
| specs/character-resources | specs/api-character-resources |

Keep `design.md`, `tasks.md`, and `.openspec.yaml` as-is.

## Archive merge (47, names unchanged)

- `apps/api/.../archive/*` (9) → `openspec/changes/archive/`
- `apps/cms/.../archive/*` (16) → `openspec/changes/archive/`
- `apps/terminal/.../archive/*` (22) → `openspec/changes/archive/`

Move folders verbatim. Do not edit any file inside an archived change.

## config.yaml merge (sketch)

```yaml
schema: spec-driven

context: |
  Monorepo "Unified MAGNUS": one product, three separately-deployed apps under apps/.
  Capabilities are prefixed by owning app: api-* (NestJS backend), cms-* (backoffice
  authoring SPA), emulator-* (player-facing Fallout terminal emulator).
  Shared domain: campaigns, terminals (JSON node/choice graph "olonastri"), users, auth,
  game state engine. Each app keeps its own folder, package.json, build, and deploy.

  emulator app: Vanilla HTML5/CSS3/JS (no build step), marked.js (CDN), Docker + nginx;
  Italian UI/content; static, no backend; manifest-driven JSON content loaded at runtime.

rules:
  proposal:
    - For emulator-* specs: prefer content/data solutions; only touch index.html if a
      feature cannot be achieved via content/data alone. State impact on the JSON
      authoring workflow. Use Fallout lore-accurate naming where appropriate.
  tasks:
    - For emulator-* specs: each task must be verifiable by opening index.html in a
      browser; data/schema changes must include an example JSON snippet; keep tasks
      scoped to one layer (engine, manifest, or content).
```

## Risks
- **Lost per-app rule scoping** (D4) — accepted; mitigated by convention prefixes in rules.
- **Validator flags a delta-less change** — expected for a migration change.
- **Stale references** in app docs/CI pointing at `apps/*/openspec` — grep and update.
