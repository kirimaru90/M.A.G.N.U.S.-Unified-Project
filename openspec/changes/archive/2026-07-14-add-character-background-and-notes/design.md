## Context

The personal-terminal feature needs a character's **background** and **notes** as readable data. Neither exists yet. This change adds only the persistence + API; the Pip-Boy editors that let a player write them, and the terminal that displays them, are separate changes (`emulator-personal-terminal`, plus Pip-Boy follow-ups).

## Decisions

### Background: a field, but hidden on retrieval
Background is stored as a plain `background?: string` on the character document, **not** a separate collection — it is singular and 1:1 with the character. To keep long/spoiler narrative out of the hot paths (list rows, sheet load, admin picker), the Mongoose prop is declared `select: false`. Every existing read (`list`, `findById`, the section PATCH responses) already projects through `toResponse()`, which will simply never see the field. The only place it is explicitly `.select('+background')`-ed is the dedicated `GET .../background` handler.

Rationale for hiding it (the user's "avoid exposing it when the character is recovered"): background can be large and is narrative-sensitive; callers that need the whole sheet (Pip-Boy, CMS) fetch it deliberately via its own endpoint, so it is never paid for on bulk/opportunistic reads.

### Writing background without clobbering it
- `PATCH /campaigns/:cid/characters/:id/background { background }` is the primary write path (set to a string, or empty string to clear).
- The full `PUT` accepts an optional `background`: **present → overwrite; absent → leave unchanged.** This is a deliberate carve-out from the usual "PUT replaces the whole mutable document" semantics, because `background` is `select: false` and a naive full replace would silently wipe it whenever a client (which never received it) round-trips the document.

### Notes: a separate collection
Notes are titled, dated, and unbounded, so they are their own documents rather than an array embedded on the character:

```
character_notes
  id         string  (server-minted nanoid — matches the collection-id convention)
  characterId ObjectId (indexed)
  campaignId  ObjectId (scoping / access)
  userId      ObjectId (owner; = character.userId at creation)
  title       string
  note        string
  createdAt / updatedAt   (mongoose timestamps)
```

Indexed `{ characterId: 1 }` for the list query. Ownership is derived from the parent character (via `CharacterOwnerGuard`), so `userId` is a denormalised convenience, not the authority.

### Access control — reuse, don't reinvent
All routes sit under `/campaigns/:cid/characters/:id/...` and reuse `CharacterOwnerGuard`: load the parent character, `404` if missing/soft-deleted, pass for admin or owner, else `404`. Notes inherit the character's fate; there is no independent notes-level sharing.

## Open questions / follow-ups (out of scope here)

- Pip-Boy UI to author background and notes (the `NOTES` tab is currently a placeholder) — separate `pipboy-*` change(s).
- Whether deleting a character should cascade-delete its notes. For now notes are filtered by the (soft-deleted) character's guard so they become unreachable anyway; a hard cascade can be a later cleanup.
