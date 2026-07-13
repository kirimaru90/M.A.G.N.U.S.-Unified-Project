## MODIFIED Requirements

### Requirement: Signal-based AuthService exposes session state
The application SHALL provide an `AuthService` exposing the session as Signals: `isAuthenticated: Signal<boolean>`, `currentUser: Signal<User | null>`, and `token: Signal<string | null>`. The signals MUST update synchronously when login, session restore, or logout occurs so that bound templates and guards react without manual change detection.

`currentUser` — including the user's `role` — SHALL be populated by the login flow itself, not merely by a later session restore. Because the `POST /auth/login` response body does not carry a full user object (it returns the bearer token and the role scalar, not a `user`), the login flow SHALL hydrate `currentUser` by fetching `GET /auth/me` after the token is stored, before `login(...)` resolves.

#### Scenario: Signals reflect a successful login
- **WHEN** `AuthService.login(...)` completes successfully against the API
- **THEN** `token()` returns the issued JWT string, `currentUser()` returns the authenticated user object (including its `role`) hydrated by the login flow, and `isAuthenticated()` returns `true`

#### Scenario: Signals reflect logout
- **WHEN** `AuthService.logout()` is called
- **THEN** `token()` returns `null`, `currentUser()` returns `null`, and `isAuthenticated()` returns `false`

## ADDED Requirements

### Requirement: Role-gated UI is available immediately after login
After a successful `POST /auth/login`, role-gated UI SHALL render correctly **without** requiring a page reload or a subsequent navigation — in particular the sidebar **Catalogo** section (admin-only) SHALL appear immediately for an admin user. To guarantee this, `AuthService.login()` SHALL ensure `currentUser` is fully hydrated (with `role`) before it resolves, by fetching `GET /auth/me` as part of the login flow, since the login response body does not include the user's role in a `currentUser`-shaped object.

The typed login response model SHALL match the real API wire shape and SHALL NOT declare a `user` field the backend does not send; the full user object is obtained from `GET /auth/me`.

#### Scenario: Admin sees Catalogo immediately after login
- **GIVEN** the API `POST /auth/login` returns `{ accessToken, role }` (no `user` object) and `GET /auth/me` returns the full admin user
- **WHEN** an admin logs in and is navigated to the landing route
- **THEN** `currentUser()?.role` is `"admin"` and the sidebar **Catalogo** section is rendered, with no page refresh required

#### Scenario: Non-admin does not see Catalogo after login
- **GIVEN** `GET /auth/me` returns a user whose `role` is not `"admin"`
- **WHEN** that user logs in
- **THEN** `currentUser()` is populated but the sidebar **Catalogo** section is not rendered

#### Scenario: Login response type matches the wire shape (no phantom user)
- **WHEN** inspecting the login response type in the API client
- **THEN** it declares only the fields the API actually returns (`accessToken`, and the role/expiry scalars) and does NOT declare a `user` object, so `currentUser` is never set from an undefined `response.user`
