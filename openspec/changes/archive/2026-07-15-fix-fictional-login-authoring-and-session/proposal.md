## Why

Fictional login is under-specified at three layers and the gaps compound:

1. **Node login is silently dropped on save (CMS).** The node editor lets an author pick per-node login users (`p-multiselect` → `node.loginUsers`) and `toContent` serializes `node.login = { users: [...] }`, but `TerminalNodeSchema` never declares a `login` field. `save()` runs `TerminalContentSchema.safeParse(...)` after `toContent`, and Zod strips the unknown `login` key from every node. The selection appears to "collapse" into the root `login` block (which is really the separate fictional-user registry) and never reaches the API. The `cms-terminal-nodes-editor` spec already asserts this serialization works (`login.users = ['ada','grace']`), so this is an internal contradiction, not a new feature. The `toContent` unit tests pass because they do not run the `safeParse` step that `save()` performs — a test blind spot.

2. **The boot gate cannot be turned off from the CMS.** To gate a *deep* node with user X, the author must declare X in the fictional-users section, which populates the root `login.users` registry. A non-empty root registry arms the boot-time login gate on `start` unless `login.gateOnBoot` is `false`. The emulator already honors `gateOnBoot`, and the schema/DTO/service already carry it end-to-end — but the CMS exposes **no control to set it**. So declaring a user for a node gate unavoidably forces a boot login the author did not want.

3. **The login cache bypasses across terminals and never logs out.** The emulator's `loggedInUsers` is a module-global `Map` keyed by bare username, and `clearLogins()` is exported but never called. Logging into `tecnico` on terminal A auto-unlocks a differently-passworded `tecnico` gate on terminal B (server validation is per-terminal; the client cache is not), and the authentication survives disconnecting and reconnecting a terminal for the whole page session.

## What Changes

- **Q1 — node login survives save (CMS schema).** Add an optional `login: { users: string[] }` to `TerminalNodeSchema` so `safeParse` preserves per-node login instead of stripping it. Update the inferred `TerminalNode` type (removing the `nodeAny` cast in `terminal-form.ts`). The API already round-trips node objects opaquely, so no API change is required.
- **Q2 — boot login gate toggle (CMS UI).** Add a **"Richiedi accesso all'avvio"** checkbox to the fictional-users section, bound to a new `login.gateOnBoot` form control. Checked (the default) omits `gateOnBoot` (so absence continues to mean "gate at boot"); unchecked serializes `login.gateOnBoot: false`. This lets an author declare fictional users for node-level gates without arming the boot gate.
- **Q3 — per-terminal login cache with remembered credentials and logout-on-disconnect (emulator).**
  - Key the authenticated-user set by `(terminalId, username)` so one terminal's login never satisfies another's gate.
  - On terminal **disconnect**, clear the authenticated-user set ("logout").
  - Maintain a session-scoped **remembered-credentials** cache keyed by `(terminalId, username)` holding the password the user typed after a successful validation. It persists across disconnect until page reload.
  - On **reconnect**, a gated node (or the boot gate) still presents the login overlay — but with the remembered username pre-selected and the password field pre-filled, so the player confirms with `[ ACCEDI ]` (re-validated by the server) rather than auto-bypassing.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `cms-terminal-content-schema`: nodes accept an optional per-node `login: { users: string[] }`; the schema no longer strips it on parse.
- `cms-terminal-metadata-state-users-editor`: the fictional-users section gains a boot-gate toggle bound to `login.gateOnBoot`.
- `emulator-login-access-control`: the authenticated-user set is per-terminal and cleared on disconnect; a session-scoped remembered-credentials cache pre-fills the login overlay on reconnect.

## Impact

- `apps/cms/src/app/domain/terminal-schema.ts` — add optional `login` to `TerminalNodeSchema`; `TerminalNode` type gains `login?`.
- `apps/cms/src/app/features/terminals/editor/terminal-form.ts` — `toForm`/`toContent` read & emit `login.gateOnBoot`; drop the `nodeAny` cast when reading `node.login`.
- `apps/cms/src/app/features/terminals/editor/fictional-users-section.ts` — render the boot-gate checkbox.
- `apps/cms/src/app/features/terminals/editor/terminal-editor.ts` — hold the `gateOnBoot` control and pass it to the section.
- `apps/terminal/src/engine/login-fictional.js` — per-terminal keying, remembered-credentials cache, wire `clearLogins()`.
- `apps/terminal/src/screens/terminal.js` — clear authenticated set on `disconnectTerminal`; pass remembered credentials into the login/ack path.
- `apps/terminal/src/screens/login-fictional.js` (+ `main.js` boot gate) — pre-select username and pre-fill password from the remembered cache.
- No API change: node objects and `login.gateOnBoot` already round-trip through `apps/api`.

### Security note (Q3 remembered passwords)
Remembering the typed password to pre-fill the overlay keeps a cleartext fictional password in an in-memory `Map` for the page session (never persisted, never sent in a payload, cleared on reload). This is a deliberate convenience tradeoff for the game/LARP context: the credential is one the same operator just entered in the same session. It does **not** relax the existing rules that passwords never arrive in client-bound payloads and are always validated server-side.

## Testing

Per repo rules, tests are mandatory task steps; a change is not done while any test is red.

- **cms-\*** (Vitest; `enable-cms-testing` is archived):
  - `terminal-schema.spec.ts` — a node carrying `login: { users: ['tecnico'] }` survives `TerminalContentSchema.parse` (round-trips, not stripped); a node with no `login` still validates.
  - `terminal-form.spec.ts` — end-to-end `save()` path (`toContent` **then** `safeParse`) preserves `node.login.users`; `toForm` hydrates `gateOnBoot`; `toContent` emits `login.gateOnBoot: false` only when unchecked and omits it when checked.
  - `fictional-users-section` / `terminal-editor` spec — the boot-gate checkbox renders next to the users rows, reflects the loaded `gateOnBoot`, and drives the serialized value.
  - Final: `npm test` from `apps/cms` green, ≥ 70% line coverage on changed files.
- **emulator-\*** (Playwright; `enable-emulator-testing` is archived):
  - Loading two terminals that share a username and asserting login to A does **not** unlock B (cross-terminal isolation).
  - Disconnect clears authentication: reconnecting a terminal re-presents the login overlay.
  - Reconnect pre-fill: the overlay shows the remembered username selected and the password field populated; `[ ACCEDI ]` re-validates and proceeds.
  - `gateOnBoot: false` with a non-empty root registry navigates straight to `start` (regression guard, already-specified behavior).
  - Final: `npx playwright test` from `apps/terminal` green.
