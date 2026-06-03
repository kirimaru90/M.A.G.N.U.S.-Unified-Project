## Context

The fictional (in-narrative) login is a puzzle gate: a holotape node — or the whole tape — can require a username/password before its content is shown. Today this is validated entirely on the client:

- `GET /terminals/:id/load` delivers the holotape with `login.users[].password` **in plain text**.
- `src/engine/login-fictional.js#checkCredentials` does `user.password === password` in JavaScript.
- `src/screens/login-fictional.js#showLogin` runs that compare synchronously inside the `[ ACCEDI ]` click handler; on success it calls `recordLogin(username)` and on failure it reveals `#login-error`.

The flow is reached from two call sites, both routed through `main.js`:
- **Node-level** gates: `terminal.js#loadNode` → `onRequestLogin(loginBlock, …)` (wired in `main.js` to `login.showLogin`).
- **Root-level** gates: `main.js#playTerminalData` calls `login.showLogin(globalLogin, …)` after the tape loads.

The unlock set (`loggedInUsers`, a module-level `Map` in the engine) is keyed by username, lives only in memory, and is reset only when the module re-initialises (page reload). `getLoggedInUser(loginBlock)` returns the first already-unlocked username so a second visit shows the `Utente [username] connesso` acknowledgement instead of re-prompting.

The architecture (§4.4, §6.3, §9.3) requires fictional credentials to never reach the client and to be validated by `POST /terminals/:id/fictional-login`. This change makes the client conform.

## Goals / Non-Goals

**Goals:**
- Replace the in-JS password compare with a server validation call to `POST /terminals/:id/fictional-login`.
- Make the client correct when the delivered `login` block has no `password` field (usernames only).
- Preserve the observable login UX: the `#login-screen` markup/styling, the error line, the back-button behaviour, the `Utente [username] connesso` acknowledgement, and the reload-clears-unlock lifecycle.

**Non-Goals:**
- Changing the visual login screen (markup, CSS, focus/keyboard nav).
- Changing the holotape JSON authoring shape — authors still declare `login.users` with passwords; the *server* strips passwords on delivery.
- Real-user auth (Phase 4, done) and the Phase 6 cache policy for fictional-login responses.
- Re-architecting how gated node content is delivered. Node text/choices already arrive in the `/load` payload (only passwords are stripped), so a successful validation simply unlocks the already-present node — the client does not re-fetch content.

## Decisions

### Decision 1: Keep transport in the engine module, keep the screen a view
`src/engine/login-fictional.js` gains an async `submitFictionalLogin(terminalId, username, password)` that POSTs to `/terminals/:id/fictional-login` via the existing `apiPost` wrapper and resolves to the validated username (or signals failure). `checkCredentials` is removed. `src/screens/login-fictional.js` awaits this function from its submit handler.

- **Why:** mirrors the existing split where the screen renders and the engine module owns login state/logic (`getLoggedInUser`/`recordLogin`). Routing through `apiPost` reuses the central error normalisation (`ApiError`) and keeps a single transport layer.
- **Alternative considered:** call `apiPost` directly inside the screen. Rejected — it would scatter API knowledge into the view and duplicate the success/record bookkeeping.

### Decision 2: Distinguish "invalid credentials" from "request failed"
`submitFictionalLogin` treats an HTTP failure whose status indicates rejection (e.g. `401`) as **invalid credentials** (resolve to "no user" / throw a typed `InvalidCredentialsError`), and propagates network/HTTP-5xx/parse failures as a different error — paralleling `session.js#InvalidCredentialsError` from Phase 4.

- **Why:** lets the screen show the existing `CREDENZIALI NON VALIDE` line for a genuine wrong-password and a transport-distinct message for a server/network fault, instead of telling the player their password is wrong when the server is simply unreachable.
- **Trade-off:** the proposal asks to "display the existing error UI." We keep `CREDENZIALI NON VALIDE` for the credential case (the common path that existing scenarios cover) and add a separate transient message for transport faults. If a single message is preferred, the transport branch can fall back to the same line — a one-line change.

### Decision 3: Thread the terminal id explicitly through `showLogin`
`showLogin` takes the terminal id as an argument: `showLogin(loginBlock, terminalId, onSuccess, onBack)`. `terminal.js#onRequestLogin` forwards `currentTerminalId`; `main.js#playTerminalData` passes the `terminalId` it already derives from `rawData.content.meta.id`.

- **Why:** the screen has no other handle on the active terminal, and the id is already in scope at both call sites. An explicit parameter is the smallest, most legible seam.
- **Alternative considered:** stash the terminal id in module state via a setter. Rejected — hidden state for a value that is already available as an argument.

### Decision 4: Preserve the in-memory, username-keyed unlock set as-is
On a successful server validation the screen calls `recordLogin(username)` exactly as today; `getLoggedInUser` and the acknowledgement flow are unchanged. Any token the server may return is ignored — gated node content is already in the loaded payload, so the unlock is purely a client-side "don't re-prompt this session" flag.

- **Why:** keeps the change surgical and keeps every downstream behaviour (acknowledgement typing, reload-clears) identical. Adopting a server token would add lifecycle (storage, expiry, attachment) for no behavioural gain given content is already delivered.
- **Alternative considered:** persist the unlock or carry a per-node token. Rejected as scope creep; the reload-re-prompts requirement explicitly wants ephemeral state.

### Decision 5: Disable the submit control while a request is in flight
The `[ ACCEDI ]` handler disables the submit button (and ignores Enter) until the awaited call settles, re-enabling on failure.

- **Why:** the compare used to be synchronous; an async call opens a double-submit window. Disabling avoids duplicate POSTs and a confusing double error flash.

## Risks / Trade-offs

- **Cross-tape unlock leakage (pre-existing).** `loggedInUsers` is keyed by bare username and `clearLogins` is currently never called, so an unlock for username `X` on tape A would suppress the prompt for a node gated by `X` on tape B within the same page session. → This behaviour is unchanged by Phase 5; with server validation it only ever *skips* a redundant prompt, never grants content the server wouldn't. Out of scope to fix here; flagged for a future change (a `clearLogins()` on tape switch is the cheap fix).
- **Server contract drift.** The exact request/response shape of `POST /terminals/:id/fictional-login` is only sketched in the reference (`validate fictional credentials`). → Isolate request/response handling in the single engine function so a drift is a one-file fix, exactly as `session.js` isolates the `/auth/*` contract.
- **Latency in the login UX.** A network round-trip replaces an instant compare, so a slow link delays the unlock. → Disable-on-submit (Decision 5) prevents double-submit; the existing data-load immersion delay already conditions players to brief waits.
- **Error-message regression.** Existing scenarios assert `CREDENZIALI NON VALIDE` on a wrong password. → Decision 2 keeps that exact line for the credential-rejection path; transport faults get a distinct line, so the credential scenarios still pass verbatim.

## Migration Plan

Pure client change, no data migration. Ships only when the server's `POST /terminals/:id/fictional-login` is live and `/terminals/:id/load` strips `login.users[].password`. Rollback is reverting the client commit — the old in-JS compare still works against a payload that includes passwords, but the server should not be reverted to delivering passwords. Verify done-criteria by inspecting a `GET /terminals/:id/load` response for the absence of `password`.

## Open Questions

- Does `POST /terminals/:id/fictional-login` need the node id (for node-level gates) in addition to `{ username, password }`, or does the server resolve the credential against the whole holotape? Assumed whole-holotape (usernames are unique per tape); confirm against the live Swagger before implementation and adjust the request body in the single engine function if needed.
