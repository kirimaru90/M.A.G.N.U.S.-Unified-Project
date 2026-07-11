## Why

`POST /campaigns/:cid/characters` requires an explicit `userId` in the body when the caller is an admin (`api-characters`: "Admin omits userId → HTTP 400" — intentional, since the API has no other way to know which player the admin is creating a character for). `apps/pip-boy` is the only client that creates characters, and its "Crea personaggio" flow only ever prompts for a name and POSTs `{ name }` — it never collects or sends `userId`. Any admin using pip-boy's empty-character-list creation action gets a 400 with no path forward.

## What Changes

- In `apps/pip-boy`'s character-selection screen, when the authenticated user is an admin, the "create character" action first lets them pick which campaign member the character belongs to (fetched from the existing admin-only campaign players endpoint), then prompts for the name, then creates the character for that player.
- Non-admin players keep the existing behavior unchanged: prompt for name only, character is created for themselves.
- Add a `listPlayers(campaignId)` wrapper to pip-boy's campaigns API client and thread an optional `userId` through its character-creation API client.

No backend or API contract changes — `GET /campaigns/:id/players` and `POST /campaigns/:cid/characters` already support everything this needs.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `pipboy-app-shell`: the "Character selection" requirement's empty-list creation behavior gains an admin-specific path (select target player, then name) alongside the existing player path (name only, self-owned).

Note: `pipboy-app-shell` is currently defined only as a pending spec delta under `openspec/changes/add-pip-boy-app/specs/pipboy-app-shell/spec.md` (that change is task-complete but not yet archived into `openspec/specs/`). This change's spec delta is written as a further modification of that same requirement and assumes `add-pip-boy-app` lands first.

## Impact

- `apps/pip-boy/src/api/campaigns.js`: new `listPlayers(campaignId)` function calling `GET /campaigns/:id/players`.
- `apps/pip-boy/src/api/characters.js`: `createCharacter(campaignId, { name, species, userId })` sends `userId` in the POST body when provided.
- `apps/pip-boy/src/screens/character-select.js`: admin-branching in the empty-list creation handler using the existing `isAdmin()` session helper and the existing `.pb-list`/`.pb-select-item` markup pattern for the player picker.
- No changes to `apps/api`, `apps/cms`, or `apps/terminal`.

## Testing

- **pipboy-\***: extend the Playwright suite (`apps/pip-boy/playwright.config.ts`, per `pipboy-app-shell`'s existing test plan) with cases for: an admin creating a character picks a player from the campaign roster before naming it and the resulting character is owned by the selected player; a player still gets the simple name-only prompt and the character is owned by themselves.
