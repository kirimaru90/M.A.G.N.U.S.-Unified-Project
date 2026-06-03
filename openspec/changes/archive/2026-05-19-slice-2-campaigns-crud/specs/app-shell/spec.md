## MODIFIED Requirements

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
