## 1. Branch and baseline

- [x] 1.1 Create working branch off `rework`; confirm pre-refactor `index.html` and `sw.js` are the source of truth for behavior (no in-flight edits sitting unmerged).
- [ ] 1.2 Open the current `index.html` in a clean browser profile, play all seven holotapes (`data.json`, `esempio-login.json`, `fascicolo_mcgillian.json`, `guida_sistema.json`, `manifest.json` boot path, `segreto.json`, `super_duper_admin.json`); record any behavior that feels timing-sensitive so post-refactor diffs are obvious.

## 2. Module skeleton

- [x] 2.1 Create directory tree: `src/`, `src/api/`, `src/state/`, `src/engine/`, `src/screens/`, `src/styles/`.
- [x] 2.2 Add `.gitkeep` to `src/api/` and `src/state/` so the empty directories are tracked.
- [x] 2.3 Create empty stub files (one named export each, no logic yet): `src/main.js`, `src/engine/typewriter.js`, `src/engine/sounds.js`, `src/engine/keynav.js`, `src/engine/back-history.js`, `src/engine/hidden-tape.js`, `src/engine/login-fictional.js`, `src/screens/boot.js`, `src/screens/terminal.js`, `src/screens/login-fictional.js`. Verify import chain from `main.js` resolves with no runtime errors when loaded by a temporary throwaway HTML page.

## 3. CSS extraction

- [x] 3.1 Copy the entire `<style>` block from `index.html` verbatim into `src/styles/terminal.css`. No edits, no reformatting.
- [x] 3.2 Replace the inline `<style>` in `index.html` with `<link rel="stylesheet" href="src/styles/terminal.css">`. Reload and visually confirm CRT scanlines, color, font, and layout are pixel-identical.

## 4. Engine module extraction (move-only, no edits)

- [x] 4.1 `src/engine/typewriter.js` — move the character-by-character render function(s), per-character delay logic, and fast-replay double-tap handler from `index.html`. Export `typewrite(...)` (and any helpers the screens call). No other changes.
- [x] 4.2 `src/engine/sounds.js` — move audio element loading and trigger functions (keystroke, selection, error/data). Export `playKeyClick()`, `playSelection()`, `playDataTerminal()` (preserve current names if different). Audio file paths remain `./suoni/*.mp3`.
- [x] 4.3 `src/engine/keynav.js` — move arrow-key + Enter handler for choice navigation. Export the bind/unbind functions. Accept DOM choice-container reference as argument (not via global selector).
- [x] 4.4 `src/engine/back-history.js` — move the back stack and Backspace handler, including focus restoration on pop. Export push/pop/peek and the keydown binder.
- [x] 4.5 `src/engine/hidden-tape.js` — move the hidden-tape ID lookup logic (the path used today to access tapes not listed in `dati/manifest.json`). Export the lookup function.
- [x] 4.6 `src/engine/login-fictional.js` — move the current in-JS credential comparison verbatim (Phase 5 replaces this with a server call; do not change the logic now). Export the check function.

## 5. Screen module extraction

- [x] 5.1 `src/screens/boot.js` — move the boot animation, manifest fetch, and entry screen rendering. Export `mountBoot(...)`. Accept the container element as an argument.
- [x] 5.2 `src/screens/terminal.js` — move the tape playback screen: node rendering, choice rendering, transition handlers, integration with `back-history.js`. Export `mountTerminal(...)`.
- [x] 5.3 `src/screens/login-fictional.js` — move the fictional-login screen mount + input handling. Export `mountLoginFictional(...)`. Wire to `engine/login-fictional.js` for the check.

## 6. Bootstrap and screen routing

- [x] 6.1 In `src/main.js`, import all engine + screen modules by named export. On `DOMContentLoaded`, locate the shell DOM nodes (boot container, terminal container, login container) by ID and pass them into the screen mount functions.
- [x] 6.2 Reproduce the current screen-routing logic in `main.js`: boot → manifest list → tape (with optional fictional login gate) → back navigation. Use locals in `main.js` for transient state (current tape, current node, back stack); do not introduce module-level singletons in engine modules.
- [x] 6.3 Replace all inline `<script>` in `index.html` with a single `<script type="module" src="src/main.js"></script>` at the end of `<body>`. Remove all inline JS.

