## ADDED Requirements

### Requirement: Authenticated app shell with bo-* topbar, sidebar, and content area
For authenticated users, the application SHALL render an app shell composed of `.bo-topbar`, `.bo-sidebar` (inside a `.bo-body` flex container), and a `<main class="bo-main">` containing `.bo-page-header` and `.bo-content` with the router outlet. The shell SHALL NOT render on the `/login` route — `/login` renders directly inside `.bo-frame` without `.bo-topbar` or `.bo-sidebar`.

#### Scenario: Shell renders on authenticated routes
- **WHEN** an authenticated user is on `/campaigns` (or any other authenticated route)
- **THEN** `.bo-topbar`, `.bo-sidebar`, and the `.bo-content` router outlet are all visible inside `.bo-frame`

#### Scenario: Shell does not render on /login
- **WHEN** any user is on `/login`
- **THEN** only the login form (inside `.bo-frame`) is shown — no `.bo-topbar` and no `.bo-sidebar`

### Requirement: Topbar shows logo, breadcrumbs, version, theme toggle, user chip, and logout
The topbar SHALL be 44 px tall and follow the `.bo-topbar` chrome from `reference/design/Implementation Reference.md` §2.1. It SHALL render, left-to-right: the `.bo-logo` mark + wordmark, `.bo-crumbs` (may be a single static crumb in this slice), and a `.bo-topbar-right` group containing the application version string, a sun/moon theme-toggle button (`.bo-btn.icon` calling `ThemeService.toggle()`), and a `.bo-user-chip` displaying the current authenticated user's identifier with an adjacent or in-chip logout control. Activating the logout control SHALL invoke `AuthService.logout()`.

#### Scenario: Topbar shows the current user
- **WHEN** an authenticated user is on any shell-rendering route
- **THEN** the `.bo-user-chip` in the topbar displays the value of `currentUser().username` (or the equivalent identifier from the user DTO)

#### Scenario: Topbar exposes a theme toggle
- **WHEN** an authenticated user is on any shell-rendering route
- **THEN** the topbar renders an icon button showing the sun glyph in dark mode and the moon glyph in light mode, and activating it calls `ThemeService.toggle()` which updates `.bo-frame[data-theme]` immediately

#### Scenario: Logout control triggers logout
- **WHEN** the user activates the logout control in the topbar
- **THEN** `AuthService.logout()` is invoked, auth state is cleared, and the router navigates to `/login`

### Requirement: Sidebar exposes the campaign-switcher stub and section-labelled nav for Campaigns and Users
The sidebar SHALL be 200 px wide (`flex: 0 0 200px`) and follow the `.bo-sidebar` chrome from `reference/design/Implementation Reference.md` §2.1. It SHALL contain, top-to-bottom: a `.bo-campaign-switch` card (rendered as a non-interactive placeholder in this slice — no popover behaviour), a `CAMPAGNA` section label followed by a `.bo-nav` link to `/campaigns`, and a `SISTEMA` section label followed by a `.bo-nav` link to `/users`. The active nav entry SHALL render with the `.bo-nav a.active` styling (accent-soft background, accent-text colour, 2-px accent left bar via `::before`).

#### Scenario: Sidebar contains the campaign-switcher stub
- **WHEN** the shell is rendered
- **THEN** the sidebar shows a `.bo-campaign-switch` element containing a `CAMPAGNA` kicker and a placeholder name; clicking it has no effect in this slice

#### Scenario: Sidebar contains the two placeholder nav entries with section labels
- **WHEN** the shell is rendered
- **THEN** the sidebar shows a `CAMPAGNA` section label followed by a nav entry routing to `/campaigns`, and a `SISTEMA` section label followed by a nav entry routing to `/users`

#### Scenario: Active item is highlighted
- **WHEN** the user is on `/campaigns`
- **THEN** the Campaigns sidebar entry has the `active` class applied (via `routerLinkActive`) and displays the accent-bar + accent-soft background

### Requirement: Placeholder routes for /campaigns and /users
The router SHALL define routes for `/campaigns` and `/users` that render a minimal placeholder component (heading only) inside `.bo-content` in this slice. These routes SHALL be subject to the auth guard.

#### Scenario: /campaigns renders a placeholder heading
- **WHEN** an authenticated user navigates to `/campaigns`
- **THEN** the route renders a placeholder component containing only a heading (e.g., `<h1>Campagne</h1>`) inside `.bo-content`

#### Scenario: /users renders a placeholder heading
- **WHEN** an authenticated user navigates to `/users`
- **THEN** the route renders a placeholder component containing only a heading (e.g., `<h1>Utenti</h1>`) inside `.bo-content`

#### Scenario: Placeholder routes are guarded
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

### Requirement: CurrentCampaignService signal is stubbed
The application SHALL provide a `CurrentCampaignService` exposing a `currentCampaign` Signal (defaulting to `null`) and `setCurrent` / `clear` methods. This service is consumed by later slices; in this slice no UI binds to it (the `.bo-campaign-switch` placeholder may read it for display but does not write to it).

#### Scenario: Service is injectable and default state is null
- **WHEN** any component injects `CurrentCampaignService`
- **THEN** `currentCampaign()` returns `null` until `setCurrent(...)` is called

#### Scenario: setCurrent updates the signal
- **WHEN** `setCurrent(campaign)` is called with a campaign object
- **THEN** `currentCampaign()` returns that campaign until `clear()` is called or another `setCurrent` replaces it
