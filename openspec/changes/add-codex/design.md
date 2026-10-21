## Context

The codex is the third campaign-scoped, per-character-projected domain, after character notes and quests. Quests (`apps/api/api/src/quests`) set the pattern this change follows: an admin controller under `/campaigns/:cid/<domain>`, a character controller under `/campaigns/:cid/characters/:chid/<domain>` guarded by `JwtRequiredGuard + CampaignAccessGuard + CharacterOwnerGuard`, a pure projection function, a nanoid `id`, and a `toJSON` transform. The CMS has a matching feature folder and API service, and the Pip-Boy has a lazy-fetching subtab with list and detail states plus a popup editor.

The constraints that shaped the design are already in the code:

- Map places have **no id**. Their identity is `slug` (`campaign-map.schema.ts`), so a codex-to-map link is a slug.
- The map read is projected **by role**, not by character (`GET /campaigns/:id/map`). The map cannot know which codex entries a given character sees.
- The API runs `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`, so any new field must be declared on its DTO or writes containing it fail with 400.
- The Pip-Boy already has a one-shot cross-tab intent, `goToDice(approachKey)` → `pendingApproach` → `preselectApproach` in the render context (`screens/sheet.js`), and a reusable focus primitive in the map tab (`focusPlace`).
- Characters already soft-delete with `isDeleted` and `deletedAt`, filtered with `isDeleted: { $ne: true }`.
- There is no file-upload infrastructure.

## Goals / Non-Goals

**Goals:**
- One codex per campaign, with the visibility, write and soft-delete rules in `api-codex`, enforced server-side.
- The master authors everything from the CMS, including per-character reveal, secret text, editability, restore and permanent delete, and export/import.
- Players read, search and filter the codex on the Pip-Boy, create entries, and edit or delete shared editable entries.
- Two-way navigation between codex entries and map places without coupling their lifecycles.

**Non-Goals:**
- Image upload or storage. Images are external `http(s)` URLs only.
- Per-character write grants beyond `isEditable`. Players cannot change who sees an entry.
- Entry history or versioning. Restore covers only deletion.
- Keeping the two links (`mapPlaceSlug` and `codexEntryId`) in sync.
- Configurable types. The four types are a fixed enum.
- Offline caching of external images.

## Decisions

### D1. Separate `codex_entries` collection, one document per entry
Same reasoning as quests: entries are independently written by many characters, and embedding them in the campaign document would make every write contend on one document. Indexes: `(campaignId, id)` unique for lookups, `(campaignId, isDeleted)` for the admin list, and `(campaignId, visibleToCharacterIds)` for the player query.

### D2. Visibility is computed per read in one pure function
`projectForCharacter(entry, characterId)` returns either `null` (not visible) or the player DTO. It is the single place that decides that a deleted entry is never visible, that visibility means public or listed, and that the secret and the access lists are stripped. `canWrite(entry, characterId, isAdmin)` is built on the same visibility predicate: visible and (`isEditable` or admin). Both are unit-tested exhaustively. The player list query adds `isDeleted: {$ne: true}, $or: [{isPublic: true}, {visibleToCharacterIds: chid}]` so Mongo filters first, but the projection still runs on every document, which guards against a drifting query.

*Alternative*: store `isVisible` per character. Rejected because unpublishing has to take effect on the next read, and a computed rule has nothing to keep in sync.

### D3. Two DTO families; master-only fields are absent from player DTOs
The player create and update DTOs declare only `type`, `name`, `description`, `imageUrl`, `isPublic` and `mapPlaceSlug`. With `forbidNonWhitelisted`, sending `secretDescription`, `visibleToCharacterIds` or `isEditable` is a 400 for free, so no runtime branching is needed. Admin DTOs add the master fields and `isDeleted` (for restore).

### D4. Status codes: 404 for "not for you", 403 for "you see it but it's locked"
A player touching an entry they cannot see, or a deleted one, gets 404, consistent with `CharacterOwnerGuard` and the rule that the API does not leak existence. A visible but `isEditable: false` entry gets 403, because the player already knows it exists, and the Pip-Boy hides the controls anyway. A PATCH that leaves the entry invisible to its author (unpublishing an entry seen only through `isPublic`) returns **204** rather than a projection the caller may no longer see.

### D5. Soft delete for players, hard delete for the master
Player `DELETE` sets `isDeleted`, `deletedAt` and `deletedByCharacterId`. Under communal editing any player can delete a shared entry, so the master needs both a recycle bin and an audit trail. Admin `DELETE` is a hard delete. Restore is an admin `PATCH { isDeleted: false }`, which clears the deletion fields, rather than a new endpoint, keeping the surface small. The admin list returns deleted entries and the CMS filters client-side (`Mostra eliminate`); codex sizes are small (tens to low hundreds), so there is no need for a query parameter.

