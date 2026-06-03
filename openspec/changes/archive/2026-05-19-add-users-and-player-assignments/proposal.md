## Why

Slices 1 and 2 delivered the app shell, auth, and Campaigns CRUD. The `/users` route is still a placeholder, so admins cannot manage who can log in or which players belong to which campaign. Slice 3 closes the user-management gap and introduces the player↔campaign assignment surface that subsequent slices (Terminals, State) implicitly assume exists.

## What Changes

- Add `/users` list page with a PrimeNG table over `GET /users`, showing both admin and player users. Columns: **Nome utente**, **Ruolo** (admin/player badge), and row actions (edit, reset password, delete).
- Add "Nuovo utente" dialog: Reactive Form with `username` (required), `role` (PrimeNG `<p-select>` of `admin | player`, required), `password` (required on creation). Zod-validated. Calls `POST /users`.
- Add "Modifica utente" dialog (rename + role change). Calls `PUT /users/:id` with `{ username, role }`. Password is **not** part of this dialog.
- Add a separate "Reimposta password" row action that opens its own dialog with a single `password` field and calls `PUT /users/:id` with only `{ password }`. The current password is never displayed.
- Add a "Elimina utente" row action behind a PrimeNG `ConfirmDialog`. Calls `DELETE /users/:id`.
- Add a `/users/:id` user detail page. For player users it shows a **Campagne assegnate** panel: list of campaigns the player belongs to + a multi-select picker to add/remove memberships. For admin users the panel is hidden and a short note explains that admins have implicit access to all campaigns.
- Add a `/campaigns/:id` campaign detail page (Slice 2 extension) that hosts a **Giocatori assegnati** panel: list of player users assigned to the campaign + a multi-select picker to add/remove. The "Nome campagna" row in the list page gains a link that routes here. The campaign edit and delete actions on the list keep working as before.
- Use `GET /campaigns/:id/players`, `POST /campaigns/:id/players` (body `{ playerId }`), `DELETE /campaigns/:id/players/:playerId` for both panels.
- Role changes are reflected immediately in the UI: a user whose role flips from `player` to `admin` loses the assignments panel on next view; an `admin → player` flip exposes it.
- Activate the `/users` sidebar nav link (it currently routes to a placeholder).
- Extend the MSW mock layer with handlers for every `/users` route plus the `/campaigns/:id/players` sub-resource. Seed two fixture player users so the campaigns-side panel renders meaningful data.

## Capabilities

### New Capabilities

- `users-crud`: List, create, edit (rename + role), reset password (separate action), and delete users via PrimeNG table + dialogs. Includes a `/users/:id` detail page.
- `campaign-player-assignments`: Two-sided player↔campaign assignment surface (panel on the user detail page and panel on the campaign detail page), with add/remove via the `/campaigns/:id/players` sub-resource. Hidden for admin users.
- `users-msw-handlers`: MSW in-memory handlers for the `/users` route family used by this slice, seeded with fixture admin + player users.

### Modified Capabilities

- `campaigns-crud`: Adds a `/campaigns/:id` campaign detail route (reachable from the campaigns list) that hosts the players panel. Existing list, create, edit, toggle-active, and delete behaviours are unchanged.
- `campaigns-msw-handlers`: Adds handlers for `GET /campaigns/:id/players`, `POST /campaigns/:id/players`, and `DELETE /campaigns/:id/players/:playerId`, persisting assignments in the same in-memory store.
- `app-shell`: The `/users` placeholder route is replaced by the real users feature route; the sidebar `SISTEMA → /users` link is now active. No change to the topbar, switcher, or login chrome.

## Impact

- **New files**: `UsersPage`, `UserDetailPage`, `CreateUserDialogComponent`, `EditUserDialogComponent`, `ResetPasswordDialogComponent`, `UsersApiService`, `users.types.ts`, `users.schemas.ts`, `CampaignDetailPage`, `CampaignPlayersPanelComponent`, `UserCampaignsPanelComponent`, `CampaignPlayersApiService` (or method group on the existing `CampaignsApiService`), MSW handler module for users + extension of campaigns handlers.
- **Modified files**: `app.routes.ts` (activate `/users`, add `/users/:id`, add `/campaigns/:id`), `campaigns.ts` (link rows to the detail page), `src/mocks/handlers/campaigns.handlers.ts` (add players sub-resource), `src/mocks/browser.ts` (register users handlers).
- **API surface used**: `GET /users`, `POST /users`, `GET /users/:id`, `PUT /users/:id`, `DELETE /users/:id`, `GET /campaigns/:id/players`, `POST /campaigns/:id/players`, `DELETE /campaigns/:id/players/:playerId`.
- **No breaking changes** to Slice 1 or Slice 2 contracts. The campaigns list rows simply gain a link; their existing actions still work.
