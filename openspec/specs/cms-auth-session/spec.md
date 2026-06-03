## ADDED Requirements

### Requirement: Signal-based AuthService exposes session state
The application SHALL provide an `AuthService` exposing the session as Signals: `isAuthenticated: Signal<boolean>`, `currentUser: Signal<User | null>`, and `token: Signal<string | null>`. The signals MUST update synchronously when login, session restore, or logout occurs so that bound templates and guards react without manual change detection.

#### Scenario: Signals reflect a successful login
- **WHEN** `AuthService.login(...)` completes successfully against the API
- **THEN** `token()` returns the issued JWT string, `currentUser()` returns the user object from the response, and `isAuthenticated()` returns `true`

#### Scenario: Signals reflect logout
- **WHEN** `AuthService.logout()` is called
- **THEN** `token()` returns `null`, `currentUser()` returns `null`, and `isAuthenticated()` returns `false`

### Requirement: JWT is persisted in localStorage
The JWT bearer token SHALL be persisted in `localStorage` under a documented key when the user logs in, and SHALL be removed from `localStorage` when the user logs out or when the session is cleared due to a 401.

#### Scenario: Token persists across login
- **WHEN** the user logs in successfully
- **THEN** `localStorage` contains the token under the documented key

#### Scenario: Token is removed on logout
- **WHEN** the user logs out
- **THEN** the token key is absent from `localStorage`

#### Scenario: Token is removed when session is cleared by a 401
- **WHEN** any API call returns `401` and triggers session clearing
- **THEN** the token key is absent from `localStorage`

### Requirement: Session is restored on app start via GET /auth/me
On application bootstrap, if a token is present in `localStorage`, the application SHALL call `GET /auth/me` to validate the token and rehydrate `currentUser`. If the call succeeds, the user is treated as authenticated; if it fails with `401`, the session is cleared and the user is treated as unauthenticated.

#### Scenario: Successful restore
- **WHEN** the app starts with a valid token in `localStorage`
- **THEN** `AuthService` calls `GET /auth/me`, populates `currentUser` from the response, and `isAuthenticated()` is `true` before any guarded route resolves

#### Scenario: Restore is rejected
- **WHEN** the app starts with an invalid or expired token in `localStorage`
- **THEN** `GET /auth/me` responds `401`, the session is cleared, the token is removed from `localStorage`, and `isAuthenticated()` is `false`

#### Scenario: No token present
- **WHEN** the app starts with no token in `localStorage`
- **THEN** no `GET /auth/me` call is issued and `isAuthenticated()` is `false`

### Requirement: HTTP interceptor attaches the Bearer token
The application SHALL register an Angular `HttpInterceptor` that, for every outbound request to the configured API base URL, attaches `Authorization: Bearer <token>` when a token is present in `AuthService`. Requests issued without a stored token MUST NOT carry an `Authorization` header.

#### Scenario: Token is attached when present
- **WHEN** the client issues any API request and a token is stored
- **THEN** the outgoing request carries `Authorization: Bearer <token>`

#### Scenario: No token, no header
- **WHEN** the client issues an API request and no token is stored
- **THEN** the outgoing request has no `Authorization` header

#### Scenario: Interceptor scope
- **WHEN** the client issues an HTTP request to a URL outside the configured API base URL (e.g., a third-party asset)
- **THEN** no `Authorization` header is attached

### Requirement: 401 responses clear auth state and redirect to /login
The HTTP interceptor SHALL detect `401 Unauthorized` responses from API calls, clear the auth session (token, user, `localStorage`), and navigate the user to `/login`. The application SHALL NOT enter a redirect loop on the login route itself.

#### Scenario: 401 on a guarded API call
- **WHEN** an API call returns `401` while the user is on a guarded route
- **THEN** the auth state is cleared and the router navigates to `/login`

#### Scenario: 401 from the login endpoint does not redirect
- **WHEN** `POST /auth/login` returns `401` for bad credentials
- **THEN** the auth state remains unchanged (the user was never authenticated), the user remains on `/login`, and the login form surfaces an error

### Requirement: Route guard redirects unauthenticated users to /login
The application SHALL provide a functional route guard (e.g., `canActivate`) that allows navigation only when `AuthService.isAuthenticated()` returns `true`; otherwise it SHALL redirect to `/login`. The guard SHALL be applied to all routes except `/login` itself.

#### Scenario: Unauthenticated user is sent to login
- **WHEN** an unauthenticated user navigates to a guarded route (e.g., `/campaigns`)
- **THEN** the router redirects to `/login` and the original route is not rendered

#### Scenario: Authenticated user is allowed through
- **WHEN** an authenticated user navigates to a guarded route
- **THEN** the route activates and renders its component

#### Scenario: Root redirects through the guard
- **WHEN** an unauthenticated user navigates to `/`
- **THEN** the user lands on `/login`

### Requirement: Login screen with plain admin aesthetic
The application SHALL provide a `/login` route rendering a PrimeNG-based form with username and password inputs and a submit button. On successful submit, the user SHALL be navigated to `/campaigns`. On failed submit (`401` from `/auth/login`), the form SHALL display an inline error message and the user SHALL remain on `/login`. The visual style MUST be a plain administrative form — it SHALL NOT use the Fallout/CRT terminal styling reserved for the player-facing Terminal app.

#### Scenario: Successful login navigates to /campaigns
- **WHEN** the user submits the login form with credentials that the API accepts
- **THEN** auth state is populated and the router navigates to `/campaigns`

#### Scenario: Failed login surfaces an error
- **WHEN** the user submits the login form with credentials the API rejects (`401`)
- **THEN** the form displays an inline error message and the user remains on `/login`

#### Scenario: No CRT styling
- **WHEN** inspecting the login screen's rendered styles
- **THEN** it uses standard PrimeNG/Tailwind admin styling without the green-on-black scanline/glow effects used by the Terminal player app

### Requirement: Logout clears state and returns to /login
The application SHALL expose a logout action that calls `POST /auth/logout`, clears all auth state regardless of the HTTP outcome, and navigates to `/login`.

#### Scenario: Logout success
- **WHEN** the user invokes logout and `POST /auth/logout` returns `204`
- **THEN** the token is removed, `currentUser` is `null`, `isAuthenticated()` is `false`, and the router navigates to `/login`

#### Scenario: Logout when the server call fails
- **WHEN** the user invokes logout and `POST /auth/logout` fails (network error or non-204)
- **THEN** the client still clears local auth state and navigates to `/login`

### Requirement: Login response bearer token is read from the `accessToken` field
The client SHALL read the issued JWT bearer token from the `accessToken` field of the `POST /auth/login` response body, and SHALL persist and store that exact value as the session token. The typed login response model SHALL declare the field as `accessToken` so the runtime shape and the static type agree.

#### Scenario: Token is extracted from accessToken
- **WHEN** `POST /auth/login` returns `200` with a body containing `accessToken: "<jwt>"` and a `user` object
- **THEN** `AuthService` persists `<jwt>` to `localStorage` and `token()` returns `<jwt>` (a non-empty string)

#### Scenario: Subsequent request carries the token
- **WHEN** the user has logged in successfully and the client issues any API request to the configured API base URL
- **THEN** the outgoing request carries `Authorization: Bearer <jwt>` using the value taken from `accessToken`

#### Scenario: Login response type matches the wire shape
- **WHEN** inspecting the login response type in the API client
- **THEN** it declares the token field as `accessToken` (not `access_token`), so reading `response.accessToken` typechecks and is defined at runtime
