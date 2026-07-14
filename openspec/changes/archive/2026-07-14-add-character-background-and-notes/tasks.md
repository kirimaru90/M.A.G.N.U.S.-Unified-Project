## 1. Character background field

- [x] 1.1 Add `@Prop({ type: String, select: false }) background?: string` to the `Character` root schema in `apps/api/api/src/characters/schemas/character.schema.ts`
- [x] 1.2 Confirm `toResponse()` in `characters.service.ts` never emits `background` (it maps an explicit field list; add a guard/test so a future `.select('+background')` read cannot leak it into the general response)

## 2. Background endpoints

- [x] 2.1 `dto/patch-background.dto.ts` — `background?: string` (optional; empty string clears)
- [x] 2.2 Service `getBackground(campaignId, characterId)` — query the character with `.select('+background')`, return `{ background: doc.background ?? null }`
- [x] 2.3 Service `setBackground(campaignId, characterId, background)` — `$set` (or `$unset` on empty) and return `{ background }`
- [x] 2.4 In the full `update()` path, treat `background` as optional and **preserve** the stored value when the PUT body omits it (never `$unset` on absence); overwrite only when present
- [x] 2.5 Controller: `GET /campaigns/:cid/characters/:id/background` and `PATCH /campaigns/:cid/characters/:id/background`, both behind `CharacterOwnerGuard`

## 3. Notes schema & module

- [x] 3.1 Create `apps/api/api/src/characters/schemas/character-note.schema.ts` — `CharacterNote { id: string, characterId: Types.ObjectId, campaignId: Types.ObjectId, userId: Types.ObjectId, title: string, note: string }` with `@Schema({ timestamps: true })`; index `{ characterId: 1 }`
- [x] 3.2 Register the `CharacterNote` model (`MongooseModule.forFeature`) in the characters module
- [x] 3.3 `dto/create-note.dto.ts` — `title` (string, required, non-empty), `note` (string, default `""`)
- [x] 3.4 `dto/update-note.dto.ts` — `title?`, `note?` (both optional, validated when present)

## 4. Notes service & controller

- [x] 4.1 `character-notes.service.ts` — `list(characterId)`, `create(character, dto)` (mint `id` via `nanoid(8)`, set `characterId`/`campaignId`/`userId` from the parent character), `update(characterId, noteId, dto)` (merge title/note; `404` if not found under this character), `remove(characterId, noteId)` (`404` if not found)
- [x] 4.2 `toNoteResponse()` — expose `{ id, title, note, createdAt, updatedAt }`; stringify ids; never leak `_id`/`__v`
- [x] 4.3 Controller routes under `CharacterOwnerGuard`: `GET|POST /campaigns/:cid/characters/:id/notes`, `PATCH|DELETE /campaigns/:cid/characters/:id/notes/:noteId`

## 5. Tests

- [x] 5.1 Unit: notes service CRUD, id/timestamp minting, per-character scoping, `404` on cross-character note access
- [x] 5.2 Unit: `getBackground` returns the selected value; `toResponse()` omits `background`; `update()` preserves `background` when omitted and overwrites when present
- [x] 5.3 E2E: background not present on `GET` list or detail; `GET .../background` returns it; access control on all new routes (owner 200, non-owner player 404, admin 200, anonymous 401)
- [x] 5.4 E2E: notes are isolated per character; a note under character A is `404` under character B
- [x] 5.5 Run `npm test` and `npm run test:e2e` from `apps/api/api`; confirm green and changed-file coverage ≥ 80% via `npm run test:cov`
