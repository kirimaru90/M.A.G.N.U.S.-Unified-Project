## Context

This change is the code-side remediation from the 2026-07-01 consistency audit. Findings
were bucketed into (1) genuine code bugs vs still-correct specs, (2) stale specs the code
has intentionally outgrown, and (3) spec-vs-spec conflicts. **This change handles bucket 1
only.** Buckets 2 and 3 are handled by the sibling change `reconcile-stale-specs`, which
edits specs rather than code.

## Decisions

### Only one spec delta; the rest are pure code fixes
For every bucket-1 item except the PWA pre-cache, the spec already states the correct
behaviour and the code simply fails to meet it — so there is nothing to change in the spec.
Adding cosmetic MODIFIED deltas that restate unchanged requirements would add noise. The
one exception is `emulator-pwa-installability`: the current requirement lists
`manifest.webmanifest` in the pre-cache but does not forbid the brittle
`cache.addAll`-rejects-on-any-404 pattern that turned a missing file into a total install
failure. We strengthen that requirement so the failure mode is specified away.

### Fast-replay: render truly instant (0 ms), matching the spec
`emulator-fast-replay-typing` mandates 0 ms/char for seen nodes and the codebase already
implements a `speed === 0` instant path in `typeWriterHTML`. The current
`typingSpeed * 0.25` (fast-but-visible) is treated as the bug. *If* the visible-fast replay
was a deliberate product choice, the correct move is instead to update the spec (in
`reconcile-stale-specs`) — flag for product confirmation before implementing. Default:
fix the code to instant.

### PWA install resilience
`sw.js` uses `cache.addAll(SHELL_URLS)`, which rejects atomically if any URL 404s. Two
fixes together: (a) create the missing `manifest.webmanifest` so the shell list resolves;
(b) split genuinely-required shell assets (cached via `addAll`) from optional ones (cached
individually with `.catch(() => {})`, mirroring how `MARKED_CDN` is already handled) so a
future missing optional asset degrades gracefully instead of bricking the SW.

### API status-code fixes are behaviour-visible
`activate` 201→200 and `PUT /users/:id` 400→200 change HTTP responses clients may depend on.
They are still the spec-correct behaviour; note them in the release notes.

### `PUT /users/:id` accept-and-ignore vs the global pipe
The global `ValidationPipe({ forbidNonWhitelisted: true })` hard-rejects unknown keys, which
conflicts with the spec's accept-and-ignore for server-owned fields. Prefer a per-route/DTO
relaxation (declare-and-strip the server-owned fields, or a scoped pipe) over weakening the
global pipe, so other endpoints keep their strictness.

## Open questions

- Is emulator fast-replay meant to be truly instant (spec) or fast-visible (current code)?
- Should the `StateService` 404-hardening ship here, or is "masked by guards, unreachable"
  acceptable to defer? Included here as low-risk defensive correctness.
