## Context

The Terminal client today is a single `index.html` (738 lines) holding all CSS, DOM, and JavaScript inline. The wider rework (see [openspec/REWORK.md](../../REWORK.md)) needs six follow-on phases — API client, state store, conditional variants, input components, real-user auth, server-side login — to land on this client. Trying to land those on a monolith means every phase touches the same file, every merge is a conflict, and every regression is hard to localize.

Constraints (locked by [openspec/REWORK.md](../../REWORK.md) "Foundations (decided)"):

- Vanilla JS only. No framework. No bundler. No transpiler.
- Native ES modules (`<script type="module">`), statically deployable from nginx as-is.
- CRT aesthetic preserved exactly.
- PWA must keep installing and caching the new file set.
- Italian UI/content unchanged.

Stakeholders: the dev doing the rework, the content authors of the seven existing holotapes in [dati/](../../../dati/), the operators serving the PWA.

## Goals / Non-Goals

**Goals:**

- Decompose `index.html` along subsystem seams that match the next six phases' module boundaries — so Phase 1 adds `src/api/` without restructuring, Phase 2 adds `src/state/` without restructuring, etc.
- Every existing engine subsystem (typewriter, sounds, keyboard nav, back history, hidden-tape access, fictional login, choice rendering) extracted into its own module with an explicit named export.
- Service worker correctly invalidates the old cache and warms the new module file set on first load post-deploy.
- All seven existing holotapes in [dati/](../../../dati/) play with no observable behavior diff vs. the pre-refactor build.

**Non-Goals:**

- Any behavior change. No new screens, no new content, no new APIs, no state engine, no real auth.
- Touching [ARCHITECTURE.md](../../../ARCHITECTURE.md), [SERVER-DESIGN.md](../../../SERVER-DESIGN.md), or any text in [openspec/specs/](../../specs/).
- Improving existing code. If a function looks awkward, it gets moved verbatim. Refactor-the-refactor is explicitly forbidden in this phase — it conflates "did I break behavior" with "did I improve design" and makes the regression check meaningless.
- Adding a bundler, transpiler, framework, or any new runtime dependency.
- Replacing the fictional-login client-side check (Phase 5 owns that).
- Splitting the service worker cache into static/data layers (Phase 6 owns that).
- Adding tests, types, lint, or formatting. Out of scope for this phase.

## Decisions

### 1. Native ES modules with `<script type="module">`, no bundler

`index.html` references one entry: `<script type="module" src="src/main.js">`. Sibling modules import each other with relative paths.

**Why:** the foundation choice in [REWORK.md](../../REWORK.md) is "static-deployable, no build step." Native modules deliver that. Every target browser the PWA supports already supports them.

**Alternatives considered:**
- **Bundler (Vite/esbuild/rollup):** rejected. Adds a build step, breaks the "edit a file, reload the page" workflow, contradicts the locked foundation decision.
- **One big file with IIFEs:** rejected. Defeats the purpose of the phase — Phase 1+ still merge into one file.
- **Import maps:** unnecessary. No third-party bare-specifier imports here; `marked.js` stays a global from the CDN `<script>` (unchanged).

### 2. Module boundaries match the Phase 1–6 seams in REWORK.md

```
src/
  main.js                    bootstrap, screen routing
  api/                       (empty + .gitkeep — Phase 1 fills it)
  state/                     (empty + .gitkeep — Phase 2 fills it)
  engine/
    typewriter.js            character-by-character render + cadence
    sounds.js                keystroke/select/error audio
    keynav.js                arrow + Enter selection on choices
    back-history.js          back stack + Backspace handler
    hidden-tape.js           ID-lookup access for non-listed tapes
    login-fictional.js       current in-JS credential compare (Phase 5 replaces)
  screens/
    boot.js                  boot animation + manifest entry
    terminal.js              tape playback screen
    login-fictional.js       fictional-login screen mount
  styles/
    terminal.css             extracted CRT styles
```

**Why this carving:** each module maps 1:1 to either an existing OpenSpec capability (`typewriter.js` ↔ `typing-animation-flow`, `keynav.js` ↔ `keyboard-navigation`, `sounds.js` ↔ `terminal-sound-effects`, `back-history.js` ↔ `file-error-back-navigation`, `hidden-tape.js` ↔ `hidden-terminal-access`, `login-fictional.js` ↔ `login-access-control`) or to a Phase 1+ capability (`api/`, `state/`). The seam choice is not arbitrary — it's the seam Phase 1+ will modify, so subsequent phases edit one file each.

**Alternatives considered:**
- **Flat `src/*.js` with no subdirs:** rejected. Six follow-on phases each adding new files would crowd the root.
- **Group by screen, not by subsystem:** rejected. Engine subsystems are shared across screens (typewriter runs in boot + terminal + login). Grouping by screen means duplicating or cross-importing across siblings.

### 3. Module pattern: explicit named exports, no default exports

Every module exports named functions/objects. `main.js` imports them by name. No `export default`.

**Why:** named exports are greppable and refactor-safe — `import { typewrite } from ...` is the same string everywhere, so finding all callers is `grep -r "typewrite"`. Default exports get renamed at every import site and lose that property. Trivial constraint to honor; pays off when Phase 2 starts wiring state into these modules.

### 4. Wiring: dependency-injection via function arguments, not module-level singletons

Modules export pure-ish functions. State that today lives in `index.html`'s top-level `let`/`var` (current tape, current node, back stack) moves into `main.js` as locals and is passed into engine functions as arguments. Modules do not reach into the DOM via global selectors at import time; they accept DOM element references as arguments.

