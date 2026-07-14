## Why

Two of the three sections the upcoming player-facing "scheda personale" terminal must show — a character's **background** and its **notes** — have no source of truth today. The character document ([character.schema.ts](../../../apps/api/api/src/characters/schemas/character.schema.ts)) stores identity, stats, inventory and status but no freeform narrative text, and the Pip-Boy `NOTES` tab is a spec'd static placeholder ([pipboy-character-sheet](../../specs/pipboy-character-sheet/spec.md)). This change adds the persistence and API surface those features draw on.

Background is potentially long, spoiler-ish narrative prose that should **not** ride along on every character fetch (list rows, sheet loads, admin pickers). It is therefore stored on the character document but hidden from the normal retrieval paths and read through its own endpoint. Notes are titled, dated, and unbounded in number, so they live in their own collection rather than as an array on the character.

## What Changes

- Add an optional `background` (string) field to the character document, persisted with `select: false` so it is **never** included in the character list or detail responses.
- New dedicated `GET /campaigns/:cid/characters/:id/background` returning `{ background }` — the only read path that exposes it.
- New `PATCH /campaigns/:cid/characters/:id/background` to set/clear it; the full `PUT /campaigns/:cid/characters/:id` accepts an optional `background` and leaves the stored value **unchanged when omitted** (it is never wiped by a background-less full update).
- New `character_notes` collection: `{ id, characterId, campaignId, userId, title, note, createdAt, updatedAt }`.
- Full CRUD for notes under a character: `GET`/`POST /campaigns/:cid/characters/:id/notes`, `PATCH`/`DELETE /campaigns/:cid/characters/:id/notes/:noteId`.
- All new endpoints reuse the character access rules: owner or admin, campaign membership enforced, `404`-over-`403` to avoid leaking existence.

## Capabilities

### New Capabilities

- `api-character-notes`: A per-character notes collection with full CRUD, scoped and access-controlled like characters.

### Modified Capabilities

- `api-characters`: The character document gains an optional `background` field that is excluded from list and detail responses and read/written only through dedicated background endpoints; the full-update contract is clarified so an omitted `background` is preserved rather than cleared.

## Impact

- Character schema: new `background` prop with `select: false`.
- New Mongoose schema/collection: `CharacterNote`; new `CharacterNotesModule` (or notes members added to the existing characters module) registered in `AppModule`.
- New routes: `GET|PATCH /campaigns/:cid/characters/:id/background`; `GET|POST /campaigns/:cid/characters/:id/notes`; `PATCH|DELETE /campaigns/:cid/characters/:id/notes/:noteId`.
- Reuses `CharacterOwnerGuard` for ownership/existence checks.
- No breaking change: existing character responses are byte-for-byte unchanged (background was never present before and remains absent from those paths).

## Testing

- **Unit** (`src/**/*.spec.ts`): notes service CRUD (create mints an id + timestamps; update merges title/note; delete removes; list is scoped to the character); background read returns the selected field; the character response mapper never emits `background`; `PUT` with `background` omitted preserves the stored value while `PUT`/`PATCH` with it present updates it.
- **E2E** (`test/*.e2e-spec.ts`, mongodb-memory-server): each endpoint's happy path and access control — owner succeeds, non-owner player gets `404`, admin succeeds, unauthenticated gets `401`; `GET` character detail and list responses contain **no** `background` key; `GET .../background` returns it; notes are isolated per character and per campaign.
- The final task runs `npm test` and `npm run test:e2e` from `apps/api/api`; changed files meet ≥ 80% line coverage via `npm run test:cov`.