### D6. Links are independent, dangling links are tolerated
`CodexEntry.mapPlaceSlug` and `MapPlace.codexEntryId` are separate, optional and unvalidated against each other. Either side may be deleted, imported or renamed without cascades. Each client shows a link button only when the target resolves *for that viewer*:
- Codex → map: the slug is in the role-projected map (so a hidden place shows nothing).
- Map → codex: the id is in the character's projected codex list. The map tab fetches the codex once per mount for this.

*Trade-off*: a player can see the raw `codexEntryId` of a hidden entry in the map payload. It is an opaque nanoid that reveals no name or content, which we accept. The alternative, a character-aware map read, would add a second projection path to the map for little gain.

*Alternative*: one mirrored link maintained on both sides. Rejected because it needs cross-collection writes on every edit, delete and import, and the two links legitimately differ (a place can be linked from several entries).

### D7. Cross-tab navigation generalizes `goToDice`
`sheet.js` gains `goToMap(slug)` and `goToCodex(entryId)`. They set `pendingMapFocus` or `pendingCodexEntry`, call `selectTop` or `selectSub`, and the values are passed once in the render context (`focusPlaceSlug`, `openEntryId`) and then cleared, mirroring `pendingApproach`. The map tab applies `focusPlace` after its places load. The codex tab opens the detail once its fetch resolves. No router or URL state is introduced.

### D8. Codex tab reuses quest-tab structure and existing primitives
- `tabs/codex.js` keeps a `viewStates` WeakMap keyed by character (as `quests.js` does) holding `{ view, entryId, query, type, open:Set }`, so returning from the detail preserves the filters and toggle states.
- `tabs/codex-editor.js` copies the `quest-editor.js` popup (explicit `SALVA`, dirty-close confirmation, a delete slot). The map-place field opens `openCatalogPicker` over places from `GET /campaigns/:cid/map`, fetched on demand when the field is opened (and also used by the detail to resolve the place name).
- Deletion uses `confirm-dialog.js`.
- Image: `<img class="pb-codex-img" loading="lazy" referrerpolicy="no-referrer">` with `max-width:100%; max-height:40vh; object-fit:contain`, and an `onerror` handler that removes its wrapper. `esc()` on the URL, and the API's `http(s)` validation, close off `javascript:` URLs.

### D9. Import merge is server-side
Unlike places, which the CMS merges and PUTs wholesale, the codex import is `POST /codex/import`. The merge needs the campaign's character ids to filter foreign references, and doing it in one service call avoids N round trips and partial imports from a closed tab. The merge is a pure function `planCodexImport(existing, incoming, campaignCharacterIds)` that returns `{ toInsert, skipped }`, which makes it unit-testable. The name key is normalized with NFD, diacritics stripped, lowercase, trimmed and whitespace collapsed, matching the Italian collation behaviour the catalogs use. Inserts go through `insertMany`.

### D10. CMS reuses map and characters reads for its pickers
The entry dialog loads `GET /campaigns/:cid/characters` (the same lookup as the quest multi-picker) and `GET /campaigns/:cid/map` (as admin, which returns every place). The place card in the map screen loads `GET /campaigns/:cid/codex`. No new lookup endpoints are added.

## Risks / Trade-offs

- **Communal edits can vandalize or erase shared entries** → soft delete with `deletedByCharacterId`, restore in the CMS, and the master can lock an entry with `isEditable: false`. There is no edit history, so overwrites of text are not recoverable.
- **A player can lock themselves out by unpublishing** → a Pip-Boy confirmation when the entry is not their own, and a 204 so the client cleanly drops the entry. The master can re-publish it.
- **External images can break, be slow, or track viewers** → `referrerpolicy="no-referrer"`, lazy loading, and a silent `onerror` removal. Images are not offline-cached. Uploads can come later as a separate `media` capability.
- **Raw `codexEntryId` of a hidden entry is visible in the map payload** → accepted (D6). It reveals no content.
- **INFO subtab order change breaks Playwright specs and muscle memory** → marked BREAKING. The `gotoTab` helper and navigation-order specs are updated in the same change.
- **Import name-collision may skip a genuinely different entry with the same name and type** → reported per item in the summary. The master can rename and re-import.

## Migration Plan

No data migration. The new collection starts empty, and existing map places simply lack `codexEntryId`. Deploy order: the API first (it is backward compatible with the current CMS and Pip-Boy), then the CMS and Pip-Boy, in either order. The Pip-Boy `BUILD_ID` stamp invalidates the service-worker shell so the new scripts load. Rollback: redeploy the previous images. The `codex_entries` collection is ignored by older code. Stored `codexEntryId` fields are **not**: the old map DTO runs under `forbidNonWhitelisted`, so a CMS save that echoes the field back would be rejected with 400. Rolling back the API therefore requires unsetting the field first: `db.campaignmaps.updateMany({}, { $unset: { "places.$[].codexEntryId": "" } })`.

## Open Questions

None blocking. Possible follow-ups: an upload-backed `media` module for images, and a CMS "link both ways" convenience action.
