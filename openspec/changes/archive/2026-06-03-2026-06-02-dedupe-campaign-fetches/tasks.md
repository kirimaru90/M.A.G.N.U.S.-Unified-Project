## 1. CurrentCampaignService becomes the cache (`current-campaign.service.ts`)

- [x] 1.1 Add a cached lean campaign list: `campaigns: Signal<CampaignDto[]>` backed by a single shared source (`shareReplay(1)` observable or a writable signal hydrated once) so multiple readers do not each trigger `GET /campaigns`
- [x] 1.2 Add `refresh(): void` that re-fetches the lean list and, when a campaign is current, its full `GET /campaigns/:id` snapshot
- [x] 1.3 Change rehydrate: on construction with a stored id, call `api.get(storedId)` (not `list()` + `.find()`); on 404 call `clear()`; on success `setCurrent(fullDto)` carrying `state`
- [x] 1.4 `setCurrent` / selection path: ensure the cached `currentCampaign()` is the **full** DTO (with `state`) — fetch `GET /campaigns/:id` once when a lean option is selected (D3)
- [x] 1.5 Confirm `CampaignDto.state?` is documented as populated for the current campaign and absent on lean list items (`campaign.types.ts`)

## 2. Switcher and campaigns list read the shared cache

- [x] 2.1 `campaign-workspace-switcher.ts`: source dropdown options from `currentCampaign.campaigns()` instead of `this.api.list()`
- [x] 2.2 `campaigns.ts`: render the table from the shared cached list; after create / edit / delete / activate call `CurrentCampaignService.refresh()`
- [x] 2.3 Wire `refresh()` into the remaining campaign mutation call-sites (campaign detail activate/edit, players panel if it mutates the campaign)

## 3. Terminal editor reads cached state (`editor/terminal-editor.ts`)

- [x] 3.1 Build `campaignGlobalSchema` from `currentCampaign()?.state`; remove the `ngOnInit` `campaignsApi.get(this.campaignId)` subscription
- [x] 3.2 Handle a null/absent current campaign gracefully (empty global schema until rehydrate resolves), matching today's in-flight behavior
- [x] 3.3 After a global-schema `PATCH` (returns `{ state }`), update the cached `currentCampaign().state` so the editor schema reflects fresh declarations without a reload (D7)

## 4. Terminal detail page: single terminal fetch (`terminal-detail.ts`)

- [x] 4.1 Remove the `campaignName` second `terminalsApi.get(terminalId)`; compute the name synchronously from `currentCampaign()` (mirroring `backLink()`)
- [x] 4.2 Verify `terminal()` remains the only `GET /terminals/:id` and the not-found (404) path is unchanged

## 5. Terminals list existence check (`terminals-list.ts`)

- [x] 5.1 Derive `campaignNotFound` from `CurrentCampaignService.campaigns()` (or `currentCampaign()`); remove the constructor `campaignsApi.get(this.campaignId)`
- [x] 5.2 Confirm the not-found empty state still renders for an unknown/deep-linked campaign id

## 6. Specs

- [x] 6.1 `current-campaign-service`: update the two requirements (service surface gains `campaigns`/`refresh` + `state` on the DTO; rehydrate via `GET /campaigns/:id`)
- [x] 6.2 `campaign-workspace-switcher`: dropdown options sourced from the cached `campaigns()`; selection populates the full current DTO
- [x] 6.3 `terminals-crud`: detail page issues one `GET /terminals/:id` and resolves the campaign name synchronously; add the cached-list existence-check requirement
- [x] 6.4 `terminal-editor-shell`: add the requirement that the editor sources the global schema from `currentCampaign().state` and issues no `GET /campaigns/:id` on mount

## 7. Verify

- [x] 7.1 Build / lint / typecheck pass
- [ ] 7.2 Refresh on any shell page issues exactly **1× `GET /campaigns`** (lean) + **1× `GET /campaigns/:id`** (current, with `state`); refreshing on `/campaigns` adds no further list call
- [ ] 7.3 Entering a terminal issues exactly **1× `GET /terminals/:id`** and **0× `GET /campaigns/:id`** (campaign + state served from cache)
- [ ] 7.4 Opening `/campaigns/:id/terminals` issues **0** dedicated `GET /campaigns/:id` and still shows the not-found state for an unknown campaign id
- [ ] 7.5 Editing a global variable then opening a terminal shows the **updated** schema (cache invalidation works)
- [ ] 7.6 Switching campaigns in the switcher updates the editor's available global variables and the terminals list without a full reload
