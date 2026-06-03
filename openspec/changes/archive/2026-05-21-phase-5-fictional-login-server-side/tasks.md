## 1. Engine: server-side validation

- [x] 1.1 In `src/engine/login-fictional.js`, add an async `submitFictionalLogin(terminalId, username, password)` that calls `apiPost('/terminals/' + encodeURIComponent(terminalId) + '/fictional-login', { username, password })` and resolves to the validated `username` on a success response.
- [x] 1.2 Map a credential-rejection status (e.g. `401`) to a typed `InvalidCredentialsError` (mirroring `src/api/session.js`); let network/HTTP-5xx/parse failures propagate as the original `ApiError` so callers can tell "wrong password" from "request failed".
- [x] 1.3 Remove `checkCredentials` and update the module exports; keep `getLoggedInUser`, `recordLogin`, and `clearLogins` unchanged.

## 2. Screen: async submit handler

- [x] 2.1 In `src/screens/login-fictional.js`, change `showLogin` to accept the active terminal id: `showLogin(loginBlock, terminalId, onSuccess, onBack)`.
- [x] 2.2 Replace the synchronous compare in the `[ ACCEDI ]` handler with an `await submitFictionalLogin(terminalId, username, password)` call; on success call `recordLogin(username)` then `onSuccess(username)`.
- [x] 2.3 On an `InvalidCredentialsError`, reveal the existing `#login-error` (`CREDENZIALI NON VALIDE`) line and keep the overlay open; add no username to the unlock set.
- [x] 2.4 On a non-credential failure (network/5xx/parse), show an error and keep the overlay open without recording an unlock.
- [x] 2.5 Disable the submit button while the request is in flight and re-enable it on failure, so a duplicate POST cannot be issued for the same attempt (Enter, which clicks the same button, is inert while disabled).
- [x] 2.6 Confirm the username `<select>` is still populated from `loginBlock.users[].username` and works when entries have no `password` field.

## 3. Thread the terminal id through both call sites

- [x] 3.1 In `src/screens/terminal.js`, pass `currentTerminalId` when invoking `onRequestLogin` for node-level gates.
- [x] 3.2 In `src/main.js`, forward that terminal id through the `onRequestLogin` wrapper into `login.showLogin`.
- [x] 3.3 In `src/main.js#playTerminalData`, pass the already-derived `terminalId` (`rawData.content.meta.id`) into the root-level `login.showLogin` call.
- [x] 3.4 Remove the obsolete Phase-5 placeholder comment in `src/main.js` warning that the in-JS compare rejects stripped payloads.

## 4. Verify against the spec

- [x] 4.1 Inspect a `GET /terminals/:id/load` response and confirm no `login.users[].password` field is present (done-when criterion).
- [x] 4.2 In a browser, navigate to a root-gated and a node-gated holotape: correct credentials unlock the node after a server success; wrong credentials show `CREDENZIALI NON VALIDE` and keep the overlay open.
- [x] 4.3 Confirm a previously unlocked node shows the `Utente [username] connesso` acknowledgement (no re-prompt) within the same session.
- [x] 4.4 Reload the page and confirm the gate re-prompts (in-memory unlock does not survive reload).
- [x] 4.5 Confirm the `[ Torna al menu ]` back-button behaviour is unchanged for both root-level and node-level gates.
- [x] 4.6 Simulate a failed request (offline) and confirm an error is shown, the overlay stays open, and the submit re-enables for retry.
