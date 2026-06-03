## 1. Login screen Enter key

- [x] 1.1 In `showLoginView` (index.html), after cloning and replacing the submit/back buttons, add a `keydown` listener on `loginPasswordEl` that calls the submit logic when `e.key === 'Enter'` — mirror the existing pattern used by `hiddenInput`
- [x] 1.2 Verify: open index.html, navigate to a login-protected node, type the correct password and press Enter — the login screen should dismiss and the node should render
- [x] 1.3 Verify: press Enter with a wrong password — `CREDENZIALI NON VALIDE` appears, overlay stays

## 2. Fast replay typing for seen nodes

- [x] 2.1 Declare `let seenNodes = new Set();` alongside `loggedInUsers` and `navigationHistory` at the top of the script block in `index.html`
- [x] 2.2 At the start of `renderNode`, add the node's id to `seenNodes` — requires passing the node id into `renderNode`; update all three call sites in `loadNode` and `showAlreadyLoggedIn` callback to pass the id
- [x] 2.3 In `renderNode`, compute `const speed = seenNodes.has(nodeId) ? 0 : typingSpeed;` and pass it to `typeWriterHTML`
- [x] 2.4 Verify `typeWriterHTML` handles `speed = 0` without freezing the UI (each character still goes through `setTimeout`, so yielding is preserved)
- [x] 2.5 Verify: navigate to a node for the first time — typewriter animation plays normally; go back and return to the same node — text appears instantly

## 3. Hidden archive search by id

- [x] 3.1 In `lookupHidden` (index.html), change `t.nome.toLowerCase()` to `t.id.toLowerCase()` so the comparison uses the `id` field from the manifest
- [x] 3.2 Update `dati/manifest.json` (and any example manifests) to ensure each entry has an `id` field alongside `nome` and `file`, e.g. `{ "id": "archivio-segreto", "nome": "Archivio Segreto", "file": "...", "public": false }`
- [x] 3.3 Verify: open index.html, type the `id` value of a hidden archive entry and press `[ CARICA ]` or Enter — the terminal loads correctly
- [x] 3.4 Verify: typing the `nome` of a hidden archive (not its `id`) shows `ARCHIVIO NON TROVATO`
