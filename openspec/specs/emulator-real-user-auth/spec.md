# emulator-real-user-auth Specification

## Purpose

Real-user bearer-token session lifecycle (login/logout/rehydrate), credential-attaching API client, Accedi/Esci auth actions, post-login campaign refresh, non-leaking errors, and authenticated public/private campaign grouping.

## Requirements

### Requirement: Anonymous campaign view is the default
The Terminal SHALL operate without a real-user session by default. When no session is present, requests SHALL be issued anonymously (no `Authorization` header) and the campaign-selection screen SHALL show only what the server returns for an anonymous request (active public campaigns).

#### Scenario: Fresh load with no stored credential
- **WHEN** the app loads and `sessionStorage` holds no real-user credential
- **THEN** the campaign-selection screen SHALL issue `GET /campaigns` with no `Authorization` header
- **THEN** the screen SHALL render only the public campaigns returned by the server

#### Scenario: Anonymous user sees only public campaigns
- **WHEN** the server is configured with both public and assignment-gated campaigns
- **AND** the client has no session
- **THEN** the rendered campaign list SHALL NOT include any assignment-gated campaign

### Requirement: Bearer-token session lifecycle
The Terminal SHALL manage a real-user session as a bearer token. `POST /auth/login` with `{ username, password }` SHALL, on success, return a token and the authenticated user; the client SHALL store the token in `sessionStorage` under a single well-known key and hold the current user in memory. Logout SHALL call `POST /auth/logout` and then clear the stored token and in-memory user. A session module SHALL be the single owner of this state, exposing the current token, the current user, and `isAuthenticated()`.

#### Scenario: Successful login stores the credential
- **WHEN** `POST /auth/login` returns a token and user object
- **THEN** the session module SHALL persist the token in `sessionStorage`
- **THEN** `isAuthenticated()` SHALL return true and the current user SHALL be available

#### Scenario: Logout clears the credential
- **WHEN** the user logs out
- **THEN** the client SHALL call `POST /auth/logout`
- **THEN** the stored token SHALL be removed from `sessionStorage` and the in-memory user cleared
- **THEN** `isAuthenticated()` SHALL return false

#### Scenario: Logout clears the credential even if the server call fails
- **WHEN** the user logs out and `POST /auth/logout` fails (network or HTTP error)
- **THEN** the client SHALL still remove the stored token and clear the in-memory user, returning to the anonymous state

### Requirement: API client attaches the session credential
The API client wrapper SHALL attach `Authorization: Bearer <token>` to every request when a session token is present, and SHALL omit the header entirely when no session exists. The client SHALL continue to function unchanged (anonymous) when there is no session.

#### Scenario: Authenticated request carries the header
- **WHEN** a session token is present and any `apiGet`/`apiPost` call is made
- **THEN** the request SHALL include the header `Authorization: Bearer <token>`

#### Scenario: Anonymous request omits the header
- **WHEN** no session token is present and any `apiGet`/`apiPost` call is made
- **THEN** the request SHALL NOT include an `Authorization` header

### Requirement: Session rehydration on app load
On load, if a credential is present in `sessionStorage`, the Terminal SHALL call `GET /auth/me` to confirm the session before treating the user as authenticated. A successful response SHALL hydrate the in-memory current user and the campaign list SHALL be fetched in authenticated mode. An invalid or expired credential SHALL be cleared silently and the app SHALL fall back to the anonymous view; no error SHALL be shown for this case.

#### Scenario: Valid stored credential rehydrates the session
- **WHEN** the app loads with a token in `sessionStorage` and `GET /auth/me` succeeds
- **THEN** the current user SHALL be hydrated from the response
- **THEN** the campaign-selection screen SHALL fetch and render campaigns in authenticated mode (public + assigned)

#### Scenario: Expired stored credential falls back to anonymous
- **WHEN** the app loads with a token in `sessionStorage` and `GET /auth/me` responds `401`
- **THEN** the client SHALL remove the stored token
- **THEN** the campaign-selection screen SHALL render the anonymous (public-only) view
- **THEN** no error message SHALL be shown to the user

### Requirement: Accedi / Esci action on campaign selection
The campaign-selection screen SHALL present a single auth action that reflects session state: `[ Accedi ]` when anonymous, `[ Esci ]` when authenticated. The action SHALL be rendered in the status footer at the bottom of the screen, in the established CRT button aesthetic, and SHALL participate in keyboard navigation and the hover selection sound like the other choice buttons. `[ Accedi ]` SHALL open the real-user login UI. `[ Esci ]` SHALL log the user out.

#### Scenario: Anonymous state shows Accedi
- **WHEN** the campaign-selection screen renders with no session
- **THEN** an `[ Accedi ]` action SHALL be present and an `[ Esci ]` action SHALL NOT be present

#### Scenario: Authenticated state shows Esci
- **WHEN** the campaign-selection screen renders with an active session
- **THEN** an `[ Esci ]` action SHALL be present and an `[ Accedi ]` action SHALL NOT be present

