## Why

The master has no way to track and reveal the campaign's quests: neither the story arc shared by the whole party nor the personal threads of individual characters. Players have no in-game log of what they are pursuing. Quests also change over time (they advance, stall, close), and the table needs that evolution to be readable as a history rather than overwritten in place.

## What Changes

- **New quest domain (API + DB).** A `quests` collection, one document per quest, scoped to a campaign. A quest is either `story` (visible to every character in the campaign, gated by a quest-level `isPublic`) or `personal` (assigned to one or more characters through a `characterIds` array). Each quest carries an append-only list of **stages**. A stage is a full snapshot: `title` (required), `description?`, `reward?` (all free text), `status` (`in_corso` | `standby` | `completata`), `isMilestone`, and its own `isPublic`. The quest's current state is its **last public stage**, so a quest gains or loses milestone status as stages are added.
- **Hidden stages are drafts.** A stage with `isPublic: false` is never sent to a player, and the player projection leaks no trace of it (no ids, no counts, no `updatedAt` bump). Stages carry a `revealedAt` timestamp, set the first time they become public, and the player sees that date.
- **Admin CRUD endpoints** for quests and their stages, and a **read-only player endpoint** per character that returns the visible story quests plus the visible personal quests that include the character. For personal quests the response also lists the *other* involved characters as `{ id, name }` only.
- **CMS "Quest" section**, modelled on Terminali: a list bound to the current campaign (type, involved characters, current status, milestone, public, stage count) and a detail page that edits the quest header (kind, characters, public) and its stages (create pre-filled from the last stage, edit, delete the last one, toggle public / milestone).
- **Pip-Boy navigation rearranged** (**BREAKING** for the sheet layout and its specs): the first level goes from six tabs to five, `STATS · INV · DADI · INFO · MAPPA`. `SALUTE` becomes the first subtab of `STATS`, and the new `INFO` tab holds the `Quest` and `Note` subtabs. The existing NOTES screen moves under `INFO › Note` unchanged.
- **Pip-Boy quest log (`INFO › Quest`)**: a list grouped by current status (completed ones collapsed), a milestone marker, a `CONDIVISA` indicator with the other characters for shared personal quests, an `AGGIORNATA` badge for quests with public stages not yet seen on this device, and a detail view showing the current stage with its reward, followed by an expandable stage log.
- Out of scope: linking quests to map places (dropped for now), player-authored quests, a dedicated milestone timeline view.

## Capabilities

### New Capabilities
- `api-quests`: quest and stage persistence, admin CRUD, validation by kind, the player projection with two-level visibility (quest and stage), `revealedAt`, and the no-leak rules.
- `cms-quests`: the Quest list and detail pages, header and stage editors, character multi-picker, the sidebar entry, and the `QuestsApiService`.
- `pipboy-quests`: the `INFO › Quest` list and detail, status grouping, milestone and shared indicators, and the device-local `AGGIORNATA` badge.

### Modified Capabilities
- `pipboy-sheet-navigation`: first level becomes five tabs (`STATS`, `INV`, `DADI`, `INFO`, `MAPPA`). `STATS` gains `Salute` as its first subtab, `INFO` gets `Quest` and `Note` subtabs, and the flattened prev/next and swipe order is updated.
- `pipboy-character-sheet`: the `SALUTE` first-level tab becomes the `STATS › Salute` subtab, and the `NOTES` first-level tab becomes the `INFO › Note` subtab. Their content requirements are otherwise unchanged.

## Impact

- **API (`apps/api/api`)**: new `quests/` module (schema, DTOs, service, admin controller under `/campaigns/:cid/quests`), plus a player route `GET /campaigns/:cid/characters/:id/quests` reusing the character access guard. Character deletion has to be reflected in personal quests: soft-deleted characters are filtered out of the `involved` projection. Swagger/OpenAPI is updated, so the CMS client is regenerated.
- **CMS (`apps/cms`)**: new `features/quests/` (list, detail, stage dialog), `core/quests/` API service and types, sidebar entry, and a campaign-characters lookup for the multi-picker (via the existing actor-scoped `GET /campaigns/:cid/characters`).
- **Pip-Boy (`apps/pip-boy`)**: `screens/sheet.js` `TAB_TREE` rearranged, new `tabs/quests.js` and `api/quests.js`, styles, and `localStorage` for seen stages. Existing Playwright tests that click `SALUTE` / `NOTES` as first-level tabs, or that assert six tabs or the old swipe order, must be updated.
- **No data migration**: the collection is new.

## Testing

- **API unit (`src/**/*.spec.ts`)**:
  - player projection: story `isPublic` gate, personal membership, hidden stages removed, quest dropped when it has no public stage, current status and milestone taken from the last public stage, `updatedAt` derived from public stages only, `involved` excludes the viewer and soft-deleted characters, and carries only `{ id, name }`;
  - DTO validation: `personal` requires a non-empty `characterIds` of characters in the campaign, `isPublic` is ignored or rejected on `personal`, stage `title` is required, `status` is in the enum;
  - `revealedAt` is set on the first publication and preserved on re-publication;
  - only the last stage can be deleted.
- **API e2e (`test/quests.e2e-spec.ts`, mongodb-memory-server)**:
  - admin CRUD round-trip for quests and stages;
  - non-admin gets 404 on the admin routes;
  - player read of their own character returns the right set;
  - player read of another player's character gets 404;
  - unauthenticated requests get 401;
  - a hidden draft stage is absent from the player response and does not change it.
- **CMS (Vitest, already wired per `cms-testing`)**:
  - `QuestsApiService` maps and unwraps responses;
  - the list page shows the select-a-campaign empty state, rows and columns, and sorting;
  - the detail page edits the header;
  - the stage dialog is pre-filled from the last stage on create;
  - delete is offered only on the last stage;
  - unpublishing the current stage asks for confirmation.
- **Pip-Boy (Playwright e2e, `apps/pip-boy/tests`)**:
  - five first-level tabs, the `STATS` and `INFO` subtabs, and the new flattened order and swipe;
  - the quest list grouped by status with completed ones collapsed;
  - milestone marker;
  - `CONDIVISA` with other characters only;
  - detail with current stage and expandable log;
  - `AGGIORNATA` appears for unseen stages and clears after the detail is opened;
  - empty state;
  - the notes flow still works under `INFO › Note`.
