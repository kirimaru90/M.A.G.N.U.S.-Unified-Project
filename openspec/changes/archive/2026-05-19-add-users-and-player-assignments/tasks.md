## 1. User types, schemas, and API service

- [x] 1.1 Create `src/app/core/user/user.types.ts` defining `UserRole = 'admin' | 'player'` and `UserDto = { id: string; username: string; role: UserRole }`
- [x] 1.2 Create `src/app/core/user/user.schemas.ts` exporting `CreateUserSchema`, `EditUserSchema`, and `ResetPasswordSchema` Zod schemas (per D2)
- [x] 1.3 Create `src/app/core/user/users-api.service.ts` (`UsersApiService`) with methods: `list(): Observable<UserDto[]>`, `get(id): Observable<UserDto>`, `create(dto): Observable<UserDto>`, `update(id, dto: Partial<{ username, role, password }>): Observable<UserDto>`, `delete(id): Observable<void>` — all using `HttpClient`

## 2. CampaignsApiService extension for players sub-resource

- [x] 2.1 Add `listPlayers(campaignId: string): Observable<UserDto[]>` to `src/app/core/campaign/campaigns-api.service.ts`
- [x] 2.2 Add `addPlayer(campaignId: string, playerId: string): Observable<UserDto>` (POST body `{ playerId }`)
- [x] 2.3 Add `removePlayer(campaignId: string, playerId: string): Observable<void>`
- [x] 2.4 Import `UserDto` from `src/app/core/user/user.types.ts` for the player return shape

## 3. MSW users handlers

- [x] 3.1 Create `src/mocks/handlers/users.handlers.ts` with an in-memory store: `users: Array<{ id, username, role, password }>` (password kept internal; never returned)
- [x] 3.2 Seed fixtures: one admin (`admin`) and three players (`p1`, `p2`, `p3`) — passwords kept simple for dev
- [x] 3.3 Export read-only helpers `getUserById(id)` and `getAllPlayers()` (consumed by `campaigns.handlers.ts`)
- [x] 3.4 Implement `GET /users` handler (returns `users` mapped to `{ id, username, role }`)
- [x] 3.5 Implement `POST /users` handler (validates required fields, generates uuid, appends to `users`, returns 201 with `{ id, username, role }`)
- [x] 3.6 Implement `GET /users/:id` handler (returns `{ id, username, role }` or 404)
- [x] 3.7 Implement `PUT /users/:id` handler (merges any subset of `{ username, role, password }`, returns 200 with `{ id, username, role }` or 404)
- [x] 3.8 Implement `DELETE /users/:id` handler (removes from `users`, calls `removeUserFromAllCampaigns(id)` from campaigns handlers, returns 204 or 404)
- [x] 3.9 Ensure the auth login handler still authenticates against the seeded users (update `auth.handlers.ts` if it currently hardcoded credentials)
- [x] 3.10 Register `usersHandlers` in `src/mocks/browser.ts`

## 4. MSW campaign-players handlers (extension to campaigns.handlers.ts)

- [x] 4.1 Add an in-memory `campaignPlayers: Map<campaignId, Set<playerId>>` (or equivalent) to `src/mocks/handlers/campaigns.handlers.ts`
- [x] 4.2 Seed one assignment so at least one fixture campaign has player `p1` assigned
- [x] 4.3 Export `removeUserFromAllCampaigns(playerId)` for the users-delete cascade
- [x] 4.4 Implement `GET /campaigns/:id/players` handler (returns `[{ id, username, role }]` from `users.handlers.ts` helpers + the association set; 404 if campaign missing)
- [x] 4.5 Implement `POST /campaigns/:id/players` handler — validates campaign exists, `playerId` exists, and target user has `role === 'player'`; idempotent on re-assign; returns 201 with assigned user
- [x] 4.6 Reject in `POST` with 400/422 if the target user is an admin
- [x] 4.7 Implement `DELETE /campaigns/:id/players/:playerId` handler — removes from association, returns 204 or 404

## 5. Sidebar / routing wiring

- [x] 5.1 In `src/app/app.routes.ts`, replace the placeholder `/users` route with a lazy `UsersPage` import (or direct standalone import matching the campaigns route pattern)
- [x] 5.2 Add a `/users/:id` route mapped to `UserDetailPage` (declared **after** `/users` so the matcher prefers the list)
- [x] 5.3 Add a `/campaigns/:id` route mapped to `CampaignDetailPage` (declared after `/campaigns`)
- [x] 5.4 Confirm `/users` and `/users/:id` and `/campaigns/:id` are inside the auth-guarded shell route group
- [x] 5.5 Verify the existing sidebar `SISTEMA → /users` link now resolves to the real users page (no template change required if the `routerLink` already points there)