## 7. Service worker update

- [x] 7.1 In `sw.js`, bump `CACHE_VERSION` (e.g., `robco-v1` → `robco-v2`).
- [x] 7.2 Extend `SHELL_URLS` to include: `./src/main.js`, `./src/engine/typewriter.js`, `./src/engine/sounds.js`, `./src/engine/keynav.js`, `./src/engine/back-history.js`, `./src/engine/hidden-tape.js`, `./src/engine/login-fictional.js`, `./src/screens/boot.js`, `./src/screens/terminal.js`, `./src/screens/login-fictional.js`, `./src/styles/terminal.css`.
- [x] 7.3 Load the app over `http://localhost` (not `file://`) so the SW registers. In DevTools → Application → Service Workers, confirm the new SW activates, the old cache is deleted, and the new cache contains every URL in `SHELL_URLS`.
- [ ] 7.4 Toggle DevTools "Offline" and reload; confirm boot screen renders, manifest loads from cache, and a previously visited holotape plays end-to-end.

## 8. Regression by scenario — walk every existing capability spec

Each task below is the manual playthrough of the named spec's scenarios against the modularized build. PASS = behavior is byte-for-byte identical to the pre-refactor build. FAIL = stop and fix before continuing.

- [x] 8.1 `typing-animation-flow` — open `data.json` and `guida_sistema.json`; confirm character-by-character render, per-character delay, and end-of-text cursor behavior match pre-refactor.
- [x] 8.2 `fast-replay-typing` — during an active typewriter render, trigger fast-replay (double-tap / configured shortcut); confirm full text appears instantly without skipping the trailing state transition.
- [x] 8.3 `terminal-sound-effects` — confirm keystroke sound fires on each rendered character, selection sound fires on choice activation, and data-terminal sound fires where it does today. Volume, file, and timing unchanged.
- [x] 8.4 `keyboard-navigation` — on the choices list, arrow-up/arrow-down moves focus, Enter activates the focused choice, focus visibly indicates the current choice. Mouse click still works.
- [x] 8.5 `file-error-back-navigation` — request a nonexistent tape ID (or trigger a load error); confirm the error screen shows and Backspace returns to the prior screen with focus restored.
- [x] 8.6 `scroll-and-shortcuts` — long tape content scrolls; configured shortcuts (page-down / spacebar / whatever is current) behave identically.
- [x] 8.7 `terminal-exit` — exiting from a tape returns to the manifest/boot screen as it does today.
- [x] 8.8 `hidden-terminal-access` — enter the ID of a hidden tape (`segreto.json` or `super_duper_admin.json` per current content); confirm the lookup succeeds and the tape plays. Confirm an invalid ID still produces the existing error path.
- [x] 8.9 `login-access-control` — open `esempio-login.json` (or whichever tape currently gates on fictional login); confirm valid credentials pass and invalid credentials fail with the same message and same retry behavior as pre-refactor.
- [x] 8.10 `pwa-installability` — open the app over HTTPS / `localhost`, confirm the install prompt appears, install the PWA, launch standalone, confirm the manifest icon and theme color render and the app boots offline after first install.

## 9. PR readiness

- [x] 9.1 Diff review: `index.html` is shell-only (DOM scaffolding, one stylesheet `<link>`, one `<script type="module">`). No leftover inline JS, no leftover inline `<style>`.
- [x] 9.2 Diff review: no edits to files outside `index.html`, `sw.js`, `src/**`. Confirm `ARCHITECTURE.md`, `SERVER-DESIGN.md`, `openspec/specs/**`, `dati/**`, `icons/**`, `manifest.webmanifest`, `suoni/**` are untouched.
- [x] 9.3 Update [openspec/REWORK.md](../../REWORK.md) Phase 0 checkboxes from `[ ]` to `[x]` for completed items only.
- [x] 9.4 PR description includes the deploy note: "First load post-deploy invalidates the v1 cache and primes the v2 module set. If a user is stuck on the old cache, hard-refresh recovers."
- [x] 9.5 Rollback note in the PR: "Revert ships a `CACHE_VERSION` bumped above Phase 0 (e.g., `robco-v3`) so the rollback SW activates and clears any half-updated state."
