## Context

`apps/pip-boy` is a static, buildless PWA (plain ES modules, no framework) mirroring `apps/terminal`'s conventions. Its character-selection screen (`apps/pip-boy/src/screens/character-select.js`) currently offers a single "create character" action, built for the player path only: `window.prompt()` for a name, then `POST { name }`. The backend (`api-characters`) has always required an explicit `userId` from admins — this was never wired up on the client because pip-boy's character-creation flow was designed and tested against the player path only (see `pipboy-app-shell`'s existing spec: "Empty character list offers creation" only describes the self-owned case).

Admins already have a working, admin-gated data source for "who's in this campaign": `GET /campaigns/:id/players` (used today by the CMS's player-assignment panel), returning `{ id, username, role }[]` with names already resolved server-side.

## Goals / Non-Goals

**Goals:**
- Let an admin using pip-boy create a character for a specific campaign member without hitting the 400.
- Reuse the existing admin-only players endpoint and existing character-create endpoint as-is — no new backend surface.
- Keep the player-facing creation flow (self, name-only) completely unchanged.

**Non-Goals:**
- No new "assign player" or campaign-membership management inside pip-boy (that stays a CMS responsibility).
- No general-purpose modal/dialog framework for pip-boy — the picker reuses the existing list-selection markup pattern already used for campaign/character selection.
- No change to who can *edit* a character after creation (existing owner/admin PATCH permission model is untouched).

## Decisions

- **Branch on `isAdmin()` in the existing creation handler, not a separate screen.** `apps/pip-boy/src/api/session.js` already exposes `isAdmin()`, and `character-select.js` already imports session state. Keeping the branch inline (rather than a new route/screen) matches the app's existing single-file-per-screen structure and avoids introducing new navigation states.
- **Fetch players via the existing `GET /campaigns/:id/players`, not a new pip-boy-specific endpoint.** It's already admin-guarded, already returns resolved usernames, and is exactly the same call the CMS makes for the equivalent picker — no new backend code, no new spec for `api-campaigns`.
- **Render the picker with the existing `.pb-list` / `.pb-select-item` pattern**, the same markup already used for campaign selection and character selection in this file, rather than introducing a new component or a native `<select>`. Keeps visual consistency with the rest of the CRT-styled app.
- **Keep `window.prompt()` for the character name in both paths.** The admin path only inserts a player-selection step *before* the existing name prompt; it doesn't redesign the name-entry UX, since that's out of scope and consistent with the app's minimal-prompt style elsewhere.
- **`userId` is optional, additive, in both API client functions.** `createCharacter(campaignId, { name, species, userId })` omits `userId` from the POST body entirely when not given, so the player path's request body is byte-for-byte unchanged.

## Risks / Trade-offs

- **Empty player list**: if an admin opens character creation in a campaign with zero assigned players, the picker has nothing to show. → Show the existing Italian-voiced error pattern (`.pb-error`) instructing the admin to assign a player via the CMS first; do not attempt to fall back to creating a character for the admin's own account, since that would silently misattribute ownership.
- **Two sequential prompts (player pick, then name) is not a single form.** Slight UX roughness, but matches the app's existing prompt-based creation flow and avoids scope creep into a real form/modal system.
- **Spec dependency on an unarchived change**: `pipboy-app-shell`'s baseline requirement being modified here currently only exists as a delta under `openspec/changes/add-pip-boy-app/`. If `add-pip-boy-app` changes further before archiving, this change's delta needs re-checking against the final archived text.

## Migration Plan

Purely additive client-side change, no data migration. Deploy alongside/after `apps/pip-boy`'s next static release; no coordinated backend deploy required since no API changes are involved. No rollback complexity beyond reverting the pip-boy static files.

## Open Questions

- None blocking; the only external dependency is `add-pip-boy-app` archiving cleanly first (tracked as a note in the proposal).
