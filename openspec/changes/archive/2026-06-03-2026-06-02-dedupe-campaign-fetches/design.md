## Context

Campaign data is read in five places, none sharing state:

- **`CurrentCampaignService`** (root singleton) — holds `currentCampaign: Signal<CampaignDto | null>`; on construction, if a stored id exists, calls `api.list()` and `.find()`s the match. Constructed once per page load.
- **`CampaignWorkspaceSwitcherComponent`** (topbar, persists across SPA navigation) — `toSignal(api.list())` for its dropdown options.
- **`CampaignsPage`** (`/campaigns`) — `reload$ → api.list()` for the table.
- **`TerminalsListPage`** (`/campaigns/:campaignId/terminals`) — constructor `campaignsApi.get(campaignId)` purely to flip `campaignNotFound` on a 404; the list itself comes from `terminalsApi.listByCampaign`.
- **`TerminalEditorComponent`** (`ngOnInit`) — `campaignsApi.get(campaignId)` to read the campaign `state` map into `campaignGlobalSchema` (the set of declarable global variables).

Plus `TerminalDetailPage` subscribes to `GET /terminals/:id` **twice**: once for `terminal()` (renders the page) and once for `campaignName()`, whose `switchMap` throws the terminal away and returns `currentCampaign().name`.

`CampaignDto` is `{ id, name, isActive, isPublic, state? }` — `state` is already an optional field on the type. `GET /campaigns/:id` returns `state` (per `global-schema-management`: "declarations and current values SHALL be read from the campaign document's `state` map (`GET /campaigns/:id` → `state`)"). The lean `GET /campaigns` list response does **not** carry `state`.

The enabling fact: the data each consumer needs is already (or can be) held by `CurrentCampaignService`. The work is to make that service the cache and have everyone read from it.

## Goals / Non-Goals

**Goals:**
- One cached `GET /campaigns` (lean) per page load, shared by the switcher and the campaigns list page.
- One `GET /campaigns/:id` (carrying `state`) per *selected campaign*, reused by the terminal editor and the terminals-list existence check.
- Eliminate the discarded second `GET /terminals/:id` on the detail page.
- Keep cached data correct after campaign mutations via an explicit invalidation hook.

**Non-Goals:**
- An HTTP-layer cache/interceptor — this is application-state caching in a service, not middleware.
- Embedding every campaign's `state` in the lean list response.
- Any backend endpoint or payload change; any change to the users area; any change to how schema/state *writes* are issued.

## Decisions

**D1 — Lean list, fat current campaign.**
`GET /campaigns` stays lean (`id, name, isActive, isPublic`) and feeds the dropdown + the campaigns table. Only the **selected** campaign is fetched in full (`GET /campaigns/:id`, carrying `state`) and cached in `currentCampaign()`. So a page load makes at most one lean list call plus one full-campaign call — both load-bearing, neither redundant.
- *Alternative considered:* make `GET /campaigns` include `state` for every campaign, so rehydrate finds the current campaign (with state) in the cached list and the load collapses to a single call. **Rejected** — state maps grow per campaign, and loading every campaign's full state on each refresh just to render a name-only dropdown is the wrong trade. Only the active workspace needs its state.

**D2 — `CurrentCampaignService` is the cache.**
The service exposes:
- `currentCampaign: Signal<CampaignDto | null>` — full DTO incl. `state` (unchanged signature, richer payload).
- `campaigns: Signal<CampaignDto[]>` — the cached lean list (backed by a `shareReplay(1)` source or a writable signal hydrated once), shared by the switcher and the campaigns page.
- `refresh(): void` — re-fetches the lean list (and, if a campaign is current, its full DTO) to invalidate the cache after mutations.
- `setCurrent` / `clear` — unchanged contract; `setCurrent` may trigger the single `GET /campaigns/:id` to upgrade a lean selection into a full DTO with `state` (see D3).

