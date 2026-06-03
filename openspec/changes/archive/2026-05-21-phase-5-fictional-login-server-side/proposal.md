## Why

The in-narrative *fictional* login is still a client-side honour system: holotape JSON arrives with `login.users[].password` in plain text and `src/engine/login-fictional.js` compares the typed password in JavaScript. Anyone can read the answer in DevTools, so the puzzle isn't a puzzle. The architecture (§4.4, §6.3, §9.3) requires fictional credentials to live only on the server and be validated by `POST /terminals/:id/fictional-login`. Phase 5 moves the comparison server-side so credentials never reach the client.

## What Changes

- **Stop comparing passwords in JS.** `src/engine/login-fictional.js` drops `checkCredentials` (the `user.password === password` compare) and instead submits the attempt to `POST /terminals/:id/fictional-login`. The response decides success or failure; the client never sees a password.
- **The login screen submit handler becomes asynchronous.** `src/screens/login-fictional.js` awaits the server call. On success it records the in-memory unlock and proceeds exactly as today; on failure it shows the existing `CREDENZIALI NON VALIDE` error and keeps the overlay open. The visible login UI (`#login-screen`) is unchanged.
- **Thread the terminal id into the login flow.** Both call sites (node-level via `terminal.js` → `onRequestLogin`, root-level via `main.js` at tape load) pass the current terminal id so the screen knows where to POST.
- **The login block delivered to the client carries usernames only.** The username `<select>` is populated from `login.users[].username`; the absence of `password` is now expected, not a bug. The client MUST NOT depend on a password field being present.
- **Unlock state stays in-memory and per-session.** The existing `loggedInUsers` set continues to gate already-authenticated nodes (the `Utente [username] connesso` acknowledgement still fires). It is never persisted, so a page reload re-prompts for the fictional login — unchanged from today.
- Remove the now-obsolete Phase-5 placeholder comment in `main.js` warning that the in-JS compare rejects stripped payloads.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `login-access-control`: rewritten so credential validation happens via `POST /terminals/:id/fictional-login` instead of an in-JS comparison; the client-delivered `login` block contains usernames but no `password`; the in-memory unlock lifecycle (empty at load, cleared on reload) and the login/acknowledgement UI behaviour are preserved at the observable level.

## Impact

- **Modified files**: `src/engine/login-fictional.js` (replace `checkCredentials` with an async server submit; keep `getLoggedInUser`/`recordLogin`/`clearLogins`), `src/screens/login-fictional.js` (async submit handler, accept the terminal id, in-flight handling), `src/screens/terminal.js` (forward `currentTerminalId` through `onRequestLogin`), `src/main.js` (forward the terminal id at both login call sites; remove the placeholder comment).
- **No `index.html` change**: the markup and CRT styling of `#login-screen` are untouched; only the submit logic changes.
- **API contract used**: `POST /terminals/:id/fictional-login` with `{ username, password }` → success (2xx) on valid credentials, failure (e.g. 401) on invalid. `GET /terminals/:id/load` is expected to deliver `login` blocks with `password` stripped — a server responsibility this client now relies on.
- **Content-creator workflow**: no impact. Authors still define `login.users` (with passwords) in the backoffice; the server stores them and strips passwords before delivery. The authoring shape of holotape JSON does not change.
- **Out of scope**: the visual login screen, the holotape JSON authoring shape, real-user auth (Phase 4, done), and the service-worker cache policy for fictional-login responses (Phase 6).
