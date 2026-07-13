## MODIFIED Requirements

### Requirement: Users list page displays all users in a PrimeNG table
The `/users` route SHALL render a PrimeNG `<p-table>` listing all users returned by `GET /users`. The table SHALL include columns: **Nome utente** (`username`), **Ruolo** (`role` shown as an `admin` / `player` badge), and **Azioni** (row action buttons: edit, reset password, delete). Both admin and player users SHALL appear in the same list. Every data column SHALL be sortable, and on load the table SHALL default to **ascending alphabetical order by `username`**. The page SHALL display a loading state while the request is in flight and an empty-state message when the list is empty. The "Nuovo utente" action SHALL appear in the page-head row aligned right (see `cms-backoffice-table-conventions`).

#### Scenario: List loads and displays users
- **WHEN** an authenticated admin navigates to `/users`
- **THEN** the table renders one row per user returned by `GET /users`, showing username, role badge, and the three row action buttons

#### Scenario: List defaults to alphabetical order by username
- **WHEN** the users list first renders
- **THEN** the rows are ordered ascending alphabetically by `username`

#### Scenario: Empty state message
- **WHEN** `GET /users` returns an empty array
- **THEN** the table shows an empty-state message (e.g., "Nessun utente trovato") instead of rows

#### Scenario: Loading state during fetch
- **WHEN** the request to `GET /users` is in flight
- **THEN** the table renders a loading indicator (PrimeNG table skeleton or spinner)

#### Scenario: Username links to user detail page
- **WHEN** the admin clicks the username cell of a row
- **THEN** the router navigates to `/users/:id` for that user