**D3 — Selecting a campaign upgrades it to the full DTO.**
The switcher hands `setCurrent` a *lean* option (from the list). To guarantee `currentCampaign().state` is present for the editor, `setCurrent`/the switcher fetches `GET /campaigns/:id` once on selection and caches the full DTO. This is the *same* single campaign GET the editor used to make per terminal — moved earlier and reused across every terminal in that campaign, not added on top.
- *Alternative considered:* lazily fetch `state` inside the editor only when missing. **Rejected** — it re-disperses the fetch back into the editor and reintroduces a per-terminal call; centralizing in the service is the point.

**D4 — Terminal editor reads `currentCampaign().state`.**
`TerminalEditorComponent` builds `campaignGlobalSchema` from the cached `currentCampaign()?.state` and drops the `ngOnInit` `campaignsApi.get(campaignId)`. This preserves the existing coupling already encoded in the template (`[campaignId]="currentCampaign.currentCampaign()?.id"`) — the terminal under edit is assumed to belong to the current workspace campaign.
- *Edge:* if `currentCampaign()` is null (deep link before rehydrate completes), the editor renders with an empty global schema, exactly as it does today when the campaign fetch has not yet returned. Rehydrate populating the signal triggers recompute.

**D5 — Detail page: one terminal fetch, synchronous campaign name.**
`TerminalDetailPage.campaignName` is computed from `currentCampaign()` synchronously (mirroring `backLink()`), and the second `terminalsApi.get(terminalId)` is removed. The existing `terminals-crud` requirement already says the name is "resolved via `CurrentCampaignService`," so this aligns code with spec.

**D6 — Terminals-list existence check reads the cache.**
`TerminalsListPage` derives `campaignNotFound` by looking up `campaignId` in `CurrentCampaignService.campaigns()` (or comparing against `currentCampaign()`), removing the dedicated `campaignsApi.get(campaignId)`. A current campaign deleted server-side is already caught at rehydrate (D1: `GET /campaigns/:id` → 404 → `clear()`); a deep-linked unknown id is caught by the cached-list lookup.
- *Trade-off:* the cached list can lag a server-side deletion that happens mid-session. The `refresh()` hook (D2) after mutations covers in-app deletions; a cross-session deletion surfaces on the next rehydrate. Accepted — the previous guard had the same staleness window between its fetch and any later deletion.

**D7 — Invalidation on mutation.**
Every campaign mutation refreshes the cache so reads stay correct:
- create / edit / delete / activate → `CurrentCampaignService.refresh()`.
- global-schema `PATCH /campaigns/:id/state/schema` (returns `{ state }`) → if the patched campaign is current, update the cached `currentCampaign().state` with the returned snapshot, so the editor's `campaignGlobalSchema` reflects fresh declarations without a reload.

## Risks / Trade-offs

- **Stale cached `state` in the editor** → without D7 invalidation, editing a global variable in the campaign panel and then opening a terminal would show the old schema. The schema-patch refresh (D7) is required, not optional.
- **Selection now costs a `GET /campaigns/:id`** → switching campaigns issues one campaign fetch (D3). This replaces the per-terminal editor fetch; for a workspace with multiple terminals it is strictly fewer calls, and for zero terminals it is one extra call on an explicit user action (acceptable).
- **Cross-session deletion staleness** (D6) → bounded by rehydrate-on-reload and `refresh()` on in-app mutations; matches the prior guard's window.
- **Null current campaign on deep link** (D4) → editor renders empty global schema until rehydrate resolves, identical to today's in-flight behavior.

## Migration Plan

No data or endpoint migration. The change is internal to the Angular app's state layer:
1. Add the cache (`campaigns` signal + `refresh()`) and switch rehydrate to `get(:id)` in `CurrentCampaignService`.
2. Point the switcher and campaigns page at the cached list; wire `refresh()` into mutation call-sites.
3. Move the editor's schema source to `currentCampaign().state`; remove its fetch.
4. Collapse the detail page to one terminal fetch; remove the terminals-list guard fetch.

Rollback is reverting these files; no persisted state changes, so rollback is clean at any point.
