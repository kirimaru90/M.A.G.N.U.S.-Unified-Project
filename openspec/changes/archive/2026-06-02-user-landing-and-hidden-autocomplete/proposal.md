## Why

Authenticated users today re-select their campaign on every visit, even when they
return to the same one repeatedly — an avoidable step now that the server tracks
the last campaign each user entered (`lastCampaignId` on `GET /auth/me`). At the
same time, the hidden-terminal lookup is a blind free-text field: a returning user
who has already discovered hidden archives must retype each name from memory. The
server now tags previously-accessed hidden archives on `GET /campaigns/:id/terminals`
by adding an optional `hiddenId` field to those terminal entries, enabling a recall
affordance without weakening the by-hidden-id secrecy model. These two quality-of-life
features ride on additive backend contract changes (no breaking shape changes).

## What Changes

- **Last-campaign landing.** On both entry points — boot-time `rehydrate()` and
  interactive login through the shared `makeOnLogin` flow — an authenticated user
  whose `lastCampaignId` resolves against `GET /campaigns` is routed straight into
  that campaign's terminal list, skipping campaign selection. The client only
  *reads* `lastCampaignId`; recording stays server-side.
- **Fallback matrix preserved.** No id, an id missing from the user's `GET /campaigns`
  list, an unauthorized/stale id, an anonymous session, and a first-time user all
  fall back to today's `showCampaignSelect()` behavior. Existing single-campaign
  auto-enter in campaign-select is unaffected.
- **Hidden-archive ids on terminal objects.** `GET /campaigns/:id/terminals`
  continues to return a bare array of terminals (top-level shape unchanged). Any
  terminal — public or non-public — MAY carry an optional `hiddenId` field on
  entries the user has previously accessed via the by-hidden-id lookup. The client
  derives its visited-hidden list for the autocomplete by collecting `hiddenId`
  ONLY from non-public entries (`!t.isPublic && t.hiddenId`); public terminals
  carrying `hiddenId` are excluded because they are already discoverable via the
  visible button list and the autocomplete is a recall affordance for *secret*
  archives. The existing `.filter(t => t.isPublic)` render loop is unchanged.
- **CRT-styled hidden-terminal autocomplete.** The plain hidden input becomes a
  custom dropdown populated from the derived visited-hidden list: focus shows all
  visited entries, typing filters them, click/keyboard picks fill the input, Escape
  closes. Arbitrary free text is always permitted and still submits through the
  unchanged `GET /campaigns/:id/terminals/by-hidden-id/{value}` path. An empty
  visited list degrades to exactly today's plain input.

## Capabilities

### New Capabilities
- `session-landing`: the last-visited-campaign redirect — the two entry points
  (boot rehydrate, interactive login), resolution of `lastCampaignId` against the
  `GET /campaigns` list into a full campaign object, and the complete fallback
  matrix (no id / missing / unauthorized / anonymous / single-campaign / login-from-
  inside-a-campaign).
- `hidden-terminal-autocomplete`: the campaign-scoped CRT dropdown — its data
  source (visited ids derived from `terminal.hiddenId` on the terminals response),
  focus/filter behavior, keyboard interaction coexisting with `makeNavHandler`,
  free-text passthrough to `by-hidden-id`, and empty-state degradation to the plain
  input.

### Modified Capabilities
- `campaign-selection`: note that an authenticated user with a resolvable
  `lastCampaignId` may bypass the campaign-selection screen via `session-landing`,
  qualifying the "campaign-selection is the application entry screen" requirement.
- `hidden-terminal-access`: note that terminal entries on `GET /campaigns/:id/terminals`
  may now carry an optional `hiddenId` field on previously-accessed hidden archives,
  and that the secret-name input may be backed by an autocomplete sourced from those
  ids; the by-hidden-id lookup contract itself is unchanged.

## Impact

- **Code:** `src/main.js` (boot flow, `makeOnLogin`, a new shared landing helper
  routing through `onCampaignSelected`), `src/screens/terminal-list.js` (terminals
  fetch unwrap + the autocomplete dropdown replacing the plain input),
  `src/styles/terminal.css` (CRT dropdown styling next to the existing `#hidden-input`
  rules). `src/api/session.js` is read-only here (`getUser()` already carries the
  `/auth/me` response).
- **APIs (server):** `GET /auth/me` gains nullable `lastCampaignId` (consumed by
  this change). `GET /campaigns/:id/terminals` keeps its bare-array shape; entries
  may now carry an optional `hiddenId` field on previously-accessed hidden archives.
  `GET /auth/me` may additionally expose `unlockedHiddenIds: { [campaignId]: string[] }`;
  this field is additive and NOT consumed by this change (the per-campaign source
  on the terminals response is sufficient and avoids cross-screen coupling). No new
  write endpoints. Both contract changes are additive — no deployment ordering
  required.
- **Out of scope:** any client-side write of `lastCampaignId` or visited-hidden
  tracking; intra-session persistence of new hidden visits before the next
  `/auth/me` or terminals refresh (the in-memory copy may lag one fetch — accepted);
  changes to the by-hidden-id lookup, campaign-select grouping, or the auth/login UI.
- **Content-creator workflow:** unaffected. Holotape authoring, JSON node/choice
  format, and `meta.hiddenId` semantics are unchanged; this is navigation/UI only.