#### Scenario: Auth action is keyboard- and pointer-consistent
- **WHEN** the auth action button is rendered
- **THEN** it SHALL be reachable by the existing arrow-key navigation
- **THEN** pointer hover over it SHALL play the selection sound

### Requirement: Real-user login screen in CRT aesthetic
The Terminal SHALL provide a real-user login screen, presented inline on (or as a navigable sub-screen of) the campaign-selection screen, that collects a username and password and submits them to `POST /auth/login`. The screen SHALL adopt the existing CRT aesthetic and keyboard navigation. It SHALL be visually and functionally distinct from the in-narrative fictional login. The screen SHALL provide a way to cancel and return to the campaign list without authenticating.

#### Scenario: Accedi opens the login screen
- **WHEN** the user activates `[ Accedi ]`
- **THEN** the real-user login screen SHALL be shown in the CRT aesthetic with username and password fields

#### Scenario: Submitting credentials calls the login endpoint
- **WHEN** the user enters a username and password and submits
- **THEN** the client SHALL issue `POST /auth/login` with `{ username, password }`

#### Scenario: Cancel returns to the campaign list
- **WHEN** the user cancels the login screen without authenticating
- **THEN** the campaign-selection screen SHALL be shown again in its anonymous state with the credential unchanged (still none)

### Requirement: Campaign list refreshes after login
On a successful login, the Terminal SHALL refresh the campaign list by re-issuing `GET /campaigns` in authenticated mode and re-rendering the campaign-selection screen, so that the player's assigned campaigns appear alongside the public ones without a manual reload. If exactly one campaign is accessible after the refresh, the single-campaign auto-enter behavior of the campaign-selection screen SHALL apply.

#### Scenario: Assigned campaigns appear after login
- **WHEN** login succeeds for a player assigned to one or more campaigns
- **THEN** the client SHALL re-issue `GET /campaigns` with the session credential
- **THEN** the re-rendered list SHALL include the player's assigned campaigns in addition to any public ones

#### Scenario: Authenticated player with no assignments sees only public campaigns
- **WHEN** login succeeds for a player with no assigned campaigns
- **THEN** the re-rendered list SHALL contain only the public campaigns (which may be empty)

### Requirement: Logout returns to the anonymous view
Activating `[ Esci ]` SHALL clear the session and re-render the campaign-selection screen in its anonymous state, re-issuing `GET /campaigns` without a credential so that assigned campaigns are no longer shown and only public campaigns remain.

#### Scenario: Esci hides assigned campaigns
- **WHEN** an authenticated player who can see assigned campaigns activates `[ Esci ]`
- **THEN** the session SHALL be cleared
- **THEN** the campaign-selection screen SHALL re-issue `GET /campaigns` anonymously and render only public campaigns
- **THEN** the `[ Accedi ]` action SHALL be present again

### Requirement: Failed login shows an inline, non-leaking error
On a failed login, the Terminal SHALL show an inline error in the CRT aesthetic and remain on the login screen (the user stays on the campaign-selection flow, not booted back). The error message SHALL be generic — e.g. "credenziali non valide" — and SHALL NOT reveal which field was wrong or whether the username exists. Network/server errors unrelated to credentials MAY use a distinct generic message but SHALL likewise avoid leaking field-level detail.

#### Scenario: Bad credentials produce a generic error
- **WHEN** `POST /auth/login` responds with an authentication failure (e.g. `401`)
- **THEN** the login screen SHALL display a single generic message such as "credenziali non valide"
- **THEN** the message SHALL NOT indicate whether the username or the password was the problem
- **THEN** no session SHALL be created and the user SHALL remain on the login screen able to retry

#### Scenario: User remains anonymous after a failed attempt
- **WHEN** a login attempt fails
- **THEN** `isAuthenticated()` SHALL remain false and no `Authorization` header SHALL be attached to subsequent requests

### Requirement: Public and private campaigns are grouped only when authenticated
When the player is authenticated, the campaign-selection screen SHALL visually distinguish the public campaigns from the private (assignment-gated) campaigns — rendering them as two labelled groups partitioned client-side by the campaign's public-visibility field. When the player is anonymous, no such distinction SHALL be drawn: every visible campaign is public, so the list is rendered as a single undifferentiated group with no public/private labels.

#### Scenario: Authenticated player sees public and private groups
- **WHEN** the campaign-selection screen renders with an active session and the list contains both public and private (assigned) campaigns
- **THEN** the screen SHALL render the public campaigns under a "public" group label and the private campaigns under a "private" group label
- **THEN** each campaign SHALL appear under the group matching its public-visibility field

#### Scenario: Anonymous player sees a single undifferentiated list
- **WHEN** the campaign-selection screen renders with no session
- **THEN** the campaigns SHALL be rendered as one group with no public/private grouping labels

### Requirement: Authenticated campaign selection indicates an empty group
When the player is authenticated, the campaign-selection screen SHALL show an explicit string for each empty group: if there are no public campaigns, a "no public campaigns" string SHALL appear where the public group would be, and if there are no private campaigns, a "no private campaigns" string SHALL appear where the private group would be. This per-group indication is shown only when authenticated; the anonymous view keeps its existing single empty-state message.

