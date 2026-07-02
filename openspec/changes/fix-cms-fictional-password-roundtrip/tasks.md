## 1. API — update response shape + password-preserving reconcile

- [x] 1.1 In `apps/api/api/src/terminals/terminals.service.ts`, change `update()` to return the detail envelope (same shape as `detail()`: `{ id, campaignId, title, content, state, createdAt, updatedAt }` + `fictionalUsers` for admin) instead of `toSummary(updated)`. Factor the envelope-building out of `detail()` so both share it.
- [x] 1.2 Replace the `deleteMany` + `insertMany` block in `update()` with a password-preserving reconcile: read existing `fictionalUsers` rows for the terminal into a `username → password` map; for each incoming `login.users` entry keep the existing password when the incoming one is empty/blank/omitted, use the incoming password when non-empty, and remove stored usernames absent from the incoming list.
- [x] 1.3 Reject with `BadRequestException` (400) when an incoming user has an empty/blank/omitted password and no stored row exists for that username (both in `update()` and `create()`), replacing the current mongoose `required` 500.
- [x] 1.4 Confirm the `update()` controller method (`terminals.controller.ts`) still returns the service result unchanged and that `req.user`/admin gating flows through so `fictionalUsers` is included only for admins (thread the actor into `update()` like `detail()` does).
- [x] 1.5 Decide password emptiness consistently: treat `undefined`, `""`, and whitespace-only as "no password provided". Keep `FictionalUserDto.password` optional-or-string as needed so an omitted password passes validation and reaches the reconcile (do not let the DTO force a non-empty string that would 400 the preserve case).

## 2. API — tests (e2e)

- [x] 2.1 Add e2e in `apps/api/api/test/terminals.e2e-spec.ts`: `PUT /terminals/:id` returns an envelope with `content` (login.users password-free) and `fictionalUsers` (with passwords) for admin.
- [x] 2.2 Add e2e: updating with a non-empty password persists it (verify via admin detail and `POST /terminals/:id/fictional-login`).
- [x] 2.3 Add e2e: updating an existing username with `password: ""` (and with `password` omitted) preserves the stored password and returns 200 (no 500).
- [x] 2.4 Add e2e: a brand-new username with an empty password returns 400 (not 500), on both update and create/import.
- [x] 2.5 Add e2e: dropping a username from `login.users` removes its credential; verify remaining users unaffected.
- [x] 2.6 Confirm existing contract tests still pass: playback `load` / `by-hidden-id` still strip passwords from `content.login.users`.

## 3. CMS — load path (passwords into the editor)

- [x] 3.1 In `apps/cms/src/app/features/terminals/terminal-detail.ts`, switch from `terminalsApi.get(id)` to `terminalsApi.getEnvelope(id)` (still one request); derive metadata from `envelope.content.meta` and pass both `content` and `fictionalUsers` into `<app-terminal-editor>`.
- [x] 3.2 Add a `fictionalUsers` input to `TerminalEditorComponent` (`editor/terminal-editor.ts`) and pass it through to form construction.
- [x] 3.3 In `editor/terminal-form.ts`, change `toForm` to accept the `fictionalUsers` list and hydrate each user row's password by matching `username`; stop reading `password` from `content.login.users`.

## 4. CMS — save path (envelope response + re-hydration + blank preservation)

- [x] 4.1 In `apps/cms/src/app/core/terminal/terminals-api.service.ts`, change `update()` to emit the full `TerminalDetailEnvelope` (drop the `map(r => r.content)`); update its return type. Adjust `TerminalDetailEnvelope.fictionalUsers` typing to `{ username: string; password: string }[]`.
- [x] 4.2 In `editor/terminal-editor.ts` `save()` success handler, set `baseline` from `envelope.content`, rebuild the form, and re-hydrate password fields from `envelope.fictionalUsers`; ensure `dirty = false` and the success toast run and that `buildForm` never receives `undefined`.
- [x] 4.3 In `editor/terminal-form.ts` `toContent`, omit the `password` key for a user row whose password field is blank/whitespace (do not emit `password: ""`), so the API's preserve semantics trigger.
- [x] 4.4 Verify the CMS Zod `LoginUserSchema` / `TerminalContentSchema` tolerates a missing `password` on a user entry (make `password` optional) so `safeParse` passes when a blank field is omitted.

## 5. CMS — tests (Vitest)

- [x] 5.1 `terminals-api.service` spec: `getEnvelope` surfaces `fictionalUsers`; `update` emits the envelope (content + fictionalUsers) rather than bare content.
- [x] 5.2 `terminal-form` spec: `toForm` hydrates password fields from `fictionalUsers`; `toContent` omits `password` for blank rows and includes it for filled rows.
- [x] 5.3 `terminal-editor` spec: a successful save (envelope response) clears `dirty`, shows the toast, re-hydrates passwords, and does not throw; an error response keeps `dirty` and shows the API error.
- [x] 5.4 `terminal-detail` spec: the page uses `getEnvelope` and forwards `fictionalUsers` to the editor; passwords render in the fictional-users section.

## 6. Verification

- [ ] 6.1 Manual/integration check: edit a fictional password in the CMS detail → save → badge clears, toast shows, password persists and re-displays on reload.
- [ ] 6.2 Manual/integration check: import a terminal JSON with `login.users[].password` → reopen → password is displayed and `fictional-login` succeeds.
- [ ] 6.3 Manual/integration check: multi-user terminal — edit one password, leave others blank, save → untouched passwords are preserved (not wiped, no error).
- [x] 6.4 Run API e2e + CMS unit suites; confirm all green.
