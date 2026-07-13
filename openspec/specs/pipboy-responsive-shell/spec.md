# pipboy-responsive-shell Specification

## Purpose

The `apps/pip-boy` shell SHALL fill the available viewport in every supported orientation, confine scrolling to the terminal's own content pane, and size `.pb-case` based only on viewport size and orientation rather than on which screen is mounted.

## Requirements

### Requirement: Responsive fullscreen shell
`apps/pip-boy` SHALL fill the available viewport in every supported orientation (mobile portrait,
mobile landscape, and desktop/wide landscape), SHALL confine all scrolling to the terminal's own
content pane (`.pb-screen-content`) rather than the page, and SHALL render `.pb-case` at a size that
depends only on viewport size and orientation — never on which screen (`login` / `campaign-select` /
`character-select` / `sheet`) is mounted.

`.pb-case` SHALL grow to fill the available viewport width and height, in both portrait and
landscape. There SHALL be no fixed pixel `max-width` or `max-height` cap that leaves the case floating
in dead space on a large viewport (in particular, neither the former `460px` portrait cap nor the
`900px` landscape cap).

The shell SHALL be **safe-area-aware and edge-to-edge**: instead of a fixed uniform page margin, the
outer inset around `.pb-case` SHALL be derived from `env(safe-area-inset-*)` so that when the app runs
fullscreen/standalone the case reaches the physical display edges (truly edge-to-edge where the OS
exposes no inset), while on devices with a notch or home indicator the case and its content stay clear
of those regions. Interactive and textual chrome (status bar, header, footer) SHALL NOT be occluded by
the notch or home indicator. In a normal browser tab, where safe-area insets resolve to zero, a small
uniform fallback margin MAY be applied so the case is not flat against the viewport edge.

#### Scenario: Mobile portrait fills the viewport
- **WHEN** the app loads on a mobile-sized viewport in portrait orientation
- **THEN** `.pb-case` occupies the full available viewport height and width (within any safe-area
  insets), with no dead gap left by stale `vh` sizing and no page-level scrollbar

#### Scenario: Mobile or desktop landscape fills the viewport
- **WHEN** the viewport is in landscape orientation (device rotation or a wide desktop window)
- **THEN** `.pb-case` widens to fill the available landscape viewport rather than remaining fixed at a
  portrait `max-width` or a `900px` landscape cap

#### Scenario: Desktop wide viewport has no dead margin
- **GIVEN** a wide desktop window well beyond `900px`
- **WHEN** the app renders
- **THEN** `.pb-case` fills the viewport minus at most the small uniform fallback margin, with no large
  empty band on either side

#### Scenario: Installed fullscreen reaches the display edges
- **GIVEN** the app is launched fullscreen/standalone on a device that exposes no safe-area inset on a
  given edge
- **WHEN** the shell renders
- **THEN** `.pb-case` reaches that display edge with no fixed page margin holding it back

#### Scenario: Content stays clear of the notch and home indicator
- **GIVEN** a device that reports non-zero `env(safe-area-inset-*)` values (notch and/or home
  indicator)
- **WHEN** the shell renders fullscreen
- **THEN** the status bar, header, and footer content are inset from those regions and remain fully
  visible and tappable

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
