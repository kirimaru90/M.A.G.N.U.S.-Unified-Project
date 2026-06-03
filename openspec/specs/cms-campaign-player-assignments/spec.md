## ADDED Requirements

### Requirement: User detail view exposes a campaigns assignments panel for player users
On the `/users/:id` route, when the user's role is `player`, the page SHALL render an `<app-user-campaigns-panel>` component titled **Campagne assegnate**. The panel SHALL list the campaigns the player belongs to (one row per campaign showing **Nome** and a remove control) plus a multi-select picker — a PrimeNG `<p-multiselect>` or `<p-select>` — populated with the campaigns the player is NOT yet assigned to. The panel SHALL be hidden for admin users. The membership list SHALL be derived by combining `GET /campaigns` (full campaigns list) with `GET /campaigns/:id/players` for each campaign (or an equivalent client-side join), so the panel reflects the live assignment state.

#### Scenario: Panel lists the player's current campaigns
- **WHEN** the admin opens `/users/:id` for a player who is assigned to campaigns A and C
- **THEN** the panel shows two rows (Campagna A, Campagna C), each with a remove control

#### Scenario: Picker offers only unassigned campaigns
- **WHEN** the player is already assigned to campaigns A and C and campaigns A, B, C, D exist
- **THEN** the multi-select picker offers only campaigns B and D as options

#### Scenario: Panel is hidden for admins
- **WHEN** the admin opens `/users/:id` for a user whose role is `admin`
- **THEN** the panel is not rendered (the admin notice from `users-crud` is shown instead)

### Requirement: Adding campaigns to a player from the user detail view
The user-detail campaigns panel SHALL allow the admin to add one or more campaigns to the player by selecting them in the picker and confirming. For each selected campaign, the panel SHALL call `POST /campaigns/:campaignId/players` with body `{ playerId: <user.id> }`. After all requests complete, the panel SHALL refresh its membership state. Failures SHALL be surfaced via a PrimeNG `<p-toast>` and SHALL NOT roll back successful additions.

#### Scenario: Adding a single campaign sends one POST
- **WHEN** the admin selects campaign B in the picker and confirms
- **THEN** `POST /campaigns/B/players` is called with `{ playerId: <user.id> }` and on success campaign B appears in the membership list

#### Scenario: Adding multiple campaigns at once
- **WHEN** the admin selects campaigns B and D in the picker and confirms
- **THEN** two POST requests are sent (one per campaign id) and on success both appear in the membership list

#### Scenario: Failure surfaces a toast and keeps the rest
- **WHEN** one of the POST requests fails with a non-2xx status
- **THEN** a `<p-toast>` reports the failure (e.g., "Impossibile assegnare a Campagna B") and successfully added campaigns remain in the membership list

### Requirement: Removing a campaign from a player from the user detail view
Each row in the user-detail campaigns panel SHALL expose a remove control. Activating it SHALL open a PrimeNG `<p-confirmdialog>` with message "Rimuovere il giocatore dalla campagna?". On confirmation, the panel SHALL call `DELETE /campaigns/:campaignId/players/:playerId` (where `:playerId` is the current user's id). On success, the campaign row is removed from the membership list.

#### Scenario: Confirmation appears before removal
- **WHEN** the admin clicks the remove control on a campaign row
- **THEN** a ConfirmDialog appears before any API call is made

#### Scenario: Confirmed removal removes the row
- **WHEN** the admin confirms the removal of campaign A
- **THEN** `DELETE /campaigns/A/players/<user.id>` is called and the campaign A row disappears from the panel

#### Scenario: Cancelled removal takes no action
- **WHEN** the admin clicks Cancel in the ConfirmDialog
- **THEN** no API call is made and the campaign row remains

### Requirement: Campaign detail view exposes a players assignments panel
The `/campaigns/:id` route SHALL render an `<app-campaign-players-panel>` component titled **Giocatori assegnati**. The panel SHALL list the players assigned to the campaign (one row per player showing **Nome utente** and a remove control) plus a multi-select picker populated with the player users (role = `player`) who are NOT yet assigned to the campaign. The membership list is sourced from `GET /campaigns/:id/players`; the picker's candidate list is sourced from `GET /users` filtered to `role === 'player'` minus the already-assigned players.

#### Scenario: Panel lists the campaign's current players
- **WHEN** the admin opens `/campaigns/:id` for a campaign with players P1 and P2 assigned
- **THEN** the panel shows two rows (P1, P2), each with a remove control

#### Scenario: Picker offers only unassigned player users
- **WHEN** users P1, P2, P3 are players (and A1 is an admin) and P1 is already assigned
- **THEN** the picker offers only P2 and P3 — A1 (admin) and P1 (already assigned) are excluded

### Requirement: Adding players to a campaign from the campaign detail view
The campaign-detail players panel SHALL allow the admin to add one or more players to the campaign by selecting them in the picker and confirming. For each selected player, the panel SHALL call `POST /campaigns/:id/players` with body `{ playerId: <selected.id> }`. After all requests complete, the panel SHALL refresh its membership state. Failures SHALL be surfaced via a PrimeNG `<p-toast>` and SHALL NOT roll back successful additions.

#### Scenario: Adding a single player sends one POST
- **WHEN** the admin selects player P3 in the picker and confirms
- **THEN** `POST /campaigns/:id/players` is called with `{ playerId: "P3" }` and on success P3 appears in the membership list

#### Scenario: Adding multiple players at once
- **WHEN** the admin selects players P3 and P4 in the picker and confirms
- **THEN** two POST requests are sent and on success both appear in the membership list

### Requirement: Removing a player from a campaign from the campaign detail view
Each row in the campaign-detail players panel SHALL expose a remove control. Activating it SHALL open a PrimeNG `<p-confirmdialog>` with message "Rimuovere il giocatore dalla campagna?". On confirmation, the panel SHALL call `DELETE /campaigns/:id/players/:playerId`. On success, the player row is removed from the membership list.

#### Scenario: Confirmation appears before removal
- **WHEN** the admin clicks the remove control on a player row
- **THEN** a ConfirmDialog appears before any API call is made

#### Scenario: Confirmed removal removes the row
- **WHEN** the admin confirms the removal of player P1
- **THEN** `DELETE /campaigns/:id/players/P1` is called and the P1 row disappears from the panel

### Requirement: Assignment surfaces stay consistent across the two views
A membership change made from one view (user detail or campaign detail) SHALL be reflected in the other view on its next load. The application SHALL NOT cache membership state in a way that would show stale assignments after a round-trip.

#### Scenario: User-side removal is reflected on the campaign side
- **WHEN** the admin removes campaign A from player P1 via `/users/P1`
- **THEN** opening `/campaigns/A` afterwards shows P1 absent from the players panel

#### Scenario: Campaign-side addition is reflected on the user side
- **WHEN** the admin adds player P3 to campaign A via `/campaigns/A`
- **THEN** opening `/users/P3` afterwards shows campaign A present in the campaigns panel
