## ADDED Requirements

### Requirement: Responsive fullscreen shell
`apps/pip-boy` SHALL fill the available viewport in every supported orientation (mobile portrait,
mobile landscape, and desktop/wide landscape), SHALL confine all scrolling to the terminal's own
content pane (`.pb-screen-content`) rather than the page, and SHALL render `.pb-case` at a size that
depends only on viewport size and orientation — never on which screen (`login` / `campaign-select` /
`character-select` / `sheet`) is mounted.

#### Scenario: Mobile portrait fills the viewport
- **WHEN** the app loads on a mobile-sized viewport in portrait orientation
- **THEN** `.pb-case` occupies the full available viewport height and width (within its designed
  margin), with no dead gap left by stale `vh` sizing and no page-level scrollbar

#### Scenario: Mobile or desktop landscape fills the viewport
- **WHEN** the viewport is in landscape orientation (device rotation or a wide desktop window)
- **THEN** `.pb-case` widens beyond its portrait-shaped bound to fill the available landscape
  viewport, rather than remaining fixed at its portrait `max-width`

#### Scenario: Scrolling stays inside the terminal screen
- **WHEN** any screen's content is taller than `.pb-screen-content`'s visible area
- **THEN** only `.pb-screen-content` scrolls; `html`/`body` never produce a page-level scrollbar

#### Scenario: Case size is constant across screens
- **GIVEN** a fixed viewport size and orientation
- **WHEN** the user proceeds from `login` → `campaign-select` → `character-select` → `sheet`
- **THEN** `.pb-case`'s rendered width and height are identical on every one of those screens

#### Scenario: Landscape width regression guard
- **WHEN** `.pb-case`'s rendered width in a landscape viewport is measured
- **THEN** it is meaningfully greater than the fixed `460px` portrait cap, confirming the
  orientation-aware sizing rule is in effect rather than the old fixed-width rule
