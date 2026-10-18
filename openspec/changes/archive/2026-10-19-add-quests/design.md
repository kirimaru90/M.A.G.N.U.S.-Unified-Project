## Context

Quests are a new domain object that cuts across the three apps:
- **API and DB**: NestJS + Mongoose, with campaign-scoped modules.
- **CMS**: an Angular + PrimeNG backoffice. The terminals section already sets the pattern of a list bound to the current campaign and a detail page.
- **Pip-Boy**: a vanilla JS PWA with a two-level `TAB_TREE` in `screens/sheet.js`.

Existing patterns to reuse:
- `characters/character-notes.*`: its own collection plus `JwtRequiredGuard`, `CampaignAccessGuard`, and `CharacterOwnerGuard`, with 404 returned instead of 403;
- `campaign-map.service`: projection by role happens in the service, and the API never returns what the caller may not see;
- the Pip-Boy lazy-fetch tabs (`tabs/notes.js`);
- the CMS `CurrentCampaignService` and the `/terminals` list conventions.

Decisions taken with the user during exploration:
- the quest history is a sequence of stages;
- statuses are `in_corso`, `standby`, and `completata`;
- personal quests take a `characterIds` array;
- `isPublic` exists on story quests **and** on every stage;
- the link between quests and map places is dropped for now;
- the Pip-Boy rearranges to `STATS · INV · DADI · INFO · MAPPA`;
- shared personal quests name the *other* characters;
- unseen updates get an `AGGIORNATA` badge.

## Goals / Non-Goals

**Goals:**
- One quest model serving story and personal quests, with an append-only history.
- Hidden stages work as drafts the master prepares ahead, with zero leakage to players.
- An authoring flow in the CMS that matches the existing terminals UX.
- An in-character quest log in the Pip-Boy, plus the navigation rearrangement it needs.

**Non-Goals:**
- Linking quests to map places, or "show on map" (deferred).
- Player-authored or player-editable quests.
- A milestone timeline or chronicle view.
- Push or real-time notifications. The badge is computed on load only.
- Server-side "seen" tracking.

## Decisions

### D1 — Stages are full snapshots embedded in the quest document
Each stage stores the complete `title / description / reward / status / isMilestone`, and the quest's state is derived from its stages.
- *Alternative, deltas* (a stage stores only what changed): rejected. Every read would need a fold, past stages could not be shown "as they were" without replay, and the CMS pre-fill would still need the folded state.
- *Alternative, a separate `quest_stages` collection*: rejected. Stages are few, always read with their quest, and never queried on their own, so embedding gives atomic writes and a single read.

### D2 — Title lives on the stage, not on the quest
A quest can be renamed as it develops ("Un segnale strano" → "Il segnale della Vault 81"). With title on the stage, the history keeps the old names. The quest's display title is that of its current stage: the last stage in the CMS, the last public stage for players. The cost is that the header carries no title of its own, so the CMS list and detail always derive it.

### D3 — Two visibility levels, evaluated only in the service
```
visible(quest, char) = (story ∧ quest.isPublic ∨ personal ∧ char ∈ characterIds)
                       ∧ ∃ stage.isPublic
publicStages        = stages.filter(isPublic)       (order preserved)
current             = publicStages.at(-1)
```
The projection is a pure function, `projectForCharacter(quest, characterId, namesById)`, which can be unit-tested without Mongo. Only the projected shape leaves the player endpoint: no ids or counts of hidden stages, and an `updatedAt` computed from public stages only. The quest document's own `updatedAt` moves whenever a draft is saved, so returning it would leak the existence of the draft.

### D4 — `revealedAt` is set once
`revealedAt` is set the first time `isPublic` becomes true, and is never rewritten. The player sees the moment something happened at the table, not when the master typed it. An unpublish followed by a republish keeps the first date, so a mistaken unpublish does not reshuffle the log dates.

### D5 — Append-only, delete-last-only
Reordering is not supported, and only the last stage can be deleted, provided it is not the only one. This keeps "current" well defined and makes delete an "undo the last update" action. Corrections to past stages go through PATCH. HTTP 409 is used for structurally invalid deletes, and 404 for unknown ids.

### D6 — Validation of `characterIds` against the campaign
The service checks that every id belongs to a non-deleted character of the same campaign at write time. Soft-deleting a character later does not cascade into quests (D7).

