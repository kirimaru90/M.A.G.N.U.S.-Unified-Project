## 1. Engine: State and Utility

- [x] 1.1 Add `loggedInUsers` Map variable (after the existing state variables in `index.html`)
- [x] 1.2 Add optional `speed` parameter to `typeWriterHTML(html, element, callback, speed)` — default to `typingSpeed` when omitted; verify existing call sites are unaffected

## 2. Engine: Login Overlay HTML + CSS

- [x] 2.1 Add `<div id="login-screen">` overlay element to `index.html` body (hidden by default, `z-index: 20`)
- [x] 2.2 Add CSS for `#login-screen`: fullscreen absolute overlay, same `--terminal-bg` background, flex column centered, hidden via `display: none`
- [x] 2.3 Add CSS for `#login-screen` child elements: heading, `<select>`, `<input type="password">`, submit button, and error line — all using existing terminal green palette and `choice-btn` style conventions

## 3. Engine: Login View Logic

- [x] 3.1 Implement `getLoginForNode(nodeId)` helper — returns the node's own `login` field if present, otherwise `null`
- [x] 3.2 Implement `getLoggedInUser(loginBlock)` helper — returns the first username from `loginBlock.users` that is present in `loggedInUsers`, or `null` if none match
- [x] 3.3 Implement `showLoginView(loginBlock, onSuccess)` function:
  - Populate the `<select>` with usernames from `loginBlock.users`
  - Show the `#login-screen` overlay
  - On `[ ACCEDI ]` click: validate password; if correct → add user to `loggedInUsers`, hide overlay, call `onSuccess(username)`; if wrong → show `CREDENZIALI NON VALIDE` error line
  - On `[ Torna al menu ]` click: hide overlay, call `initBoot()`
- [x] 3.4 Implement `showAlreadyLoggedIn(username, onDone)` function:
  - Type `Utente ${username} connesso` in the content area at `Math.round(typingSpeed * 2)` ms speed
  - After typing completes, wait 2000 ms, then call `onDone()`

## 4. Engine: Intercept loadNode

- [x] 4.1 Modify `loadNode(nodeId, isBack)` to call `getLoginForNode(nodeId)` at the start
- [x] 4.2 If a login block exists and `getLoggedInUser` returns `null`: call `showLoginView(loginBlock, () => loadNode(nodeId, isBack))` and return early (do NOT push to `navigationHistory` yet)
- [x] 4.3 If a login block exists and `getLoggedInUser` returns a username: call `showAlreadyLoggedIn(username, () => { /* proceed to render node */ })` then render node normally (push history, type content, show choices)
- [x] 4.4 Ensure `navigationHistory` is only pushed AFTER successful authentication (not before the login intercept)

## 5. Engine: Root-Level Login Gate

- [x] 5.1 Modify `loadServerFile` (or `startSystem`) to check `terminalData.login` after the JSON is loaded
- [x] 5.2 If root-level `login` is present and no matching user is in `loggedInUsers`: show login view before calling `startSystem()`; on success → call `startSystem()` and show the already-logged-in acknowledgement when navigating to `"start"`

## 6. Content: Example JSON

- [x] 6.1 Add or update a file in `dati/` (e.g., `dati/esempio-login.json`) that demonstrates:
  - Root-level `login` block with at least one user
  - A node with its own `login` block (different user than root)
  - A freely accessible node (no login)
  - Example snippet to verify:
    ```json
    {
      "login": {
        "users": [{ "username": "Amministratore", "password": "vault101" }]
      },
      "start": {
        "text": "# Benvenuto\nAccesso autorizzato.",
        "choices": [{ "label": "Zona riservata", "target": "zona_riservata" }]
      },
      "zona_riservata": {
        "login": {
          "users": [{ "username": "Ingegnere", "password": "robobrain" }]
        },
        "text": "# ZONA RISERVATA\nDati classificati.",
        "choices": []
      }
    }
    ```
- [x] 6.2 Add `esempio-login` entry to `dati/manifest.json` for easy testing

## 7. Verification

- [x] 7.1 Open `index.html` in browser — verify files without `login` load and navigate identically to before
- [x] 7.2 Load `esempio-login.json` — verify root-level login overlay appears before `start` node
- [x] 7.3 Enter wrong password — verify `CREDENZIALI NON VALIDE` appears and node does not render
- [x] 7.4 Enter correct password — verify overlay dismisses and node renders
- [x] 7.5 Navigate to `zona_riservata` (different user) — verify second login overlay appears with correct username list
- [x] 7.6 Navigate back to `start` (already authenticated as Amministratore) — verify `Utente Amministratore connesso` types at half speed with 2-second post-typing delay
- [x] 7.7 Click `[ Torna al menu ]` on login overlay — verify `initBoot()` is called and boot screen appears
