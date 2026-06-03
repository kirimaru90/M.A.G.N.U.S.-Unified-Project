## Why

The backoffice re-fetches campaign data it already holds, because `CampaignsApiService` and `CurrentCampaignService` share no cache — every consumer hits the network independently. Observed today (with a campaign selected):

```
TRIGGER                       REDUNDANT CALLS                                  ROOT CAUSE
──────────────────────────────────────────────────────────────────────────────────────────────
Refresh (any shell page)      2× GET /campaigns                                rehydrate list()+find  +  switcher list()
Refresh on /campaigns list    3× GET /campaigns                                + the list page lists again
Enter a terminal              2× GET /terminals/:id  +  1× GET /campaigns/:id  detail double-fetches; editor re-fetches campaign
Open /…/terminals list        1× GET /campaigns/:id                            404 guard re-fetches a campaign already held
```

Two of these are literal waste, not just architectural duplication:

- **`TerminalDetailPage.campaignName`** ([terminal-detail.ts:105-113](src/app/features/terminals/terminal-detail.ts#L105-L113)) issues a *second* `GET /terminals/:id` and then **discards the response** — its `switchMap` ignores the terminal and returns `currentCampaign().name`. The sibling `backLink()` already reads `currentCampaign()` synchronously with zero HTTP, so this fetch buys nothing.
- **`CurrentCampaignService` rehydrate** ([current-campaign.service.ts:16-27](src/app/core/campaign/current-campaign.service.ts#L16-L27)) fetches the **entire** campaign list just to `.find()` one campaign by the stored id, when `GET /campaigns/:id` returns exactly that one.

The unifying defect: `CurrentCampaignService` holds the selected campaign, but almost nobody trusts it — the workspace switcher, the campaigns list page, the terminals list guard, and the terminal editor each re-fetch instead of reading shared state. The users area is unaffected only because it is not campaign-scoped.

## What Changes

- **`CurrentCampaignService` becomes the single campaign cache.** It owns (a) a cached `campaigns` list signal shared by the topbar switcher and the campaigns list page, and (b) the full current-campaign DTO **including its `state` map**. It exposes a `refresh()` invalidation hook called after campaign mutations (create / edit / delete / activate / global-schema patch).
- **Rehydrate via `GET /campaigns/:id`, not `GET /campaigns` + find.** On startup the service fetches the single stored campaign (carrying `state`); a 404 calls `clear()`. The lean list is still fetched once (for the dropdown) and shared.
- **The current-campaign DTO carries `state`.** `CampaignDto.state?` is populated for the *selected* campaign (via the single `GET /campaigns/:id` on rehydrate/selection). The lean `GET /campaigns` list stays lightweight (no per-campaign `state`).
- **The terminal editor reads `currentCampaign().state`** for the global-variable schema instead of issuing its own `GET /campaigns/:id` on mount.
- **The terminal detail page issues one `GET /terminals/:id`.** The campaign name is derived synchronously from `currentCampaign()`; the discarded second fetch is removed.
- **The terminals-list campaign-existence check reads the cached campaign list** instead of a dedicated `GET /campaigns/:id` guard.

Net effect (with a campaign selected):

```
TRIGGER                       BEFORE                              AFTER
─────────────────────────────────────────────────────────────────────────────────────────
Refresh (any page)            2–3× GET /campaigns                 1× GET /campaigns (lean, shared) + 1× GET /campaigns/:id
Enter a terminal              2× terminal + 1× campaign           1× GET /terminals/:id  (campaign + state already cached)
Open terminals list           1× GET /campaigns/:id               0 dedicated campaign calls
```

Out of scope: any change to backend endpoints or response shapes (the lean list and `GET /campaigns/:id` already return what is needed); the users area; HTTP-layer caching middleware (this is application-state caching, not an interceptor); changing how global-schema *writes* are issued.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `current-campaign-service`: becomes the campaign cache — exposes a shared cached `campaigns` list signal and a `refresh()` invalidation hook; rehydrates the current campaign via `GET /campaigns/:id` (carrying `state`) instead of `GET /campaigns` + find; the `CampaignDto` type gains an optional `state` map populated for the selected campaign.
- `campaign-workspace-switcher`: sources its dropdown options from `CurrentCampaignService`'s cached `campaigns()` signal instead of its own `GET /campaigns`; selecting a campaign populates the full current DTO (with `state`).
- `terminals-crud`: the terminal detail page issues a single `GET /terminals/:id` and resolves the campaign name synchronously from `CurrentCampaignService`; the terminals-list campaign-existence check uses the cached campaign list rather than a dedicated `GET /campaigns/:id`.
- `terminal-editor-shell`: the editor sources the campaign global-variable schema from the cached `currentCampaign().state` and does not fetch `GET /campaigns/:id` on mount.

## Impact

- **Modified code:**
  - `src/app/core/campaign/current-campaign.service.ts` — add a cached `campaigns` list source (`shareReplay(1)` or a signal store) and a `refresh()` hook; change rehydrate to `api.get(storedId)` (404 → `clear()`); store the full DTO with `state`.
  - `src/app/core/campaign/campaign.types.ts` — `state?` already declared; confirm it is populated only for the current campaign and documented as optional on lean list items.
  - `src/app/layout/campaign-workspace-switcher.ts` — read `currentCampaign.campaigns()` instead of `this.api.list()`; selection sets the full current DTO.
  - `src/app/features/campaigns/campaigns.ts` — read the shared cached list; call `refresh()` after create/edit/delete/activate.
  - `src/app/features/terminals/terminal-detail.ts` — drop the `campaignName` second `GET /terminals/:id`; derive the name from `currentCampaign()` synchronously.
  - `src/app/features/terminals/editor/terminal-editor.ts` — populate `campaignGlobalSchema` from `currentCampaign().state`; remove the `ngOnInit` `campaignsApi.get(campaignId)`.
  - `src/app/features/terminals/terminals-list.ts` — derive `campaignNotFound` from the cached campaign list; remove the constructor `campaignsApi.get(campaignId)`.
  - Campaign mutation call-sites (campaign detail / global-schema panel / state panel) — invoke `CurrentCampaignService.refresh()` (and refresh the cached current `state` after a global-schema patch) so the cache does not go stale.
- **Specs modified:** `current-campaign-service`, `campaign-workspace-switcher`, `terminals-crud`, `terminal-editor-shell`.
- **Unaffected:** users area and `users-crud`; backend endpoints and response shapes; `GET /campaigns/:campaignId/terminals` list call; the mutation/global-schema *write* endpoints; `openspec/changes/archive/**` (frozen).
