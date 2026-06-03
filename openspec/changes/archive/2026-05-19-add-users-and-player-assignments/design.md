## Context

Slices 1 and 2 established the app shell, auth, MSW infrastructure, generated OpenAPI types, and full Campaigns CRUD with the topbar workspace switcher. The `/users` route is currently a placeholder heading; the `/campaigns/:id` detail route does not yet exist. The campaigns list page (`src/app/features/campaigns/campaigns.ts`) routes everything through dialogs.

The Users + Assignments slice introduces:
- A `users` feature area (`src/app/features/users/`) that mirrors the structure of `campaigns`.
- A `user` core service area (`src/app/core/user/`) for `UsersApiService`, `user.types.ts`, and `user.schemas.ts`, mirroring `src/app/core/campaign/`.
- A two-sided player↔campaign assignment surface that lives on both the user detail page and a new campaign detail page.

Relevant existing files:
- `src/app/features/users/users.ts` — Slice 1 placeholder, to be replaced.
- `src/app/features/campaigns/campaigns.ts` — list page that gains a row-name link to the detail page.
- `src/app/core/campaign/campaigns-api.service.ts` — gains player-association methods (or a thin sibling service).
- `src/app/core/campaign/campaign.types.ts` — pattern to follow for `user.types.ts`.
- `src/app/core/campaign/campaign.schemas.ts` — pattern to follow for `user.schemas.ts`.
- `src/mocks/handlers/campaigns.handlers.ts` — extended with the players sub-resource.
- `src/mocks/handlers/auth.handlers.ts` — must remain consistent with new user fixtures so login still works against the seeded users.
- `src/app/app.routes.ts` — activates `/users`, adds `/users/:id` and `/campaigns/:id`.

The OpenAPI spec does not expose a `User` response schema; it only defines `CreateUserDto`, `UpdateUserDto`, and `AddPlayerDto`. Like `CampaignDto` in Slice 2, the user response shape must be inferred and defined locally.

## Goals / Non-Goals

**Goals:**
- Full users CRUD: list, create, edit (rename + role), reset password (separate dialog), delete.
- A `/users/:id` user detail page that conditionally renders the campaigns-assignments panel based on role.
- A `/campaigns/:id` campaign detail page that hosts the players-assignments panel.
- Add/remove memberships from both panels via `/campaigns/:id/players` sub-resource.
- MSW handlers covering all new routes, seeded with at least one admin + multiple players + at least one pre-existing assignment.
- Lint and typecheck pass.

**Non-Goals:**
- Password hashing or any obfuscation (out of scope — the backend handles secrets; MSW mock stores cleartext for dev).
- Bulk assignment endpoints (we orchestrate per-campaign POSTs client-side).
- Pagination on the users list (not in the API spec; data volume is small).
- Anything terminal-related or campaign state.
- Server-driven role-based access control beyond hiding the assignments panel for admins. The auth guard remains binary (logged in / not).

## Decisions

### D1 — User response shape (`UserDto`) is defined locally

The OpenAPI spec defines DTOs for create/update but no `User` response. Mirroring the Slice 2 decision for `CampaignDto`, we declare:

```ts
// src/app/core/user/user.types.ts
export type UserRole = 'admin' | 'player';
export interface UserDto {
  id: string;
  username: string;
  role: UserRole;
}
```

`UserDto` deliberately omits `password`. The MSW mock SHALL also strip it from responses. Components consume `UserDto` from `user.types.ts` (not generated types).

**Alternative considered:** Use generated types from `openapi-types.ts`. Rejected because the generator did not emit a User response type — `CreateUserDto`/`UpdateUserDto` are request shapes and embed `password`, which we never want to flow into the UI.

### D2 — Zod schemas split the three write operations

```ts
// src/app/core/user/user.schemas.ts
export const CreateUserSchema = z.object({
  username: z.string().min(1, 'Il nome utente è obbligatorio'),
  role: z.enum(['admin', 'player'], { message: 'Il ruolo è obbligatorio' }),
  password: z.string().min(1, 'La password è obbligatoria'),
});

export const EditUserSchema = z.object({
  username: z.string().min(1, 'Il nome utente è obbligatorio'),
  role: z.enum(['admin', 'player']),
});

export const ResetPasswordSchema = z.object({
  password: z.string().min(1, 'La password è obbligatoria'),
});
```

