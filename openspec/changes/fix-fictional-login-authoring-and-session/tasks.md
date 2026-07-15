## 1. Q1 — node login survives save (CMS schema)

- [ ] 1.1 In `apps/cms/src/app/domain/terminal-schema.ts`, add optional `login: z.object({ users: z.array(z.string()) }).optional()` to `TerminalNodeSchema` (usernames only, no passwords). Confirm `TerminalNode` inferred type now carries `login?`.
- [ ] 1.2 In `apps/cms/src/app/features/terminals/editor/terminal-form.ts`, drop the `nodeAny as TerminalNode & { login?… }` cast in `makeNodeGroup` now that `node.login` is typed. Leave `toContent`'s `node.login = { users: n.loginUsers }` emission unchanged.
- [ ] 1.3 **Test:** `terminal-schema.spec.ts` — a node with `login: { users: ['tecnico'] }` round-trips through `TerminalContentSchema.parse` (not stripped); a node without `login` still validates.
- [ ] 1.4 **Test:** `terminal-form.spec.ts` — run the real save order (`toContent(raw)` **then** `TerminalContentSchema.safeParse`) and assert the parsed result preserves `nodes.<id>.login.users`.

## 2. Q2 — boot login gate toggle (CMS UI)

- [ ] 2.1 In `terminal-form.ts` `toForm`, add a root `FormControl<boolean>` `loginGateOnBoot`, hydrated `true` when `content.login?.gateOnBoot !== false`, `false` only when explicitly `false`.
- [ ] 2.2 In `terminal-form.ts` `toContent`, emit `login.gateOnBoot: false` only when the control is `false`; omit the key when `true` (checked = default = gate at boot).
- [ ] 2.3 In `terminal-editor.ts`, expose the `loginGateOnBoot` control and pass it into `FictionalUsersSectionComponent`.
- [ ] 2.4 In `fictional-users-section.ts`, render a **"Richiedi accesso all'avvio"** checkbox next to the user rows, bound to the passed control. When no users are declared, disable it (or render an inert hint) so an empty registry can never produce a boot gate.
- [ ] 2.5 **Test:** `fictional-users-section` / `terminal-editor` spec — checkbox renders, reflects a loaded `gateOnBoot: false` as unchecked and absent/true as checked, and drives the serialized value (unchecked ⇒ `login.gateOnBoot: false`; checked ⇒ no `gateOnBoot` key).

## 3. Q3 — per-terminal cache, remembered credentials, logout on disconnect (emulator)

- [ ] 3.1 In `apps/terminal/src/engine/login-fictional.js`, replace the global username-keyed `loggedInUsers` with two `Map`s keyed by `${terminalId}:${username}`: an authenticated set and a remembered-credentials cache. Update the signatures: `recordLogin(terminalId, username, password)`, `getLoggedInUser(terminalId, loginBlock)`, add `getRememberedPassword(terminalId, username)`, and make `clearLogins(terminalId?)` clear the authenticated set (keeping remembered credentials).
- [ ] 3.2 In `apps/terminal/src/screens/login-fictional.js`, record the typed password on success (`recordLogin(terminalId, username, password)`) and update `showLogin` to accept an optional prefill `{ username, password }`, pre-selecting the `<select>` and pre-filling `#login-password`.
- [ ] 3.3 In `apps/terminal/src/screens/terminal.js`, pass `currentTerminalId` into `getLoginForNode`/`getLoggedInUser`, call `clearLogins(currentTerminalId)` inside `disconnectTerminal` (the currently-missing logout), and when presenting a node gate, look up `getRememberedPassword` to prefill the overlay.
- [ ] 3.4 In `apps/terminal/src/main.js`, thread the terminal id into the boot-gate `getLoggedInUser` check and pass a remembered prefill into the boot `showLogin`.
- [ ] 3.5 **Test (Playwright):** two terminals sharing a username — login on A does not unlock B's gate.
- [ ] 3.6 **Test (Playwright):** disconnect clears authentication — reconnecting re-presents the login overlay.
- [ ] 3.7 **Test (Playwright):** reconnect prefill — the overlay shows the remembered username selected and password populated; `[ ACCEDI ]` re-validates and renders the node.
- [ ] 3.8 **Test (Playwright):** regression — `gateOnBoot: false` with a non-empty root registry navigates straight to `start`.

## 4. Verify

- [ ] 4.1 From `apps/cms`, run `npm test` and confirm green with ≥ 70% line coverage on changed files.
- [ ] 4.2 From `apps/terminal`, run `npx playwright test` and confirm all pass.
- [ ] 4.3 Manual smoke: import `reference/terminale_emporio_rugginoso.json`, add a fictional user, gate a non-start node with it, uncheck "Richiedi accesso all'avvio", save, and play — boot goes straight to `start`, the gated node prompts, and reconnect pre-fills the password.
