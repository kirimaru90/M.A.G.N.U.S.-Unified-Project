## Why

A campaign accumulates characters, places, factions and creatures. Players have nowhere to read about them except scattered notes. The master has no way to reveal lore one character at a time. A campaign-scoped codex fills that gap. It reuses the per-character projection that quests already use and links to the map, so the lore and the geography point at each other.

## What Changes

- **API**: new `codex` module and `codex_entries` collection. An entry has a `type` (`personaggio` | `luogo` | `fazione` | `creatura`), `name`, `description`, master-only `secretDescription`, `imageUrl`, `isPublic`, `visibleToCharacterIds`, `isEditable`, an optional `mapPlaceSlug`, `createdByCharacterId`, and soft-delete fields (`isDeleted`, `deletedAt`, `deletedByCharacterId`).
  - Admin CRUD under `/campaigns/:cid/codex`. An admin delete is a hard delete, and an admin can restore a soft-deleted entry.
  - Admin export (`GET …/codex/export`) and append-only import (`POST …/codex/import`) that skips collisions.
  - Character routes under `/campaigns/:cid/characters/:chid/codex`: a projected read (visible when public or when the character is listed, never deleted, never the secret). Players can create, which makes the entry visible to the creator and editable. Players can edit and toggle `isPublic` when the entry is visible and `isEditable`. A player's delete is only a soft delete.
- **API, map**: `MapPlace` gains an optional `codexEntryId`. Map documents and import files without it stay valid; the field is simply undefined.
- **CMS**: new **Codex** section, modelled on Quest. It has a campaign-bound list with a type filter and a `Mostra eliminate` filter (off by default), and an entry dialog that includes the character multi-picker, the secret description, `isEditable` and the map-place link. Deleted entries can be restored or permanently deleted. JSON export and import are available. The map's place card gains a codex-entry link.
- **Pip-Boy**: new `INFO › Codex` subtab, the first INFO subtab. **BREAKING (sheet layout)**: INFO becomes `Codex · Quest · Note`, and the swipe/prev-next order changes.
  - The subtab has a search box, a type select, collapsible category groups (collapsed by default and auto-expanded while searching), and a full-pane detail with the image at the top (contained, height-capped), a back button and a `MAPPA` button.
  - The editor popup in quest style creates and edits entries; its map-place picker matches places by name and stores the slug. Deletion goes through a confirmation and is a soft delete.
  - The map popup gains a `CODEX` button for a linked entry the character can see.

## Capabilities

### New Capabilities
- `api-codex`: codex entry persistence, admin CRUD with restore and hard delete, admin export and import, the per-character projection, and player writes gated by visibility, `isEditable` and soft delete.
- `cms-codex`: CMS Codex section with the list and its filters, the entry dialog, restore and permanent delete, JSON export and import, and `CodexApiService`.
- `pipboy-codex`: the Pip-Boy `INFO › Codex` subtab with list, search, type filter, collapsible categories, detail with image and map jump, editor popup, and soft-delete confirmation.

### Modified Capabilities
- `api-campaign-map`: the place document gains an optional `codexEntryId`.
- `cms-campaign-map`: the place selection card gains a codex-entry link, and importing places keeps `codexEntryId` while still accepting files without it.
- `pipboy-map-tab`: the place popup offers `CODEX` for a linked visible entry, and the tab can be opened focused on a place given by slug.
- `pipboy-sheet-navigation`: INFO gains `Codex` as its first subtab, the flattened order changes, and a cross-tab jump carries a one-shot intent.
- `pipboy-character-sheet`: `INFO › Note` becomes the third INFO subtab.

## Impact

- **API**: `apps/api/api/src/codex/` (schema, DTOs, projection, service, two controllers, module), `app.module.ts`, the campaign-map schema and DTO (`codexEntryId`), a regenerated `apps/packages/api-spec/openapi.json`, and a new `test/codex.e2e-spec.ts`.
- **CMS**: `src/app/core/codex/` (API service and types), `src/app/features/codex/` (list, entry dialog, import dialog), routes, sidebar, the campaign-map place card, and regenerated `openapi-types.ts`.
- **Pip-Boy**: `src/api/codex.js`, `src/tabs/codex.js`, `src/tabs/codex-editor.js`, `screens/sheet.js` (tab tree, `goToMap` and `goToCodex`), `tabs/map.js` (popup button, focus intent), `pipboy.css`, the `sw.js` precache list, and Playwright `gotoTab` plus the specs that depend on INFO order.
- **Data**: one new collection with indexes on `(campaignId, id)` (unique), `(campaignId, isDeleted)` and `(campaignId, visibleToCharacterIds)`. No migration is needed; existing map places simply lack `codexEntryId`.
- **No new dependencies.** Images are external URLs only, with no upload or storage.

## Testing

- **API unit** (`src/**/*.spec.ts`):
  - Projection: the visibility rule, removal of the secret and of deleted entries, and the map from `createdByCharacterId` to `isOwn`.
  - Write-permission predicate: visible and `isEditable`, with admin bypass.
  - Import merge: id collision, (type, normalized name) collision, collisions within the file, invalid entries, and filtering of character ids from other campaigns.
  - Service create defaults: player-created entries are visible to the creator, editable and private; master-created entries default to not editable.
- **API e2e** (`test/codex.e2e-spec.ts`, mongodb-memory-server):
  - Admin CRUD, restore and hard delete.
  - Player read projection: public, listed, private, made private again, deleted, secret never present.
  - Player create, edit and toggle on editable versus non-editable entries (403); soft delete (404 afterwards for players, still visible to admin).
  - 404 across campaigns and for non-owners; export and import round trip.
  - Map PUT with and without `codexEntryId`.
- **CMS Vitest**: `CodexApiService`; the list (type filter, `Mostra eliminate` default off, deleted-row actions); the entry dialog (validation, multi-picker, map-place picker); the import dialog summary; the place card's codex link; and place import that keeps `codexEntryId` while accepting files without it.
- **Pip-Boy Playwright** (`apps/pip-boy/tests`):
  - `codex-tab.spec.ts`: INFO order, empty categories hidden, collapsed by default, search auto-expand, type select, detail with image cap and broken-image fallback, back button, create, edit, toggle and soft-delete confirmation, no edit controls on non-editable entries, `MAPPA` jump.
  - `map-tab` addition: the `CODEX` button shows only for a visible linked entry and opens its detail.
  - Updated `gotoTab` and the navigation-order specs.