Three schemas instead of one partial / discriminated schema because each dialog owns one — keeping them separate makes the Zod errors trivially mappable to their host form. Validation runs on submit (matching Slice 2).

**Alternative considered:** Single `UserSchema.partial()` with conditional refinements. Rejected — harder to surface field-level errors and forces the components to know which fields are required in which context.

### D3 — `UsersApiService` lives under `src/app/core/user/`

A new `UsersApiService` (mirroring `CampaignsApiService`) wraps `HttpClient` for `/users` endpoints with methods: `list()`, `get(id)`, `create(dto)`, `update(id, dto)`, `delete(id)`. The `update` method accepts a `Partial<{username, role, password}>` so both the edit dialog (`{username, role}`) and the reset-password dialog (`{password}`) can call it. Components never call `HttpClient` directly.

**Alternative considered:** A dedicated `resetPassword(id, password)` method. Rejected because the wire endpoint is the same `PUT /users/:id` — a separate method would imply a separate endpoint and mislead future readers.

### D4 — Player assignment lives on `CampaignsApiService` (extension, not new service)

The `/campaigns/:id/players` sub-resource is hierarchically a campaign concern, so we add three methods to the existing `CampaignsApiService`:

```ts
listPlayers(campaignId: string): Observable<UserDto[]>
addPlayer(campaignId: string, playerId: string): Observable<UserDto>
removePlayer(campaignId: string, playerId: string): Observable<void>
```

The user detail panel still queries this service — it does not need its own players API service. To build "campaigns assigned to a player" we combine `CampaignsApiService.list()` with one `listPlayers(c.id)` per campaign and filter where the player is present. For MVP data volumes (tens of campaigns) the N+1 cost is acceptable; see Risks for the trade-off.

**Alternative considered:** A new endpoint `GET /users/:id/campaigns`. Rejected — it doesn't exist in the API spec, and inventing it would require changing the contract.

**Alternative considered:** A new `CampaignPlayersApiService` class. Rejected as premature splitting; the methods are tiny and clearly campaign-scoped.

### D5 — Both panels are dumb components driven by a host page

`<app-user-campaigns-panel [user]="user()">` and `<app-campaign-players-panel [campaign]="campaign()">` are responsible only for the UI: rendering rows, the picker, the remove confirmations, and emitting events when the host should refetch. They orchestrate their own API calls via injected services but **do not own routing or page chrome**. This keeps them reusable if a future slice needs to surface assignments elsewhere (e.g., a player profile widget).

The host pages (`UserDetailPage`, `CampaignDetailPage`) own:
- Route param parsing (`route.paramMap`)
- Fetching the central entity via the appropriate API service
- Conditional rendering (admin users on `UserDetailPage` get the notice, not the panel)

### D6 — Picker behaviour: PrimeNG `<p-multiselect>` with confirm button

Both panels use a `<p-multiselect>` populated with the currently-unassigned counter-party set (campaigns not yet assigned to this player; players not yet assigned to this campaign). The admin selects N items, then clicks an "Aggiungi" button. We fire N independent POST requests in parallel via `forkJoin` and refresh the panel once the join settles. Errors are surfaced via `MessageService` toasts but do not block other successes (per spec).

**Alternative considered:** Auto-fire one POST per item on selection. Rejected — adds N API calls on transient picker state and makes "undo before commit" impossible.

**Alternative considered:** A single batch endpoint. Rejected — doesn't exist in the API spec.

### D7 — Role change updates the UI immediately

The edit dialog returns the updated `UserDto` to the parent (the users list or the user detail page). The parent uses that returned object to replace its local state. On the user detail page specifically, the page holds a `WritableSignal<UserDto | null>` for the loaded user; the edit dialog success handler calls `userSignal.set(updated)`. Because the template gates the assignments panel on `user().role === 'player'`, the panel appears/disappears synchronously on role flip.

No `currentUser` rehydration is required even if the admin edits their own account — Slice 1's `AuthService.currentUser` is independent and won't be updated here. (If the admin changes their own role, the change takes effect on next login. Surfacing this within-session is out of scope.)