#### Scenario: Authenticated player with no public campaigns
- **WHEN** the campaign-selection screen renders with an active session and the list contains no public campaigns
- **THEN** a string indicating that there are no public campaigns SHALL be shown in the public group

#### Scenario: Authenticated player with no private campaigns
- **WHEN** the campaign-selection screen renders with an active session and the list contains no private (assigned) campaigns
- **THEN** a string indicating that there are no private campaigns SHALL be shown in the private group

### Requirement: Accedi / Esci action on terminal selection
The terminal-selection screen SHALL present the same `[ Accedi ]` / `[ Esci ]` auth action as campaign selection, placed in the status footer at the bottom of the screen (below the navigation `[ Indietro ]` action). `[ Accedi ]` SHALL open the real-user login UI; `[ Esci ]` SHALL log the user out. The `[ Indietro ]` navigation action SHALL remain in its place after `[ CARICA ]`, above the footer. After a logout from the terminal-selection screen, if the current campaign is private (not public), the Terminal SHALL exit the campaign and return to the campaign-selection screen, because the now-anonymous player may no longer be authorized for that campaign. If the current campaign is public, the player SHALL remain on the terminal-selection screen, re-rendered in the anonymous state.

#### Scenario: Auth action appears in the footer after navigation
- **WHEN** the terminal-selection screen renders
- **THEN** an `[ Accedi ]` (anonymous) or `[ Esci ]` (authenticated) action SHALL be present in the status footer, ordered after the `[ Indietro ]` navigation action
- **THEN** the action SHALL participate in keyboard navigation as the last focusable element and play the hover selection sound like the other buttons

#### Scenario: Logout from a private campaign exits to campaign selection
- **WHEN** an authenticated player is on the terminal-selection screen of a private campaign and activates `[ Esci ]`
- **THEN** the session SHALL be cleared
- **THEN** the Terminal SHALL leave the campaign and show the campaign-selection screen in its anonymous state

#### Scenario: Logout from a public campaign stays on terminal selection
- **WHEN** an authenticated player is on the terminal-selection screen of a public campaign and activates `[ Esci ]`
- **THEN** the session SHALL be cleared
- **THEN** the terminal-selection screen SHALL remain shown, re-rendered in the anonymous state

### Requirement: Session status footer
The campaign-selection and terminal-selection screens SHALL render a status footer at the bottom of the CRT block that groups the current-user identity with the `[ Accedi ]` / `[ Esci ]` auth action, visually separated from the content above by a divider. The footer SHALL be rendered in both auth states. When authenticated, the auth action SHALL be the destructive logout — visually distinct from the green navigation actions (a color-coded "is-logout" treatment) and labelled as a logout (e.g. `[ Esci — disconnetti utente ]`) — and SHALL expose an accessible label naming the user being disconnected. When anonymous, the auth action SHALL be `[ Accedi ]` in the ordinary (non-destructive) button styling. Navigation actions (such as `[ Indietro ]`) SHALL remain above the footer, not inside it.

#### Scenario: Footer present in both auth states
- **WHEN** either selection screen renders, whether anonymous or authenticated
- **THEN** a status footer SHALL be present at the bottom of the screen containing the current-user identity and the auth action

#### Scenario: Authenticated logout is destructive and distinct
- **WHEN** a selection screen renders with an active session
- **THEN** the footer auth action SHALL be a logout labelled as such (e.g. `[ Esci — disconnetti utente ]`)
- **THEN** it SHALL be styled distinctly from the green navigation actions and SHALL expose an accessible label naming the user

#### Scenario: Navigation stays out of the footer
- **WHEN** the terminal-selection screen renders
- **THEN** the `[ Indietro ]` navigation action SHALL appear above the footer, and the footer SHALL contain only the identity line and the auth action

### Requirement: Current-user indicator on campaign and terminal selection
The campaign-selection and terminal-selection screens SHALL each display a status string identifying the current player within the status footer: the authenticated user's name when a session is active, or an anonymous indicator (e.g. "utente anonimo") when there is no session. The string SHALL update whenever the auth state changes (login, logout, rehydration).

#### Scenario: Authenticated user is named
- **WHEN** either selection screen renders with an active session
- **THEN** the status string SHALL show the current user's name from the session

#### Scenario: Anonymous user is labelled anonymous
- **WHEN** either selection screen renders with no session
- **THEN** the status string SHALL show an anonymous indicator rather than a user name

### Requirement: Terminal-selection user indicator includes the current campaign
On the terminal-selection screen, the current-user status string SHALL additionally include the current campaign (e.g. its name), so the player sees both who they are and which campaign they are in.

#### Scenario: Terminal selection shows user and campaign
- **WHEN** the terminal-selection screen renders
- **THEN** the status string SHALL include both the current-user indicator (named or anonymous) and the current campaign
