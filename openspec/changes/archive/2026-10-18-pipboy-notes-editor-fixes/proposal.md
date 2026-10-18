## Why

The Pip-Boy's shared note/background editor (`pipboy-character-sheet`'s "Shared editor") has four live, confirmed defects: the ✕ close control overlaps the title input, the formatting toolbar never reflects which formats are active, the bullet-list toggle collapses previously-separate lines into one run-on block instead of restoring paragraphs, and — as a direct consequence — notes saved with a bullet list render as fused, bullet-less text in the separately-deployed terminal app. Live Playwright reproduction against real Chromium traced the last two to the same root cause: `execCommand`'s DOM output shape depends on whether the editor's content was freshly typed or loaded from saved markdown, and nothing in the editor normalizes that output back to the flat block shape `domToMd` requires — so the spec's existing "byte-compatible with the terminal app's `marked` rendering" guarantee is silently violated for any note edited after being saved once.

## What Changes

- Fix the `.pb-note-title` box-model conflict (`width: 100%` plus a non-auto `margin-right` add instead of subtract) so the title input never renders under the ✕ close control.
- Add real toolbar active-state tracking: each button (bold, italic, heading, bullet, quote) reflects `document.queryCommandState(...)` on selection/caret changes, via a visible active/inactive style.
- After every toolbar command, normalize the editable body back to the canonical flat block structure (`P`/`DIV`/`H2`/`UL`/`BLOCKQUOTE` as direct root children) instead of leaving whatever nested or `<br>`-joined shape `execCommand` happened to produce — restoring both a clean bullet-list toggle-off (separate paragraphs, not one `<br>`-joined blob) and a valid, list-preserving markdown save.
- Extend Playwright coverage (`apps/pip-boy/tests/notes-tab.spec.ts`, `markdown-roundtrip.spec.ts`) to lock in: no close-button/title overlap, toolbar active-state reflects `queryCommandState`, a list can be toggled on and back off without losing line structure, and a note edited (not just newly typed) with a bullet list still serializes to a `marked`-renderable list.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `pipboy-character-sheet`: the NOTES tab's shared editor requirement gains explicit, testable guarantees — the toolbar SHALL reflect active formatting state, toggling a format off SHALL preserve the document's paragraph structure, and the DOM SHALL always be normalized to the shape `domToMd` can serialize, so the stored markdown stays byte-compatible with the terminal app's `marked` rendering regardless of whether the note is new or previously saved. The close control SHALL NOT overlap the title/label.

## Impact

- `apps/pip-boy/src/tabs/note-editor.js` — toolbar state sync, post-command DOM normalization.
- `apps/pip-boy/src/styles/pipboy.css` — `.pb-note-title` box-model fix, active-state styling for `.pb-note-tool`.
- `apps/pip-boy/src/sheet/markdown.js` — touched only if normalization is implemented via `domToMd`/`mdToDom` round-trip rather than in-place DOM surgery (design decision, see design.md).
- No changes expected in `apps/terminal`: the terminal's `marked.parse` rendering of a well-formed list is already proven correct by the existing round-trip spec; this change fixes the producer, not the consumer.

## Testing

- **Layer**: e2e, Playwright, following the existing `apps/pip-boy/tests` conventions (a local static server + a fully mocked API, headless Chromium) — no new test infrastructure needed.
- Behaviors under test:
  - `.pb-popup-close` and `.pb-note-title` bounding boxes never overlap (regression guard for the CSS box-model fix).
  - After clicking bold/italic/heading/bullet/quote, the corresponding toolbar button's active/inactive class matches `document.queryCommandState(...)`.
  - Clicking bullet twice on a multi-line body returns the body to separate paragraph blocks (not a single `<br>`-joined block), and `domToMd` of that state contains no list markers.
  - Editing an existing (previously saved) multi-line note and applying bullet once produces a flat `<ul>`/`<li>` structure (not nested inside a `<p>`), and the resulting `domToMd` output, run through `marked.parse`, yields a real `<ul>`/`<li>` — closing the loop the bug report actually started from.
