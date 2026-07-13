## RENAMED Requirements

- FROM: `### Requirement: Topbar shows logo, breadcrumbs, campaign workspace switcher, version, theme toggle, user chip, and logout`
- TO: `### Requirement: Topbar shows logo, breadcrumbs, version, theme toggle, user chip, and logout`

## MODIFIED Requirements

### Requirement: Topbar shows logo, breadcrumbs, version, theme toggle, user chip, and logout
The topbar SHALL be 44 px tall and follow the `.bo-topbar` chrome. It SHALL render, left-to-right: the `.bo-logo` mark + wordmark, `.bo-crumbs` (static crumb "Backoffice"), and a `.bo-topbar-right` group containing the application version string, a sun/moon theme-toggle button, a `.bo-user-chip` displaying the current user's identifier, and a logout control. The topbar SHALL NOT contain the campaign workspace switcher — campaign selection is now an in-page control on campaign-dependent pages (see `cms-campaign-workspace-switcher`). Activating the logout control SHALL invoke `AuthService.logout()` and navigate to `/login`.

#### Scenario: Topbar shows the current user
- **WHEN** an authenticated user is on any shell-rendering route
- **THEN** the `.bo-user-chip` in the topbar displays the value of `currentUser().username`

#### Scenario: Topbar exposes a theme toggle
- **WHEN** an authenticated user is on any shell-rendering route
- **THEN** the topbar renders an icon button showing the sun glyph in dark mode and the moon glyph in light mode, and activating it calls `ThemeService.toggle()`

#### Scenario: Logout control triggers logout
- **WHEN** the user activates the logout control in the topbar
- **THEN** `AuthService.logout()` is invoked, auth state is cleared, and the router navigates to `/login`

#### Scenario: Topbar does not contain the campaign switcher
- **WHEN** an authenticated user is on any shell-rendering route
- **THEN** the topbar renders no campaign workspace switcher between `.bo-crumbs` and `.bo-topbar-right`
