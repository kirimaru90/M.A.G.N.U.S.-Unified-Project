## 1. Types and API service

- [x] 1.1 Define `CampaignDto` interface (`{ id, name, isActive, isPublic }`) in `src/app/core/campaign/campaign.types.ts`
- [x] 1.2 Define `CreateCampaignSchema` and `EditCampaignSchema` Zod schemas in `src/app/core/campaign/campaign.schemas.ts`
- [x] 1.3 Create `CampaignsApiService` in `src/app/core/campaign/campaigns-api.service.ts` with methods: `list()`, `create(dto)`, `update(id, dto)`, `delete(id)`, `activate(id)` — all returning `Observable<T>` via `HttpClient`

## 2. CurrentCampaignService upgrade

- [x] 2.1 Update `CurrentCampaignService` to use `CampaignDto` (import from `campaign.types.ts`)
- [x] 2.2 Implement `setCurrent`: update signal and write `id` to `localStorage['magnus.currentCampaignId']`
- [x] 2.3 Implement `clear`: set signal to `null` and remove `localStorage['magnus.currentCampaignId']`
- [x] 2.4 Implement startup rehydration in the constructor: read stored id, if present call `CampaignsApiService.list()`, find match, call `setCurrent` or `clear`

## 3. MSW campaigns handlers

- [x] 3.1 Create `src/mocks/handlers/campaigns.handlers.ts` with an in-memory `CampaignDto[]` seeded with two fixture campaigns
- [x] 3.2 Implement `GET /campaigns` handler (returns full array)
- [x] 3.3 Implement `POST /campaigns` handler (generates uuid, appends, returns 201)
- [x] 3.4 Implement `GET /campaigns/:id` handler (returns match or 404)
- [x] 3.5 Implement `PUT /campaigns/:id` handler (merges `{ name, isPublic }`, returns 200 or 404)
- [x] 3.6 Implement `DELETE /campaigns/:id` handler (removes from array, returns 204 or 404)
- [x] 3.7 Implement `POST /campaigns/:id/activate` handler (toggles `isActive`, returns updated or 404)
- [x] 3.8 Register `campaignsHandlers` in `src/mocks/browser.ts`

## 4. Campaign workspace switcher component

- [x] 4.1 Create `CampaignWorkspaceSwitcherComponent` in `src/app/layout/campaign-workspace-switcher.ts` (standalone, imports `SelectModule`, `FormsModule`)
- [x] 4.2 Inject `CampaignsApiService` and `CurrentCampaignService`; load campaigns list on init with `toSignal`
- [x] 4.3 Bind `<p-select>` to `currentCampaign()` with placeholder "Seleziona campagna" and `optionLabel="name"`
- [x] 4.4 Implement `onSelect(campaign: CampaignDto)` calling `CurrentCampaignService.setCurrent(campaign)`
- [x] 4.5 Add the component to `TopbarComponent` imports and template (between `.bo-crumbs` and `.bo-topbar-right`)

## 5. Sidebar cleanup

- [x] 5.1 Remove the `.bo-campaign-switch` placeholder element from `src/app/layout/sidebar.ts`

## 6. Campaigns list page

- [x] 6.1 Replace the placeholder `CampaignsPage` in `src/app/features/campaigns/campaigns.ts` with a full component importing `TableModule`, `ButtonModule`, `ConfirmDialogModule`, `ToastModule`
- [x] 6.2 Inject `CampaignsApiService`, `ConfirmationService`, `MessageService`, `CurrentCampaignService`; load campaigns with `toSignal(this.api.list())`
- [x] 6.3 Add `<p-table>` with columns Nome, Attiva (badge), Pubblica (badge), Azioni; add loading and empty-state handling
- [x] 6.4 Add "Nuova campagna" button triggering the create dialog
- [x] 6.5 Add row edit action button opening the edit dialog
- [x] 6.6 Add row toggle-active action button calling `activate(id)` and refreshing the list
- [x] 6.7 Add row delete action button triggering PrimeNG `ConfirmationService.confirm(...)` with the warning message

## 7. Create campaign dialog

- [x] 7.1 Create `CreateCampaignDialogComponent` in `src/app/features/campaigns/create-campaign-dialog.ts` (standalone, uses `DialogModule`, `ReactiveFormsModule`, `CheckboxModule`, `InputTextModule`)
- [x] 7.2 Build Reactive Form: `name` (required), `isActive` (boolean, default false), `isPublic` (boolean, default false)
- [x] 7.3 On submit: run Zod `CreateCampaignSchema.safeParse`, show `.bo-field-error` on failure, call `CampaignsApiService.create()` on success
- [x] 7.4 Emit success event to parent on `POST /campaigns` 2xx; parent closes dialog and refreshes list
- [x] 7.5 Integrate `CreateCampaignDialogComponent` into `CampaignsPage` with `<p-dialog>` visibility binding

## 8. Edit campaign dialog

- [x] 8.1 Create `EditCampaignDialogComponent` in `src/app/features/campaigns/edit-campaign-dialog.ts` (standalone, input `campaign: CampaignDto`)
- [x] 8.2 Build Reactive Form pre-populated with `campaign.name` and `campaign.isPublic`
- [x] 8.3 On submit: run Zod `EditCampaignSchema.safeParse`, show errors on failure, call `CampaignsApiService.update(id, dto)` on success
- [x] 8.4 On success: emit updated campaign to parent; parent refreshes list and calls `CurrentCampaignService.setCurrent` if it was the active campaign
- [x] 8.5 Integrate `EditCampaignDialogComponent` into `CampaignsPage` with `<p-dialog>` visibility binding

## 9. ConfirmDialog and delete wiring

- [x] 9.1 Provide `ConfirmationService` and `MessageService` in `app.config.ts` (if not already provided)
- [x] 9.2 Add `<p-confirmdialog>` to `CampaignsPage` template
- [x] 9.3 Wire delete row action: `ConfirmationService.confirm({ message: '...', acceptButtonStyleClass: 'p-button-danger', accept: () => onDeleteConfirmed(campaign) })`
- [x] 9.4 Implement `onDeleteConfirmed`: call `CampaignsApiService.delete(id)`, on success remove from list, call `CurrentCampaignService.clear()` if it was the active campaign

## 10. Verification

- [x] 10.1 Run `npm run lint` — zero errors
- [x] 10.2 Run `npm run typecheck` (or `tsc --noEmit`) — zero errors
- [x] 10.3 Manually verify: list loads fixture campaigns from MSW; create adds a row; edit renames the campaign; toggle-active flips the badge; delete with confirmation removes the row
- [x] 10.4 Manually verify: selecting a campaign in the topbar switcher persists through a page reload
