## Context

Fictional-user credentials for a terminal are stored in a dedicated `fictionalUsers` Mongo collection, never inside the terminal document's `content.login`. By design (`contentWithoutUsers()` / `stripContent()`, verified by `api-terminals` e2e), `content.login.users` only ever carries `{ username }` — passwords are stripped at write time and re-attached only on the admin detail response as a sibling `fictionalUsers: [{ username, password }]` array.

The CMS editor was built against the wrong mental model: it reads and writes passwords through `content.login.users[].password`. Three concrete defects follow:

1. **Load** — `TerminalsApiService.get()` unwraps `GET /terminals/:id` to just `.content` and drops the `fictionalUsers` sibling; `toForm()` then reads `password` off `content.login.users`, which is always absent. Password fields render blank on every open.
2. **Save response** — the CMS `cms-terminal-editor-shell` spec already assumes `PUT /terminals/:id` returns the detail envelope (`{ content, fictionalUsers, ... }`) and unwraps `.content`. But the server's `TerminalsService.update()` actually returns `toSummary(updated)` (no `content`). So `update()` emits `undefined`, `buildForm(undefined)` throws inside the RxJS `next` callback, the dirty reset and success toast never run, and — because the throw is in `next`, not the stream — the `error` handler never fires. The "Modifiche non salvate" badge sticks.
3. **Blank-password hazard** — because passwords load blank, saving a terminal with more than one user sends `password: ""` for the untouched users. `update()` does `deleteMany` + `insertMany`, and the `FictionalUser.password` field is `required`, so an empty string either throws a mongoose validation error (500) or wipes the previously-stored credential.

Import works server-side (the JSON carries a real password → `create()` persists it), but defect 1 makes it *look* unset on reopen.

## Goals / Non-Goals

**Goals:**
- Passwords stored in `fictionalUsers` load into the editor and display in the password fields.
- A successful save clears the dirty badge and shows the success toast without crashing.
- `PUT /terminals/:id` returns the same detail envelope shape as `GET /terminals/:id`, satisfying the contract the CMS already assumes.
- An empty/blank password field for an **existing** username preserves the stored password — no overwrite, no delete, no validation error.

**Non-Goals:**
- Changing how passwords are stored (they remain plaintext in `fictionalUsers`, by existing design).
- Changing playback (`load` / `by-hidden-id`) responses — passwords stay stripped there.
- Hashing / encrypting fictional passwords (out of scope; deliberate design elsewhere).
- Any emulator/player-app changes.

## Decisions

### D1 — Editor loads passwords from the `fictionalUsers` array, not `content.login`
The terminal detail page already issues a single `GET /terminals/:id`. Switch it from `get()` (content-only) to `getEnvelope()` (full envelope, still one request) and pass both `content` and `fictionalUsers` into `TerminalEditorComponent`. `toForm()` gains a second input (the `fictionalUsers` list) and hydrates each user row's password by matching on `username`; it no longer reads `password` from `content.login.users`.

*Alternative considered:* have the API embed passwords back into `content.login.users` on the admin detail. Rejected — it contradicts the established `stripContent`/`contentWithoutUsers` contract and the `api-terminals` e2e that asserts `content.login.users` is password-free, and would risk leaking passwords into any code path that forwards `content`.

### D2 — `PUT /terminals/:id` returns the detail envelope
Change `TerminalsService.update()` to return the same envelope the `detail()` method produces (`{ id, campaignId, title, content, state, fictionalUsers (admin), createdAt, updatedAt }`) instead of `toSummary(updated)`. This makes `PUT` and `GET` symmetric and satisfies the existing `cms-terminal-editor-shell` requirement ("Update unwraps the detail envelope into TerminalContent"). The CMS `update()` keeps unwrapping `.content` for the baseline and additionally reads `fictionalUsers` to re-hydrate passwords after save.

*Alternative considered:* leave the server returning a summary and have the CMS re-fetch via `getEnvelope()` after each save. Rejected — an extra round-trip, and it leaves the server/spec mismatch in place for other clients.

**This is a breaking change** to the `PUT /terminals/:id` response body (summary → envelope). The only known consumer is the CMS, updated in lockstep.

### D3 — Empty password means "keep existing" on update
Replace the blunt `deleteMany` + `insertMany` in `update()` with a reconcile that is password-aware:
- For each incoming `login.users` entry, if its password is non-empty → upsert that username's row with the new password.
- If its password is empty/blank **and** a row already exists for that `terminalId + username` → keep the stored password untouched.
- If its password is empty/blank **and no** row exists for that username → HTTP 400 (a credential cannot be created without a password); this replaces the current mongoose 500.
- Usernames absent from the incoming list are removed (explicit removal via the editor still works).

The CMS complements this: `toContent()`/save omits the `password` key for a row whose field is blank (rather than sending `""`), so the "keep existing" branch is what the server sees. Sending an explicit empty string and sending an omitted password are treated identically server-side, so the server is safe regardless of client behavior.

*Alternative considered:* keep delete+insert but coalesce blank → existing by pre-reading current rows into a map. Functionally equivalent; the reconcile framing is clearer and avoids a window where rows are deleted before re-insert (safer under partial failure).

### D4 — Create/import unchanged except blank-password error code
`create()` (used by both create and import) keeps persisting supplied passwords. The only refinement: a user entry with a blank password on first creation returns HTTP 400 (validation) rather than a mongoose 500, matching D3's first-creation rule. Real imports carry non-empty passwords and are unaffected.

## Risks / Trade-offs

- **[Breaking PUT response shape]** → Only the CMS consumes it; updated together. e2e updated to assert the new envelope. No public/versioned API contract exists for this route.
- **[Password now travels to the CMS on load and save]** → It already did on `GET /terminals/:id` detail (admin-only via `fictionalUsers`); this change only makes the CMS actually read it. Still admin-gated by the existing guard; still absent from playback responses.
- **[Reconcile vs delete+insert changes removal semantics]** → Must preserve the existing "usernames dropped from the list are deleted" behavior; covered by a dedicated scenario/test so removal is not accidentally broken.
- **[Blank-on-first-create now 400 instead of 500]** → Slightly stricter surfaced behavior; acceptable and better UX. Existing valid imports unaffected.
