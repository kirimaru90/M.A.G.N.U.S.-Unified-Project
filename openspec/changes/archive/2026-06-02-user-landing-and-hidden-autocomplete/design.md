## Context

Two logged-user quality-of-life features layer onto the completed REWORK phases.
They share `src/main.js` (boot + navigation) and `src/screens/terminal-list.js`
(the terminals fetch + hidden input), so they are proposed as one change.

Current flow: `main.js` boots by `rehydrate()`-ing the session, then always calls
`showCampaignSelect()`. `makeOnLogin(screenEl)` is the shared interactive-login
helper used by BOTH `campaign-select.js` and `terminal-list.js`; it resolves a
Promise after login/cancel and the caller re-renders in place. `onCampaignSelected(campaign)`
fetches campaign config and calls `showTerminalList()`, which reads
`currentCampaign.{id,name,isPublic}` to mount the terminal list. The terminal list
fetches `GET /campaigns/:id/terminals` as a bare array and renders a plain
`#hidden-input` whose Enter/`[ CARICA ]` triggers `lookupHidden()` →
`by-hidden-id/{value}`. Keyboard nav across all focusables is one
`makeNavHandler(focusables)` handler (Arrow up/down cycles, Enter activates buttons).

This change depends on two additive server contract changes: nullable
`lastCampaignId` on `GET /auth/me`, and an optional `hiddenId` field on terminal
entries of the bare-array `GET /campaigns/:id/terminals` response (present on
entries the authenticated user has previously accessed via the by-hidden-id
lookup). The client is strictly a *reader* of both fields; all recording is
server-side and automatic.

Constraints: vanilla JS, no build step, no framework; Italian UI strings; preserve
the established CRT phosphor aesthetic and the existing `makeNavHandler` model.

## Goals / Non-Goals

**Goals:**
- Land an authenticated user with a resolvable `lastCampaignId` directly on that
  campaign's terminal list, from BOTH boot rehydrate and interactive login.
- Keep every other case (no id / missing / unauthorized / anonymous / first-time)
  on today's `showCampaignSelect()` path — zero regression.
- Derive the visited-hidden list locally from optional `hiddenId` fields on entries
  of `GET /campaigns/:id/terminals` (top-level shape unchanged).
- Replace the plain hidden input with a CRT-styled autocomplete over that derived
  list that still accepts arbitrary free text, coexists with `makeNavHandler`, and
  degrades to the current plain input when the list is empty.

**Non-Goals:**
- No client-side write of `lastCampaignId` or visited-hidden state (server-owned).
- No intra-session persistence of newly visited hidden ids before the next
  `/auth/me` or terminals refresh (the in-memory copy may lag one fetch — accepted).
- No change to the `by-hidden-id` lookup contract, campaign-select grouping, or the
  auth/login UI.

## Decisions

### Decision 1 — A single shared landing helper, used by boot and login

Add one helper in `main.js`, e.g. `tryLandOnLastCampaign(user)`, that encapsulates
the entire redirect: given an authenticated `user` with a truthy `lastCampaignId`,
it fetches `GET /campaigns`, finds the campaign whose `id === user.lastCampaignId`,
and — if found — routes through the existing `onCampaignSelected(campaign)` (which
already applies campaign config and calls `showTerminalList()`). It returns a
boolean / the campaign so callers know whether the redirect happened.

- **Boot:** the boot IIFE already has the rehydrated `user`. After config load, call
  the helper; only if it does NOT land, call `showCampaignSelect()`.
- **Login:** see Decision 3 for where this hooks into `makeOnLogin`.

*Why route through `onCampaignSelected` rather than calling `showTerminalList()`
directly:* `showTerminalList()` reads `currentCampaign.{id,name,isPublic}`, and
`onCampaignSelected` is the one place that both sets `currentCampaign` and applies
the per-campaign config. Reusing it guarantees the landing path is identical to a
manual selection. *Alternative rejected:* duplicating the set-campaign + config-load
logic at each entry point — drift risk for no benefit.

### Decision 2 — Fallback resolution requires the full campaign object

`showTerminalList()` needs `id`, `name`, and `isPublic`; `lastCampaignId` alone is
insufficient. Resolution is therefore always against the `GET /campaigns` list the
user is actually allowed to see. **"Not in the list" is treated identically to "no
access" → fall back to campaign select.** This makes a stale/unauthorized id
non-fatal (the handoff doc notes the server *prefers* clearing it but *may* return a
stale id). A `GET /campaigns` failure during landing also falls back to
`showCampaignSelect()` (which will surface its own retry/error state as today).

