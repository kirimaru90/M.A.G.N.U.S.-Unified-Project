## MODIFIED Requirements

### Requirement: Updating and deleting terminals
The API SHALL expose `PUT /terminals/:id` (admin) and `DELETE /terminals/:id` (admin).

`PUT` accepts the same shape as create. The API SHALL:
- Re-validate against the schema.
- Reconcile the terminal's `fictionalUsers` rows against the incoming `login.users` with **password-preserving semantics** (see below); it SHALL NOT unconditionally delete-and-reinsert all rows.
- Re-project `state.local` declarations onto the terminal's `state` map with **additive semantics**: keys present in the new declaration but missing from the existing state are added with their defaults; keys present in both keep their current `value`; keys present in the existing state but not in the new declaration are left untouched (orphaned, not deleted).
- Re-project `state.global` declarations onto the campaign's `state` with the same first-declaration-wins rule (new globals added with defaults; existing globals untouched).

**Response shape:** `PUT /terminals/:id` SHALL respond 200 with the same detail envelope produced by `GET /terminals/:id` — `{ id, campaignId, title, content (passwords stripped from `content.login.users`), state, createdAt, updatedAt }`, plus `fictionalUsers: [{ username, password }]` when the caller is an admin. It SHALL NOT return the summary object (`{ id, title, isPublic, viewCount, ... }`) that list endpoints return.

**Password-preserving reconcile of `login.users`:** for each incoming user entry (matched to a stored row by `username` within this terminal):
- If the entry's `password` is present and non-empty, the API SHALL persist that password for the username (creating the row if new).
- If the entry's `password` is empty, blank, or omitted **and** a stored row already exists for that username, the API SHALL keep the existing stored password unchanged — it SHALL NOT overwrite it, delete the row, or raise a validation error.
- If the entry's `password` is empty, blank, or omitted **and** no stored row exists for that username, the API SHALL respond HTTP 400 (a credential cannot be created without a password); it SHALL NOT emit a 500.
- Usernames present in the stored rows but absent from the incoming `login.users` SHALL be removed.

`DELETE` removes the terminal, its `fictionalUsers` rows, and any `terminals.state` data (campaign-level global state is **not** affected).

#### Scenario: Admin updates a terminal preserving live state
- **WHEN** a terminal has `state.access_count.value == 7` and an admin PUTs new content whose `state.local.access_count` declaration is unchanged
- **THEN** the response is HTTP 200 and the terminal's `state.access_count.value` is still `7`

#### Scenario: Adding a new local variable on update
- **WHEN** an admin PUTs new content adding `state.local.new_var: {type:"number", default:0}` to an existing terminal
- **THEN** the terminal's `state.new_var` is now `{type:"number", value:0, default:0}`

#### Scenario: Removing a variable from the schema is non-destructive
- **WHEN** an admin PUTs new content that no longer declares `state.local.old_var`
- **THEN** the terminal's `state.old_var` remains in the persisted state map until an explicit reset

#### Scenario: Update returns the detail envelope
- **WHEN** an admin PUTs valid content to `/terminals/T` for a terminal with fictional users
- **THEN** the response is HTTP 200 whose body contains `content` (with `content.login.users` carrying `{ username }` only, no password) and `fictionalUsers: [{ username, password }, ...]`
- **AND** the body does NOT have the list-summary shape (`isPublic` / `viewCount` at the top level in place of `content`)

#### Scenario: Update with a new non-empty password persists it
- **GIVEN** terminal T has fictional user `{ username: "tecnico", password: "old" }`
- **WHEN** an admin PUTs `login.users: [{ username: "tecnico", password: "robco123" }]`
- **THEN** the response is HTTP 200 and a subsequent `POST /terminals/T/fictional-login` with `{ username: "tecnico", password: "robco123" }` succeeds
- **AND** the admin detail `fictionalUsers` shows `password: "robco123"`

