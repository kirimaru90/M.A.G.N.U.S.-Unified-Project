## MODIFIED Requirements

### Requirement: Bearer-token session lifecycle
The Terminal SHALL manage a real-user session as a bearer token. `POST /auth/login` with `{ username, password, rememberMe }` SHALL, on success, return a token and the authenticated user; the client SHALL store the token under a single well-known key in `localStorage` when the user chose "Ricordami", and in `sessionStorage` otherwise, removing the key from the other store so that at most one store holds it. The client SHALL hold the current user in memory. When reading the token, the session module SHALL read `localStorage` first and fall back to `sessionStorage`. Logout SHALL call `POST /auth/logout` and then clear the key from both stores and the in-memory user. A session module SHALL be the single owner of this state, exposing the current token, the current user, and `isAuthenticated()`.

#### Scenario: Successful remembered login stores the credential in localStorage
- **WHEN** the user logs in with "Ricordami" enabled and `POST /auth/login` returns a token
- **THEN** the session module SHALL persist the token in `localStorage` and SHALL NOT keep it in `sessionStorage`
- **THEN** `isAuthenticated()` SHALL return true and the current user SHALL be available

#### Scenario: Successful non-remembered login stores the credential in sessionStorage
- **WHEN** the user logs in with "Ricordami" disabled and `POST /auth/login` returns a token
- **THEN** the session module SHALL persist the token in `sessionStorage` and SHALL NOT keep it in `localStorage`

#### Scenario: Logout clears the credential
- **WHEN** the user logs out
- **THEN** the client SHALL call `POST /auth/logout`
- **THEN** the stored token SHALL be removed from both `localStorage` and `sessionStorage` and the in-memory user cleared
- **THEN** `isAuthenticated()` SHALL return false

#### Scenario: Logout clears the credential even if the server call fails
- **WHEN** the user logs out and `POST /auth/logout` fails (network or HTTP error)
- **THEN** the client SHALL still remove the stored token from both stores and clear the in-memory user, returning to the anonymous state

### Requirement: Session rehydration on app load
On load, if a credential is present in `localStorage` or `sessionStorage`, the Terminal SHALL call `GET /auth/me` to confirm the session before treating the user as authenticated. A successful response SHALL hydrate the in-memory current user and the campaign list SHALL be fetched in authenticated mode. An invalid or expired credential SHALL be cleared silently from both stores and the app SHALL fall back to the anonymous view; no error SHALL be shown for this case.

#### Scenario: Valid stored credential rehydrates the session
- **WHEN** the app loads with a token in `sessionStorage` and `GET /auth/me` succeeds
- **THEN** the current user SHALL be hydrated from the response
- **THEN** the campaign-selection screen SHALL fetch and render campaigns in authenticated mode (public + assigned)

#### Scenario: Remembered credential survives closing the app
- **WHEN** the user logged in with "Ricordami", closed the window, and opens the app again
- **THEN** the token SHALL be found in `localStorage` and `GET /auth/me` SHALL be issued with it
- **THEN** on success the user SHALL be authenticated without seeing the login screen

#### Scenario: Expired stored credential falls back to anonymous
- **WHEN** the app loads with a stored token and `GET /auth/me` responds `401`
- **THEN** the client SHALL remove the stored token from both stores
- **THEN** the campaign-selection screen SHALL render the anonymous (public-only) view
- **THEN** no error message SHALL be shown to the user

### Requirement: Real-user login screen in CRT aesthetic
The Terminal SHALL provide a real-user login screen, presented inline on (or as a navigable sub-screen of) the campaign-selection screen, that collects a username and password and submits them to `POST /auth/login`. The screen SHALL include a "Ricordami" toggle rendered in the CRT aesthetic as a choice button showing its state (`[ ] RICORDAMI` / `[X] RICORDAMI`), reachable through the existing keyboard navigation and toggled by activation (click or Enter). The toggle SHALL be off each time the screen is shown. The screen SHALL adopt the existing CRT aesthetic and keyboard navigation. It SHALL be visually and functionally distinct from the in-narrative fictional login. The screen SHALL provide a way to cancel and return to the campaign list without authenticating.

#### Scenario: Accedi opens the login screen
- **WHEN** the user activates `[ Accedi ]`
- **THEN** the real-user login screen SHALL be shown in the CRT aesthetic with username and password fields and the `[ ] RICORDAMI` toggle off

#### Scenario: Toggling Ricordami
- **WHEN** the user navigates to the "Ricordami" toggle with the keyboard and presses Enter
- **THEN** the toggle SHALL show `[X] RICORDAMI`, and activating it again SHALL show `[ ] RICORDAMI`

#### Scenario: Submitting credentials calls the login endpoint
- **WHEN** the user enters a username and password and submits
- **THEN** the client SHALL issue `POST /auth/login` with `{ username, password, rememberMe }`, where `rememberMe` reflects the toggle state

#### Scenario: Cancel returns to the campaign list
- **WHEN** the user cancels the login screen without authenticating
- **THEN** the campaign-selection screen SHALL be shown again in its anonymous state with the credential unchanged (still none)
