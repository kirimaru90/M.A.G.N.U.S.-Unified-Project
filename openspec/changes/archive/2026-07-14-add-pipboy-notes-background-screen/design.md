## Context

The Pip-Boy (`apps/pip-boy`) is a vanilla-ES-module PWA with **no build step** and an offline service worker. Its `NOTES` tab is a placeholder ([src/tabs/notes.js](../../../apps/pip-boy/src/tabs/notes.js)). The backend it needs already exists (commit `af90ad4`):

- **Notes** — a per-character collection: `GET`/`POST /campaigns/:cid/characters/:id/notes`, `PATCH`/`DELETE .../notes/:noteId`; a note is `{ id, title, note, createdAt, updatedAt }` (`title` required, `note` is a markdown string).
- **Background** — a character field read/written only through `GET`/`PATCH .../background`, returning/accepting `{ background }` (string or `null`; empty string clears).

Both enforce owner-or-admin access and `404` everyone else. The same `note`/`background` markdown is rendered elsewhere by the terminal app via `marked` ([terminal.js:88](../../../apps/terminal/src/screens/terminal.js#L88)), so the Pip-Boy must produce **standard markdown**, not a private format.

Existing patterns this change builds on: the 80%-surface `.pb-info-popup` ([info-popup.js](../../../apps/pip-boy/src/tabs/info-popup.js)); the `.pb-inv-head` + `.pb-inv-add` `+` header and list rows ([gear.js](../../../apps/pip-boy/src/tabs/gear.js)); section-scoped API modules under `src/api`; and the async-fill-after-render pattern of [character-select.js](../../../apps/pip-boy/src/screens/character-select.js).

## Goals / Non-Goals

**Goals:**
- Replace the placeholder with a working two-section (background + notes) screen in the app's existing amber/CRT visual language.
- Let non-technical players format text **without seeing or typing markdown**, while storing standard markdown.
- Reuse existing chrome (popup shell, list rows, `+` head) rather than inventing new visual patterns.
- Keep the app dependency-free and offline-safe (no CDN, no bundler).

**Non-Goals:**
- No backend, schema, or API change — endpoints ship as-is.
- No markdown **renderer** in the Pip-Boy (WYSIWYG makes it unnecessary).
- No full CommonMark support — only the subset the toolbar exposes (bold, italic, heading, bullet list, quote, paragraphs). No tables, images, code blocks, inline links (can be a later change).
- No autosave, no draft persistence, no offline write queue — saves are explicit and online.

## Decisions

### WYSIWYG `contenteditable` over a markdown textarea
A `contenteditable` shows bold-as-bold and never exposes `**`/`#`, directly meeting "use markdown without knowing its syntax." A decisive side effect: the edit view *is* the rendered view, so the Pip-Boy needs **no markdown parser at runtime** — sidestepping the offline/CDN problem the terminal app avoids only because it isn't a PWA.
- *Alternatives:* a plain textarea whose toolbar inserts `**…**` (simplest and most paste-robust, but leaves markers on screen — fails the goal); a textarea with a live preview pane (still shows syntax and would require a vendored renderer offline). Rejected for the stated goal.

### A constrained markdown subset with a hand-rolled `mdToDom`/`domToMd`
Round-tripping arbitrary HTML↔markdown is where WYSIWYG editors get large and buggy. Constraining to exactly the five toolbar constructs keeps a hand-written serializer small, testable (`domToMd(mdToDom(x)) === x`), and in the app's no-dependency spirit. The serializer canonicalizes so the round-trip is stable; paste is walked and reduced to the subset (unknown tags → their text content), so the serializer never meets a node it can't emit.
- *Alternative:* vendoring a WYSIWYG/markdown library as a local ES module. Rejected — heavier, and unnecessary for a five-button subset.

### One editor component, parameterized by mode
`+` and row-tap open the **same** `openNoteEditor({ mode })`. `note` mode has a title input and `ELIMINA`; `background` mode swaps the title for a fixed label and drops delete. This keeps a single toolbar/serializer/dirty/close implementation and guarantees notes and background feel identical.
- *Alternative:* two editors. Rejected — duplicates the hard part (serializer, dirty tracking, close guard).

### Explicit save + dirty snapshot + close guard (not save-on-blur)
Per the product decision, the editor persists only on `SALVA`. It snapshots `{ title, domToMd(body) }` on open; *dirty* = current ≠ snapshot; save resets the snapshot. Closing while dirty routes through the discard-changes confirm. This makes "new + empty → nothing created" fall out for free (nothing persists without `SALVA`, and `SALVA` blocks an empty title), and it matches a note being a larger, deliberate edit than the app's steppers.

### Reusable, spaced-button confirm dialog
Delete and discard-changes share one `openConfirm({ message, confirmLabel, danger })`. The two buttons are separate flex items with a real `gap` and no shared border, so a mis-tap cannot hit the destructive action — the one place to get spacing right. The app has no confirm dialog today, so this is genuinely new (existing deletes are confirmation-free by design; a note/discard is costlier to undo, hence the guard).

### Notes state is local to the tab (not `onSectionUpdate`)
Notes live outside the character document, so — unlike inventory/status — they don't flow through the sheet's `onSectionUpdate`. `renderNotesTab` owns a local list, fetched on entry and re-fetched after each mutation. Background is a single value fetched/patched the same way. This keeps the sheet shell untouched.

### Background is a character endpoint on `characters.js`; notes get their own module
`getBackground`/`patchBackground` join the other per-character section calls in `src/api/characters.js`. Notes, being a separate collection with their own id-addressed routes, get a dedicated `src/api/notes.js` — mirroring the existing file-per-concern split.

## Risks / Trade-offs

- **`contenteditable` inconsistencies / `execCommand` deprecation** → Constrain formatting to the five constructs and drive them by direct DOM manipulation (or `execCommand` where still reliable) over the controlled subset; the serializer is the source of truth, so cosmetic DOM quirks don't corrupt the stored markdown. Playwright covers the toolbar and round-trip.
- **Messy paste (Word/web HTML)** → A paste handler intercepts and inserts only sanitized subset nodes (or plain text), so the body can never hold a construct `domToMd` can't emit.
- **Round-trip drift** (a note saved, reopened, and re-saved mutates) → `mdToDom`/`domToMd` canonicalize to a normal form; unit tests assert idempotence over the subset and that output parses in `marked` to the intended structure.
- **Lost edits from an accidental close** → the dirty snapshot + discard-changes confirm is exactly the mitigation; a clean close is silent.
- **No offline writes** → out of scope; a failed save surfaces an error and leaves the editor open with the text intact (dirty), so nothing is lost.
- **Background snippet from markdown** → the row shows a first-line snippet derived from the plain-text of the stored markdown (strip markers) to avoid showing `#`/`**` in the row.

## Migration Plan

Additive front-end change; no data migration. Ship the new/edited files together; the `NOTES` tab swaps from placeholder to the new screen on deploy. Rollback = revert the front-end files (the API is unchanged and was already live). Bump the PWA cache version per the app's existing deploy convention so clients pick up the new modules.

## Open Questions

- Numbered lists and inline links are excluded from the initial subset — add later if authors ask.
- Heading levels: the toolbar exposes a single heading level (`##`); multiple levels can follow if needed.