**Why:** Phase 2 introduces a real state store. If engine modules close over module-level singletons now, Phase 2 has to unpick that. Passing state as arguments now means Phase 2 swaps the argument source from "local in main.js" to "the store" without touching engine modules.

**Trade-off accepted:** call sites in `main.js` get longer (more arguments). That's fine — `main.js` is the integration layer and should look like glue.

### 5. CSS extraction: one file, no preprocessor, no scoping

All `<style>` content moves to `src/styles/terminal.css` verbatim. `index.html` links it via `<link rel="stylesheet" href="src/styles/terminal.css">`.

**Why:** the existing CSS is small (~150 lines) and tied to specific IDs in the shell. Splitting it per-module buys nothing in this phase and risks reordering rules that affect the CRT visuals. One file, byte-for-byte preserved.

### 6. Service worker: new cache name, explicit module file list

`sw.js` keeps its install/activate/fetch lifecycle. Changes:

- `CACHE_NAME` bumped (e.g., `robco-terminal-v2`) so the activate handler purges the previous cache.
- The pre-cache list enumerates: `index.html`, `manifest.webmanifest`, `icons/*`, `dati/*`, `src/main.js`, `src/engine/*.js`, `src/screens/*.js`, `src/styles/terminal.css`. The list is hand-maintained (no glob); reviewer of the PR is responsible for catching missing files.

**Why bump `CACHE_NAME`:** users on the old PWA have `index.html` cached. Without a cache bump they'd keep loading the old monolith forever and never fetch the new modules. The bump forces the activate handler to delete the old cache.

**Alternatives considered:**
- **Network-first for HTML, cache-first for assets:** that's the Phase 6 split-cache-policy capability. Out of scope here. The cache-name bump is sufficient to ship Phase 0 safely.

### 7. Regression strategy: the seven existing holotapes are the test harness

There is no automated test framework. The acceptance gate is manual: load each of the seven holotapes in [dati/](../../../dati/), exercise the scenarios listed in each existing OpenSpec capability spec (typewriter cadence, fast-replay double-tap, sound on each keystroke, arrow-key choice nav, Enter to select, Backspace to go back, hidden-tape ID entry, fictional login pass/fail, PWA install + offline boot), confirm no diff vs. the current build.

**Why:** writing a test framework is itself a multi-day effort that doesn't belong in a refactor phase. The seven existing holotapes already cover every code path that exists pre-refactor — by definition, if they all play identically, behavior is preserved. Tasks list the specific scenarios to walk through.

## Risks / Trade-offs

- **Risk:** subtle timing regressions in the typewriter (per-character delay) or sound triggers (ordering relative to render). → **Mitigation:** module extraction is move-only — no edits to the timing logic itself. The regression scenarios for `typing-animation-flow`, `fast-replay-typing`, and `terminal-sound-effects` catch any diff.

- **Risk:** focus management on back-navigation regresses (current implementation restores focus to the choice that was selected). → **Mitigation:** `back-history.js` ships with the existing focus-restore code intact. Scenario in `file-error-back-navigation` and `keyboard-navigation` validates.

- **Risk:** service worker serves stale `index.html` after deploy and users never see the new module tree. → **Mitigation:** `CACHE_NAME` bump forces activate to purge. Operator note in the deploy step of [tasks.md](./tasks.md). If a user is somehow stuck, hard-refresh (Ctrl+Shift+R / clear-site-data) recovers.

- **Risk:** old PWA installs (already on a device) get into a half-updated state where the SW activates but a tab is mid-session. → **Mitigation:** standard PWA behavior — new SW takes over on next navigation; existing tab keeps the old client until reload. Acceptable for a refactor that produces no user-visible change.

- **Risk:** module load latency over slow connections (multiple round-trips for the module graph vs. one HTML payload). → **Mitigation:** all modules are tiny (kilobytes) and the SW pre-caches them on install. First load over network is one extra RTT in the worst case; every subsequent load is offline-equivalent. Acceptable trade-off for the phase's structural goal.

- **Trade-off:** module boundaries are predicted from REWORK.md's Phase 1–6 plans. If a later phase finds the boundary wrong, that phase will pay a small refactor cost. **Accepted:** the alternative is doing Phase 0 twice. Better to commit to the seam now and let later phases adjust if needed.

- **Trade-off:** no automated test harness ships in this phase. **Accepted:** test-framework work is a separate concern; introducing it here would balloon scope and dilute the "zero behavior change" gate.

## Migration Plan

1. Land all module files alongside the existing monolith on a branch. `index.html` and `sw.js` updated last so the change is atomic.
2. Manual regression: walk every scenario in every existing capability spec against the modularized build. Document any diff in the PR before merging — there should be none.
3. Deploy. First page load post-deploy fetches the new `sw.js`, which purges the old cache via the bumped `CACHE_NAME` and pre-caches the new module set.
4. **Rollback:** revert the merge commit. Old `index.html` and old `sw.js` come back. `CACHE_NAME` on rollback should be set one step higher than the Phase 0 value (e.g., if Phase 0 shipped `v2`, rollback ships `v3` containing the old monolith) so users' SW activates the rollback and clears the broken cache. Document this in the deploy step of tasks.md.

## Open Questions

- None blocking. The module layout decision in §2 is the only one that could be questioned by later phases; if Phase 1 (`api/`) or Phase 2 (`state/`) hits friction with the chosen seams, those phases adjust at their own cost. Phase 0 commits to the seams as laid out.