### D8 — Campaign detail page is reachable from the row name, not via an extra "Open" button

Slice 2's campaigns list shows the name as plain text. We change the **Nome** cell template to render the value inside an `<a [routerLink]="['/campaigns', c.id]">` link. Existing row actions (edit, toggle-active, delete) keep working from the list page. This avoids adding another icon button to the actions cell and matches the user-detail flow (clicking the username navigates).

### D9 — "Not found" handling on detail pages

When `GET /users/:id` or `GET /campaigns/:id` returns 404, the page renders a small `bo-empty` message ("Utente non trovato" / "Campagna non trovata") with a link back to the list. No automatic redirect — the explicit message communicates the failure better than silently bouncing.

### D10 — MSW handler layout

`src/mocks/handlers/users.handlers.ts` is added, owning the user array, password storage, and the auth-side hook so login mock validates against the same user list as the users CRUD. The campaign-players sub-resource is added to **`campaigns.handlers.ts`** because the routes live under `/campaigns/:id/players`. Both modules read each other's stores through small exported helper functions (e.g., `getUserById(id)`, `isPlayer(id)`) to enforce the "POST rejects admins" and "DELETE user cascades" requirements without creating a global mock-state god object.

**Seeded fixtures:**
- 1 admin (`admin / admin` — already used by the auth handler)
- 3 players (`p1`, `p2`, `p3`)
- One existing assignment: `p1` assigned to the first seeded campaign

This gives both panels meaningful first-load data and lets the picker show non-empty option sets.

### D11 — Routes

Added to `app.routes.ts`:
- `/users` → `UsersPage` (replaces placeholder)
- `/users/:id` → `UserDetailPage`
- `/campaigns/:id` → `CampaignDetailPage`

All three are children of the auth-guarded shell route. Order: `/users/:id` must be declared after the literal `/users` so Angular's matcher picks the list page for the bare path.

## Risks / Trade-offs

- **[Risk] N+1 fan-out for the user-detail "campaigns assigned" query.** Building this list requires one `GET /campaigns/:id/players` per campaign. → **Mitigation:** Acceptable at MVP volume (tens of campaigns). If the campaign list grows large later, a `GET /users/:id/campaigns` endpoint can be added to the API spec and `UsersApiService.listCampaigns(userId)` added in a future change.
- **[Risk] Race when the admin edits their own role.** The `AuthService` cache holds the role at login; the UI may briefly disagree until the next login. → **Mitigation:** Document as an accepted limitation in this slice — out of scope. Future: trigger `AuthService.refresh()` after an edit that targets `currentUser.id`.
- **[Risk] MSW handlers split across two files share state.** `users.handlers.ts` owns the users array but `campaigns.handlers.ts` needs to validate `role === 'player'` and cascade deletions. → **Mitigation:** Export small read-only helpers from `users.handlers.ts` (`getUserById`, `getAllPlayers`) and a `removeUserFromAllCampaigns(userId)` from `campaigns.handlers.ts`. Coupling stays explicit and one-way.
- **[Risk] `forkJoin` short-circuits on the first error.** If we use `forkJoin` for the parallel POSTs, one failure cancels emission of others' results. → **Mitigation:** Wrap each request with `catchError(err => of({ ok: false, err, campaignId }))` so the join sees all outcomes and the panel can report per-item failures.
- **[Risk] Password reset confirmation is implicit (just a toast).** No "are you sure?" step. → **Accepted trade-off:** The reset is gated by a dedicated dialog and a separate row action — that already requires two intentional clicks. Adding a confirm step would feel hostile.
- **[Trade-off] Two separate dialogs (edit vs reset password) instead of one.** Pro: each form's submit payload is minimal, validation errors are clearly scoped, password is never displayed alongside other fields. Con: two PrimeNG dialog components to maintain. Pro outweighs con for the security clarity it gives.
- **[Trade-off] Sub-resource handlers live in `campaigns.handlers.ts`, not a new players handler module.** Pro: locality with the parent resource matches HTTP path structure. Con: `campaigns.handlers.ts` grows. Acceptable while the file stays under a few hundred lines.