## 6. Users list page

- [x] 6.1 Replace `src/app/features/users/users.ts` with a `UsersPage` standalone component importing `TableModule`, `ButtonModule`, `ConfirmDialogModule`, `ToastModule`, `RouterModule`
- [x] 6.2 Inject `UsersApiService`, `ConfirmationService`, `MessageService`; load users via `toSignal(this.api.list())`
- [x] 6.3 Render `<p-table>` with columns Nome utente, Ruolo (badge), Azioni; add loading + empty-state handling
- [x] 6.4 Render the username cell as a `routerLink` to `/users/:id`
- [x] 6.5 Add "Nuovo utente" button that opens the create dialog
- [x] 6.6 Add row action buttons: edit (opens edit dialog), reset password (opens reset dialog), delete (triggers `ConfirmationService.confirm`)
- [x] 6.7 Add `<p-confirmdialog>` and `<p-toast>` to the template

## 7. Create user dialog

- [x] 7.1 Create `src/app/features/users/create-user-dialog.ts` (`CreateUserDialogComponent`) using `DialogModule`, `ReactiveFormsModule`, `SelectModule`, `InputTextModule`, `PasswordModule` (or `InputTextModule` with `type="password"`)
- [x] 7.2 Build Reactive Form: `username` (required), `role` (`<p-select>` of `admin | player`, required), `password` (required)
- [x] 7.3 On submit: run `CreateUserSchema.safeParse`, render `.bo-field-error` per field on failure, call `UsersApiService.create()` on success
- [x] 7.4 Emit `userCreated` event with the new `UserDto` to parent; parent closes dialog and refreshes list
- [x] 7.5 Wire `CreateUserDialogComponent` into `UsersPage` with `<p-dialog>` visibility binding

## 8. Edit user dialog (rename + role only)

- [x] 8.1 Create `src/app/features/users/edit-user-dialog.ts` (`EditUserDialogComponent`) with input `user: UserDto`
- [x] 8.2 Build Reactive Form pre-populated with `user.username` and `user.role` (no password field)
- [x] 8.3 On submit: run `EditUserSchema.safeParse`, render errors on failure, call `UsersApiService.update(id, { username, role })` on success
- [x] 8.4 Emit `userUpdated` event with the returned `UserDto`; parent updates its local state
- [x] 8.5 Wire into `UsersPage` via `<p-dialog>`

## 9. Reset password dialog (separate)

- [x] 9.1 Create `src/app/features/users/reset-password-dialog.ts` (`ResetPasswordDialogComponent`) with input `user: UserDto`
- [x] 9.2 Build Reactive Form with a single `password` field — no username or role inputs
- [x] 9.3 On submit: run `ResetPasswordSchema.safeParse`, render error on failure, call `UsersApiService.update(id, { password })` — body contains ONLY `password`
- [x] 9.4 On success, close the dialog and show a `MessageService` success toast ("Password aggiornata")
- [x] 9.5 Wire into `UsersPage` via `<p-dialog>`

## 10. Delete user wiring

- [x] 10.1 In `UsersPage`, implement `onDeleteConfirmed(user)` calling `UsersApiService.delete(user.id)` and removing the row from local state on success
- [x] 10.2 Wire the delete row action to `ConfirmationService.confirm` with message "Questa azione eliminerà l'utente. L'operazione non è reversibile." and `acceptButtonStyleClass: 'p-button-danger'`

## 11. User detail page

- [x] 11.1 Create `src/app/features/users/user-detail-page.ts` (`UserDetailPage`) standalone component
- [x] 11.2 Read `id` from `route.paramMap`; load via `UsersApiService.get(id)` into a `WritableSignal<UserDto | null>`; handle 404 with a "Utente non trovato" `bo-empty` message + link back to `/users`
- [x] 11.3 Render `<h1>` with `username` and the role badge in the page header
- [x] 11.4 If `user().role === 'player'`, render `<app-user-campaigns-panel [user]="user()!">`
- [x] 11.5 If `user().role === 'admin'`, render the notice "Gli amministratori hanno accesso implicito a tutte le campagne." instead of the panel
- [x] 11.6 Add an edit button on the page that reuses `EditUserDialogComponent`; on success call `userSignal.set(updated)` so the panel/notice flip is immediate

## 12. UserCampaignsPanelComponent

