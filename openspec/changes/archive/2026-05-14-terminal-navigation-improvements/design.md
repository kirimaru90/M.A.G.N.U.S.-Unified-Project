## Context

The terminal runs entirely in a single `index.html` file with vanilla JS. Navigation state lives in `navigationHistory[]`, `terminalData{}`, and `seenNodes` (Set). Choices are rendered by `showChoices()` into `#choices-container` each time a node loads.

Currently, all interaction is mouse-only. There is no keyboard handling anywhere in the file. There is no way to return to the boot screen once a terminal is loaded (except through the login screen back button, which is not always present).

## Goals / Non-Goals

**Goals:**
- Add keyboard navigation (ArrowUp/Down, Enter, Escape) scoped to the choices panel
- Add a discrete, auto-generated exit button visible only at the `start` node
- Keep all changes confined to `index.html` with no new dependencies

**Non-Goals:**
- Keyboard support outside the choices panel (boot screen, login screen)
- Touchscreen / gamepad support
- Custom exit nodes in JSON content (no content authoring changes)
- Animation or sound for the exit button (stays consistent with existing hover/click sounds via `addBtnSounds`)

## Decisions

### Decision 1: Keyboard listener lifecycle — replace on each `showChoices()` call

**Choice:** Remove the previous `keydown` listener and attach a fresh one each time `showChoices()` is called, using a module-level variable to hold the current handler reference.

**Why:** `showChoices()` is the single point where the choices panel is rebuilt. Attaching the listener here avoids ghost listeners from previous nodes. Alternatives considered:
- *Event delegation on `document` with always-on handler*: simpler but harder to scope correctly — would interfere with login screen inputs and the hidden archive input.
- *AbortController*: cleaner API but requires careful coordination; overkill for a single handler.

### Decision 2: Exit button condition — `navigationHistory.length === 1`

**Choice:** Render the disconnect button if and only if `navigationHistory.length === 1` after pushing the current node.

**Why:** This corresponds exactly to being at the root of a terminal session. It's already the condition checked in `showChoices()` for the back button (which is hidden at depth 1), so it's consistent with existing logic.

### Decision 3: Exit button style — separate CSS class `.choice-btn-system`

**Choice:** Add a new CSS class `.choice-btn-system` that inherits from `.choice-btn` but overrides with lower opacity (0.5) and no text-shadow.

**Why:** Keeps the exit button visually subordinate without duplicating all `.choice-btn` styles. A separator `<p class="system-separator">---</p>` provides additional visual grouping.

### Decision 4: Escape key behavior — mirrors navigationHistory depth

**Choice:** Escape calls `goBack()` when `navigationHistory.length > 1`; otherwise it triggers the full disconnect/reset flow.

**Why:** Consistent with the discrete exit button logic — Escape from root equals clicking "disconnect", Escape from deeper nodes equals clicking "torna al menu precedente". No extra state needed.

### Decision 5: Auto-focus on first choice after typewriter completes

**Choice:** Focus the first button inside `showChoices()`, which is called in the typewriter callback.

**Why:** Focus is only meaningful after content is rendered. Applying it earlier (e.g., at `loadNode()`) would steal focus during typing animation, which could interfere with scroll and feel jarring.

## Risks / Trade-offs

- **Focus style flash**: Browsers apply a default focus ring that may look inconsistent before CSS overrides it. → Mitigation: Add an explicit `:focus` style in CSS matching the existing `:hover` style (green background, dark text).
- **Mobile irrelevance**: Arrow key navigation provides no benefit on touch devices. → Acceptable: the target experience is desktop browser.
- **Escape conflicts with login inputs**: The login screen has password and select fields where Escape may have browser-default behavior. → Non-issue: the keyboard listener is only attached when `showChoices()` is called, which never happens while the login screen is open.

## Migration Plan

Single-file change. No deployment steps beyond replacing `index.html`. Fully backward-compatible — no JSON content changes required.
