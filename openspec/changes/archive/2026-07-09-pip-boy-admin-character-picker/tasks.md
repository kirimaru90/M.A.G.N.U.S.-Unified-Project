## 1. API client wrappers

- [x] 1.1 Add `listPlayers(campaignId)` to `apps/pip-boy/src/api/campaigns.js`, calling `GET /campaigns/:id/players`, following the existing `listCampaigns()`/`getCampaign()` style in that file.
- [x] 1.2 Extend `createCharacter(campaignId, { name, species })` in `apps/pip-boy/src/api/characters.js` to accept an optional `userId` and include it in the POST body only when provided, so the player path's request body is unchanged.

## 2. Character-select screen

- [x] 2.1 In `apps/pip-boy/src/screens/character-select.js`, branch the empty-list "create character" click handler on `isAdmin()` (from `apps/pip-boy/src/api/session.js`).
- [x] 2.2 Non-admin path: keep existing behavior exactly as-is (prompt for name, `createCharacter(campaignId, { name })`).
- [x] 2.3 Admin path: call `listPlayers(campaignId)`; if the list is empty, render a `.pb-error` message ("assign a player to this campaign first") and stop, without creating a character.
- [x] 2.4 Admin path: when players exist, render a picker reusing the `.pb-list`/`.pb-select-item` markup pattern already used for campaign/character selection in this file, showing each player's `username`.
- [x] 2.5 Admin path: after a player is selected, prompt for the character name, then `createCharacter(campaignId, { name, userId: selectedPlayer.id })`.
- [x] 2.6 Ensure both paths still call `onSelect(created)` to open the new character's sheet on success, and surface a `.pb-error` on failure, consistent with existing error handling in this file.

## 3. Tests

- [x] 3.1 Add a Playwright spec (new file under `apps/pip-boy/tests/`, following the pattern in `admin-permissions.spec.ts`/`login-flow.spec.ts`) covering: admin with no characters in a campaign sees the create action, picks a player from the roster, names the character, and the created character is owned by the selected player.
- [x] 3.2 Add a case for the existing player path (name-only prompt, character owned by self) to confirm no regression, since no existing test currently exercises character creation at all.
- [x] 3.3 Add a case for an admin creating a character in a campaign with no assigned players: confirm a `.pb-error` is shown and no character is created.
- [x] 3.4 Run `npx playwright test` from `apps/pip-boy` and confirm all pass.
