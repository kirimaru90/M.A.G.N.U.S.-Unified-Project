## Why

The current Terminal client is a single 738-line `index.html` with all CSS, DOM, and engine logic inline. Before the multi-phase rework that turns this client into an API-backed consumer of the wider RobCo architecture (see [REWORK.md](../../REWORK.md), [ARCHITECTURE.md](../../../ARCHITECTURE.md)), the codebase must be physically broken into ES modules so subsequent phases (`api-client`, `state-store`, `real-user-auth`, etc.) can land without merge-conflict tarpits. Phase 0 makes the next six phases possible without changing a single byte of user-visible behavior.

## What Changes

- Move all inline JS out of `index.html` into native ES modules under `src/`.
- Move CSS out of `<style>` into `src/styles/terminal.css` (CRT theme preserved verbatim).
- `index.html` becomes a shell: DOM scaffolding, `<link rel="stylesheet">`, `<script type="module" src="src/main.js">`.
- Engine subsystems extracted as siblings with explicit `export`s: `src/engine/typewriter.js`, `src/engine/sounds.js`, `src/engine/keynav.js`, `src/engine/back-history.js`, `src/engine/hidden-tape.js`, `src/engine/login-fictional.js` (current in-JS comparison preserved; will be replaced in Phase 5).
- Screens extracted: `src/screens/boot.js`, `src/screens/terminal.js`, `src/screens/login-fictional.js`.
- Empty placeholder directories `src/api/` and `src/state/` created (with `.gitkeep`) for upcoming phases.
- `src/main.js` is the bootstrap: imports engine + screen modules, wires screen routing, mounts on `DOMContentLoaded`.
- `sw.js` cache manifest updated to enumerate the new module file set; bumped `CACHE_NAME` to invalidate stale caches.
- No bundler. No transpilation. No framework. Static-deployable as before.

## Capabilities

### New Capabilities

_None._ This phase introduces no new observable behavior, so no new capability specs are created.

### Modified Capabilities

_None._ All ten existing capability specs (`fast-replay-typing`, `file-error-back-navigation`, `hidden-terminal-access`, `keyboard-navigation`, `login-access-control`, `pwa-installability`, `scroll-and-shortcuts`, `terminal-exit`, `terminal-sound-effects`, `typing-animation-flow`) must continue to describe observable behavior correctly after this refactor with **zero textual changes**. Regression is verified by running every existing scenario against the modularized client.

**Explicit statement: this change has no spec deltas.** The proposal relies on regression-by-scenario against the unchanged specs in `openspec/specs/`.

## Impact

- **Affected code**:
  - `index.html` — gutted to shell only.
  - `sw.js` — cache manifest rewritten; `CACHE_NAME` bumped.
  - New tree: `src/main.js`, `src/engine/*.js`, `src/screens/*.js`, `src/styles/terminal.css`, `src/api/.gitkeep`, `src/state/.gitkeep`.
- **Affected APIs / data**: none. `dati/*.json` content is untouched; `manifest.webmanifest`, `icons/`, `marked.js` CDN reference are untouched.
- **Affected workflows**:
  - **Content creators**: zero impact. JSON authoring experience unchanged.
  - **Operators**: must hard-refresh once after deploy so the new service worker invalidates the old cached `index.html` and picks up the module tree.
- **Dependencies**: still `marked.js` via CDN. No new dependencies. No build step introduced.
- **Browser support**: requires native ES modules (`<script type="module">`). All evergreen browsers and iOS Safari 11+ supported — already the de facto baseline for the PWA.
- **Risk concentration**: subtle engine timing (typewriter cadence, sound trigger ordering, focus restoration on back-navigation). Mitigated by Phase 0's regression-by-scenario gate against the existing spec set.
