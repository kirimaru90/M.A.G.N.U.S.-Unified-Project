## REMOVED Requirements

### Requirement: JWT is persisted in localStorage
**Reason**: Persistence now depends on the user's "Ricordami" choice instead of always using `localStorage`.
**Migration**: Replaced by "JWT is persisted according to the Ricordami choice". The storage key is unchanged, so a token already in `localStorage` keeps being read and restored until it expires; no client-side migration is needed.

## ADDED Requirements

### Requirement: JWT is persisted according to the Ricordami choice
On successful login the JWT bearer token SHALL be persisted under the documented key in `localStorage` when the user checked "Ricordami", and in `sessionStorage` otherwise. At most one of the two stores SHALL hold the token at any time: writing to one store SHALL remove the key from the other. When reading the token (on construction and before attaching it to requests), the service SHALL read `localStorage` first and fall back to `sessionStorage`. Logout and 401-driven clearing SHALL remove the key from both stores.

#### Scenario: Remembered login uses localStorage
- **WHEN** the user logs in successfully with "Ricordami" checked
- **THEN** `localStorage` contains the token under the documented key and `sessionStorage` does not

#### Scenario: Non-remembered login uses sessionStorage
- **WHEN** the user logs in successfully with "Ricordami" unchecked
- **THEN** `sessionStorage` contains the token under the documented key and `localStorage` does not

#### Scenario: Token is removed on logout
- **WHEN** the user logs out
- **THEN** the token key is absent from both `localStorage` and `sessionStorage`

#### Scenario: Token is removed when session is cleared by a 401
- **WHEN** any API call returns `401` and triggers session clearing
- **THEN** the token key is absent from both `localStorage` and `sessionStorage`

## MODIFIED Requirements

### Requirement: Session is restored on app start via GET /auth/me
On application bootstrap, if a token is present in `localStorage` or `sessionStorage`, the application SHALL call `GET /auth/me` to validate the token and rehydrate `currentUser`. If the call succeeds, the user is treated as authenticated; if it fails with `401`, the session is cleared and the user is treated as unauthenticated.

#### Scenario: Successful restore
- **WHEN** the app starts with a valid token in `localStorage`
- **THEN** `AuthService` calls `GET /auth/me`, populates `currentUser` from the response, and `isAuthenticated()` is `true` before any guarded route resolves

#### Scenario: Successful restore from sessionStorage
- **WHEN** the app reloads in the same tab with a valid token only in `sessionStorage`
- **THEN** `AuthService` calls `GET /auth/me`, populates `currentUser`, and `isAuthenticated()` is `true`

#### Scenario: Restore is rejected
- **WHEN** the app starts with an invalid or expired token in either store
- **THEN** `GET /auth/me` responds `401`, the session is cleared, the token is removed from both stores, and `isAuthenticated()` is `false`

#### Scenario: No token present
- **WHEN** the app starts with no token in either store
- **THEN** no `GET /auth/me` call is issued and `isAuthenticated()` is `false`

### Requirement: 401 responses clear auth state and redirect to /login
The HTTP interceptor SHALL detect `401 Unauthorized` responses from API calls, clear the auth session (token, user, and the token key in both `localStorage` and `sessionStorage`), and navigate the user to `/login`. The application SHALL NOT enter a redirect loop on the login route itself.

#### Scenario: 401 on a guarded API call
- **WHEN** an API call returns `401` while the user is on a guarded route
- **THEN** the auth state is cleared and the router navigates to `/login`

#### Scenario: 401 from the login endpoint does not redirect
- **WHEN** `POST /auth/login` returns `401` for bad credentials
- **THEN** the auth state remains unchanged (the user was never authenticated), the user remains on `/login`, and the login form surfaces an error

### Requirement: Login screen with plain admin aesthetic
The application SHALL provide a `/login` route rendering a `.bo-*` admin form — a `.bo-card` containing a Reactive Form using `.bo-input` controls and a `.bo-btn.primary` submit — with username and password inputs, a "Ricordami" checkbox (unchecked by default), and a submit button. Submitting SHALL send `rememberMe` equal to the checkbox state in the `POST /auth/login` body. On successful submit, the user SHALL be navigated to `/campaigns`. On failed submit (`401` from `/auth/login`), the form SHALL display an inline error message and the user SHALL remain on `/login`. The visual style MUST be the `.bo-*` admin aesthetic — it SHALL NOT use the Fallout/CRT (`.bo-crt`) terminal styling reserved for the player-facing Terminal app.

#### Scenario: Successful login navigates to /campaigns
- **WHEN** the user submits the login form with credentials that the API accepts
- **THEN** auth state is populated and the router navigates to `/campaigns`

#### Scenario: Ricordami is sent with the login request
- **WHEN** the user checks "Ricordami" and submits the form
- **THEN** the `POST /auth/login` body contains `rememberMe: true`

#### Scenario: Ricordami defaults to unchecked
- **WHEN** the login screen is first rendered
- **THEN** the "Ricordami" checkbox is unchecked and submitting without touching it sends `rememberMe: false`

#### Scenario: Failed login surfaces an error
- **WHEN** the user submits the login form with credentials the API rejects (`401`)
- **THEN** the form displays an inline error message and the user remains on `/login`

#### Scenario: No CRT styling
- **WHEN** inspecting the login screen's rendered styles
- **THEN** it uses the `.bo-*` admin styling (a `.bo-card` with `.bo-input` controls and a `.bo-btn.primary` submit) without the green-on-black scanline/glow effects used by the Terminal player app
