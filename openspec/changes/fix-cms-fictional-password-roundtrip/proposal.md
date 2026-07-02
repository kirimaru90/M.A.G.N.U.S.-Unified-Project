## Why

Editing a fictional-user password in the CMS terminal detail appears to do nothing: the save returns `200 OK` but the password field reloads blank, the "Modifiche non salvate" badge never clears, and no success toast appears. Importing a terminal whose JSON carries `login.users[].password` shows the same "password not set" symptom on reopen. The passwords are, by API design, stored in a separate `fictionalUsers` collection and never travel inside `content.login` — but the CMS editor reads and writes them as if they lived in `content.login`, so it can neither display nor confidently persist them.

## What Changes

- **CMS load**: the terminal editor loads fictional-user passwords from the detail envelope's separate `fictionalUsers` array (via `getEnvelope()`), not from `content.login.users` (which is password-less by design). Password fields render with their real stored values.
- **CMS save response handling**: the update flow no longer assumes the server response contains `content`. The editor refreshes its baseline/form from a source that actually carries content + `fictionalUsers`, so `buildForm` never receives `undefined`, the dirty badge clears, and the success toast fires.
- **API update response shape**: `PUT /terminals/:id` returns the same detail envelope shape (`content` + `fictionalUsers`) as `GET /terminals/:id`, instead of the summary object, so the client has a consistent contract. **BREAKING** for any consumer relying on the old summary-only `PUT` response.
- **Empty-password preservation (NEW)**: on create/update, an empty or blank password for a given username is treated as "keep the existing stored password" rather than delete-and-reinsert-empty. This prevents both the mongoose `required` string validation error and the silent wiping of previously-saved passwords when other users' fields load blank.
- **CMS serialize**: `toContent`/save omits or flags blank password fields so the "keep existing" server semantics are triggered instead of sending `password: ""`.

## Capabilities

### New Capabilities
<!-- None: this fixes existing behavior; no new capability is introduced. -->

### Modified Capabilities
- `api-terminals`: `PUT /terminals/:id` returns the detail envelope (content + fictionalUsers) instead of a summary; create/update preserve an existing fictional-user password when the incoming password for that username is empty/blank (no overwrite, no delete, no validation error).
- `cms-terminals-crud`: the terminals API client exposes/consumes the detail envelope on load and after save so `fictionalUsers` (and their passwords) are available to the editor; `update()` no longer maps away the content+users envelope.
- `cms-terminal-metadata-state-users-editor`: fictional-user password fields are sourced from `fictionalUsers`, and blank password fields on save are preserved rather than sent as empty and overwriting stored values.
- `cms-terminal-editor-shell`: after a successful save the baseline/form is rebuilt from a valid envelope, so the "Modifiche non salvate" badge clears and the success toast shows.

## Impact

- **API** (`apps/api`): `terminals.service.ts` (`update`, `create`, and the empty-password merge logic against the `fictionalusers` collection), `terminals.controller.ts` (update response contract). Existing e2e expectations in `test/terminals.e2e-spec.ts` that assert the `content.login.users` password-stripping stay unchanged; new expectations added for the envelope response and empty-password preservation.
- **CMS** (`apps/cms`): `core/terminal/terminals-api.service.ts` (`get`/`update` envelope handling), `features/terminals/editor/terminal-form.ts` (`toForm` password source, `toContent` blank-password handling), `features/terminals/editor/terminal-editor.ts` (save success handling), and the import path perception via reload.
- **Contract**: the `PUT /terminals/:id` response body changes shape (summary → detail envelope). No player-facing / emulator impact — fictional passwords remain stripped from playback `load`/`by-hidden-id` responses.

## Testing

- **api-terminals** — e2e (`test/terminals.e2e-spec.ts`, in-memory mongodb-memory-server):
  - `PUT /terminals/:id` returns an envelope containing `content` and `fictionalUsers` (with passwords for admin).
  - Updating a user with a non-empty password persists it; a subsequent admin detail/`fictional-login` reflects the new value.
  - Updating with an empty/blank password for an existing username keeps the previously stored password (no overwrite, no delete) and returns 200 (no validation error).
  - Existing contract preserved: playback `load`/`by-hidden-id` still strip passwords from `content.login.users`.
- **cms-terminals-crud** — unit (Vitest) on `terminals-api.service.ts`: `get`/`update` surface the envelope (content + fictionalUsers) to callers.
- **cms-terminal-metadata-state-users-editor** — unit on `terminal-form.ts`: `toForm` hydrates password fields from `fictionalUsers`; `toContent`/save preserves (omits) blank passwords so they are not sent as empty strings.
- **cms-terminal-editor-shell** — unit on `terminal-editor.ts`: a successful save clears `dirty` and does not crash on the response, rebuilding the form from a valid envelope.
