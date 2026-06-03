## ADDED Requirements

### Requirement: Users list page displays all users in a PrimeNG table
The `/users` route SHALL render a PrimeNG `<p-table>` listing all users returned by `GET /users`. The table SHALL include columns: **Nome utente** (`username`), **Ruolo** (`role` shown as an `admin` / `player` badge), and **Azioni** (row action buttons: edit, reset password, delete). Both admin and player users SHALL appear in the same list. The page SHALL display a loading state while the request is in flight and an empty-state message when the list is empty.

#### Scenario: List loads and displays users
- **WHEN** an authenticated admin navigates to `/users`
- **THEN** the table renders one row per user returned by `GET /users`, showing username, role badge, and the three row action buttons

#### Scenario: Empty state message
- **WHEN** `GET /users` returns an empty array
- **THEN** the table shows an empty-state message (e.g., "Nessun utente trovato") instead of rows

#### Scenario: Loading state during fetch
- **WHEN** the request to `GET /users` is in flight
- **THEN** the table renders a loading indicator (PrimeNG table skeleton or spinner)

#### Scenario: Username links to user detail page
- **WHEN** the admin clicks the username cell of a row
- **THEN** the router navigates to `/users/:id` for that user

### Requirement: Create user via dialog
The users list page SHALL expose a "Nuovo utente" button. Clicking it SHALL open a PrimeNG `<p-dialog>` containing a Reactive Form with: **Nome utente** (text input, required), **Ruolo** (PrimeNG `<p-select>` of `admin` / `player`, required), **Password** (password input, required on creation, minimum length 1). On submit, the form SHALL be validated with the `CreateUserSchema` Zod schema. If validation passes, `POST /users` is called with `{ username, role, password }`. On success, the dialog closes and the list refreshes. On error, an error message is shown inside the dialog. Validation errors SHALL appear as `.bo-field-error` below each control.

#### Scenario: Form submits valid data
- **WHEN** the admin fills in username, picks a role, enters a password, and clicks the submit button
- **THEN** `POST /users` is called with the entered values and the new user appears in the list

#### Scenario: Empty username is rejected by Zod
- **WHEN** the admin submits the form with an empty username field
- **THEN** a `.bo-field-error` appears below the username field reading "Il nome utente è obbligatorio" and no API call is made

#### Scenario: Missing role is rejected by Zod
- **WHEN** the admin submits the form without selecting a role
- **THEN** a `.bo-field-error` appears below the role field reading "Il ruolo è obbligatorio" and no API call is made

#### Scenario: Empty password is rejected by Zod
- **WHEN** the admin submits the form with an empty password field
- **THEN** a `.bo-field-error` appears below the password field reading "La password è obbligatoria" and no API call is made

#### Scenario: Dialog closes on success
- **WHEN** `POST /users` returns 2xx
- **THEN** the dialog closes and the users list is re-fetched

### Requirement: Edit user via dialog (rename + role change only)
Each table row SHALL expose an edit action (icon button). Clicking it SHALL open a PrimeNG dialog pre-populated with the user's current **Nome utente** and **Ruolo**. The dialog SHALL NOT contain a password field. On submit, the form SHALL be validated with the `EditUserSchema` Zod schema and `PUT /users/:id` is called with `{ username, role }`. On success, the dialog closes and the list refreshes.

#### Scenario: Edit dialog pre-populates fields
- **WHEN** the admin clicks the edit action on a row
- **THEN** the dialog opens with the user's current username and role already filled in, and no password field is rendered

#### Scenario: Rename updates the list
- **WHEN** the admin changes the username and submits
- **THEN** `PUT /users/:id` is called with the new username and the list row reflects the updated value after refresh

#### Scenario: Role change updates the list
- **WHEN** the admin changes the role from `player` to `admin` (or vice versa) and submits
- **THEN** `PUT /users/:id` is called with the new role and the role badge in the list reflects the change after refresh

### Requirement: Reset password as a separate row action
Each table row SHALL expose a dedicated "Reimposta password" action (icon button, distinct from edit). Activating it SHALL open a PrimeNG `<p-dialog>` containing a Reactive Form with a single **Nuova password** field (required, minimum length 1). The dialog SHALL NOT display the user's existing password. On submit, the form SHALL be validated with the `ResetPasswordSchema` Zod schema and `PUT /users/:id` is called with **only** `{ password }`. On success, the dialog closes with a success toast or confirmation; no other user fields are modified.

#### Scenario: Reset password dialog has no other fields
- **WHEN** the admin opens the reset password dialog on a row
- **THEN** the dialog contains a single password input and a submit button; no username or role controls are present

#### Scenario: Submitting reset sends only the password
- **WHEN** the admin enters a new password and submits
- **THEN** `PUT /users/:id` is called with a request body containing only the `password` field (no `username`, no `role`)

#### Scenario: Empty password is rejected by Zod
- **WHEN** the admin submits the reset dialog with an empty password
- **THEN** a `.bo-field-error` reading "La password è obbligatoria" appears and no API call is made

### Requirement: Delete user with ConfirmDialog
Each table row SHALL expose a delete action (icon button). Clicking it SHALL open a PrimeNG `<p-confirmdialog>` with message: "Questa azione eliminerà l'utente. L'operazione non è reversibile." and severity `danger`. If the admin confirms, `DELETE /users/:id` is called. On success, the user is removed from the list.

#### Scenario: Confirmation dialog appears before delete
- **WHEN** the admin clicks the delete action on a row
- **THEN** a ConfirmDialog appears with the warning message before any API call is made

#### Scenario: Confirmed delete removes the user
- **WHEN** the admin confirms the deletion
- **THEN** `DELETE /users/:id` is called and the row disappears from the list

#### Scenario: Cancelled delete takes no action
- **WHEN** the admin clicks Cancel in the ConfirmDialog
- **THEN** no API call is made and the user remains in the list

### Requirement: User detail page renders username, role, and (for players) the assignments panel
The `/users/:id` route SHALL render a user detail page showing the user's **Nome utente**, **Ruolo** badge, and (for player users only) the **Campagne assegnate** panel defined by the `campaign-player-assignments` capability. For admin users the assignments panel SHALL be replaced by a short notice "Gli amministratori hanno accesso implicito a tutte le campagne." The page SHALL load the user via `GET /users/:id`. The page SHALL be subject to the auth guard.

#### Scenario: Player detail shows the assignments panel
- **WHEN** the admin navigates to `/users/:id` for a user whose role is `player`
- **THEN** the page renders the username, the `player` badge, and the `<app-user-campaigns-panel>` component

#### Scenario: Admin detail hides the assignments panel
- **WHEN** the admin navigates to `/users/:id` for a user whose role is `admin`
- **THEN** the page renders the username, the `admin` badge, and a notice "Gli amministratori hanno accesso implicito a tutte le campagne." instead of the assignments panel

#### Scenario: Role change updates the detail page immediately
- **WHEN** the admin changes a user's role from `player` to `admin` via the edit dialog while on the user detail page (or after navigating to it)
- **THEN** on next render the assignments panel disappears and the admin notice appears (or vice versa for `admin → player`)

#### Scenario: Detail page is guarded
- **WHEN** an unauthenticated user navigates directly to `/users/:id`
- **THEN** the auth guard redirects them to `/login`
