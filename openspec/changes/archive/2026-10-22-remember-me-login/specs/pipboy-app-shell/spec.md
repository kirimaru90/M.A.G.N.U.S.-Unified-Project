## MODIFIED Requirements

### Requirement: Real-user login only

The app SHALL authenticate exclusively against the existing `api-auth` real-user login endpoint (username/password → JWT), storing the session client-side the same way `apps/terminal` does: the login form SHALL offer a "Ricordami" checkbox (unchecked by default) styled in the Pip-Boy aesthetic; the request SHALL send `rememberMe` equal to its state; the token SHALL be stored in `localStorage` when checked and in `sessionStorage` otherwise, with the key removed from the other store; reads SHALL prefer `localStorage` and fall back to `sessionStorage`; logout and any session clearing (including a `401` on rehydrate or resume re-verification) SHALL remove the key from both stores. The app SHALL NOT implement or expose any fictional/local-account login (that concept belongs to terminal content, not to character management).

#### Scenario: Successful login
- **WHEN** a user submits a valid username/password
- **THEN** the app stores the returned JWT and proceeds to campaign selection (or the last-used defaults, per below)

#### Scenario: Remembered login survives closing the installed app
- **WHEN** a user logs in with "Ricordami" checked, closes the app, and reopens it
- **THEN** the token is read from `localStorage`, `GET /auth/me` succeeds, and the user lands past the login screen without re-entering credentials

#### Scenario: Non-remembered login is forgotten on close
- **WHEN** a user logs in with "Ricordami" unchecked
- **THEN** the token is stored only in `sessionStorage` and `localStorage` holds no token

#### Scenario: Ricordami is sent with the login request
- **WHEN** a user checks "Ricordami" and submits the form
- **THEN** the `POST /auth/login` body contains `rememberMe: true`

#### Scenario: Logout clears both stores
- **WHEN** an authenticated user logs out
- **THEN** `POST /auth/logout` is called and the token key is absent from both `localStorage` and `sessionStorage`

#### Scenario: Invalid credentials
- **WHEN** a user submits an incorrect username/password
- **THEN** the app displays an Italian, terminal-voiced error and does not proceed