- [x] 12.1 Create `src/app/features/users/user-campaigns-panel.ts` (`UserCampaignsPanelComponent`) with input `user: UserDto`
- [x] 12.2 Inject `CampaignsApiService`, `ConfirmationService`, `MessageService`
- [x] 12.3 On init: call `CampaignsApiService.list()`, then for each campaign call `listPlayers(c.id)` and filter to the campaigns where `user.id` is present — store result as `assignedCampaigns`; compute `availableCampaigns` as `allCampaigns - assignedCampaigns`
- [x] 12.4 Render the "Campagne assegnate" header, the assigned-campaigns list (each row: name + remove button), and the multi-select picker + "Aggiungi" button bound to `availableCampaigns`
- [x] 12.5 Implement "Aggiungi": for each picked campaign, call `addPlayer(c.id, user.id)` in parallel via `forkJoin` (each request wrapped in `catchError` so failures don't short-circuit the join); on completion refresh assignments; on per-item failures emit `MessageService.add({ severity: 'error', summary: 'Impossibile assegnare a ${name}' })`
- [x] 12.6 Implement remove: open `ConfirmationService.confirm` with message "Rimuovere il giocatore dalla campagna?"; on accept call `removePlayer(c.id, user.id)` and refresh assignments

## 13. Campaign detail page

- [x] 13.1 Create `src/app/features/campaigns/campaign-detail-page.ts` (`CampaignDetailPage`) standalone component
- [x] 13.2 Read `id` from `route.paramMap`; load via `CampaignsApiService.get(id)` (add a `get(id)` method if missing); handle 404 with a "Campagna non trovata" `bo-empty` message + link back to `/campaigns`
- [x] 13.3 Render the page header with `<h1>` name and the Attiva + Pubblica badges
- [x] 13.4 Render `<app-campaign-players-panel [campaign]="campaign()!">`

## 14. CampaignPlayersPanelComponent

- [x] 14.1 Create `src/app/features/campaigns/campaign-players-panel.ts` (`CampaignPlayersPanelComponent`) with input `campaign: CampaignDto`
- [x] 14.2 Inject `CampaignsApiService`, `UsersApiService`, `ConfirmationService`, `MessageService`
- [x] 14.3 Load `assignedPlayers` via `CampaignsApiService.listPlayers(campaign.id)`
- [x] 14.4 Load `availablePlayers` via `UsersApiService.list()` filtered to `role === 'player'` minus the assigned set
- [x] 14.5 Render the "Giocatori assegnati" header, the assigned-players list (each row: username + remove button), and the multi-select picker + "Aggiungi" button bound to `availablePlayers`
- [x] 14.6 Implement "Aggiungi": for each picked player, call `addPlayer(campaign.id, p.id)` in parallel via `forkJoin` with `catchError` wrappers; refresh on completion; per-item failures via `MessageService` toast
- [x] 14.7 Implement remove: `ConfirmationService.confirm` with message "Rimuovere il giocatore dalla campagna?"; on accept call `removePlayer(campaign.id, p.id)` and refresh

## 15. Campaigns list: row name links to detail

- [x] 15.1 In `src/app/features/campaigns/campaigns.ts`, replace the plain-text **Nome** cell with `<a [routerLink]="['/campaigns', c.id]">{{ c.name }}</a>` (ensure `RouterModule` / `RouterLink` is imported)
- [x] 15.2 Verify existing row actions (edit dialog, toggle active, delete) continue to function unchanged

## 16. `CampaignsApiService.get(id)` (if missing)

- [x] 16.1 If `CampaignsApiService` lacks a `get(id): Observable<CampaignDto>` method, add it (the campaigns-msw handlers already expose `GET /campaigns/:id`)

## 17. Verification

- [x] 17.1 Run `npm run lint` — zero errors
- [x] 17.2 Run `npm run typecheck` (or `tsc --noEmit`) — zero errors
- [x] 17.3 Manually verify users list: fixtures load; create, edit, reset-password, delete all round-trip correctly
- [x] 17.4 Manually verify user detail: navigating to a player shows the campaigns panel; navigating to an admin shows the notice; editing a player to admin flips the UI immediately
- [x] 17.5 Manually verify campaign detail: navigating from the campaigns list opens the detail page; players panel lists assignments; add/remove round-trip
- [x] 17.6 Manually verify two-sided consistency: assigning P3 to Campaign A via `/campaigns/A` shows up on `/users/P3`; removing it from `/users/P3` removes it on `/campaigns/A`
- [x] 17.7 Manually verify MSW: refreshing the page reloads users from the in-memory store (state resets to fixtures, as documented)

