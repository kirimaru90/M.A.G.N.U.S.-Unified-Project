## 1. API clients

- [x] 1.1 Add `src/api/notes.js` with `listNotes(campaignId, characterId)`, `createNote(campaignId, characterId, { title, note })`, `updateNote(campaignId, characterId, noteId, body)`, `deleteNote(campaignId, characterId, noteId)`, using the existing `apiGet/apiPost/apiPatch/apiDelete` client.
- [x] 1.2 Add `getBackground(campaignId, characterId)` and `patchBackground(campaignId, characterId, { background })` to `src/api/characters.js`.

## 2. Markdown subset engine

- [x] 2.1 Add `src/sheet/markdown.js` exporting `mdToDom(md)` → a DocumentFragment/HTML for the subset (bold `**`, italic `*`, heading `##`, bullet list `-`, quote `>`, paragraphs) and `domToMd(root)` → the canonical markdown string.
- [x] 2.2 Add a `sanitizePaste(dataTransfer)` (or equivalent) helper that reduces pasted HTML to the supported subset, collapsing unknown nodes to their text content.
- [x] 2.3 Unit-test round-trip idempotence (`domToMd(mdToDom(x)) === x`) over the subset and that `mdToDom` output re-serializes to the same markdown; verify emitted markdown parses in `marked` to the intended structure.

## 3. Confirm dialog

- [x] 3.1 Add `src/tabs/confirm-dialog.js` exporting `openConfirm({ message, confirmLabel, danger, onConfirm })` — an overlay with a message and two buttons (cancel + confirm) that are separate flex items with a real gap and no shared edge; backdrop/cancel dismiss without confirming.
- [x] 3.2 Add matching styles in `src/styles/pipboy.css` (dialog box, spaced buttons, danger accent) consistent with the existing popup chrome.

## 4. Shared note/background editor

- [x] 4.1 Add `src/tabs/note-editor.js` exporting `openNoteEditor({ mode, title, body, onSave, onDelete })` built on the `.pb-info-popup` 80%-surface shell made editable, with `mode: 'note' | 'background'`.
- [x] 4.2 Render the toolbar (bold, italic, heading, bullet list, quote) over a `contenteditable` body; on open call `mdToDom(body)`; wire toolbar actions to format the current selection over the supported subset (no markers shown).
- [x] 4.3 Wire the paste handler to `sanitizePaste` so only subset content enters the body.
- [x] 4.4 In `note` mode render the editable title input and the `ELIMINA` control; in `background` mode render the fixed `BACKGROUND` label and no delete.
- [x] 4.5 Implement dirty tracking: snapshot `{ title, domToMd(body) }` on open; compute dirty as current ≠ snapshot; reset snapshot on successful save.
- [x] 4.6 Implement `SALVA`: serialize via `domToMd`, block in note mode when the title is empty, call `onSave({ title, note })`, then close on success; keep the editor open (text intact) on save failure.
- [x] 4.7 Implement close (`✕`/backdrop): when dirty, `openConfirm({ message: 'Chiudere senza salvare?' })` and only discard/close on confirm; when clean, close immediately with no prompt.
- [x] 4.8 Implement `ELIMINA` (note mode): `openConfirm({ message: 'Eliminare questa nota?', danger: true })`, then call `onDelete()` on confirm and close.
- [x] 4.9 Add editor styles in `src/styles/pipboy.css` (editable popup body, toolbar buttons, title input, SALVA/ELIMINA button row spacing).

## 5. NOTES tab rewrite

- [x] 5.1 Rewrite `src/tabs/notes.js` `renderNotesTab(container, ctx)` to read `campaignId`, `character`, `canEdit` from ctx, paint a loading skeleton, then load both sections asynchronously.
- [x] 5.2 Render the BACKGROUND section: a `BACKGROUND` head with no `+`, one dedicated row; fetch via `getBackground`; show a first-line plain-text snippet when set and an add-prompt when unset; tapping opens `openNoteEditor({ mode: 'background' })` whose save calls `patchBackground` and refreshes the row.
- [x] 5.3 Render the NOTE section: a `NOTE` head with a `+`; fetch via `listNotes`; one row per note showing title + `updatedAt` date; visually separate it from the background section.
- [x] 5.4 Wire `+` to open the empty editor in note mode; on save `createNote` then re-fetch and re-render the list (subsequent saves in the same session PATCH the returned id).
- [x] 5.5 Wire row tap to open the populated editor; on save `updateNote`, on delete `deleteNote`, then re-fetch and re-render.
- [x] 5.6 Handle the non-owner/`404` case: show empty states (add-prompt + empty list) with no error banner; only fetch when `canEdit`.
- [x] 5.7 Add screen styles in `src/styles/pipboy.css` (section heads, separator between background and notes, background row, note rows).

## 6. Tests & verification

- [x] 6.1 Add a Playwright spec under `apps/pip-boy/tests` (API mocked) covering: tab layout (background row, no `+`; note head `+`; rows show title + date); note create/edit/delete-with-confirm; save blocked on empty title; background save and clear-by-empty; discard-changes prompt on dirty close and its absence on clean close; toolbar formatting shows no markers; non-owner empty state.
- [x] 6.2 Run the Pip-Boy test suite (`npm test` in `apps/pip-boy`) and the markdown unit tests; confirm all green.
- [x] 6.3 Bump the PWA cache version per the app's deploy convention so clients pick up the new modules.
