## 1. Terminal-list entry

- [x] 1.1 In `apps/terminal/src/screens/terminal-list.js`, when `isAuthenticated()`, prepend a `[ SCHEDA PERSONALE ]` button above the public-archive buttons; hover/click sounds consistent with the other entries
- [x] 1.2 Route its click to a new callback (e.g. `onPersonalTerminal()`) rather than `onTerminalSelected(id)`; the anonymous render path SHALL NOT create the button
- [x] 1.3 Independently verifiable: open `index.html` authenticated → the entry shows; logged out → it is absent
      (example generated payload the screen consumes — the emulator authors none of it:)
      ```json
      { "content": { "meta": { "id": "<charId>", "title": "SCHEDA PERSONALE — Ada", "public": false },
                     "nodes": { "start": { "text": "## SCHEDA PERSONALE — ADA", "choices": [
                       { "label": "Riepilogo scheda", "target": "summary" },
                       { "label": "Background", "target": "background" },
                       { "label": "Note", "target": "notes" } ] } } },
        "localState": {}, "globalState": {} }
      ```

## 2. Character-selection screen

- [x] 2.1 Create `apps/terminal/src/screens/character-select.js` (mirroring `campaign-select.js`): fetch `GET /campaigns/:cid/characters`, render one button per character, keyboard-navigable via `makeNavHandler`
- [x] 2.2 Empty state: render `NESSUN PERSONAGGIO` plus a `[ Indietro ]` back control when the list is empty
- [x] 2.3 Network/error state: reuse the list screen's `ERRORE DI RETE` pattern with a back control
- [x] 2.4 Render into the existing boot/list container — no new element in `index.html`

## 3. Wiring

- [x] 3.1 In `apps/terminal/src/main.js`, implement `onPersonalTerminal()` → show the character-select screen
- [x] 3.2 On character pick → `apiGet('/campaigns/' + cid + '/characters/' + id + '/terminal')` → `playTerminalData(payload)`
- [x] 3.3 Back from the picker returns to the terminal list; a load error surfaces `ERRORE LETTURA` with a back-to-list control (reuse existing handler)
- [x] 3.4 Confirm disconnecting from the played character terminal returns to the terminal list (existing `onDisconnect` path)

## 4. Tests

- [x] 4.1 Playwright: authenticated session shows `[ SCHEDA PERSONALE ]`; anonymous session does not
- [x] 4.2 Playwright: selecting it renders the picker from a mocked characters list; selecting a character issues the generator request and plays the terminal (assert the `SCHEDA PERSONALE — <NOME>` banner and the three section choices in the live DOM)
- [x] 4.3 Playwright: mocked empty character list renders `NESSUN PERSONAGGIO` with a working back control
- [x] 4.4 Run `npx playwright test` from `apps/terminal`; confirm all pass
