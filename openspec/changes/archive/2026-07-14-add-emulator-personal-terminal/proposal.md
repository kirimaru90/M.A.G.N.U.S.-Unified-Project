## Why

A logged-in player should be able to open their own character's "scheda personale" straight from the RobCo terminal list: pick which character, then walk a read-only terminal showing that character's sheet summary, background, and notes. The server already knows how to generate that terminal (`add-personal-terminal-generator`); this change adds the emulator's entry point and character picker.

## What Changes

- When a user is **authenticated**, the terminal list SHALL show a synthetic `[ SCHEDA PERSONALE ]` entry above the campaign's archives. It is not a stored terminal — selecting it does not hit `GET /terminals/:id/load`.
- Selecting it opens a **character-selection screen** populated from `GET /campaigns/:cid/characters` (a player sees only their own characters), rendered in the existing terminal container — **no `index.html` change** (reuses the boot/list container, consistent with how `mountTerminalList` already renders into it).
- Choosing a character calls `GET /campaigns/:cid/characters/:id/terminal` and hands the payload to the emulator's existing `playTerminalData`, so playback, headers, typing, sound, and back/disconnect all work unchanged.
- Empty state: a player with no characters sees `NESSUN PERSONAGGIO` and a way back to the list.
- The `[ SCHEDA PERSONALE ]` entry SHALL NOT appear for anonymous users.
- Back navigation from the picker returns to the terminal list; disconnecting from the character terminal returns to the terminal list as usual.

## Capabilities

### New Capabilities

- `emulator-personal-terminal`: A logged-in-only terminal-list entry that opens a character picker and plays the server-generated per-character terminal.

### Modified Capabilities

## Impact

- `apps/terminal/src/screens/terminal-list.js`: inject the synthetic entry when authenticated; route its selection to the picker via a sentinel rather than `onTerminalSelected(id)`.
- New screen module `apps/terminal/src/screens/character-select.js` (mirrors `campaign-select.js`).
- `apps/terminal/src/main.js`: wire the picker → generator fetch → `playTerminalData`.
- **No `index.html` change** — the feature is achieved with existing containers and the existing playback engine; only screen/engine JS is added.
- **Content-creator workflow: unaffected.** This terminal is *generated from character data*, never authored as terminal JSON, so it introduces no new authoring surface, manifest entry, or schema for content creators. The terminal-authoring guide needs no change.
- **Depends on** `add-personal-terminal-generator` (which depends on `add-character-background-and-notes`).

## Testing

Verified by an automated **Playwright** test (`apps/terminal/tests/*.spec.ts`) that loads the real `index.html` over the bundled static server with a mocked API:

- With an authenticated session, `[ SCHEDA PERSONALE ]` appears in the terminal list; with an anonymous session it does not.
- Selecting it renders the character picker from a mocked `GET /campaigns/:cid/characters`.
- Choosing a character issues `GET /campaigns/:cid/characters/:id/terminal` (mocked) and the live DOM shows the played terminal — the `start` banner `SCHEDA PERSONALE — <NOME>` and navigable `Riepilogo / Background / Note` choices.
- A mocked empty character list renders `NESSUN PERSONAGGIO` with a working back control.

The final task runs `npx playwright test` from `apps/terminal` and confirms all pass. (Playwright is already wired per the app README, so no dependency on `enable-emulator-testing`.)
