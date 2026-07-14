## Why

The Pip-Boy `NOTES` tab is a spec'd static placeholder (`pipboy-character-sheet` → *NOTES tab*), yet the persistence and API it needs already exist: commit `af90ad4` shipped a full per-character **notes** collection (`GET`/`POST /campaigns/:cid/characters/:id/notes`, `PATCH`/`DELETE .../notes/:noteId`) and a **background** field (`GET`/`PATCH .../background`). This change is the missing front-end: it turns the placeholder into a working notes-and-background screen so players can capture titled notes and a character background in-app. Because non-technical players author the text, the editor must let anyone produce markdown **without knowing its syntax** — the same markdown the terminal app already renders through `marked`.

## What Changes

- Rewrite the `NOTES` tab into a screen with **two sections**:
  - a **BACKGROUND** section — a single dedicated row (no `+`), visually fenced off as its own thing, backed by `GET`/`PATCH .../background`;
  - a **NOTE** list — one row per note showing its **title** and **last-update date**, with a `+` add trigger, backed by the notes collection endpoints.
- Add a shared **WYSIWYG note editor** popup, ~80% of the screen surface (the existing `.pb-info-popup` shell made editable), opened both by `+` (empty) and by tapping any row. It presents a formatting toolbar (**bold, italic, heading, bullet list, quote**) over a `contenteditable` body. The user never types or sees markdown markers; on save the body is **serialized to real markdown**, and on open markdown is parsed back into the editable DOM. Pasted rich text is sanitized down to the supported subset.
  - **Note mode**: an editable title input, plus an `ELIMINA` delete guarded by an *"Eliminare questa nota?"* confirmation.
  - **Background mode**: a fixed `BACKGROUND` label (no title), no delete — clearing is done by saving an empty body.
- Persistence is **explicit**: the editor has a `SALVA` button (POST for a new note, PATCH for an existing note or the background). Closing the editor while there are **unsaved changes** shows a *"Chiudere senza salvare?"* confirmation.
- Add a small reusable **confirm dialog** with two clearly-separated buttons (a real gap, no shared edge), serving both the delete and discard-changes prompts.
- The Pip-Boy ships **no markdown renderer**: because `contenteditable` shows formatted text natively, the edit view *is* the rendered view. `marked` remains only in the terminal app.
- Access stays owner-only: the notes/background endpoints `404` for non-owners, so a non-owning viewer simply sees an empty screen; the tab is populated only for the owner or an admin.

## Capabilities

### New Capabilities

*(none — the API capabilities `api-character-notes` and the `api-characters` background field already shipped in commit `af90ad4`. This is a front-end-only change.)*

### Modified Capabilities

- `pipboy-character-sheet`: the *NOTES tab* requirement is replaced — from "renders a static placeholder, no backend" to a two-section (background + notes) screen with a shared WYSIWYG markdown editor, explicit save, delete-with-confirm, and a discard-changes guard.

## Impact

- **Front-end only**, `apps/pip-boy` (vanilla ES modules, no build step, offline PWA):
  - New: `src/api/notes.js` (list/create/update/delete), `src/tabs/note-editor.js` (the shared editor), `src/tabs/confirm-dialog.js` (reusable spaced-button confirm), `src/sheet/markdown.js` (`mdToDom`/`domToMd` for the supported subset + paste sanitizing).
  - Edited: `src/api/characters.js` (add `getBackground`/`patchBackground`), `src/tabs/notes.js` (rewrite from placeholder to the two-section screen), `src/styles/pipboy.css` (sections, background row, note rows, editor, toolbar, confirm dialog).
- **No backend, schema, or API changes** — endpoints and access control already exist and are unchanged.
- **No new runtime dependency** — no markdown library is added to the Pip-Boy; the stored value is plain markdown, byte-compatible with the terminal app's `marked` rendering.
- The `NOTES` tab remains the fifth first-level tab; navigation, swipe, and footer behaviour (`pipboy-sheet-navigation`) are untouched.

## Testing

Verified by the existing Pip-Boy **Playwright** e2e harness (`apps/pip-boy/tests`, which loads the app and asserts on the live DOM against a mocked API), superseding manual browser checks:

- **Screen layout** (e2e): the `NOTES` tab renders a BACKGROUND section with exactly one dedicated row and **no** `+`, plus a NOTE section whose head carries a `+`; note rows show title and last-update date.
- **Note lifecycle** (e2e, API mocked): `+` opens the empty editor; `SALVA` with a title issues `POST .../notes` and the row appears; tapping a row opens the editor populated; editing and `SALVA` issues `PATCH .../notes/:id`; `ELIMINA` → confirm → `DELETE .../notes/:id` removes the row; `SALVA` with an empty title is blocked (no request).
- **Background lifecycle** (e2e): the background row opens the editor in background mode (fixed label, no title, no delete); `SALVA` issues `PATCH .../background`; saving an empty body clears it; the row shows a first-line snippet when set and an add-prompt when empty.
- **Editor behaviour** (e2e/unit): the toolbar applies bold/italic/heading/list/quote as visible formatting (no markers on screen); closing with unsaved changes shows *"Chiudere senza salvare?"* (CHIUDI discards, ANNULLA stays); a clean close skips the prompt.
- **Markdown round-trip** (unit, `src/sheet/markdown.js`): `domToMd(mdToDom(x)) === x` over the supported subset (bold, italic, heading, bullet list, quote, paragraphs); pasted rich HTML is reduced to the supported subset; the emitted string parses in `marked` to the intended structure.
- **Access** (e2e): a non-owner viewer whose notes/background requests `404` sees an empty screen and no error banner.
