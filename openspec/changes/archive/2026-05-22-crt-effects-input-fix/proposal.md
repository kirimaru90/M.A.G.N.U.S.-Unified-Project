## Why

The CRT illusion is broken in two places. Visually, the scanline overlay only
covers the terminal screen — it sits *below* the boot, campaign-select, and login
screens, so those screens look flat and there is no brightness "flicker" anywhere,
weakening the period-accurate RobCo terminal feel. Functionally, the input
component is dead: pressing Enter (or `[ INVIA ]`) on a correctly-authored input
node permanently disables the field, sends no mutation, and never navigates,
because the engine reads field names (`target`, `condition`) that no longer match
the authoritative authoring contract (`set`, `when`) and has no error recovery.

## What Changes

- **Global CRT overlay**: rework the `.crt::before` layering (or a dedicated
  overlay element) so scanlines + the RGB subpixel mask render uniformly *above*
  every screen — boot, campaign-select, both login screens, and terminal —
  while keeping `pointer-events: none` so focus and keyboard navigation are
  unaffected.
- **CRT flicker**: add a subtle, continuous brightness-instability animation
  (low-opacity animated overlay and/or gentle opacity keyframes) that does not
  impair text reading or interaction.
- **Reduced-motion**: under `prefers-reduced-motion: reduce`, disable/strongly
  reduce the flicker and any motion; static scanlines remain.
- **Input component field-name fix** (**BREAKING** for any holotape still authored
  with the old field names): `src/engine/components/input.js` reads
  `component.set` (was `component.target`) and `branch.when` (was
  `branch.condition`), aligning code with the reference docs and spec.
- **Input component error recovery**: wrap submission so that *any* failure path
  re-enables the field and surfaces an inline error — the field is never left
  permanently disabled.
- **Doc/spec alignment**: rewrite `openspec/specs/input-components/spec.md` to use
  `set` instead of `target` throughout; bring `guida terminale.md` in line
  (`set`/`when` instead of `target`/`condition`).

## Capabilities

### New Capabilities
- `crt-visual-effects`: defines the global CRT overlay (scanlines + subpixel mask
  rendered above all screens, pointer-transparent) and the subtle flicker
  animation, including the `prefers-reduced-motion` and palette-preservation
  requirements.

### Modified Capabilities
- `input-components`: the submission/branch contract changes its canonical field
  names from `target` to `set` (target variable) and confirms `when` (branch
  condition), and adds an error-recovery guarantee that the field is never left
  permanently disabled after a failed submission.

## Impact

- **Code**: `src/styles/terminal.css` (overlay layering, flicker keyframes,
  reduced-motion block); `src/engine/components/input.js` (field-name reads +
  try/catch error recovery). No `index.html` change required — `.crt` is already
  on `<body>`.
- **Specs/docs**: `openspec/specs/input-components/spec.md`,
  `reference/terminal-authoring-guide.md` (already canonical — verify),
  `reference/robco-terminal-architecture.md` (verify), `guida terminale.md`.
- **Content-creator workflow**: holotape authors use `set`/`when` (already what
  the reference guide §5.4 documents); any legacy holotape JSON still using
  `target`/`condition` inside an input component must be migrated, but the new
  error recovery prevents such a typo from ever locking the terminal again.
- **No backend, API, or dependency changes.**
