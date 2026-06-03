## 1. Verify `dati/` removal

- [x] 1.1 Confirm `dati/` is absent from the working tree and untracked by git (`git ls-files dati/` returns nothing; directory does not exist).
- [x] 1.2 Grep the whole repo for live references to the legacy static flow: `dati/`, `dati/manifest.json`, and static-fetch patterns pointing at `dati`. Exclude `openspec/changes/archive/`, `openspec/REWORK.md`, and `guida terminale.md` historical notes from "must-fix" — those are allowed to mention the retired flow.
- [x] 1.3 Remove any *live* residual reference found in 1.2 (e.g. in `sw.js`, `src/`, build/deploy config). If none found, record that.
- [x] 1.4 Tick the `dati/` checkbox in `openspec/REWORK.md` cross-cutting cleanup section.

## 2. Verify `index.html` shell

- [x] 2.1 Confirm `index.html` contains no inline engine logic — only the shell markup and `<script type="module" src="src/main.js">` (plus CDN/font/style links).
- [x] 2.2 If any inline engine code remains, move it into the appropriate `src/` module; otherwise record that the shell is already clean.
- [x] 2.3 Tick the inline-engine-code checkbox in `openspec/REWORK.md`.

## 3. Reconcile `guida terminale.md` with the API flow

- [x] 3.1 Re-read `guida terminale.md` end to end and list every sentence that still implies content lives in static files / is loaded without the API.
- [x] 3.2 Fix the leaked code-fence language labels (standalone `Markdown` and `JSON` lines) so the document renders as proper fenced code blocks.
- [x] 3.3 Adjust section 3's "file"-centric framing where it conflicts with the API-import flow, keeping the (correct) authoring semantics intact.
- [x] 3.4 Verify no example JSON payloads were altered except where they referenced the dead flow.
- [x] 3.5 Tick the `guida terminale.md` checkbox in `openspec/REWORK.md`.

## 4. Audit `openspec/specs/` against implemented behavior

- [x] 4.1 Enumerate every capability spec under `openspec/specs/`.
- [x] 4.2 For each spec, read it against the implementing `src/` module(s) and classify: **keep** (reflects shipped behavior), **remove** (describes retired behavior with no current equivalent), or **flag** (stale wording but behavior survives — out of scope to rewrite here).
- [x] 4.3 Use the REWORK capability map survivor list as the prior; default to **keep** when evidence is ambiguous.
- [x] 4.4 Remove the spec folders classified **remove** in 4.2 (deletion only; git preserves history). If none qualify, record that explicitly.
- [x] 4.5 Record the audit result (keep/remove/flag per spec) in the change before archiving — flagged items noted for a future docs change (e.g. `openspec/project.md` still describing a backendless static app).
- [x] 4.6 Tick the "archive stale specs" checkbox in `openspec/REWORK.md`.

## Spec audit result (task 4.2–4.5)

| Spec | Classification | Notes |
|------|---------------|-------|
| `api-client` | keep | API-backed client behavior; core to rework |
| `campaign-selection` | keep | Campaign selection screen; added in Phase 1 |
| `state-store` | keep | State persistence; added in Phase 2 |
| `state-mutations` | keep | Mutation model; added in Phase 2 |
| `conditional-variants` | keep | Variant evaluation; added in Phase 2 |
| `per-variant-components` | keep | Per-variant component overrides |
| `input-components` | keep | Input component (Phase 3) |
| `hidden-terminal-access` | keep | Server-mediated hidden terminal lookup; updated in Phase 1–2 |
| `real-user-auth` | keep | Real user authentication flow |
| `login-access-control` | keep / flag | Behavior survives; wording references retired `initBoot()` — rewrite in a future docs change |
| `pwa-installability` | keep | PWA spec; explicitly states no `dati/` in cache |
| `fast-replay-typing` | keep | Session-scoped seen-nodes/instant replay; core engine behavior |
| `keyboard-navigation` | keep / flag | Keyboard nav survives; scenario references retired `initBoot()` — rewrite in a future docs change |
| `scroll-and-shortcuts` | keep | Scroll and shortcut behavior |
| `typing-animation-flow` | keep / flag | Typing animation survives; wording references retired `initBoot()` — rewrite in a future docs change |
| `terminal-exit` | keep / flag | Exit behavior survives; wording references `initBoot()` and old screen names — rewrite in a future docs change |
| `terminal-sound-effects` | keep / flag | Sound effects survive; multiple references to `initBoot()` — rewrite in a future docs change |
| `crt-visual-effects` | keep | CRT visual effects (Phase 5) |
| `crt-font-config` | keep | CRT font configuration |
| `crt-phosphor-wave` | keep | CRT phosphor wave effect (Phase 6) |
| `terminal-configuration` | keep | Terminal configuration spec |
| `file-error-back-navigation` | **removed** | Explicit OBSOLETE notice; described `dati/manifest.json` boot flow via `initBoot()` — both retired in Phase 6 |

**Flagged for a future docs change:** `openspec/project.md` still describes the backendless static app; `openspec/specs.md` still documents the old `dati/` static flow. The five keep/flag specs need `initBoot()` references rewritten to the current module names (`campaign-select.js` / `initApp()`).

## 5. Finalize

- [x] 5.1 Run `openspec validate phase-7-cleanup`. The "no deltas found" error is expected for this no-behavior cleanup (the `specs/` artifact is the `NO-DELTAS` sentinel, same as Phase 0); resolve any *other* reported issues.
- [x] 5.2 Confirm all four cross-cutting cleanup checkboxes in `openspec/REWORK.md` are ticked.
