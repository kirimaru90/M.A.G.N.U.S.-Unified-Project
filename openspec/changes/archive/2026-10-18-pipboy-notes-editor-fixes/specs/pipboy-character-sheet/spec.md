## MODIFIED Requirements

### Requirement: NOTES tab

The `NOTES` first-level tab SHALL render a two-section screen backed by the already-deployed per-character notes and background endpoints. It SHALL be populated only for a user who may write the character (its owner, or an admin); for any other viewer the notes/background reads return `404` and the tab SHALL show its empty states with **no** error banner. The tab render is synchronous, so the screen SHALL paint a loading skeleton first and fill each section after its fetch resolves.

**BACKGROUND section** — a `BACKGROUND` section head with **no** `+` control, followed by a **single dedicated row**, visually separated from the note list as its own thing. The row is backed by `GET /campaigns/:cid/characters/:id/background` (returning `{ background }`, a markdown string or `null`). When a background is set the row SHALL show a first-line text **snippet** of it; when unset the row SHALL show an add-prompt (e.g. `Nessun background — tocca per aggiungere`). Activating the row opens the shared editor in **background mode**.

**NOTE section** — a `NOTE` section head carrying a `+` add control, followed by one **row per note** from `GET /campaigns/:cid/characters/:id/notes`. Each row SHALL show the note's **title** and its **last-update date** (`updatedAt`). Activating the `+` opens the shared editor empty (a new note); activating a row opens the shared editor populated with that note. After any create/update/delete the tab SHALL re-fetch (or otherwise refresh) the affected section and re-render.

**Shared editor** — a modal popup occupying approximately **80% of the screen surface** (the `.pb-info-popup` shell made editable), used for both notes and the background. It presents a formatting **toolbar** (bold, italic, heading, bullet list, quote) above a `contenteditable` body. The user SHALL NOT need to type or see markdown syntax: the toolbar applies formatting as **visible rich text**, on open the stored markdown is parsed into the editable DOM (`mdToDom`), and on save the DOM is serialized back to **markdown** (`domToMd`) over a constrained subset (bold, italic, heading, bullet list, quote, paragraphs). Content pasted into the body SHALL be sanitized down to that same subset. The stored value SHALL be plain markdown, byte-compatible with the terminal app's `marked` rendering; the Pip-Boy SHALL NOT bundle or load any markdown-rendering library.

Each toolbar button SHALL visually reflect whether its format is currently active at the caret/selection (per `document.queryCommandState`), updating as the caret moves or a command is applied. After **every** toolbar command, the editable body SHALL be normalized back to the flat block structure `domToMd` recognizes (block elements as direct children of the editable root, never nested inside one another) — regardless of whether the note is new or was loaded from previously saved markdown — so that toggling a format off (in particular, the bullet list) restores the document's paragraph structure instead of collapsing it into a single run-on block, and any list present at save time SHALL still serialize to markdown `marked` renders as a real list.

The ✕ close control SHALL NOT visually overlap the title input (note mode) or the `BACKGROUND` label (background mode) at any supported viewport width.

- **Note mode**: an editable **title** input at the top and an `ELIMINA` control. Saving requires a non-empty title.
- **Background mode**: a fixed `BACKGROUND` label in place of the title (the background has no title) and **no** delete control; the background is cleared by saving an empty body.

**Persistence** is explicit via a `SALVA` button:
- a new note → `POST /campaigns/:cid/characters/:id/notes { title, note }` (blocked while the title is empty); once created, further saves in the same session → `PATCH .../notes/:noteId`;
- an existing note → `PATCH .../notes/:noteId { title, note }`;
- the background → `PATCH .../background { background }` (an empty body clears it).

The editor SHALL track a **dirty** state by comparing the current `{ title, domToMd(body) }` against the snapshot taken on open (reset to clean on each successful save). Closing the editor (its `✕` or a backdrop tap) while dirty SHALL open a **discard-changes confirmation** (`Chiudere senza salvare?`): confirming discards and closes, cancelling returns to the editor. A clean close SHALL skip the prompt.

**Delete** — activating `ELIMINA` (note mode only) SHALL open a **delete confirmation** (`Eliminare questa nota?`); confirming issues `DELETE .../notes/:noteId`, closes the editor, and refreshes the list; cancelling returns to the editor.

Both confirmations SHALL use a **reusable confirm dialog** whose two buttons are visually separated by a real gap (they SHALL NOT share an edge), so a mis-tap cannot land on the destructive action.

