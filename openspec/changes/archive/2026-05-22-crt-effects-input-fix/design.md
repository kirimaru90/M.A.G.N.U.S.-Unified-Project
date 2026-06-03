## Context

Two unrelated-but-coupled defects are bundled here because both are "the terminal
doesn't behave like a RobCo terminal" bugs touching the presentation/engine layer,
and both require spec + doc updates to stay consistent.

**CRT overlay layering.** `.crt` is on `<body>` (index.html:13). The scanline +
RGB-subpixel overlay is `.crt::before`, a `position: fixed; inset: 0` element at
`z-index: 2` (terminal.css:15-20). The screens stack above it:
`#terminal-container` is `z-index: 1`, `#boot-screen` / `#campaign-select-screen`
are `z-index: 10`, `#login-screen` / `#login-real-screen` are `z-index: 20`. So the
overlay only shows through over `#terminal-container` (and even then it is *under*
the menus). There is no flicker animation anywhere.

**Input component.** `src/engine/components/input.js` builds its mutation from
`component.target` (line 44) and evaluates `branch.condition` (line 52). The
authoritative authoring contract — `reference/terminal-authoring-guide.md` §5.4,
`reference/robco-terminal-architecture.md`, and the post-archive spec
`openspec/specs/input-components/spec.md` (branches already use `when`) — says the
canonical fields are `set` (the target variable) and `when` (the branch
condition). For a correctly-authored holotape, `component.target` is `undefined`,
so `dispatch()` (node-resolver.js:55-58) throws `Invalid mutation key: undefined`.
`submit()` does not `await` inside a try/catch and the `onclick` / `keydown`
callers never `.catch()`, so the rejection is unhandled and the field is left
`disabled = true` forever. Conditional branches separately never match because
`branch.condition` is always `undefined`; only `default` works.

## Goals / Non-Goals

**Goals:**
- Render the CRT scanline/subpixel overlay uniformly above *every* screen, with
  `pointer-events: none` so focus/keyboard nav are untouched.
- Add a subtle, continuous CRT flicker that does not impair reading or interaction.
- Honor `prefers-reduced-motion: reduce` (disable/strongly reduce motion; keep
  static scanlines).
- Make the input component work end-to-end with `set`/`when`, and make a stuck
  (permanently-disabled) field impossible regardless of failure path.
- Keep code, spec, reference docs, and `guida terminale.md` mutually consistent.

**Non-Goals:**
- Curvature/barrel distortion, vignette, chromatic aberration, or per-character
  glow beyond the existing `text-shadow`.
- Changing the green-phosphor palette (`--terminal-green`, `--terminal-bg`) or the
  existing text-shadow glow.
- Any backend, API contract, or mutation-dispatch path change.
- A data migration tool for legacy holotapes (the error-recovery net makes legacy
  field-name typos non-fatal; manual content fixes suffice).

## Decisions

### 1. One global overlay element above the top screen z-index
Keep a single fixed full-viewport overlay carrying the scanline gradient + RGB
subpixel mask, and raise its `z-index` above the highest screen (login = 20). The
overlay keeps `pointer-events: none`, so even sitting on top it never intercepts
clicks, focus, or keyboard events.

- **Chosen:** keep `.crt::before` as the scanline layer but bump its `z-index`
  (e.g. to `2147483646`-ish high, or a value clearly above 20 such as 100), and
  add a *second* pseudo-element / overlay (`.crt::after` or a dedicated
  `#crt-flicker` div) for the animated flicker so the two concerns are
  independently tunable. Both `pointer-events: none`.
- **Alternative — move overlay inside each screen:** rejected; duplicates the
  overlay N times, complicates z-index per screen, and risks clipping by screen
  `overflow-y: auto`.
- **Alternative — lower the screens' z-index below the overlay:** rejected;
  screens legitimately need to stack above `#terminal-container`, and reshuffling
  them risks regressions in screen show/hide logic.

Using `::before` (scanlines) + `::after` (flicker) on the existing `.crt` body
avoids any index.html change, satisfying the "no index.html change unless required"
rule.

### 2. Flicker = low-amplitude opacity keyframes on a near-transparent tint layer
Implement flicker as a separate layer (`.crt::after`) filled with a very faint
phosphor tint, animated with a short opacity keyframe loop at low amplitude (e.g.
opacity oscillating within a small band like 0.02–0.08 over ~100–150ms with
irregular steps). This reads as brightness instability without strobing.