### D7 — Soft-deleted characters stay referenced
Quests are not mutated when a character is soft-deleted:
- the player projection drops deleted characters from `involved`;
- the admin read resolves `characters: [{ id, name, deleted }]`, so the CMS can show and remove them.

The alternative, cascading a pull on character delete, would couple the characters service to quests and lose information if the character is ever restored.

### D8 — Endpoints
- Admin routes go under `/campaigns/:cid/quests`. They are not under `/characters`, because story quests belong to no character.
- The player route is `GET /campaigns/:cid/characters/:id/quests`, in a small controller in the quests module that reuses `CharacterOwnerGuard`. An admin hitting it gets the **same** projection as the owner, because the Pip-Boy shows "what this character sees", and the full view lives in the CMS.

### D9 — Pip-Boy navigation: re-shape `TAB_TREE`, nothing more
`health` moves to the head of `stats.subtabs`. `notes` and the new `quests` move under a new `info` node:
```
stats ─ health · special · skills · talents
inv   ─ weapons · equip · consumables · misc
dice
info  ─ quests · notes
map
```
`FLAT`, the swipe handler, and the footer are already derived from `TAB_TREE`, so the order change follows automatically. The tab renderers are reused unchanged. Checks needed:
- any code that branches on `activeTop === 'health'` or `'notes'`, for example the critical banner or the resource band;
- the initial state `activeTop = 'stats'` now lands on `health`, which becomes the default landing screen;
- Playwright helpers that click first-level `SALUTE` / `NOTES`.

### D10 — Quest list and detail are a single tab with internal view state
`tabs/quests.js` holds `{ view: 'list' | 'detail', questId, completedOpen }` in module scope for the mounted sheet, the same way the map holds its state. The detail is an in-pane view with `◀`, not a popup, because the log can be long and needs the full scrolling pane. The detail is not a sheet-level position, so swipe still moves between subtabs.

### D11 — `AGGIORNATA` uses device-local seen sets
The key is `pb.quests.seen.<campaignId>.<characterId>`, holding `{ [questId]: stageId[] }`. Stage ids rather than counts or timestamps are used, so editing a past stage does not raise the badge but publishing a new one does. When the key is missing entirely, the first load seeds it with everything visible, avoiding a wall of badges on a new device. A quest absent from an existing record counts as unseen, which is correct for a newly revealed quest. All access is wrapped in try/catch.

### D12 — The CMS gets its own character lookup
There is no CMS characters section today. `QuestsApiService.campaignCharacters(cid)` calls the existing `GET /campaigns/:cid/characters`, which is actor-scoped, so an admin gets all characters. It is used only by the multi-select. The admin quest read already carries resolved `characters`, so the list needs no lookup.

## Risks / Trade-offs

- **[Tab rearrangement breaks existing Pip-Boy tests and muscle memory]** → Update the shared Playwright helpers in one place (a `gotoTab(top, sub)` helper in `fixtures.ts`). The landing screen stays health, only now as a subtab.
- **[Draft leakage through side channels]** → The projection is a single pure function with explicit "no trace" unit tests, and an e2e test compares the player response before and after a hidden stage is appended.
- **[The admin sees the character projection on the Pip-Boy, not the drafts]** → This is intended (D8), but it could surprise the master. The CMS is the place to see drafts.
- **[Embedded stages grow unbounded]** → In practice a quest has tens of stages at most, well below Mongo document limits. There is no pagination.
- **[Five tabs plus four STATS subtabs on narrow phones]** → The subtab row already fits four labels (INV). `Salute` is short.
- **[Concurrent CMS edits]** → Last write wins, as elsewhere in the CMS. Stage appends use `$push`, so two simultaneous appends do not clobber each other.

## Migration Plan

- The collection is new, so no data migration is needed.
- Deploy the API first. The new endpoints are additive.
- Then the CMS (regenerated client) and the Pip-Boy, which can ship independently.
- The Pip-Boy service worker precache must pick up the new `tabs/quests.js` and `api/quests.js` through the existing cache-busting.
- Rollback: redeploy the previous Pip-Boy and CMS images. The API endpoints can stay, being unused.

## Open Questions

- None blocking. Possible follow-ups:
  - linking quests to places with "show on map";
  - a milestone chronicle view;
  - a server-side unread state if players switch devices often.
