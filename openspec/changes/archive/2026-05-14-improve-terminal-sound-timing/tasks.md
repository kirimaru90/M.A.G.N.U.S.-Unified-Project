## 1. Move data-terminal sound to file-load entry

- [x] 1.1 In `loadServerFile()`, add `dataTerminalSound()` call at the very start of the function body, before `fetch()` is called (alongside the "ESTRAZIONE DATI IN CORSO…" assignment)
- [x] 1.2 Remove `dataTerminalSound()` from `startSystem()`

## 2. Move typing sound start to renderNode

- [x] 2.1 Add `typingSound.start()` at the entry of `renderNode()`, before the `typeWriterHTML` call
- [x] 2.2 Remove `typingSound.start()` from `startSystem()`
- [x] 2.3 Remove `typingSound.start()` from the click listener inside `addBtnSounds()` (keep `clickSound()` and `hoverSound` listeners intact)

## 3. Verify login gating works structurally

- [x] 3.1 Confirm that `loadNode` returns early (before `renderNode`) when a login block is found and the user is unauthenticated — no code change needed, just verify the existing early-return path is preserved after task 2
- [x] 3.2 Open a terminal file that has a node-level login in the browser: verify the typing sound does NOT play on the login screen, and DOES play after correct password is entered
