## ADDED Requirements

### Requirement: Authenticated app shell with bo-* topbar, sidebar, and content area
For authenticated users, the application SHALL render an app shell composed of `.bo-topbar`, `.bo-sidebar` (inside a `.bo-body` flex container), and a `<main class="bo-main">` containing `.bo-page-header` and `.bo-content` with the router outlet. The shell SHALL NOT render on the `/login` route — `/login` renders directly inside `.bo-frame` without `.bo-topbar` or `.bo-sidebar`.

#### Scenario: Shell renders on authenticated routes
- **WHEN** an authenticated user is on `/campaigns` (or any other authenticated route)
- **THEN** `.bo-topbar`, `.bo-sidebar`, and the `.bo-content` router outlet are all visible inside `.bo-frame`

#### Scenario: Shell does not render on /login
- **WHEN** any user is on `/login`
- **THEN** only the login form (inside `.bo-frame`) is shown — no `.bo-topbar` and no `.bo-sidebar`

### Requirement: Topbar shows logo, breadcrumbs, campaign workspace switcher, version, theme toggle, user chip, and logout
The topbar SHALL be 44 px tall and follow the `.bo-topbar` chrome. It SHALL render, left-to-right: the `.bo-logo` mark + wordmark, `.bo-crumbs` (static crumb "Backoffice"), a `<app-campaign-workspace-switcher>` PrimeNG Select dropdown (see `campaign-workspace-switcher` spec), and a `.bo-topbar-right` group containing the application version string, a sun/moon theme-toggle button, a `.bo-user-chip` displaying the current user's identifier, and a logout control. Activating the logout control SHALL invoke `AuthService.logout()` and navigate to `/login`.

#### Scenario: Topbar shows the current user
- **WHEN** an authenticated user is on any shell-rendering route
- **THEN** the `.bo-user-chip` in the topbar displays the value of `currentUser().username`

#### Scenario: Topbar exposes a theme toggle
- **WHEN** an authenticated user is on any shell-rendering route
- **THEN** the topbar renders an icon button showing the sun glyph in dark mode and the moon glyph in light mode, and activating it calls `ThemeService.toggle()`

#### Scenario: Logout control triggers logout
- **WHEN** the user activates the logout control in the topbar
- **THEN** `AuthService.logout()` is invoked, auth state is cleared, and the router navigates to `/login`

#### Scenario: Campaign workspace switcher is present in the topbar
- **WHEN** an authenticated user is on any shell-rendering route
- **THEN** the topbar renders the `<app-campaign-workspace-switcher>` component between `.bo-crumbs` and `.bo-topbar-right`

### Requirement: Sidebar exposes section-labelled nav for Campaigns and Users (no campaign-switch stub)
The sidebar SHALL be 200 px wide (`flex: 0 0 200px`) and follow the `.bo-sidebar` chrome. It SHALL contain, top-to-bottom: a `CAMPAGNA` section label followed by a `.bo-nav` link to `/campaigns`, and a `SISTEMA` section label followed by a `.bo-nav` link to `/users`. The `.bo-campaign-switch` placeholder card from Slice 1 SHALL be removed — the campaign workspace switcher is now in the topbar. The active nav entry SHALL render with the `.bo-nav a.active` styling.

#### Scenario: Sidebar no longer contains the campaign-switch stub
- **WHEN** the shell is rendered
- **THEN** the sidebar does NOT contain any `.bo-campaign-switch` element — only the section labels and nav links

#### Scenario: Sidebar contains the two nav entries with section labels
- **WHEN** the shell is rendered
- **THEN** the sidebar shows a `CAMPAGNA` section label followed by a nav entry routing to `/campaigns`, and a `SISTEMA` section label followed by a nav entry routing to `/users`

#### Scenario: Active item is highlighted
- **WHEN** the user is on `/campaigns`
- **THEN** the Campaigns sidebar entry has the `active` class applied and displays the accent-bar + accent-soft background

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

### Requirement: Root redirects to a sensible default
The router SHALL redirect the root path `/` to `/campaigns` for authenticated users; unauthenticated users SHALL be redirected to `/login` by the auth guard.

#### Scenario: Authenticated root redirect
- **WHEN** an authenticated user navigates to `/`
- **THEN** the router redirects to `/campaigns`

#### Scenario: Unauthenticated root redirect
- **WHEN** an unauthenticated user navigates to `/`
- **THEN** the auth guard ultimately lands them on `/login`

### Requirement: Login screen uses the bo-* admin aesthetic
The `/login` route SHALL render a `.bo-card` containing a Reactive Form using `.bo-input` controls and a `.bo-btn.primary` submit. It SHALL NOT use the `.bo-crt` aesthetic — that style is reserved for the player-facing Terminal app. User-facing copy SHALL be Italian (e.g., `ACCEDI`, `Nome utente`, `Password`, `Credenziali non valide`). On a failed login (`401`), the form SHALL render an inline `.bo-pill.danger` error message.

#### Scenario: Login form renders inside a bo-card
- **WHEN** a user navigates to `/login`
- **THEN** the page renders a `.bo-card` containing two `.bo-field` blocks (with `.bo-input` controls for `Nome utente` and `Password`) and a `.bo-btn.primary` submit button labelled `Accedi`

#### Scenario: Login does not use the CRT aesthetic
- **WHEN** inspecting the login page template and styles
- **THEN** no `.bo-crt` class is applied, and the page does NOT exhibit the dark phosphor / scanline overlay

#### Scenario: Failed login surfaces a bo-pill.danger error
- **WHEN** the login API responds `401` (e.g., empty password against the MSW mock)
- **THEN** the form renders an inline `.bo-pill.danger` element containing the text `Credenziali non valide` and the user stays on `/login`