#### Scenario: Notes tab shows a background section and a note list
- **WHEN** the owner selects the `NOTES` tab
- **THEN** a `BACKGROUND` section with exactly one dedicated row and no `+` is shown, followed by a separated `NOTE` section whose head carries a `+`, with one row per note showing its title and last-update date

#### Scenario: Adding a note opens the shared editor empty
- **WHEN** the owner activates the `NOTE` section's `+`
- **THEN** the shared editor opens in note mode with an empty title input and an empty body, and no persistence request is issued yet

#### Scenario: Tapping a note row opens the same editor populated
- **WHEN** the owner taps a note row
- **THEN** the shared editor opens in note mode with the note's title and its body (parsed from stored markdown into formatted text), showing no raw markdown markers

#### Scenario: Saving a new note creates it
- **GIVEN** the empty editor with a title entered
- **WHEN** the owner presses `SALVA`
- **THEN** the app issues `POST .../notes { title, note }`, the editor closes, and the new row appears with its title and date

#### Scenario: Saving without a title is blocked
- **GIVEN** the note editor with an empty title
- **WHEN** the owner presses `SALVA`
- **THEN** no request is issued and the editor stays open

#### Scenario: Saving an existing note updates it
- **WHEN** the owner edits an existing note and presses `SALVA`
- **THEN** the app issues `PATCH .../notes/:noteId { title, note }` and the row reflects the new title and last-update date

#### Scenario: Deleting a note asks for confirmation first
- **WHEN** the owner presses `ELIMINA` in the note editor
- **THEN** a confirm dialog `Eliminare questa nota?` opens with two clearly separated buttons, and only on confirming does the app issue `DELETE .../notes/:noteId`, close the editor, and remove the row

#### Scenario: Background row opens the editor in background mode
- **WHEN** the owner activates the single background row
- **THEN** the shared editor opens with a fixed `BACKGROUND` label (no title input) and no `ELIMINA` control

#### Scenario: Saving the background persists it
- **WHEN** the owner writes text in background mode and presses `SALVA`
- **THEN** the app issues `PATCH .../background { background }` and the background row shows a first-line snippet of the saved text

#### Scenario: Clearing the background by saving empty
- **GIVEN** a character with a set background
- **WHEN** the owner empties the body in background mode and presses `SALVA`
- **THEN** the app issues `PATCH .../background { background: "" }` and the background row returns to its add-prompt

#### Scenario: Formatting is applied without visible markdown
- **WHEN** the owner selects text and taps the toolbar's bold control
- **THEN** the text renders as bold in the editor with no `**` markers shown, and on save the stored value contains the corresponding markdown

#### Scenario: Toolbar reflects active formatting at the caret
- **GIVEN** the editor body has focus
- **WHEN** the owner selects bold text or places the caret inside it
- **THEN** the toolbar's bold control shows an active state matching `document.queryCommandState('bold')`, and it clears when the caret moves outside the bold text

#### Scenario: Toggling the bullet list off restores separate paragraphs
- **GIVEN** a multi-line body with the bullet list active
- **WHEN** the owner taps the bullet control again to deactivate it
- **THEN** the body returns to separate paragraph blocks — one per former list item — rather than a single block joined by line breaks, and the toolbar's bullet control shows an inactive state

#### Scenario: A list added to a previously saved note still saves as a list
- **GIVEN** an existing multi-line note opened for editing (its body loaded from saved markdown)
- **WHEN** the owner selects the lines and taps the bullet control once
- **THEN** the body becomes a flat bullet list (not nested inside a paragraph), and saving produces markdown that `marked.parse` renders as a real `<ul>`/`<li>` list

#### Scenario: Close control never overlaps the title
- **GIVEN** the shared editor is open in note mode
- **WHEN** the popup is rendered at any supported viewport width
- **THEN** the ✕ close control's bounding box does not intersect the title input's bounding box

#### Scenario: Closing with unsaved changes prompts to discard
- **GIVEN** the editor with unsaved edits
- **WHEN** the owner taps the editor's `✕` or the backdrop
- **THEN** a confirm dialog `Chiudere senza salvare?` opens; confirming discards the edits and closes, and cancelling returns to the editor with the edits intact

#### Scenario: Closing with no changes skips the prompt
- **GIVEN** the editor opened and left unchanged
- **WHEN** the owner taps the editor's `✕` or the backdrop
- **THEN** the editor closes immediately with no confirmation and no request

#### Scenario: Non-owner viewer sees an empty screen without errors
- **GIVEN** a viewer who does not own the character, whose notes/background reads return `404`
- **WHEN** they select the `NOTES` tab
- **THEN** the background row shows its add-prompt and the note list is empty, with no error banner shown
