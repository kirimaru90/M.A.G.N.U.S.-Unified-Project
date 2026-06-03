## MODIFIED Requirements

### Requirement: Placeholder routes for /campaigns and /users
The router SHALL define routes for `/campaigns` and `/users` that render the slice features owned by the `campaigns-crud` and `users-crud` capabilities respectively. The `/users` route SHALL render the full `UsersPage` component (no longer a placeholder heading); the `/campaigns` route continues to render the campaigns list owned by `campaigns-crud`. Both routes SHALL be subject to the auth guard.

#### Scenario: /campaigns renders the campaigns list
- **WHEN** an authenticated user navigates to `/campaigns`
- **THEN** the route renders the campaigns list page (`campaigns-crud` capability)

#### Scenario: /users renders the users list
- **WHEN** an authenticated user navigates to `/users`
- **THEN** the route renders the `UsersPage` component (users list table) — not a placeholder heading

#### Scenario: Routes are guarded
- **WHEN** an unauthenticated user navigates directly to `/campaigns` or `/users`
- **THEN** the auth guard redirects them to `/login`