#### Scenario: Empty password for an existing user preserves the stored password
- **GIVEN** terminal T has fictional user `{ username: "tecnico", password: "robco123" }`
- **WHEN** an admin PUTs `login.users: [{ username: "tecnico", password: "" }]` (or with `password` omitted)
- **THEN** the response is HTTP 200 (no validation error)
- **AND** the stored password for "tecnico" is still `"robco123"` (not overwritten, not deleted)

#### Scenario: Empty password for a brand-new user is rejected
- **GIVEN** terminal T has no fictional user named "nuovo"
- **WHEN** an admin PUTs `login.users: [{ username: "nuovo", password: "" }]`
- **THEN** the response is HTTP 400 (a credential cannot be created without a password), not HTTP 500

#### Scenario: Dropping a username removes its credential
- **GIVEN** terminal T has fictional users `["tecnico", "ospite"]`
- **WHEN** an admin PUTs `login.users: [{ username: "tecnico", password: "robco123" }]` (omitting "ospite")
- **THEN** the "ospite" credential is removed and only "tecnico" remains

#### Scenario: Admin deletes a terminal
- **WHEN** an admin calls `DELETE /terminals/:id`
- **THEN** the response is HTTP 204
- **AND** the terminal and its `fictionalUsers` rows are removed

### Requirement: Admin can create terminals
The API SHALL expose `POST /campaigns/:id/terminals` accepting a JSON body that conforms to the terminal content schema (`meta`, `state`, optional `login`, `nodes`). The `meta` block accepts `{ title, hiddenId?, public? }` where `hiddenId` is optional. The field `content.meta.id` SHALL be rejected on input with HTTP 400 (clients may not override the server-assigned record id). The API SHALL:
- Validate the payload against the schema; reject with HTTP 400 if invalid.
- Reject with HTTP 400 if the payload contains `content.meta.id`.
- Extract `login.users` (if any) and persist them in the `fictionalUsers` collection (one document per user, plaintext password). A user entry whose password is empty, blank, or omitted SHALL be rejected with HTTP 400 (a credential cannot be created without a password); it SHALL NOT emit a 500.
- Persist the terminal with `content` containing everything *except* `login.users`.
- Initialize the terminal's `state` map by copying each `state.local` declaration into `{ type, value: default, default }`.
- Merge `state.global` declarations into the parent campaign's `state` only for keys that do not already exist (first-declaration-wins).

#### Scenario: Admin creates a terminal with local and global state
- **WHEN** an admin posts a terminal whose content declares `state.local.foo: {type:"boolean",default:false}` and `state.global.omega: {type:"boolean",default:false}` to a campaign with no existing `omega`
- **THEN** the response is HTTP 201
- **AND** the persisted terminal has `state.foo == {type:"boolean", value:false, default:false}`
- **AND** the parent campaign now has `state.omega == {type:"boolean", value:false, default:false}`

#### Scenario: First-declaration-wins on global state
- **WHEN** an admin imports a terminal declaring `state.global.omega: {default:true}` into a campaign whose `state.omega.value` is already `false`
- **THEN** the campaign's `state.omega.value` remains `false`

#### Scenario: Login users are stripped from stored content
- **WHEN** an admin posts a terminal whose content contains `login.users: [{username:"u",password:"p"}]`
- **THEN** the persisted terminal's `content.login` either omits `users` or has it as an empty array
- **AND** the `fictionalUsers` collection contains a row `{terminalId, username:"u", password:"p"}`

#### Scenario: Create with a blank fictional password is rejected, not a 500
- **WHEN** an admin posts a terminal whose content contains `login.users: [{ username: "u", password: "" }]`
- **THEN** the response is HTTP 400 (a credential cannot be created without a password), not HTTP 500

#### Scenario: Invalid content schema
- **WHEN** an admin posts a terminal with no `nodes` object
- **THEN** the response is HTTP 400

#### Scenario: Client attempts to set meta.id on input
- **WHEN** an admin posts a terminal whose `content.meta` includes a non-empty `id` field
- **THEN** the response is HTTP 400 (`meta.id` is server-owned and not accepted on input)