The complete fallback matrix → `showCampaignSelect()`:
- `lastCampaignId` absent / null / empty
- id present but not in the user's `GET /campaigns` list (missing/unauthorized/stale)
- `GET /campaigns` fails during the landing attempt
- anonymous session (no `getUser()`)
- single-campaign case: already handled by campaign-select's auto-enter; landing need
  not special-case it (if landing doesn't fire, campaign-select auto-enters the lone
  campaign anyway).

### Decision 3 — Login-redirect threading: only from campaign-select, never from inside a campaign

`makeOnLogin(screenEl)` is shared. The redirect is only meaningful when the user
logs in from the **campaign-select** screen — there, after a successful login we
re-fetch the now-authenticated `getUser()` and attempt landing; if it lands, we do
NOT re-mount campaign-select. When the user logs in from **inside a terminal list**
(`makeOnLogin(bootEl)`), they are already in a campaign: **no jump** — preserve
today's "re-render in place" behavior so we never yank a user out of the campaign
they are actively browsing.

Implementation approach: parameterize the landing intent rather than guessing from
`screenEl`. Give `makeOnLogin` an explicit opt-in (e.g.
`makeOnLogin(screenEl, { landAfterLogin: true })`) set only for the campaign-select
call site. On login success with the flag set, attempt `tryLandOnLastCampaign(getUser())`;
if it lands, resolve without restoring `screenEl` (the terminal list has taken over);
if it doesn't, fall through to today's behavior (show `screenEl`, resolve, caller
re-mounts). *Alternative rejected:* inferring intent from which element was passed —
brittle and couples the helper to specific DOM ids.

Note the existing post-login re-mount in `campaign-select.js` (`_appendAuthButton`
re-runs `mountCampaignSelect` after `onLogin()` resolves). When landing fires, the
terminal list is already mounted and the campaign-select element is hidden; the
re-mount must not visibly flash or steal the key handler. Resolving the landing
*before* the caller's re-mount, plus the screen-visibility flips already in
`showTerminalList()` (which hides `campaignSelectEl`), keeps this clean — verify no
double key-handler registration results.

### Decision 4 — Visited list derived from terminals' `hiddenId` field, filtered to non-public

In `terminal-list.js`, after `apiGet('/campaigns/:id/terminals')`, treat the
response as the terminal array (defensively `const terminalList = Array.isArray(res)
? res : [];`) and derive `visitedHidden` in one pass:
`const visitedHidden = terminalList.filter(t => t.hiddenId && !t.isPublic).map(t => t.hiddenId);`.
The existing `.filter(t => t.isPublic)` render loop is unchanged.

