## Context

`apps/pip-boy/src/tabs/note-editor.js` builds a `contenteditable` body from stored markdown via `mdToDom` (from `apps/pip-boy/src/sheet/markdown.js`), lets the user format it with a small toolbar (`document.execCommand`), and serializes it back with `domToMd` on save. `domToMd` only recognizes `P`/`DIV`/`H2`/`UL`/`BLOCKQUOTE` as blocks, and only as **direct children of the editable root** — it was written against the flat shape `mdToDom` itself produces, not against whatever `execCommand` happens to leave behind.

Live reproduction (Playwright + real Chromium) showed `execCommand('insertUnorderedList')` does not reliably preserve that flat shape:
- On freshly-typed content (one `<br>`-joined block), toggling bullet on then off leaves `<b>a</b><br><b>b</b><br><b>c</b>` — a single block, not three paragraphs.
- On content loaded from saved markdown (`mdToDom` → separate `<p>` elements), toggling bullet on **once** produces `<p><ul><li>a</li><li>b</li></ul></p>` — the `<ul>` nested inside the first `<p>` instead of replacing all the `<p>`s.

`domToMd`'s recursive inline-flattening (`childInlineMd`/`inlineToMd`) has no case for a block tag nested inside another block tag, so it silently drops separators: `<br>` becomes a bare space, but a nested block's children get concatenated with **nothing**. Both bugs (list won't "turn off" cleanly; saved lists don't render as lists in the terminal app) are this one gap surfacing two different ways.

Separately, `note-editor.js` never reads back format state after an `execCommand` call (no `queryCommandState` anywhere), and `.pb-note-title` combines `width: 100%` with a non-auto `margin-right`, which is a well-known CSS box-model conflict — margin extends past a 100%-wide box rather than carving room out of it — putting the title input under the ✕ close control.

## Goals / Non-Goals

**Goals:**
- The editor's body is always in the flat, `domToMd`-recognized shape after any toolbar action, regardless of whether the note is new or was loaded from saved markdown.
- Toolbar buttons visibly reflect `document.queryCommandState(...)` for the caret/selection at all times the editor is open.
- The ✕ control never overlaps the title input at any supported viewport width.
- Saved markdown for a note containing a list stays byte-compatible with `marked.parse` (the terminal app's renderer) — proven by an e2e assertion that actually calls `marked.parse`, not just an assumption.

**Non-Goals:**
- Rewriting the editor onto a different contenteditable strategy (e.g. a full block-model editor, ProseMirror/Slate-style). The fix stays inside the existing `execCommand` + `domToMd`/`mdToDom` architecture.
- Expanding the supported markdown subset (still bold/italic/heading/bullet/quote/paragraph only).
- Any change in `apps/terminal` — its `marked.parse` rendering of a well-formed list is already covered by the existing round-trip spec and is not touched.

## Decisions

### 1. Normalize by round-tripping through `domToMd` → `mdToDom`, not manual DOM surgery

After every toolbar `execCommand`, re-serialize the body with the editor's own `domToMd`, then rebuild it with `mdToDom`, and replace the body's contents with the result.

**Why**: `mdToDom`'s output is *by definition* the shape `domToMd` can serialize — reusing it as the normalizer means there are not two independent notions of "canonical DOM shape" to keep in sync. It also directly fixes the nested-`<ul>`-inside-`<p>` case: once serialized to markdown, `- a\n- b` has no notion of nesting to lose.

**Alternative considered**: Walk the DOM after each command and manually un-nest block tags found inside other block tags. Rejected — it means hand-writing a second serializer that has to track every way `execCommand` can misbehave across browsers, duplicating logic `domToMd`/`mdToDom` already own correctly.

**Caret/selection risk**: replacing the body's `innerHTML` drops the caret. Mitigation: after rebuilding, restore focus to the body and place the caret at the **end of the block that was just acted on** (found by counting characters into the newly built DOM up to the pre-normalization caret offset, or — simpler and acceptable for this editor's scale — end of the last modified top-level block). This trades perfect caret fidelity for simplicity; flagged as an open question below since it's the one part of this design most worth a second look before implementation.

### 2. Active-state sync via a single `selectionchange`-scoped listener, not per-button polling

Attach one `document.addEventListener('selectionchange', ...)` while the editor is open (removed on close), debounced to the next animation frame, that calls `document.queryCommandState(cmd)` once per toolbar entry and toggles an `is-active` class. Also re-run it synchronously right after each toolbar click (so the just-clicked button updates immediately, without waiting on the selection-change event some browsers fire late for programmatic changes).

**Why**: `selectionchange` is the only event that reliably fires for both mouse/keyboard caret movement and programmatic selection changes from `execCommand`, and one listener for five buttons is simpler than five.

**Alternative considered**: Poll `queryCommandState` on an interval. Rejected as wasteful and laggy compared to an event-driven update.

### 3. CSS fix: replace `width: 100%` + `margin-right` with `width: calc(100% - 28px)`

`.pb-note-title` keeps its `margin-right: 28px` comment/intent, but the width calculation now actually subtracts that space instead of adding it on top.

**Alternative considered**: Restructure the popup header into a flex row (title `flex: 1`, close button in normal flow instead of `position: absolute`). More invasive (changes how `.pb-popup-close` is positioned across every popup that reuses it, e.g. `info-popup.js`, `settings-popup.js`), so rejected in favor of the smallest fix that resolves the overlap without touching shared popup chrome.

## Risks / Trade-offs

- **[Risk]** Re-normalizing on every toolbar click could visibly "flatten" formatting the user did not intend to lose (e.g. anything outside the supported subset that leaked in some other way). → **Mitigation**: this is actually the current save-time behavior already (domToMd/mdToDom already run once at save); moving it to run after every toolbar click just makes an existing lossy boundary happen more often but no more lossy than what already happens today at save time. Cover with the round-trip spec's existing SAMPLES plus a case for each toolbar command.
- **[Risk]** Caret placement after DOM rebuild may occasionally land somewhere surprising (see Decision 1). → **Mitigation**: scope the fix to "caret returns to the end of the affected block," verify with an e2e test that types after a toolbar click and asserts the new text lands in the right block; revisit if manual testing shows it's disorienting.
- **[Risk]** `execCommand` behavior is browser-dependent; a fix verified only in Chromium (Playwright's default) could behave differently in Firefox/Safari-based mobile browsers the Pip-Boy actually targets. → **Mitigation**: the normalization step's whole point is to make the *result* independent of whatever DOM shape `execCommand` produced, so it should be robust to this — but flag as a manual cross-browser smoke check before shipping, since the e2e suite only runs Chromium today.

## Migration Plan

None — client-side bug fix, no data model or API change, no stored data migration. Existing saved notes are unaffected until next edited and re-saved.

## Open Questions

- Exact caret-restoration heuristic after normalization (end of affected block vs. attempting character-offset fidelity) — proposed as "end of affected block" above; confirm this is acceptable before implementation, since it's the one behavior change a user could actually feel while typing.
- Should normalization run after *every* toolbar command (bold/italic/heading/quote too), or only after list-affecting commands (bullet), since bold/italic don't structurally nest blocks the way list conversion does? Leaning toward running it uniformly for consistency and to keep one code path, but scoping it to just `bullet` would be a smaller, lower-risk change if preferred.
