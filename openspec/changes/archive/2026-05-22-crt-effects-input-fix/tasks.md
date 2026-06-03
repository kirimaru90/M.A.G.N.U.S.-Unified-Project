## 1. CRT global scanline overlay (Part A)

- [x] 1.1 In `src/styles/terminal.css`, raise the `.crt::before` overlay above the highest screen z-index (login = 20) so the scanline gradient + RGB subpixel mask render over `#boot-screen`, `#campaign-select-screen`, `#login-screen`, `#login-real-screen`, and `#terminal-container`; keep `pointer-events: none` and `position: fixed; inset: 0`.
- [x] 1.2 Verify in a browser (open `index.html`) that scanlines are visible over each screen in turn: boot, campaign-select, both login screens, terminal.
- [x] 1.3 Verify pointer + keyboard interaction is unaffected on every screen — click buttons, tab/arrow focus, type into login and input fields — confirming the raised overlay never intercepts events.

## 2. CRT flicker animation (Part A)

- [x] 2.1 Add a dedicated flicker layer (e.g. `.crt::after`, full-viewport `position: fixed; inset: 0; pointer-events: none`) carrying a near-transparent phosphor tint, above the screens like the scanline layer.
- [x] 2.2 Add a `@keyframes` flicker animation with low-amplitude opacity oscillation (small band, short irregular period) applied to the flicker layer, looping infinitely; tune so it reads as brightness instability without high-contrast strobing.
- [x] 2.3 Wrap all motion (flicker keyframes and any brightness pulse) so it is active only when `prefers-reduced-motion` is not `reduce`; under `@media (prefers-reduced-motion: reduce)` set `animation: none` (or strongly reduce) while keeping the static scanlines.
- [x] 2.4 Confirm the green-phosphor palette (`--terminal-green`, `--terminal-bg`) and existing text-shadow glow are unchanged, and no existing style (choice buttons, login inputs, boot footer, logout color) regresses.
- [x] 2.5 Verify in-browser: flicker is subtle and continuous with motion enabled; flicker stops (scanlines remain) when the OS/browser reduced-motion setting is on.

## 3. Input component field-name fix (Part B)

- [x] 3.1 In `src/engine/components/input.js`, build the mutation from `component.set` instead of `component.target`: `{ op: 'set', key: component.set, value: rawValue }` (raw string, no coercion).
- [x] 3.2 In the branch loop, evaluate `branch.when` instead of `branch.condition`; preserve resolution order (first matching `when` wins, else `{ default: true }`, else `'logic'` inline error + re-enable).

## 4. Input component error recovery (Part B)

- [x] 4.1 Wrap the `await dispatchMutations(...)` and all post-dispatch branch resolution in `input.js` in a `try { … } catch { requestInlineError('state'); reenableAfterError(); }` so any thrown exception (e.g. invalid mutation key) re-enables the field and shows an inline error.
- [x] 4.2 Make the `submitBtn.onclick` and Enter `keydown` callers tolerant of a rejected promise (e.g. `.catch()` or ensure `submit()` never rejects) so no unhandled rejection can leave the field stuck.
- [x] 4.3 Confirm the invariant: every non-navigating, non-rerender outcome ends with `reenableAfterError()` run and an inline error shown — the field is never left permanently `disabled`.

## 5. Spec & documentation alignment (Part B)

- [x] 5.1 Apply the `input-components` spec delta into `openspec/specs/input-components/spec.md` so the component variable field is `set` (branch `target` stays a node id; branch condition stays `when`).
- [x] 5.2 Update `guida terminale.md` to document input components with `set` / `when` instead of `target` / `condition`.
- [x] 5.3 Verify `reference/terminal-authoring-guide.md` §5.4 and `reference/robco-terminal-architecture.md` already use `set` / `when`; fix any drift so code, spec, and reference docs all agree.

## 6. End-to-end verification (Part B)

- [x] 6.1 Author/locate an input node per `reference/terminal-authoring-guide.md` §5.4 (using `set` and `when`) and confirm a non-empty submit posts a single `{ op: 'set', key: <component.set>, value: <rawValue> }` and, on 2xx, navigates via the first matching `branch.when` (else `default`).
- [x] 6.2 Confirm failure paths (invalid key throw, network/5xx, unresolvable branches) all re-enable the field with an inline error rather than locking it.
- [x] 6.3 Run `openspec validate "crt-effects-input-fix" --strict` and confirm the change is valid.