*Why filter to non-public:* the server may attach `hiddenId` to public terminals
too (it tracks every previously-accessed by-hidden-id entry, irrespective of the
target's `isPublic` flag). For the autocomplete, however, the affordance is a
*recall list for secret archives* — public terminals are already discoverable via
the visible button list, so surfacing their hidden ids in the dropdown would be
noise rather than recall. Filtering on the client keeps the policy local to the
UI capability (`hidden-terminal-autocomplete`) and leaves the server contract
unchanged.

*Why this source over `/auth/me.unlockedHiddenIds[campaignId]`:* the data is identical
for the current campaign, but the terminals response is fetched at the exact moment
the dropdown is rendered, so its freshness story is at least as good as `/auth/me`
and the dependency stays local to `terminal-list.js` — no new coupling to
`getUser()`. The `unlockedHiddenIds` field on `/auth/me` is additive on the server
and may be useful for future cross-campaign features, but it is intentionally NOT
consumed here.

### Decision 5 — Custom CRT dropdown, not native `<datalist>`

A native `<datalist>` cannot be styled to the CRT aesthetic and renders
inconsistently across browsers. Build a custom dropdown: a positioned container of
suggestion items below `#hidden-input`, transparent background, green border,
monospace, phosphor glow — mirroring the existing `#hidden-input` / `.choice-btn`
styling. Behavior:
- **Focus** on the input → show all `visitedHiddenTerminals` entries.
- **Type** → filter entries by substring (case-insensitive) against the current
  value; hide the dropdown when nothing matches but keep the typed value intact.
- **Pick** (click or keyboard) → fill `#hidden-input` with the entry, close the
  dropdown, return focus to the input. Picking does NOT auto-submit; the user still
  presses Enter / `[ CARICA ]` (keeps the submit path explicit and unchanged).
- **Escape** → close the dropdown without changing the value; input keeps focus.
- **Empty `visitedHiddenTerminals`** → no dropdown is created; behavior is byte-for-
  byte today's plain input.

### Decision 6 — Keyboard coexistence with `makeNavHandler` and Enter disambiguation

The input already binds `keydown`: Enter = `lookupHidden()`. `makeNavHandler`
cycles focus on Arrow keys and activates buttons on Enter. The dropdown introduces a
transient, input-local navigation mode that must not fight either:

- The input's own `keydown` handler owns dropdown interaction while the dropdown is
  open, and calls `stopPropagation()` so the global `makeNavHandler` does not also
  act on the same key.
- **ArrowDown** with the dropdown open → move the active highlight down the suggestion
  list (wrapping). **ArrowUp** → move up; ArrowUp past the top returns focus to the
  input text with no active item. With the dropdown closed, Arrow keys fall through
  to `makeNavHandler` (normal cross-control focus movement).
- **Enter** disambiguation: if the dropdown is open AND an item is highlighted →
  Enter PICKS that item (fills input, closes dropdown), and does NOT submit.
  Otherwise → Enter SUBMITS via `lookupHidden()` (today's behavior, free text
  included).
- **Escape** → close the dropdown (consumed); with the dropdown already closed,
  Escape is left to existing handling.

Suggestion items are rendered as non-focusable elements driven by an "active index"
the input handler maintains (rather than real `tab`/`focus` stops), so they never
enter the `makeNavHandler` focusables array and never disturb the page-level cycle.

### Decision 7 — Disconnect from a terminal returns to the terminal list, not campaign select

The existing `terminal-exit` capability specifies that disconnecting from a
terminal "returns to the boot screen" — and in this codebase `bootEl` *is* the
host for the terminal-list screen (see `showTerminalList()` in `src/main.js`).
The wiring in `src/main.js` (`mountTerminal({ onDisconnect: showCampaignSelect, ... })`)
drifted from that contract and jumps two screens back to campaign-select.

Fix: wire `onDisconnect: showTerminalList`. `currentCampaign` is guaranteed
non-null at this point because reaching the terminal screen requires going
through `onCampaignSelected()`, which sets it before `showTerminalList()` is
called. The chooser remains one step further out via the existing `[ Indietro ]`
on the terminal list, so deliberate exit-to-chooser is still reachable. No new
spec text is needed — this aligns code with the existing `terminal-exit` spec.

## Risks / Trade-offs

- **Double-fetch of `GET /campaigns` on a landing boot** (once in the landing helper,
  then again if/when the user navigates back to campaign-select). → Acceptable: the
  list is small and back-navigation already re-fetches by design (campaign-selection
  spec). Not worth caching complexity.
- **Landing then immediate back feels like a loop for a user who wanted the chooser.**
  → The back affordance on the terminal list returns to campaign-select as today, so
  the chooser is always one step away; landing is a shortcut, not a trap.
- **Stale `lastCampaignId` if the server returns it instead of clearing.** → Decision
  2's "resolve against the allowed list" makes a stale id fall back gracefully.
- **Stale `visitedHiddenTerminals` within a session** (a freshly visited hidden id
  won't appear until the next terminals fetch). → Explicit non-goal; the dropdown is
  convenience-only and free text always works.
- **Enter ambiguity regressing the free-text submit.** → Mitigated by Decision 6:
  Enter only picks when an item is actively highlighted; with no highlight (the
  default after typing free text) Enter always submits. Cover with the spec scenarios.
- **Key-handler double-registration around the login→landing re-mount.** → Decision 3:
  resolve landing before the caller re-mounts and rely on `showTerminalList()`'s
  visibility flips; verify exactly one active `keydown` handler after landing.

## Migration Plan

Client-side only; no data migration. Both server contract changes are additive
(nullable `lastCampaignId` on `/auth/me`; optional `hiddenId` on terminal entries),
so client and server can ship in any order. Before the server populates either
field, landing simply never fires and the visited-hidden dropdown is never rendered
(empty derived list → plain input) — i.e. today's behavior. Rollback is a client
revert; no server coordination needed because the server fields are additive and
ignored by older clients.

## Open Questions

- None blocking. The canonical server "entered a campaign" trigger for recording
  `lastCampaignId` is the server team's choice (handoff doc) and does not affect the
  client. Exact dropdown sizing/max-height is a styling detail to settle during
  implementation against the CRT theme.
