## Context

Slice 1 established the app shell, auth, MSW infrastructure, and the generated TypeScript client from `reference/API-docs.json`. The `CurrentCampaignService` exists as a stub (signal only, no persistence). The `/campaigns` route renders an empty heading. Slice 2 fills the route with full CRUD, activates the `CurrentCampaignService` with localStorage persistence, and adds a workspace switcher to the topbar.

Relevant existing files:
- `src/app/core/campaign/current-campaign.service.ts` — signal stub to be extended
- `src/app/features/campaigns/campaigns.ts` — placeholder to be replaced
- `src/app/layout/topbar.ts` — gains the switcher component
- `src/api/generated/openapi-types.ts` — generated types (no Campaign response schema in OpenAPI spec; infer shape from DTOs and architecture doc)
- `src/mocks/handlers/auth.handlers.ts` — pattern to follow for campaigns handlers

## Goals / Non-Goals

**Goals:**
- Full campaigns CRUD (list, create, rename, delete, toggle `is_active`, toggle `is_public`)
- `CurrentCampaignService` with localStorage persistence and startup rehydration
- Topbar workspace switcher (campaign selector dropdown)
- MSW in-memory handlers for all `/campaigns` routes in this slice
- Lint and typecheck pass

**Non-Goals:**
- Campaign players (Slice 3)
- Terminals scoped to a campaign (Slice 4)
- Campaign global state (Slice 6)
- Pagination on the campaigns list (not in API spec for MVP)

## Decisions

### D1 — Workspace switcher in the topbar, not the sidebar

The Slice 1 sidebar contains a non-interactive `.bo-campaign-switch` placeholder card. Activating it in the sidebar would require a popover or flyout over the sidebar content, adding layout complexity. A PrimeNG `<p-select>` dropdown embedded in the topbar is simpler, always visible regardless of which sidebar section is active, and matches the mental model of "workspace scope" (like an organisation picker in SaaS tools). The sidebar `.bo-campaign-switch` placeholder is **removed** in this slice.

**Alternative considered:** Sidebar popover / workspace switcher card. Rejected because it adds layout complexity and the sidebar is narrow (200 px).

### D2 — CurrentCampaignService rehydration strategy

On service construction (app bootstrap), read the stored campaign ID from `localStorage`. Fetch `GET /campaigns` and find the matching campaign by ID. If found, call `setCurrent(campaign)`; if not found (deleted or no access), call `clear()` and remove the key. The fetch is an RxJS `take(1)` call and runs only at init, not reactively.

**Alternative considered:** Store the full campaign JSON in localStorage. Rejected because the stored object can become stale (name or flags may have changed). Fetching the list guarantees freshness at cost of one extra API call on startup.

### D3 — Campaign API service

Introduce a `CampaignsApiService` (`src/app/core/campaign/campaigns-api.service.ts`) that wraps `HttpClient` calls to the campaigns endpoints. Components never call `HttpClient` directly. The service returns `Observable<T>` for all operations. The campaigns list page uses `AsyncPipe` (or `toSignal`) to display data.

**Alternative considered:** Calling generated client functions directly from the component. Rejected because it bypasses the Bearer interceptor pattern and mixes concerns.

### D4 — Zod validation in the create/edit form

The create form validates with a Zod schema before calling the API:
```ts
const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio'),
  isActive: z.boolean().default(false),
  isPublic: z.boolean().default(false),
});
```
The edit form validates:
```ts
const EditCampaignSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio'),
  isPublic: z.boolean(),
});
```
Validation runs on submit (not on every keystroke). Errors surface as `.bo-field-error` messages below each control.

### D5 — Edit dialog scope

The edit dialog covers: rename and toggle `is_public`. Toggling `is_active` is intentionally a separate row action (icon button → `POST /campaigns/:id/activate`) because it is a state-machine transition, not a property edit. This avoids the footgun of accidentally toggling active status while editing the name.

### D6 — MSW handlers: in-memory array seeded with fixtures

Campaigns handlers live in `src/mocks/handlers/campaigns.handlers.ts`. They maintain an in-memory `Campaign[]` array (seeded with two or three fixture campaigns on MSW startup). The array is mutated by POST, PUT, DELETE, and activate handlers. The list handler returns the full array filtered to the requesting "user" (since the MSW mock has no real auth logic, return all for simplicity). The activate handler toggles `isActive` and returns the updated campaign.

### D7 — Campaign response shape

The API spec does not define a `CampaignDto` response schema. Based on the DTOs and architecture document, the inferred shape is:
```ts
interface CampaignDto {
  id: string;
  name: string;
  isActive: boolean;
  isPublic: boolean;
}
```
`CurrentCampaignService.Campaign` is updated to this shape. All components use `CampaignDto` from a local `campaign.types.ts` file (not from generated types, since the generator did not emit a Campaign response type).

### D8 — Topbar switcher: PrimeNG Select with optionLabel

The switcher uses `<p-select [options]="campaigns" optionLabel="name" [(ngModel)]="selectedCampaign" (onChange)="onSelect($event.value)">` with a placeholder label "Seleziona campagna". It reads the current value from `CurrentCampaignService.currentCampaign()`. Because it's inside the topbar (no form), `ngModel` is used (FormsModule), not Reactive Forms.

## Risks / Trade-offs

- **[Risk] Race on rehydration**: `CurrentCampaignService` fetches campaigns during bootstrap. If the topbar switcher renders before the request completes, it shows no selection momentarily. → Mitigation: Initialize `currentCampaign` to `null`; the switcher placeholder label ("Seleziona campagna") covers the transient state. No spinner needed.
- **[Risk] Stale campaign name in topbar after edit**: Editing a campaign name via the edit dialog updates the list, but `CurrentCampaignService.currentCampaign` holds the old object. → Mitigation: After a successful edit, call `setCurrent(updatedCampaign)` if the edited campaign is the current one.
- **[Risk] Delete of the currently selected campaign**: → Mitigation: After a successful delete, call `clear()` if the deleted campaign was the current one. Remove the localStorage key.
- **[Risk] MSW does not persist across restarts**: In-memory state is reset on every MSW restart. → Accepted as per scope: the proposal explicitly allows this.
- **[Trade-off] No pagination**: The campaigns list loads all campaigns in one request. Acceptable for MVP given the expected data volume (tens, not thousands, of campaigns).
