## Why

Slice 1 delivered the app shell, auth, and MSW infrastructure. The backoffice currently lands on an empty `/campaigns` placeholder — admins have no way to create or manage campaigns. Slice 2 adds the Campaigns CRUD and the `CurrentCampaignService` workspace context that all subsequent slices (Terminals, State) depend on.

## What Changes

- Add `/campaigns` list page with a PrimeNG table showing all campaigns (active and inactive), with columns for name, `is_active`, `is_public`, and row actions (edit, toggle active, delete).
- Add "Create campaign" dialog: Reactive Form with name (required), `is_active` (boolean, default false), `is_public` (boolean, default false). Zod-validated before submit via `POST /campaigns`.
- Add "Edit campaign" inline dialog: rename and toggle `is_public` via `PUT /campaigns/:id`.
- Add toggle `is_active` action via `POST /campaigns/:id/activate`.
- Add "Delete campaign" action with PrimeNG `ConfirmDialog`, warning that all terminals and state belonging to the campaign will be lost. Calls `DELETE /campaigns/:id`.
- Implement `CurrentCampaignService` — a signal-based Angular service exposing `{ currentCampaign, setCurrent, clear }`. Persists the selected campaign ID in `localStorage` and rehydrates on app start by cross-referencing the stored ID against the campaigns list.
- Add workspace switcher UI in the topbar (a PrimeNG dropdown) — the proposer chose topbar over sidebar because it provides a persistent, always-visible affordance without consuming sidebar navigation real estate, which is reserved for section links.
- Extend the MSW mock layer with in-memory handlers for all `/campaigns` routes used in this slice: `GET /campaigns`, `POST /campaigns`, `GET /campaigns/:id`, `PUT /campaigns/:id`, `DELETE /campaigns/:id`, `POST /campaigns/:id/activate`.

## Capabilities

### New Capabilities

- `campaigns-crud`: List, create, edit, and delete campaigns. Includes `is_active` and `is_public` toggle mechanics and the ConfirmDialog delete flow.
- `current-campaign-service`: Signal-based workspace context service. Exposes the currently selected campaign, persists selection in `localStorage`, and rehydrates on app start.
- `campaign-workspace-switcher`: Topbar dropdown UI for switching the active campaign. Reads from and writes to `CurrentCampaignService`.
- `campaigns-msw-handlers`: MSW in-memory handlers for the full `/campaigns` route family consumed by this slice.

### Modified Capabilities

- `app-shell`: The topbar gains the campaign workspace switcher component.

## Impact

- **New files**: `CampaignsListComponent`, `CreateCampaignDialogComponent`, `EditCampaignDialogComponent`, `CurrentCampaignService`, `CampaignWorkspaceSwitcherComponent`, MSW handler module for campaigns.
- **Modified files**: `app.routes.ts` (activate `/campaigns` route), topbar component (embed switcher), MSW `handlers.ts` (extend with campaigns handlers).
- **API surface used**: `GET /campaigns`, `POST /campaigns`, `GET /campaigns/:id`, `PUT /campaigns/:id`, `DELETE /campaigns/:id`, `POST /campaigns/:id/activate`.
- **No breaking changes** to existing Slice 1 contracts.