- **Chosen:** opacity keyframes on a dedicated tint overlay. Cheap (compositor-only
  if we animate `opacity`), isolated from text, easy to gate behind reduced-motion.
- **Alternative — animate `filter: brightness()` on the whole `.crt` body:**
  rejected as primary because filtering the entire subtree can be expensive and can
  subtly blur/shift text; kept as an optional secondary if a global brightness
  pulse is wanted, but bounded tightly.
- **Subtlety guard:** amplitude and frequency chosen to avoid the photosensitivity
  danger zone (no high-contrast full-screen flashing 3+/sec). The animation is
  continuous and loops infinitely.

### 3. `prefers-reduced-motion` gate
Wrap all motion (flicker keyframes, any brightness pulse, and — if added — any
animated scanline drift) in `@media (prefers-reduced-motion: no-preference)`, or
explicitly disable them under `@media (prefers-reduced-motion: reduce)` by setting
`animation: none`. Static scanlines + subpixel mask remain in both cases. The
existing `.cursor` blink is out of scope but may be reviewed for consistency.

### 4. Input component: read `set` / `when`, raw string value
In `input.js`, build the mutation as
`{ op: 'set', key: component.set, value: rawValue }` and evaluate `branch.when`
(not `branch.condition`). Value is sent as the raw field string — no trim, no
numeric coercion — per the existing spec. Branch resolution order is unchanged:
first branch whose `when` is true wins, else the `{ default: true }` branch, else
inline `'logic'` error + re-enable.

### 5. Input component: total error containment via try/catch
Wrap the `await dispatchMutations(...)` and all post-dispatch branching in a single
`try { … } catch { requestInlineError('state'); reenableAfterError(); }`, and make
the `onclick` / `keydown` callers tolerant (either `await`/`.catch()` the returned
promise or rely on `submit()` never rejecting). The invariant: **every** exit path
from a failed submission runs `reenableAfterError()` (which clears `inFlight`,
re-enables the field, restores the focus list, and refocuses) and surfaces an
inline error. This holds even after the field-name fix, as defense-in-depth against
future authoring typos. The existing sentinel handling (`null` → branch,
`RERENDER_REQUIRED` → rerender, `INLINE_ERROR`/other → state error + re-enable) is
preserved; the try/catch only adds a path for *thrown* exceptions.

### 6. Spec/doc alignment
`openspec/specs/input-components/spec.md` is rewritten so the component variable
field is `set` (branch `target` stays a node id; branch condition stays `when`).
`guida terminale.md` is updated from `target`/`condition` to `set`/`when`. The
reference docs already use `set`/`when` (verify, fix if drifted).

## Risks / Trade-offs

- **Overlay on top of focusable controls** → if `pointer-events: none` is dropped
  or a non-pointer-transparent layer is introduced, clicks/focus break on every
  screen. Mitigation: assert `pointer-events: none` on every overlay layer; manual
  focus/click test on boot, campaign-select, both logins, and terminal.
- **Flicker too strong / photosensitivity** → keep amplitude low and frequency out
  of the strobe range; verify visually; respect reduced-motion.
- **Animating overlay on top of text reduces contrast** → keep the flicker tint
  near-transparent and prefer compositor-only `opacity` so text legibility holds.
- **Header-text mismatch in MODIFIED spec deltas** → would silently drop detail at
  archive. Mitigation: copy existing requirement headers verbatim.
- **Legacy holotapes using `target`/`condition`** → conditional branches silently
  fall through to `default`, and the variable is never written. Mitigation: the
  error-recovery net keeps the terminal usable; legacy content must be migrated to
  `set`/`when` (no automated migration shipped).

## Migration Plan

1. Land the CSS overlay/flicker/reduced-motion changes (presentation only,
   independently revertable).
2. Land the input.js field-name + try/catch changes together.
3. Update spec + `guida terminale.md`; verify reference docs.
4. Migrate any in-repo holotape JSON whose input components still use
   `target`/`condition`.

Rollback: each part is an isolated diff (CSS block; input.js; docs) and can be
reverted independently without coupling.
